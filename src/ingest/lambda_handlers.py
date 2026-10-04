"""AWS Lambda entry points for the ingest path.

    API Gateway -> receive() -> SQS -> write() -> DynamoDB

receive(): checks the API key, validates readings with the same rules as the local API, and puts
the valid ones on the queue. It answers 202 once they are queued, so a device is never held up by
the database. write(): saves queued readings through DynamoDBStore. DynamoDBStore.save() is
idempotent, so SQS delivering a message twice is harmless.

Both classes take their AWS clients as arguments, which is how the tests run them against moto.
"""
from __future__ import annotations

import base64
import hmac
import json
import os
import time
import traceback
from datetime import datetime
from typing import Callable, Optional

from botocore.exceptions import BotoCoreError, ClientError

from src.ingest.handler import RequestError, parse_request, validate_batch
from src.ingest.validate import VALIDATORS, FeederReading, MeterReading, Reading

CHUNK = 25  # readings per SQS message
SQS_BATCH = 10  # SendMessageBatch accepts at most 10 entries
KEY_CACHE_SECONDS = 300  # a rotated key takes effect within this long


class EnqueueError(Exception):
    """SQS did not accept every message of a request."""


def _response(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body)}


def _log(event: str, **fields) -> None:
    print(json.dumps({"event": event, **fields}, default=str))


def reading_to_dict(r: Reading) -> dict:
    """The queue message form of a validated reading, accepted again by the same validators."""
    if isinstance(r, MeterReading):
        return {"meter_id": r.meter_id, "timestamp": r.timestamp.isoformat(), "kwh": r.kwh, "voltage": r.voltage, "tamper": r.tamper}
    return {"feeder_id": r.feeder_id, "timestamp": r.timestamp.isoformat(), "voltage": r.voltage, "kwh": r.kwh}


class SsmKey:
    """The ingest API key, read from SSM Parameter Store and cached briefly."""

    def __init__(self, client, name: str, ttl: float = KEY_CACHE_SECONDS, clock: Callable[[], float] = time.monotonic):
        self._client, self._name, self._ttl, self._clock = client, name, ttl, clock
        self._value: Optional[str] = None
        self._fetched_at = 0.0

    def get(self) -> str:
        if self._value is None or self._clock() - self._fetched_at >= self._ttl:
            self._value = self._client.get_parameter(Name=self._name, WithDecryption=True)["Parameter"]["Value"]
            self._fetched_at = self._clock()
        return self._value


class Receiver:
    def __init__(self, sqs, queue_url: str, key: SsmKey, now: Optional[Callable[[], datetime]] = None):
        self._sqs, self._queue_url, self._key = sqs, queue_url, key
        self._now = now

    def handle(self, event: dict) -> dict:
        try:
            return self._handle(event)
        except Exception:  # never leak internals to a caller
            _log("receiver_error", trace=traceback.format_exc())
            return _response(500, {"error": "internal error"})

    def _handle(self, event: dict) -> dict:
        headers = {str(k).lower(): v for k, v in (event.get("headers") or {}).items()}
        provided = str(headers.get("x-api-key", ""))
        if not hmac.compare_digest(provided.encode(), self._key.get().encode()):
            _log("rejected", reason="bad api key")
            return _response(401, {"error": "invalid or missing API key"})
        body = event.get("body")
        if event.get("isBase64Encoded") and body:
            body = base64.b64decode(body).decode("utf-8", errors="replace")
        try:
            kind, raw = parse_request(body)
        except RequestError as e:
            return _response(e.status, {"error": e.message})
        valid, rejected = validate_batch(kind, raw, self._now() if self._now else None)
        if not valid:
            return _response(400, {"error": "no valid readings in request", "queued": 0, "rejected": rejected})
        try:
            self._enqueue(kind, valid)
        except (EnqueueError, ClientError, BotoCoreError) as e:  # SQS is refusing or unreachable: worth retrying
            _log("enqueue_failed", error_type=type(e).__name__, error=str(e))
            return _response(503, {"error": "could not queue readings; retry the whole request, duplicates are ignored"})
        _log("queued", kind=kind, queued=len(valid), rejected=len(rejected))
        return _response(207 if rejected else 202, {"queued": len(valid), "rejected": rejected})

    def _enqueue(self, kind: str, readings: list) -> None:
        messages = [
            json.dumps({"kind": kind, "readings": [reading_to_dict(r) for r in readings[i : i + CHUNK]]})
            for i in range(0, len(readings), CHUNK)
        ]
        for start in range(0, len(messages), SQS_BATCH):
            entries = [{"Id": str(n), "MessageBody": body} for n, body in enumerate(messages[start : start + SQS_BATCH])]
            response = self._sqs.send_message_batch(QueueUrl=self._queue_url, Entries=entries)
            if response.get("Failed"):
                raise EnqueueError(f"{len(response['Failed'])} of {len(entries)} messages were not accepted by SQS")


class Writer:
    def __init__(self, store):
        self._store = store

    def handle(self, event: dict) -> dict:
        """Returns the SQS partial-batch response: only failed messages are retried."""
        failures = []
        for record in event.get("Records", []):
            try:
                message = json.loads(record["body"])
                validator = VALIDATORS[message["kind"]]
                readings = [validator(raw, None) for raw in message["readings"]]
                result = self._store.save(readings)
                _log("saved", message_id=record["messageId"], **{k: v for k, v in result.as_dict().items() if k != "rejected"})
            except Exception:
                _log("write_failed", message_id=record.get("messageId"), trace=traceback.format_exc())
                failures.append({"itemIdentifier": record["messageId"]})
        return {"batchItemFailures": failures}


# Lambda entry points. Clients are created on first use, then reused across invocations.
_receiver: Optional[Receiver] = None
_writer: Optional[Writer] = None


def receive(event: dict, context=None) -> dict:
    global _receiver
    if _receiver is None:
        import boto3

        _receiver = Receiver(boto3.client("sqs"), os.environ["QUEUE_URL"], SsmKey(boto3.client("ssm"), os.environ["INGEST_KEY_PARAM"]))
    return _receiver.handle(event)


def write(event: dict, context=None) -> dict:
    global _writer
    if _writer is None:
        from src.store_dynamodb import DynamoDBStore

        _writer = Writer(DynamoDBStore(os.environ["READINGS_TABLE"], os.environ["PLATFORM_TABLE"], os.environ["AUDIT_TABLE"]))
    return _writer.handle(event)
