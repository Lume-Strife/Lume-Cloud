import sqlite3
from datetime import date, datetime, timedelta

import pytest

from src.accountability.engine import load_config
from src.detection.engine import detect_feeder, load_detection_config
from src.ingest.validate import FeederReading, MeterReading
from src.store import SQLiteStore

CFG = load_config()
DET = load_detection_config()
START = datetime(2026, 9, 1)
DAYS = 20
PERIOD = (START.date(), START.date() + timedelta(days=DAYS))
SLOTS = [START + timedelta(minutes=15 * i) for i in range(96 * DAYS)]


def _on(t):
    return t.hour >= 4  # 20h supply every day


def _feeder(meters, loss=0.07):
    """Feeder head energy = true load of every meter + technical loss."""
    true = {t: sum(load(t) for load in meters.values()) for t in SLOTS}
    return [FeederReading("F001", t, 230.0 if _on(t) else 0.0, true[t] * (1 + loss) if _on(t) else 0.0) for t in SLOTS]


def _steady(kwh):
    return lambda t: kwh if _on(t) else 0.0


def _readings(meter_id, load, report=None, tamper_at=()):
    report = report or (lambda t, kwh: kwh)
    return [MeterReading(meter_id, t, report(t, load(t)), None, t in tamper_at) for t in SLOTS]


def _detect(true_loads, readings):
    return detect_feeder("F001", PERIOD, _feeder(true_loads), readings, CFG, DET)


def _honest(n=10):
    loads = {f"M{i:03d}": _steady(0.1 + 0.01 * i) for i in range(n)}
    return loads, {m: _readings(m, load) for m, load in loads.items()}


def test_honest_feeder_raises_no_flags():
    loads, readings = _honest()
    assert _detect(loads, readings) == []


def test_outages_alone_do_not_look_like_a_drop():
    loads, readings = _honest()
    # Same meter, but second half of the period has long outages: rate per supplied hour is unchanged.
    readings["M000"] = [r for r in readings["M000"] if not (r.timestamp.day > 10 and r.timestamp.hour < 12)]
    assert not [f for f in _detect(loads, readings) if f["subject_id"] == "M000"]


def test_bypass_flags_drop_and_feeder_imbalance():
    loads, readings = _honest()
    theft_day = START + timedelta(days=12)
    readings["M005"] = _readings("M005", loads["M005"], lambda t, kwh: kwh * 0.2 if t >= theft_day else kwh)
    loads["M009"] = _steady(1.0)  # big consumer so the stolen energy moves the feeder balance
    readings["M009"] = _readings("M009", loads["M009"], lambda t, kwh: kwh * 0.2 if t >= theft_day else kwh)
    flags = _detect(loads, readings)
    drop = {f["subject_id"]: f for f in flags if f["rule"] == "consumption_drop"}
    assert set(drop) == {"M005", "M009"}
    assert drop["M005"]["evidence"]["low_since"] == "2026-09-13"
    feeder = next(f for f in flags if f["rule"] == "feeder_imbalance")
    assert feeder["evidence"]["suspect_meters"] == ["M005", "M009"]


def test_stopped_meter_flags_zero_with_supply():
    loads, readings = _honest()
    stop = START + timedelta(days=15)
    readings["M003"] = _readings("M003", loads["M003"], lambda t, kwh: 0.0 if t >= stop else kwh)
    zero = [f for f in _detect(loads, readings) if f["rule"] == "zero_with_supply"]
    assert [f["subject_id"] for f in zero] == ["M003"] and zero[0]["evidence"]["zero_hours"] == 100.0


def test_tamper_flag_carries_reason_and_confidence():
    loads, readings = _honest()
    readings["M001"] = _readings("M001", loads["M001"], tamper_at={SLOTS[100], SLOTS[101]})
    tamper = next(f for f in _detect(loads, readings) if f["rule"] == "tamper_event")
    assert tamper["confidence"] == 0.7 and "2 tamper alarms" in tamper["reason"]


def test_missing_meter_readings_do_not_create_imbalance():
    loads, readings = _honest()
    readings = {m: [r for i, r in enumerate(rs) if i % 10] for m, rs in readings.items()}  # drop 10%
    assert not [f for f in _detect(loads, readings) if f["rule"] == "feeder_imbalance"]


def test_flags_are_stored_once_per_rule_subject_period():
    store = SQLiteStore()
    flag = {
        "rule": "tamper_event", "subject_type": "meter", "subject_id": "M001", "feeder_id": "F001",
        "period_start": "2026-09-01", "period_end": "2026-09-21", "reason": "x", "confidence": 0.7, "evidence": {},
    }
    assert store.save_flags([flag]) == 1 and store.save_flags([flag]) == 0
    assert store.flags(status="open")[0]["subject_id"] == "M001"


def test_audit_chain_detects_tampering():
    store = SQLiteStore()
    store.audit("ops1", "flag.decide", "flag:1", {"status": "confirmed"})
    store.audit("ops1", "flag.decide", "flag:2", {"status": "dismissed"})
    assert store.verify_audit_chain() is None
    # Triggers block UPDATE/DELETE; simulate someone bypassing them.
    store.conn.execute("DROP TRIGGER audit_no_update")
    store.conn.execute("UPDATE audit_log SET details = '{\"status\": \"dismissed\"}' WHERE seq = 1")
    assert store.verify_audit_chain() == 1


def test_audit_log_rejects_updates():
    store = SQLiteStore()
    store.audit("ops1", "x", "y")
    with pytest.raises(sqlite3.IntegrityError):
        store.conn.execute("DELETE FROM audit_log")


def test_period_dates_on_flags():
    loads, readings = _honest()
    readings["M001"] = _readings("M001", loads["M001"], tamper_at={SLOTS[5]})
    f = _detect(loads, readings)[0]
    assert (f["period_start"], f["period_end"]) == (date(2026, 9, 1).isoformat(), date(2026, 9, 21).isoformat())


def test_reset_clears_everything_including_the_audit_log(tmp_path):
    store = SQLiteStore(tmp_path / "p.db")
    store.upsert_feeder("F001", "A")
    store.audit("ops1", "x", "y")
    other = SQLiteStore(tmp_path / "p.db")  # e.g. the API holding the file open
    store.reset()
    assert store.feeders() == [] and store.audit_entries() == []
    assert other.feeders() == []
    store.audit("ops1", "x", "y")
    assert store.verify_audit_chain() is None
