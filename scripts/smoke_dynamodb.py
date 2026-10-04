"""Smoke test of DynamoDBStore against REAL AWS tables.

    python scripts/smoke_dynamodb.py

Safety rules, enforced in code:
  1. It aborts, touching nothing, if any of the three tables already holds an item.
  2. When it finishes it deletes everything in the tables. Rule 1 guarantees that
     everything there at that point was created by this script.
  3. Never point it at tables that hold real data. It refuses to start if they do.

Needs AWS credentials (aws configure) and boto3. Costs a few dozen requests, effectively nothing.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.ingest.validate import FeederReading, MeterReading  # noqa: E402
from src.store_dynamodb import DynamoDBStore  # noqa: E402

T0 = datetime(2026, 9, 1, 10, 0)
WRITERS = 5


def _count(table) -> int:
    return table.scan(Select="COUNT")["Count"]


def _eventually(fn, seconds: float):
    """The status index is eventually consistent, so poll briefly instead of asserting at once."""
    deadline = time.time() + seconds
    while True:
        value = fn()
        if value or time.time() >= deadline:
            return value
        time.sleep(0.25)


def _flag(**overrides) -> dict:
    base = {
        "rule": "tamper", "subject_type": "meter", "subject_id": "SMOKE-M1", "feeder_id": "SMOKE-F1",
        "period_start": "2026-09-01", "period_end": "2026-09-02", "reason": "smoke test",
        "confidence": 0.9, "evidence": {"smoke": True},
    }
    return {**base, **overrides}


def check_registry(s: DynamoDBStore) -> None:
    s.upsert_feeder("SMOKE-F1", "A")
    s.upsert_meter("SMOKE-M2", "SMOKE-F1")
    s.upsert_meter("SMOKE-M1", "SMOKE-F1")
    assert s.feeders() == [{"feeder_id": "SMOKE-F1", "band": "A"}], s.feeders()
    assert s.meter_ids("SMOKE-F1") == ["SMOKE-M1", "SMOKE-M2"], s.meter_ids("SMOKE-F1")
    assert s.feeder_band("SMOKE-F1") == "A" and s.meter_feeder("SMOKE-M1") == "SMOKE-F1"


def check_readings(s: DynamoDBStore) -> None:
    batch = [
        MeterReading("SMOKE-M1", T0, 0.25, 229.5), MeterReading("SMOKE-M1", T0 + timedelta(minutes=15), 0.3),
        FeederReading("SMOKE-F1", T0, 230.0), FeederReading("SMOKE-F1", T0 + timedelta(minutes=15), 0.0),
    ]
    first = s.save(batch)
    assert (first.accepted, first.duplicates, first.conflicts) == (4, 0, 0), first.as_dict()
    again = s.save(batch)
    assert (again.accepted, again.duplicates, again.conflicts) == (0, 4, 0), again.as_dict()
    clash = s.save([MeterReading("SMOKE-M1", T0, 9.99)])
    assert clash.conflicts == 1 and s.conflict_count() == 1
    end = T0 + timedelta(minutes=15)
    got = s.meter_readings("SMOKE-M1", T0, end)
    assert [(r.timestamp, r.kwh) for r in got] == [(T0, 0.25)], got  # end excluded, first value kept
    assert s.feeder_samples("SMOKE-F1", T0, end + timedelta(minutes=1)) == [(T0, 230.0), (end, 0.0)]
    assert s.reading_range() == (T0, end), s.reading_range()


def check_flags(s: DynamoDBStore, wait: float) -> None:
    assert s.save_flags([_flag(), _flag(subject_id="SMOKE-M2", confidence=0.5)]) == 2
    assert s.save_flags([_flag()]) == 0
    listed = _eventually(lambda: len(s.flags(status="open")) == 2, wait)
    assert listed, "flags never appeared in the status index"
    flags = s.flags()
    assert [f["subject_id"] for f in flags] == ["SMOKE-M1", "SMOKE-M2"], flags
    flag_id = flags[0]["flag_id"]
    assert s.flag(flag_id)["evidence"] == {"smoke": True}
    s.decide_flags([flag_id], "confirmed", "smoke", "checked")
    decided = s.flag(flag_id)  # strongly consistent read
    assert decided["status"] == "confirmed" and decided["decided_by"] == "smoke"
    moved = _eventually(lambda: [f["flag_id"] for f in s.flags(status="confirmed")] == [flag_id], wait)
    assert moved, "decision never reached the status index"


def check_users(s: DynamoDBStore) -> None:
    now = datetime(2026, 10, 1, 12, 0)
    s.add_user("smoke", "hash", "ops", "Smoke Test")
    s.add_session("smoke-ok", "smoke", now + timedelta(hours=1))
    s.add_session("smoke-old", "smoke", now - timedelta(minutes=1))
    assert s.session_user("smoke-ok", now)["username"] == "smoke"
    assert s.session_user("smoke-old", now) is None
    s.delete_session("smoke-ok")
    assert s.session_user("smoke-ok", now) is None


def check_audit(s: DynamoDBStore) -> None:
    for i in range(3):
        s.audit("smoke", f"step{i}", "smoke", {"i": i})
    assert [e["action"] for e in s.audit_entries()] == ["step2", "step1", "step0"]
    assert s.verify_audit_chain() is None


def _clone(s: DynamoDBStore) -> DynamoDBStore:
    """A store with its own boto3 session. Resources are not thread-safe, and in Lambda every
    concurrent request has its own process, so each writer here gets its own store too."""
    return DynamoDBStore(s.readings.name, s.platform.name, s.audit_table.name, region_name=s._client.meta.region_name)


def check_concurrent_audit(s: DynamoDBStore) -> None:
    before = len(s.audit_entries())

    def write(i: int) -> None:
        _clone(s).audit(f"writer{i}", "race", "smoke")

    with ThreadPoolExecutor(max_workers=WRITERS) as pool:
        for f in [pool.submit(write, i) for i in range(WRITERS)]:
            f.result()  # re-raises if any writer ran out of retries
    entries = s.audit_entries()
    assert len(entries) == before + WRITERS, (len(entries), before)
    assert sorted(e["seq"] for e in entries) == list(range(1, before + WRITERS + 1))
    assert s.verify_audit_chain() is None


def run_smoke(s: DynamoDBStore, wait: float = 10.0, out=print, concurrent: bool = True) -> bool:
    """concurrent=False skips the threaded audit check. moto does not serialise transactions across
    threads, so that check is only meaningful against real DynamoDB."""
    tables = (s.readings, s.platform, s.audit_table)
    counts = [_count(t) for t in tables]
    if any(counts):
        out(f"ABORTED: tables are not empty (readings={counts[0]}, platform={counts[1]}, audit={counts[2]}).")
        out("This test deletes everything when it finishes, so it refuses to run on tables that hold data.")
        return False
    steps = [
        ("registry", lambda: check_registry(s)), ("readings and conflicts", lambda: check_readings(s)),
        ("flags and status index", lambda: check_flags(s, wait)), ("users and sessions", lambda: check_users(s)),
        ("audit log chain", lambda: check_audit(s)),
    ]
    if concurrent:
        steps.append((f"{WRITERS} concurrent audit writers", lambda: check_concurrent_audit(s)))
    ok = True
    try:
        for name, fn in steps:
            started = time.time()
            try:
                fn()
                out(f"PASS  {name} ({time.time() - started:.1f}s)")
            except Exception as err:  # report every step, then stop caring about the rest
                ok = False
                out(f"FAIL  {name}: {type(err).__name__}: {err}")
    finally:
        s.reset()
        left = [_count(t) for t in tables]
        out(f"cleanup: tables empty again = {not any(left)}")
        ok = ok and not any(left)
    return ok


def main() -> int:
    import boto3

    p = argparse.ArgumentParser()
    p.add_argument("--region", default="eu-west-1")
    p.add_argument("--readings", default="nesi-powertech-readings")
    p.add_argument("--platform", default="nesi-powertech-platform")
    p.add_argument("--audit", default="nesi-powertech-audit")
    args = p.parse_args()
    who = boto3.client("sts", region_name=args.region).get_caller_identity()["Arn"]
    print("Running as:", re.sub(r"\d{12}", "************", who))
    store = DynamoDBStore(args.readings, args.platform, args.audit, region_name=args.region, allow_reset=True)
    ok = run_smoke(store)
    print("\nRESULT:", "ALL PASSED" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
