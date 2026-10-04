"""Live test of the deployed ingest endpoint.

    python scripts/smoke_ingest.py --url <ingest_url from terraform output>

It sends real HTTP requests, then reads DynamoDB to confirm the readings arrived through the queue
and the writer. It reads the API key from SSM itself (your AWS credentials), so you never paste it.

Safe on tables that hold real data: it only ever writes meter readings under a fresh
SMOKE-<random> meter id, never touches feeder readings (which update a shared range marker),
and deletes exactly its own items when it finishes, pass or fail.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from boto3.dynamodb.conditions import Key  # noqa: E402

from src.clock import now_wat  # noqa: E402
from src.store_dynamodb import DynamoDBStore  # noqa: E402

WINDOW = timedelta(days=1)


def _json(text):
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return {"raw": text}


def http_post(url: str):
    def post(key, body: str):
        headers = {"Content-Type": "application/json"}
        if key:
            headers["x-api-key"] = key
        request = urllib.request.Request(url, data=body.encode(), method="POST", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status, response.read().decode()
        except urllib.error.HTTPError as err:
            return err.code, err.read().decode()

    return post


def _rows(store: DynamoDBStore, meter_id: str):
    now = now_wat()
    return store.meter_readings(meter_id, now - WINDOW, now + timedelta(minutes=10))


def _until(fn, seconds: float):
    deadline = time.time() + seconds
    while True:
        value = fn()
        if value or time.time() >= deadline:
            return value
        time.sleep(1.0)


def _cleanup(store: DynamoDBStore, meter_id: str) -> int:
    pk = f"METER#{meter_id}"
    items = DynamoDBStore._query_all(store.readings, KeyConditionExpression=Key("pk").eq(pk), ConsistentRead=True)
    with store.readings.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
    return len(items)


def run_ingest_smoke(post, key: str, store: DynamoDBStore, sqs=None, dlq_url=None, wait: float = 45.0, out=print) -> bool:
    meter_id = f"SMOKE-{uuid.uuid4().hex[:8]}"
    base = now_wat().replace(second=0, microsecond=0)
    at = lambda n: (base - timedelta(minutes=15 * n)).isoformat()
    reading = lambda n, kwh=None: {"meter_id": meter_id, "timestamp": at(n), "kwh": kwh if kwh is not None else round(0.25 + n / 100, 2)}
    body = lambda *readings: json.dumps({"kind": "meter", "readings": list(readings)})
    ok = True

    def step(name, fn):
        nonlocal ok
        started = time.time()
        try:
            fn()
            out(f"PASS  {name} ({time.time() - started:.1f}s)")
        except Exception as err:
            ok = False
            out(f"FAIL  {name}: {type(err).__name__}: {err}")

    def expect(status_wanted, got, extra=None):
        status, text = got
        payload = _json(text)
        assert status == status_wanted, f"expected HTTP {status_wanted}, got {status}: {text[:200]}"
        return payload

    def check_auth():
        expect(401, post(None, body(reading(0))))
        expect(401, post("definitely-not-the-key", body(reading(0))))

    def check_bad_json():
        expect(400, post(key, "this is not json"))

    def check_partial():
        payload = expect(207, post(key, body(reading(0), {**reading(1), "kwh": -5})))
        assert payload["queued"] == 1 and [r["index"] for r in payload["rejected"]] == [1], payload

    def check_batch():
        payload = expect(202, post(key, body(reading(1), reading(2), reading(3))))
        assert payload["queued"] == 3 and payload["rejected"] == [], payload

    def check_arrival():
        arrived = _until(lambda: len(_rows(store, meter_id)) == 4, wait)
        rows = _rows(store, meter_id)
        assert arrived, f"only {len(rows)} of 4 readings reached DynamoDB within {wait:.0f}s"
        got = {r.timestamp.isoformat(): r.kwh for r in rows}
        assert got == {at(n): round(0.25 + n / 100, 2) for n in range(4)}, got

    def check_replay():
        # The new reading rides in the same queue message as the replayed ones, so once it has
        # arrived the replay has certainly been processed and we can check nothing was duplicated.
        expect(202, post(key, body(reading(0), reading(1), reading(2), reading(3), reading(4))))
        assert _until(lambda: len(_rows(store, meter_id)) >= 5, wait), "replay marker never arrived"
        rows = _rows(store, meter_id)
        assert len(rows) == 5, f"expected 5 rows after a replay, found {len(rows)}"
        assert {r.timestamp.isoformat(): r.kwh for r in rows}[at(0)] == 0.25, "a replay changed a stored value"

    def check_dlq():
        count = int(sqs.get_queue_attributes(QueueUrl=dlq_url, AttributeNames=["ApproximateNumberOfMessages"])["Attributes"]["ApproximateNumberOfMessages"])
        assert count == 0, f"{count} message(s) are in the dead-letter queue"

    try:
        step("requests without the right key are refused (401)", check_auth)
        step("malformed JSON is refused (400)", check_bad_json)
        step("a partly bad batch queues the good reading (207)", check_partial)
        step("a good batch is accepted (202)", check_batch)
        step("readings arrive in DynamoDB through queue and writer", check_arrival)
        step("replaying readings changes nothing", check_replay)
        if sqs is not None and dlq_url:
            step("dead-letter queue is empty", check_dlq)
    finally:
        removed = _cleanup(store, meter_id)
        left = len(_rows(store, meter_id))
        out(f"cleanup: removed {removed} items, {left} left")
        ok = ok and left == 0
    return ok


def main() -> int:
    import boto3

    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True, help="the ingest_url from terraform output")
    p.add_argument("--region", default="eu-west-1")
    p.add_argument("--key-parameter", default="/nesi-powertech/ingest-api-key")
    p.add_argument("--readings", default="nesi-powertech-readings")
    p.add_argument("--platform", default="nesi-powertech-platform")
    p.add_argument("--audit", default="nesi-powertech-audit")
    p.add_argument("--dlq-name", default="nesi-powertech-ingest-dlq")
    args = p.parse_args()

    session = boto3.session.Session(region_name=args.region)
    who = session.client("sts").get_caller_identity()["Arn"]
    print("Running as:", re.sub(r"\d{12}", "************", who))
    key = session.client("ssm").get_parameter(Name=args.key_parameter, WithDecryption=True)["Parameter"]["Value"]
    sqs = session.client("sqs")
    dlq_url = sqs.get_queue_url(QueueName=args.dlq_name)["QueueUrl"]
    store = DynamoDBStore(args.readings, args.platform, args.audit, region_name=args.region)
    ok = run_ingest_smoke(http_post(args.url), key, store, sqs, dlq_url)
    print("\nRESULT:", "ALL PASSED" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
