"""receive() -> SQS -> write() -> DynamoDB, run end to end against moto."""
import base64
import json
from datetime import datetime, timedelta

import boto3
import pytest
from botocore.exceptions import ClientError

from conftest import REGION, TABLES
from src.ingest.handler import MAX_BATCH
from src.ingest.lambda_handlers import CHUNK, Receiver, SsmKey, Writer
from src.store_dynamodb import DynamoDBStore

KEY = "test-key-123"
PARAM = "/test/ingest-api-key"
NOW = datetime(2026, 9, 2, 12, 0)
T0 = datetime(2026, 9, 1, 10, 0)
WINDOW = (T0 - timedelta(hours=1), T0 + timedelta(days=1))


class Env:
    def __init__(self, resource):
        self.sqs = boto3.client("sqs", region_name=REGION)
        self.ssm = boto3.client("ssm", region_name=REGION)
        self.queue_url = self.sqs.create_queue(QueueName="ingest")["QueueUrl"]
        self.ssm.put_parameter(Name=PARAM, Value=KEY, Type="SecureString")
        self.clock = {"t": 0.0}
        self.key = SsmKey(self.ssm, PARAM, ttl=300, clock=lambda: self.clock["t"])
        self.receiver = Receiver(self.sqs, self.queue_url, self.key, now=lambda: NOW)
        self.store = DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=resource, allow_reset=True)
        self.writer = Writer(self.store)

    def post(self, payload, key=KEY, **event_overrides):
        body = payload if isinstance(payload, str) else json.dumps(payload)
        event = {"headers": {"x-api-key": key} if key is not None else {}, "body": body, **event_overrides}
        return self.receiver.handle(event)

    def drain(self):
        """All queued messages, shaped like an SQS event for the writer."""
        records = []
        while True:
            got = self.sqs.receive_message(QueueUrl=self.queue_url, MaxNumberOfMessages=10, VisibilityTimeout=0).get("Messages", [])
            if not got:
                return {"Records": records}
            for m in got:
                records.append({"messageId": m["MessageId"], "body": m["Body"]})
                self.sqs.delete_message(QueueUrl=self.queue_url, ReceiptHandle=m["ReceiptHandle"])

    def meter_rows(self, meter_id="M001"):
        return self.store.meter_readings(meter_id, *WINDOW)


@pytest.fixture
def env(dynamodb_resource):
    return Env(dynamodb_resource)


def meter(minutes=0, kwh=0.25, meter_id="M001", **extra):
    return {"meter_id": meter_id, "timestamp": (T0 + timedelta(minutes=minutes)).isoformat(), "kwh": kwh, **extra}


def batch(*readings, kind="meter"):
    return {"kind": kind, "readings": list(readings)}


def queued_readings(env_):
    records = env_.drain()["Records"]
    return [r for rec in records for r in json.loads(rec["body"])["readings"]], len(records)


# Authentication

@pytest.mark.parametrize("key", [None, "", "wrong", KEY + "x", KEY[:-1]])
def test_missing_or_wrong_key_is_401_and_queues_nothing(env, key):
    assert env.post(batch(meter()), key=key)["statusCode"] == 401
    assert env.drain()["Records"] == []


def test_header_name_is_case_insensitive(env):
    event = {"headers": {"X-Api-Key": KEY}, "body": json.dumps(batch(meter()))}
    assert env.receiver.handle(event)["statusCode"] == 202


def test_rotated_key_is_picked_up_after_the_cache_expires(env):
    assert env.post(batch(meter()), key=KEY)["statusCode"] == 202
    env.ssm.put_parameter(Name=PARAM, Value="new-key", Type="SecureString", Overwrite=True)
    assert env.post(batch(meter()), key="new-key")["statusCode"] == 401  # old value still cached
    env.clock["t"] = 301
    assert env.post(batch(meter()), key="new-key")["statusCode"] == 202
    assert env.post(batch(meter()), key=KEY)["statusCode"] == 401


# Receiving

def test_valid_readings_are_queued_and_acknowledged_with_202(env):
    resp = env.post(batch(meter(0), meter(15)))
    assert resp["statusCode"] == 202 and json.loads(resp["body"]) == {"queued": 2, "rejected": []}
    readings, messages = queued_readings(env)
    assert [r["timestamp"] for r in readings] == [meter(0)["timestamp"], meter(15)["timestamp"]] and messages == 1


