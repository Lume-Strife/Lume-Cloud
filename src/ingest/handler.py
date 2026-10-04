"""Ingest endpoint logic, shaped for an API Gateway proxy event.

POST body: {"kind": "meter" | "feeder", "readings": [{...}, ...]}
Valid readings are stored even when others in the batch are rejected (HTTP 207).
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable, Optional

from src.store import IngestResult, SQLiteStore
from .validate import VALIDATORS, ValidationError

MAX_BATCH = 500


def _response(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body)}


class RequestError(Exception):
    """A request that can be rejected before any reading is looked at."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def parse_request(raw_body: Optional[str]) -> tuple[str, list[dict]]:
    """Check the envelope of an ingest request. Returns (kind, readings) or raises RequestError."""
    try:
        body = json.loads(raw_body or "")
    except json.JSONDecodeError:
        raise RequestError(400, "body must be JSON")
    if not isinstance(body, dict):
        raise RequestError(400, "body must be a JSON object")
    kind = body.get("kind")
    readings = body.get("readings")
    if kind not in VALIDATORS:
        raise RequestError(400, f"kind must be one of {sorted(VALIDATORS)}")
    if not isinstance(readings, list) or not readings:
        raise RequestError(400, "readings must be a non-empty list")
    if len(readings) > MAX_BATCH:
        raise RequestError(413, f"at most {MAX_BATCH} readings per request")
    if not all(isinstance(r, dict) for r in readings):
        raise RequestError(400, "each reading must be a JSON object")
    return kind, readings


def validate_batch(kind: str, raw_readings: Iterable[dict], now: Optional[datetime] = None) -> tuple[list, list[dict]]:
    """Validate each reading on its own. Returns (valid readings, rejected: {"index", "errors"})."""
    validator = VALIDATORS[kind]
    valid, rejected = [], []
    for i, raw in enumerate(raw_readings):
        try:
            valid.append(validator(raw, now))
        except ValidationError as e:
            rejected.append({"index": i, "errors": e.errors})
    return valid, rejected


def ingest(kind: str, raw_readings: Iterable[dict], store: SQLiteStore, now: Optional[datetime] = None) -> IngestResult:
    valid, rejected = validate_batch(kind, raw_readings, now)
    result = IngestResult()
    result.rejected.extend(rejected)
    return store.save(valid, result)


def handle(event: dict, store: SQLiteStore, now: Optional[datetime] = None) -> dict:
    try:
        kind, readings = parse_request(event.get("body"))
    except RequestError as e:
        return _response(e.status, {"error": e.message})
    result = ingest(kind, readings, store, now)
    return _response(207 if result.rejected else 200, result.as_dict())
