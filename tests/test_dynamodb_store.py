"""Behaviour specific to DynamoDBStore (the shared contract lives in test_store_contract.py)."""
from datetime import datetime, timedelta

import time

import pytest

from conftest import TABLES
from src.ingest.validate import WAT, MeterReading
from src.store_base import Store
from src.store_dynamodb import DynamoDBStore

T0 = datetime(2026, 9, 1, 10, 0)


@pytest.fixture
def ddb_store(dynamodb_resource):
    return DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource, allow_reset=True)


def _flag(**overrides):
    base = {
        "rule": "tamper", "subject_type": "meter", "subject_id": "M001", "feeder_id": "F001",
        "period_start": "2026-09-01", "period_end": "2026-09-02",
        "reason": "r", "confidence": 0.8, "evidence": {"n": 1},
    }
    return {**base, **overrides}


def test_implements_the_store_interface(ddb_store):
    assert isinstance(ddb_store, Store)


def test_reset_is_refused_unless_explicitly_allowed(dynamodb_resource):
    guarded = DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource)
    with pytest.raises(RuntimeError, match="allow_reset"):
        guarded.reset()


def test_floats_survive_the_round_trip_exactly(ddb_store):
    ddb_store.save([MeterReading("M001", T0, 0.1, 229.9)])
    got = ddb_store.meter_readings("M001", T0, T0 + timedelta(minutes=1))[0]
    assert (got.kwh, got.voltage) == (0.1, 229.9)


def test_conflicts_are_recorded_and_counted(ddb_store):
    ddb_store.save([MeterReading("M001", T0, 0.25)])
    ddb_store.save([MeterReading("M001", T0, 0.5), MeterReading("M001", T0, 0.75)])
    assert ddb_store.conflict_count() == 2


def test_flag_ids_are_deterministic_strings(dynamodb_resource):
    def make():
        return DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource, allow_reset=True)

    a = make()
    a.save_flags([_flag()])
    first = a.flags()[0]["flag_id"]
    assert isinstance(first, str) and len(first) == 32
    a.reset()
    a.save_flags([_flag()])
    assert a.flags()[0]["flag_id"] == first  # same rule, subject and period give the same id


def test_session_ttl_is_the_expiry_in_epoch_seconds(ddb_store):
    expires = datetime(2026, 10, 1, 13, 0)
    ddb_store.add_user("ops", "h", "ops", "Ops")
    ddb_store.add_session("tok", "ops", expires)
    item = ddb_store.platform.get_item(Key={"pk": "SESSION#tok", "sk": "SESSION"})["Item"]
    assert int(item["ttl"]) == int(expires.replace(tzinfo=WAT).timestamp())


def test_a_session_that_ttl_has_not_deleted_yet_is_still_rejected_once_expired(ddb_store):
    now = datetime(2026, 10, 1, 12, 0)
    ddb_store.add_user("ops", "h", "ops", "Ops")
    ddb_store.add_session("tok", "ops", now - timedelta(minutes=1))
    assert ddb_store.platform.get_item(Key={"pk": "SESSION#tok", "sk": "SESSION"}).get("Item")  # still stored
    assert ddb_store.session_user("tok", now) is None


def _log(store):
    for i in range(4):
        store.audit("ops", f"a{i}", "t", {"i": i})


def test_editing_an_audit_entry_breaks_the_chain_at_that_entry(ddb_store):
    _log(ddb_store)
    ddb_store.audit_table.update_item(
        Key={"pk": "LOG", "sk": "000000000002"},
        UpdateExpression="SET #d = :x",
        ExpressionAttributeNames={"#d": "details"},
        ExpressionAttributeValues={":x": '{"i": 99}'},
    )
    assert ddb_store.verify_audit_chain() == 2


def test_deleting_a_middle_audit_entry_is_detected(ddb_store):
    _log(ddb_store)
    ddb_store.audit_table.delete_item(Key={"pk": "LOG", "sk": "000000000002"})
    assert ddb_store.verify_audit_chain() == 3


def test_truncating_the_end_of_the_audit_log_is_detected(ddb_store):
    _log(ddb_store)
    ddb_store.audit_table.delete_item(Key={"pk": "LOG", "sk": "000000000004"})
    assert ddb_store.verify_audit_chain() == 4


def test_audit_append_retries_when_another_writer_moves_head(ddb_store, monkeypatch):
    ddb_store.audit("ops", "first", "t")
    real_get, calls = ddb_store._get, {"n": 0}
    stale = real_get(ddb_store.audit_table, "META", "HEAD")
    ddb_store.audit("rival", "second", "t")  # head moves on after we took our stale copy

    def flaky(table, pk, sk):
        if table is ddb_store.audit_table and (pk, sk) == ("META", "HEAD"):
            calls["n"] += 1
            if calls["n"] == 1:
                return stale  # first attempt sees an out-of-date head, so its transaction is cancelled
        return real_get(table, pk, sk)

    monkeypatch.setattr(ddb_store, "_get", flaky)
    ddb_store.audit("ops", "third", "t")
    assert calls["n"] == 2  # one cancelled attempt, one success
    assert [e["action"] for e in ddb_store.audit_entries()] == ["third", "second", "first"]
    assert ddb_store.verify_audit_chain() is None


def test_two_store_instances_share_one_intact_chain(dynamodb_resource):
    def make():
        return DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource)

    a, b = make(), make()
    for i in range(3):
        a.audit("a", f"x{i}", "t")
        b.audit("b", f"y{i}", "t")
    assert [e["seq"] for e in a.audit_entries()] == [6, 5, 4, 3, 2, 1]
    assert a.verify_audit_chain() is None


def test_session_ttl_attribute_matches_real_expiry_when_created_through_login(ddb_store):
    """DynamoDB deletes sessions by this epoch value, so it must be the true expiry instant."""
    from src.api.auth import SESSION_TTL, hash_password, login

    ddb_store.add_user("ops", hash_password("pw"), "operations", "Ops")
    login(ddb_store, "ops", "pw")
    items = ddb_store._scan_all(ddb_store.platform)
    ttl = int(next(i for i in items if i["pk"].startswith("SESSION#"))["ttl"])
    assert abs(ttl - (time.time() + SESSION_TTL.total_seconds())) < 10