def test_a_full_batch_is_split_into_chunks(env):
    resp = env.post(batch(*[meter(i, meter_id=f"M{i:03d}") for i in range(MAX_BATCH)]))
    assert json.loads(resp["body"])["queued"] == MAX_BATCH
    readings, messages = queued_readings(env)
    assert len(readings) == MAX_BATCH and messages == -(-MAX_BATCH // CHUNK)


def test_partly_bad_batch_queues_the_good_readings_and_reports_207(env):
    resp = env.post(batch(meter(0), meter(15, kwh=-5), meter(30)))
    body = json.loads(resp["body"])
    assert resp["statusCode"] == 207 and body["queued"] == 2
    assert [r["index"] for r in body["rejected"]] == [1] and body["rejected"][0]["errors"]
    assert len(queued_readings(env)[0]) == 2


def test_a_batch_with_nothing_valid_is_400_and_queues_nothing(env):
    resp = env.post(batch(meter(kwh=-1), meter(kwh="abc")))
    assert resp["statusCode"] == 400 and json.loads(resp["body"])["queued"] == 0
    assert env.drain()["Records"] == []


@pytest.mark.parametrize("payload, status", [
    ("not json", 400), ("[1, 2]", 400), ({"kind": "bogus", "readings": [meter()]}, 400),
    ({"kind": "meter", "readings": []}, 400), ({"kind": "meter", "readings": ["x"]}, 400),
    ({"kind": "meter", "readings": [meter()] * (MAX_BATCH + 1)}, 413),
])
def test_bad_envelopes_are_rejected_like_the_local_api(env, payload, status):
    assert env.post(payload)["statusCode"] == status
    assert env.drain()["Records"] == []


def test_base64_bodies_are_decoded(env):
    encoded = base64.b64encode(json.dumps(batch(meter())).encode()).decode()
    resp = env.receiver.handle({"headers": {"x-api-key": KEY}, "body": encoded, "isBase64Encoded": True})
    assert resp["statusCode"] == 202


def test_sqs_refusing_messages_is_503_and_says_to_retry(env, monkeypatch):
    monkeypatch.setattr(env.sqs, "send_message_batch", lambda **kw: {"Failed": [{"Id": "0"}]})
    resp = env.post(batch(meter()))
    assert resp["statusCode"] == 503 and "retry" in json.loads(resp["body"])["error"]


def test_sqs_client_errors_are_503(env, monkeypatch):
    def throttled(**kw):
        raise ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "SendMessageBatch")

    monkeypatch.setattr(env.sqs, "send_message_batch", throttled)
    assert env.post(batch(meter()))["statusCode"] == 503


def test_unexpected_errors_are_500_and_do_not_leak_details(env, monkeypatch):
    def boom(**kw):
        raise ValueError("secret internal detail")

    monkeypatch.setattr(env.sqs, "send_message_batch", boom)
    resp = env.post(batch(meter()))
    assert resp["statusCode"] == 500 and "secret" not in resp["body"]


# Writing, end to end

def test_end_to_end_readings_reach_dynamodb(env):
    env.post(batch(meter(0, kwh=0.25, voltage=229.5, tamper=True), meter(15, kwh=0.3)))
    assert env.writer.handle(env.drain()) == {"batchItemFailures": []}
    rows = env.meter_rows()
    assert [(r.kwh, r.voltage, r.tamper) for r in rows] == [(0.25, 229.5, True), (0.3, None, False)]


def test_feeder_readings_update_the_reading_range(env):
    feeder = lambda m, v: {"feeder_id": "F001", "timestamp": (T0 + timedelta(minutes=m)).isoformat(), "voltage": v}
    env.post(batch(feeder(0, 230), feeder(15, 0), kind="feeder"))
    env.writer.handle(env.drain())
    assert env.store.reading_range() == (T0, T0 + timedelta(minutes=15))


def test_sending_the_same_request_twice_changes_nothing(env):
    for _ in range(2):
        env.post(batch(meter(0), meter(15)))
        env.writer.handle(env.drain())
    assert len(env.meter_rows()) == 2 and env.store.conflict_count() == 0


def test_sqs_redelivering_a_message_is_harmless(env):
    env.post(batch(meter(0)))
    event = env.drain()
    assert env.writer.handle(event) == env.writer.handle(event) == {"batchItemFailures": []}
    assert len(env.meter_rows()) == 1


def test_conflicting_values_keep_the_first_and_record_the_conflict(env):
    env.post(batch(meter(0, kwh=0.25)))
    env.writer.handle(env.drain())
    env.post(batch(meter(0, kwh=0.99)))
    env.writer.handle(env.drain())
    assert [r.kwh for r in env.meter_rows()] == [0.25] and env.store.conflict_count() == 1


def test_a_poison_message_is_reported_and_does_not_block_good_ones(env):
    env.post(batch(meter(0)))
    good = env.drain()["Records"][0]
    poison = [
        {"messageId": "bad-json", "body": "{not json"},
        {"messageId": "bad-kind", "body": json.dumps({"kind": "nope", "readings": [meter()]})},
        {"messageId": "bad-reading", "body": json.dumps({"kind": "meter", "readings": [meter(kwh=-1)]})},
        {"messageId": "no-body-keys", "body": "{}"},
    ]
    result = env.writer.handle({"Records": [poison[0], good, *poison[1:]]})
    assert {f["itemIdentifier"] for f in result["batchItemFailures"]} == {p["messageId"] for p in poison}
    assert len(env.meter_rows()) == 1  # the good message still landed


def test_a_store_failure_marks_only_that_message_for_retry(env, monkeypatch):
    env.post(batch(meter(0)))
    env.post(batch(meter(0, meter_id="M002")))
    records = env.drain()["Records"]
    real_save = env.store.save

    def flaky(readings, *a, **kw):
        if readings[0].meter_id == "M002":
            raise RuntimeError("throttled")
        return real_save(readings, *a, **kw)

    monkeypatch.setattr(env.store, "save", flaky)
    result = env.writer.handle({"Records": records})
    failed = [f["itemIdentifier"] for f in result["batchItemFailures"]]
    assert len(failed) == 1 and failed[0] == next(r["messageId"] for r in records if "M002" in r["body"])
    assert len(env.meter_rows("M001")) == 1
