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


def ingest(kind: str, raw_readings: Iterable[dict], store: SQLiteStore, now: Optional[datetime] = None) -> IngestResult:
    validator = VALIDATORS[kind]
    result = IngestResult()
    valid = []
    for i, raw in enumerate(raw_readings):
        try:
            valid.append(validator(raw, now))
        except ValidationError as e:
            result.rejected.append({"index": i, "errors": e.errors})
    return store.save(valid, result)


def handle(event: dict, store: SQLiteStore, now: Optional[datetime] = None) -> dict:
    try:
        body = json.loads(event.get("body") or "")
    except json.JSONDecodeError:
        return _response(400, {"error": "body must be JSON"})
    if not isinstance(body, dict):
        return _response(400, {"error": "body must be a JSON object"})
    kind = body.get("kind")
    readings = body.get("readings")
    if kind not in VALIDATORS:
        return _response(400, {"error": f"kind must be one of {sorted(VALIDATORS)}"})
    if not isinstance(readings, list) or not readings:
        return _response(400, {"error": "readings must be a non-empty list"})
    if len(readings) > MAX_BATCH:
        return _response(413, {"error": f"at most {MAX_BATCH} readings per request"})
    if not all(isinstance(r, dict) for r in readings):
        return _response(400, {"error": "each reading must be a JSON object"})
    result = ingest(kind, readings, store, now)
    return _response(207 if result.rejected else 200, result.as_dict())
