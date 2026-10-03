import json
from datetime import datetime

import pytest

from src.ingest.handler import MAX_BATCH, handle, ingest
from src.store import SQLiteStore
from src.ingest.validate import ValidationError, validate_feeder, validate_meter

NOW = datetime(2026, 10, 1)


def _meter(**overrides):
    return {"meter_id": "M001", "timestamp": "2026-09-01T10:00:00", "kwh": "0.25", **overrides}


def _event(body):
    return {"body": json.dumps(body)}


def test_valid_meter_reading_is_normalised():
    r = validate_meter(_meter(tamper="1", voltage="229.5"), NOW)
    assert r.kwh == 0.25 and r.voltage == 229.5 and r.tamper
    assert r.timestamp == datetime(2026, 9, 1, 10, 0)


def test_aware_timestamps_convert_to_wat():
    r = validate_meter(_meter(timestamp="2026-09-01T09:00:00+00:00"), NOW)
    assert r.timestamp == datetime(2026, 9, 1, 10, 0)


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"meter_id": ""}, "meter_id"),
        ({"meter_id": "M 001"}, "meter_id"),
        ({"timestamp": "yesterday"}, "timestamp"),
        ({"timestamp": "2026-10-02T00:00:00"}, "timestamp"),
        ({"kwh": "-1"}, "kwh"),
        ({"kwh": "nan"}, "kwh"),
        ({"kwh": None}, "kwh"),
        ({"voltage": "9000"}, "voltage"),
        ({"tamper": "maybe"}, "tamper"),
    ],
)
def test_invalid_meter_readings_are_rejected(overrides, field):
    with pytest.raises(ValidationError) as e:
        validate_meter(_meter(**overrides), NOW)
    assert any(err.startswith(field) for err in e.value.errors)


def test_feeder_voltage_is_required():
    with pytest.raises(ValidationError):
        validate_feeder({"feeder_id": "F001", "timestamp": "2026-09-01T10:00:00"}, NOW)


def test_replay_is_idempotent_and_out_of_order_is_fine():
    store = SQLiteStore()
    batch = [_meter(timestamp="2026-09-01T10:15:00"), _meter()]
    assert ingest("meter", batch, store, NOW).accepted == 2
    replay = ingest("meter", list(reversed(batch)), store, NOW)
    assert replay.accepted == 0 and replay.duplicates == 2
    times = [r.timestamp.minute for r in store.meter_readings("M001", datetime(2026, 9, 1), datetime(2026, 9, 2))]
    assert times == [0, 15]


def test_conflicting_value_keeps_first_and_records_conflict():
    store = SQLiteStore()
    ingest("meter", [_meter()], store, NOW)
    result = ingest("meter", [_meter(kwh="9.9")], store, NOW)
    assert result.conflicts == 1 and store.conflict_count() == 1
    assert store.meter_readings("M001", datetime(2026, 9, 1), datetime(2026, 9, 2))[0].kwh == 0.25


def test_handler_partial_success_returns_207():
    store = SQLiteStore()
    resp = handle(_event({"kind": "meter", "readings": [_meter(), _meter(kwh="-5")]}), store, NOW)
    body = json.loads(resp["body"])
    assert resp["statusCode"] == 207
    assert body["accepted"] == 1 and body["rejected"][0]["index"] == 1


def test_handler_all_valid_returns_200():
    store = SQLiteStore()
    resp = handle(_event({"kind": "feeder", "readings": [{"feeder_id": "F001", "timestamp": "2026-09-01T10:00:00", "voltage": 230}]}), store, NOW)
    assert resp["statusCode"] == 200


@pytest.mark.parametrize(
    "event, status",
    [
        ({"body": "not json"}, 400),
        (_event([1, 2]), 400),
        (_event({"kind": "gas", "readings": [{}]}), 400),
        (_event({"kind": "meter", "readings": []}), 400),
        (_event({"kind": "meter", "readings": ["x"]}), 400),
        (_event({"kind": "meter", "readings": [_meter()] * (MAX_BATCH + 1)}), 413),
    ],
)
def test_handler_rejects_bad_requests(event, status):
    assert handle(event, SQLiteStore(), NOW)["statusCode"] == status
