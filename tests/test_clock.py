"""The app keeps time as naive West Africa Time (WAT, UTC+1, no DST), whatever the machine's own
timezone is. Lambda and CI runners are UTC, a developer laptop in Nigeria is not, so these tests
run under several machine timezones and compare against real UTC."""
import time
from datetime import datetime, timedelta, timezone

import pytest

from src.api.auth import SESSION_TTL, hash_password, login, user_for_token
from src.clock import WAT, now_wat

SLACK = timedelta(seconds=5)
needs_tzset = pytest.mark.skipif(not hasattr(time, "tzset"), reason="time.tzset is not available on Windows")


def utc_plus_one() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)


def close(a: datetime, b: datetime, slack: timedelta = SLACK) -> bool:
    return abs(a - b) <= slack


@pytest.fixture(params=["UTC", "America/Los_Angeles", "Pacific/Auckland", "Africa/Lagos"])
def machine_timezone(request, monkeypatch):
    if not hasattr(time, "tzset"):
        pytest.skip("time.tzset is not available on Windows")
    monkeypatch.setenv("TZ", request.param)
    time.tzset()
    yield request.param
    monkeypatch.undo()
    time.tzset()


def test_wat_is_a_fixed_one_hour_offset():
    assert WAT.utcoffset(None) == timedelta(hours=1)


def test_now_wat_is_utc_plus_one_hour_on_any_machine_timezone(machine_timezone):
    assert close(now_wat(), utc_plus_one())
    assert now_wat().tzinfo is None


def test_audit_timestamps_are_wat(store, machine_timezone):
    store.audit("ops", "x", "t")
    assert close(datetime.fromisoformat(store.audit_entries()[0]["at"]), utc_plus_one())


def test_flag_timestamps_are_wat(store, machine_timezone):
    store.save_flags([{
        "rule": "tamper", "subject_type": "meter", "subject_id": "M1", "feeder_id": "F1",
        "period_start": "2026-09-01", "period_end": "2026-09-02", "reason": "r", "confidence": 0.5, "evidence": {},
    }])
    flag_id = store.flags()[0]["flag_id"]
    assert close(datetime.fromisoformat(store.flag(flag_id)["created_at"]), utc_plus_one())
    store.decide_flags([flag_id], "confirmed", "ops", "note")
    assert close(datetime.fromisoformat(store.flag(flag_id)["decided_at"]), utc_plus_one())


def test_session_lasts_the_full_ttl_on_any_machine_timezone(store, machine_timezone):
    store.add_user("ops", hash_password("pw"), "operations", "Ops")
    token, _ = login(store, "ops", "pw")
    just_inside = now_wat() + SESSION_TTL - timedelta(minutes=1)
    just_outside = now_wat() + SESSION_TTL + timedelta(minutes=1)
    assert user_for_token(store, token) is not None
    assert user_for_token(store, token, now=just_inside) is not None, "session ended early"
    assert user_for_token(store, token, now=just_outside) is None, "session outlived its expiry"
