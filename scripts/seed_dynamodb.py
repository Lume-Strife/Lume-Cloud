"""Load a SIMULATED demo dataset into the real DynamoDB tables and create the demo accounts.

    python scripts/seed_dynamodb.py                 # 30 days, 3 feeders, 90 meters (about 268,000 readings)
    python scripts/seed_dynamodb.py --days 14       # smaller and faster

Safety rules:
  * It refuses to run if any table already holds data. Pass --wipe to empty all three tables first;
    you are asked to type WIPE to confirm.
  * Passwords are random, created now and printed once at the end. They are never stored in plain
    text anywhere, so note them down. (The local SQLite seed uses a public password; this never does.)
  * Everything it loads is simulated, and the output says so.
"""
from __future__ import annotations

import argparse
import csv
import re
import secrets
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.api.auth import hash_password  # noqa: E402
from src.detection.run import default_period, run_detection  # noqa: E402
from src.ingest.validate import VALIDATORS, ValidationError  # noqa: E402
from src.store_dynamodb import DynamoDBStore  # noqa: E402


def table_counts(store: DynamoDBStore) -> list[int]:
    return [t.scan(Select="COUNT")["Count"] for t in (store.readings, store.platform, store.audit_table)]


def run_simulator(out: Path, days: int, meters: int, feeders: str, theft_rate: float, seed: int) -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "simulator" / "simulate.py"), "--out", str(out), "--days", str(days), "--meters", str(meters),
         "--feeders", feeders, "--theft-rate", str(theft_rate), "--drop-rate", "0.02", "--seed", str(seed)],
        check=True, stdout=subprocess.DEVNULL,
    )


def _valid_readings(kind: str, path: Path, rejected: list):
    validator = VALIDATORS[kind]
    with open(path, newline="") as f:
        for i, row in enumerate(csv.DictReader(f)):
            try:
                yield validator(row, None)
            except ValidationError as err:
                rejected.append((kind, i + 2, err.errors))


def seed(store: DynamoDBStore, data: Path, workers: int = 8, progress=None, out=print) -> dict:
    started = time.time()
    for row in csv.DictReader(open(data / "feeders.csv", newline="")):
        store.upsert_feeder(row["feeder_id"], row["band"])
    for row in csv.DictReader(open(data / "meters.csv", newline="")):
        store.upsert_meter(row["meter_id"], row["feeder_id"])
    rejected: list = []
    loaded = {}
    for kind in ("feeder", "meter"):
        loaded[kind] = store.bulk_load(_valid_readings(kind, data / f"{kind}_readings.csv", rejected), workers=workers, progress=progress)
        out(f"Loaded {loaded[kind]:,} {kind} readings ({time.time() - started:.0f}s)")
    start, end = default_period(store)
    flags = run_detection(store, start, end)
    out(f"Detection over {start}..{end}: {len(flags)} flags ({time.time() - started:.0f}s)")

    with open(data / "injected_anomalies.csv", newline="") as f:
        thieves = {r["meter_id"] for r in csv.DictReader(f)}
    honest = {f["feeder_id"]: [m for m in store.meter_ids(f["feeder_id"]) if m not in thieves] for f in store.feeders()}
    feeders = sorted(honest)
    accounts = [
        ("customer", "customer", "Demo Customer (Band A feeder)", honest[feeders[0]][0]),
        ("customer2", "customer", "Demo Customer (lowest band feeder)", honest[feeders[-1]][0]),
        ("ops", "operations", "Revenue Protection (demo)", None),
        ("regulator", "regulator", "Regulator (demo)", None),
    ]
    passwords = {}
    for username, role, name, meter_id in accounts:
        passwords[username] = secrets.token_urlsafe(9)
        store.add_user(username, hash_password(passwords[username]), role, name, meter_id)
    store.audit("system", "demo.seed", "dynamodb", {"accounts": [a[0] for a in accounts], "simulated": True})
    return {"loaded": loaded, "rejected": rejected, "flags": len(flags), "passwords": passwords, "accounts": accounts, "period": (start, end)}


def prepare(store: DynamoDBStore, wipe: bool, confirm=lambda: input("Type WIPE to empty all three tables: ").strip() == "WIPE", out=print) -> bool:
    counts = table_counts(store)
    if any(counts):
        if not wipe:
            out(f"ABORTED: tables already hold data (readings={counts[0]}, platform={counts[1]}, audit={counts[2]}).")
            out("Nothing was changed. Re-run with --wipe to empty them first.")
            return False
        if not confirm():
            out("ABORTED: wipe not confirmed. Nothing was changed.")
            return False
        store.reset()
        out("Tables emptied.")
    return True


def main() -> int:
    import boto3

    p = argparse.ArgumentParser()
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--meters", type=int, default=30, help="meters per feeder")
    p.add_argument("--feeders", default="F001:A:18.5,F002:B:17,F003:C:13")
    p.add_argument("--theft-rate", type=float, default=0.1)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--wipe", action="store_true")
    p.add_argument("--region", default="eu-west-1")
    p.add_argument("--readings", default="nesi-powertech-readings")
    p.add_argument("--platform", default="nesi-powertech-platform")
    p.add_argument("--audit", default="nesi-powertech-audit")
    args = p.parse_args()

    store = DynamoDBStore(args.readings, args.platform, args.audit, region_name=args.region, allow_reset=args.wipe)
    who = boto3.session.Session(region_name=args.region).client("sts").get_caller_identity()["Arn"]
    print("Running as:", re.sub(r"\d{12}", "************", who))
    if not prepare(store, args.wipe):
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        print("Simulating data...")
        run_simulator(Path(tmp), args.days, args.meters, args.feeders, args.theft_rate, args.seed)
        last = [0.0]

        def progress(n):
            if time.time() - last[0] > 5:
                print(f"  ...{n:,} written")
                last[0] = time.time()

        result = seed(store, Path(tmp), args.workers, progress)
    if result["rejected"]:
        print(f"Note: {len(result['rejected'])} rows were rejected by validation (first: {result['rejected'][0]})")
    print("\nDemo accounts (SIMULATED DATA). Passwords are shown ONCE, note them down now:")
    for username, role, _, meter_id in result["accounts"]:
        print(f"  {username:<10} {role:<11} {('meter ' + meter_id) if meter_id else '':<12} password: {result['passwords'][username]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
