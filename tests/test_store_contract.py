"""Behaviour every Store implementation must match (SQLite today, DynamoDB next)."""
from datetime import datetime, timedelta

from src.ingest.validate import FeederReading, MeterReading

T0 = datetime(2026, 9, 1, 10, 0)


def _meter(minutes=0, kwh=0.25, meter_id="M001", **kw):
    return MeterReading(meter_id, T0 + timedelta(minutes=minutes), kwh, **kw)


def _feeder(minutes=0, voltage=230.0, feeder_id="F001", **kw):
    return FeederReading(feeder_id, T0 + timedelta(minutes=minutes), voltage, **kw)


def _flag(**overrides):
    base = {
        "rule": "tamper", "subject_type": "meter", "subject_id": "M001", "feeder_id": "F001",
        "period_start": "2026-09-01", "period_end": "2026-09-02",
        "reason": "tamper bit set", "confidence": 0.8, "evidence": {"count": 3},
    }
    return {**base, **overrides}


# Registry

def test_registry_round_trip(store):
    store.upsert_feeder("F002", "B")
    store.upsert_feeder("F001", "A")
    store.upsert_meter("M002", "F001")
    store.upsert_meter("M001", "F001")
    store.upsert_meter("M003", "F002")
    assert store.feeders() == [{"feeder_id": "F001", "band": "A"}, {"feeder_id": "F002", "band": "B"}]
    assert store.feeder_band("F001") == "A" and store.feeder_band("nope") is None
    assert store.meter_feeder("M003") == "F002" and store.meter_feeder("nope") is None
    assert store.meter_ids() == ["M001", "M002", "M003"]
    assert store.meter_ids("F001") == ["M001", "M002"]


def test_upserts_overwrite(store):
    store.upsert_feeder("F001", "A")
    store.upsert_feeder("F001", "C")
    store.upsert_meter("M001", "F001")
    store.upsert_meter("M001", "F002")
    assert store.feeder_band("F001") == "C"
    assert store.meter_feeder("M001") == "F002"


# Readings

def test_save_counts_new_readings(store):
    result = store.save([_meter(0), _meter(15), _feeder(0)])
    assert (result.accepted, result.duplicates, result.conflicts) == (3, 0, 0)


def test_replaying_a_reading_is_a_duplicate(store):
    store.save([_meter(0)])
    result = store.save([_meter(0)])
    assert (result.accepted, result.duplicates, result.conflicts) == (0, 1, 0)
    assert store.conflict_count() == 0


def test_same_key_different_values_is_a_conflict_and_first_value_wins(store):
    store.save([_meter(0, kwh=0.25)])
    result = store.save([_meter(0, kwh=0.99)])
    assert (result.accepted, result.duplicates, result.conflicts) == (0, 0, 1)
    assert store.conflict_count() == 1
    kept = store.meter_readings("M001", T0, T0 + timedelta(hours=1))
    assert [r.kwh for r in kept] == [0.25]


def test_feeder_duplicates_and_conflicts(store):
    store.save([_feeder(0, voltage=230.0)])
    again = store.save([_feeder(0, voltage=230.0), _feeder(0, voltage=100.0)])
    assert (again.accepted, again.duplicates, again.conflicts) == (0, 1, 1)


def test_time_range_is_half_open_and_ordered(store):
    store.save([_meter(30), _meter(0), _meter(15), _meter(45)])  # out of order on purpose
    got = store.meter_readings("M001", T0, T0 + timedelta(minutes=30))
    assert [r.timestamp for r in got] == [T0, T0 + timedelta(minutes=15)]  # end is excluded


def test_feeder_time_range_is_half_open_and_ordered(store):
    store.save([_feeder(30), _feeder(0), _feeder(15)])
    end = T0 + timedelta(minutes=30)
    assert [r.timestamp for r in store.feeder_readings("F001", T0, end)] == [T0, T0 + timedelta(minutes=15)]
    assert [ts for ts, _ in store.feeder_samples("F001", T0, end)] == [T0, T0 + timedelta(minutes=15)]


def test_empty_or_backwards_ranges_return_nothing(store):
    store.save([_meter(0), _feeder(0)])
    assert store.meter_readings("M001", T0, T0) == []
    assert store.meter_readings("M001", T0 + timedelta(hours=1), T0) == []
    assert store.feeder_readings("F001", T0 + timedelta(hours=1), T0) == []


def test_readings_are_per_source(store):
    store.save([_meter(0, meter_id="M001"), _meter(0, meter_id="M002", kwh=0.5)])
    got = store.meter_readings("M002", T0, T0 + timedelta(hours=1))
    assert [(r.meter_id, r.kwh) for r in got] == [("M002", 0.5)]


def test_meter_fields_round_trip(store):
    store.save([_meter(0, kwh=0.4, voltage=221.5, tamper=True), _meter(15)])
    first, second = store.meter_readings("M001", T0, T0 + timedelta(hours=1))
    assert (first.kwh, first.voltage, first.tamper) == (0.4, 221.5, True)
    assert (second.voltage, second.tamper) == (None, False)


def test_feeder_samples_and_readings(store):
    store.save([_feeder(15, voltage=0.0), _feeder(0, voltage=231.0, kwh=12.5)])
    end = T0 + timedelta(hours=1)
    assert store.feeder_samples("F001", T0, end) == [(T0, 231.0), (T0 + timedelta(minutes=15), 0.0)]
    first = store.feeder_readings("F001", T0, end)[0]
    assert first.kwh == 12.5


def test_reading_range_follows_feeder_readings(store):
    assert store.reading_range() is None
    store.save([_feeder(30), _feeder(0), _feeder(15)])
    assert store.reading_range() == (T0, T0 + timedelta(minutes=30))


def test_reading_range_widens_across_batches_and_never_shrinks(store):
    store.save([_feeder(30), _feeder(45)])
    store.save([_feeder(0)])  # earlier than anything stored
    assert store.reading_range() == (T0, T0 + timedelta(minutes=45))
    store.save([_feeder(60)])  # later than anything stored
    assert store.reading_range() == (T0, T0 + timedelta(minutes=60))
    store.save([_feeder(15)])  # inside the range: nothing changes
    assert store.reading_range() == (T0, T0 + timedelta(minutes=60))


# Flags

def test_save_flags_ignores_repeats_of_the_same_rule_subject_and_period(store):
    assert store.save_flags([_flag(), _flag(subject_id="M002")]) == 2
    assert store.save_flags([_flag(), _flag(period_start="2026-09-02")]) == 1


def test_flags_are_ordered_by_confidence_then_creation(store):
    store.save_flags([
        _flag(subject_id="M001", confidence=0.5),
        _flag(subject_id="M002", confidence=0.9),
        _flag(subject_id="M003", confidence=0.5),
    ])
    assert [f["subject_id"] for f in store.flags()] == ["M002", "M001", "M003"]


def test_flags_filter_by_status_and_feeder(store):
    store.save_flags([_flag(subject_id="M001"), _flag(subject_id="M002", feeder_id="F002")])
    assert [f["subject_id"] for f in store.flags(feeder_id="F002")] == ["M002"]
    target = store.flags(feeder_id="F001")[0]["flag_id"]
    store.decide_flags([target], "confirmed", "ops", "checked on site")
    assert [f["subject_id"] for f in store.flags(status="open")] == ["M002"]
    assert [f["subject_id"] for f in store.flags(status="confirmed")] == ["M001"]


def test_flag_lookup_and_decision(store):
    store.save_flags([_flag(evidence={"count": 3})])
    flag_id = store.flags()[0]["flag_id"]
    found = store.flag(flag_id)
    assert found["status"] == "open" and found["evidence"] == {"count": 3}
    assert found["decided_by"] is None
    store.decide_flags([flag_id], "dismissed", "ops", "false alarm")
    decided = store.flag(flag_id)
    assert (decided["status"], decided["decided_by"], decided["decision_note"]) == ("dismissed", "ops", "false alarm")
    assert decided["decided_at"]


def test_unknown_flag_is_none(store):
    store.save_flags([_flag()])
    real_id = store.flags()[0]["flag_id"]
    missing = real_id + 999 if isinstance(real_id, int) else "does-not-exist"
    assert store.flag(missing) is None


# Users and sessions

def test_users_upsert_and_lookup(store):
    store.add_user("ops", "hash1", "ops", "Ops One")
    store.add_user("cust", "hash2", "customer", "Customer", meter_id="M001")
    store.add_user("ops", "hash3", "ops", "Ops Renamed")
    assert store.user("nobody") is None
    assert store.user("cust")["meter_id"] == "M001"
    changed = store.user("ops")
    assert (changed["password_hash"], changed["display_name"]) == ("hash3", "Ops Renamed")


def test_sessions_expire_strictly_after_their_expiry_time(store):
    now = datetime(2026, 10, 1, 12, 0)
    store.add_user("ops", "h", "ops", "Ops")
    store.add_session("tok", "ops", now + timedelta(hours=1))
    assert store.session_user("tok", now)["username"] == "ops"
    assert store.session_user("tok", now + timedelta(hours=1)) is None  # expires_at == now is expired
    assert store.session_user("other", now) is None


def test_deleted_sessions_stop_working(store):
    now = datetime(2026, 10, 1, 12, 0)
    store.add_user("ops", "h", "ops", "Ops")
    store.add_session("tok", "ops", now + timedelta(hours=1))
    store.delete_session("tok")
    assert store.session_user("tok", now) is None


# Audit log

def test_empty_audit_chain_is_intact(store):
    assert store.verify_audit_chain() is None
    assert store.audit_entries() == []


def test_audit_entries_are_newest_first_and_chained(store):
    store.audit("ops", "login", "session", {"ip": "x"})
    store.audit("ops", "decide", "case/1", {"to": "confirmed"})
    store.audit("reg", "export", "csv")
    entries = store.audit_entries()
    assert [e["action"] for e in entries] == ["export", "decide", "login"]
    assert entries[2]["details"] == {"ip": "x"} and entries[0]["details"] == {}
    assert store.verify_audit_chain() is None
    assert entries[1]["prev_hash"] == entries[2]["hash"]  # each entry links to the one before


def test_audit_limit(store):
    for i in range(5):
        store.audit("ops", f"a{i}", "t")
    assert [e["action"] for e in store.audit_entries(limit=2)] == ["a4", "a3"]


# Lifecycle

def test_reset_clears_everything_and_the_store_still_works(store):
    store.upsert_feeder("F001", "A")
    store.save([_meter(0)])
    store.save_flags([_flag()])
    store.audit("ops", "x", "y")
    store.reset()
    assert store.feeders() == [] and store.flags() == [] and store.audit_entries() == []
    assert store.meter_readings("M001", T0, T0 + timedelta(hours=1)) == []
    store.upsert_feeder("F001", "B")
    assert store.feeder_band("F001") == "B"


# Feeder metadata (official NERC data). Both stores must behave identically.

OFFICIAL = {
    "source_feeder_name": "UNILORIN 33KV FEEDER", "disco": "IBEDC", "state": "KWARA", "business_unit": "CHALLENGE",
    "monthly_energy_cap_kwh": 258.0, "data_type": "official", "source_url": "https://nerc.gov.ng/example.pdf",
}
UNLABELLED = {"feeder_telemetry_source": "unknown", "meter_telemetry_source": "unknown"}
EMPTY_DETAILS = {
    "source_feeder_name": None, "disco": None, "state": None, "business_unit": None,
    "monthly_energy_cap_kwh": None, "data_type": "unknown", "source_url": None, **UNLABELLED,
}


def test_unknown_feeder_has_no_details(store):
    assert store.feeder_details("nope") is None


def test_a_feeder_without_metadata_has_the_full_shape_with_empty_fields(store):
    store.upsert_feeder("F001", "A")
    assert store.feeder_details("F001") == {"feeder_id": "F001", "band": "A", **EMPTY_DETAILS}


def test_metadata_round_trips_including_decimal_numbers(store):
    store.upsert_feeder("F001", "A", OFFICIAL)
    assert store.feeder_details("F001") == {"feeder_id": "F001", "band": "A", **OFFICIAL, **UNLABELLED}
    store.upsert_feeder("F002", "B", {**OFFICIAL, "monthly_energy_cap_kwh": 120000.5})
    cap = store.feeder_details("F002")["monthly_energy_cap_kwh"]
    assert cap == 120000.5 and isinstance(cap, float)


def test_new_metadata_replaces_the_old_completely(store):
    store.upsert_feeder("F001", "A", OFFICIAL)
    store.upsert_feeder("F001", "A", {"disco": "EKEDC"})
    assert store.feeder_details("F001") == {"feeder_id": "F001", "band": "A", **EMPTY_DETAILS, "disco": "EKEDC"}


def test_changing_only_the_band_keeps_the_metadata(store):
    store.upsert_feeder("F001", "A", OFFICIAL)
    store.upsert_feeder("F001", "C")
    details = store.feeder_details("F001")
    assert details["band"] == "C" and details["disco"] == "IBEDC" and details["monthly_energy_cap_kwh"] == 258.0


def test_unknown_metadata_fields_are_ignored(store):
    store.upsert_feeder("F001", "A", {**OFFICIAL, "surprise": "ignored"})
    assert "surprise" not in store.feeder_details("F001")


def test_metadata_does_not_change_the_plain_feeder_list(store):
    store.upsert_feeder("F001", "A", OFFICIAL)
    store.upsert_feeder("F002", "B")
    assert store.feeders() == [{"feeder_id": "F001", "band": "A"}, {"feeder_id": "F002", "band": "B"}]


# Telemetry source labels: where each feeder's readings come from.

import pytest  # noqa: E402

ALLOWED_SOURCES = ["simulated", "authorized_external", "lume_hardware", "none", "unknown"]


def test_a_new_feeder_is_unlabelled_not_assumed_real(store):
    store.upsert_feeder("F001", "A")
    details = store.feeder_details("F001")
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("unknown", "unknown")


@pytest.mark.parametrize("source", ALLOWED_SOURCES)
def test_every_allowed_source_can_be_set(store, source):
    store.upsert_feeder("F001", "A")
    store.set_telemetry_sources("F001", source, source)
    details = store.feeder_details("F001")
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == (source, source)


def test_feeder_and_meter_sources_are_independent(store):
    store.upsert_feeder("F001", "A")
    store.set_telemetry_sources("F001", feeder_source="authorized_external", meter_source="simulated")
    store.set_telemetry_sources("F001", meter_source="lume_hardware")  # only the meters change
    details = store.feeder_details("F001")
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("authorized_external", "lume_hardware")


def test_an_unrecognised_source_is_refused_and_changes_nothing(store):
    store.upsert_feeder("F001", "A")
    store.set_telemetry_sources("F001", "simulated", "simulated")
    for bad in ("real", "SIMULATED", "", "observed"):
        with pytest.raises(ValueError):
            store.set_telemetry_sources("F001", feeder_source=bad)
        with pytest.raises(ValueError):
            store.set_telemetry_sources("F001", meter_source=bad)
    assert store.feeder_details("F001")["feeder_telemetry_source"] == "simulated"


def test_labelling_a_feeder_that_does_not_exist_is_an_error(store):
    with pytest.raises(KeyError):
        store.set_telemetry_sources("NOPE", "simulated", "simulated")
    with pytest.raises(KeyError):
        store.set_telemetry_sources("NOPE")
    assert store.feeder_details("NOPE") is None and store.feeders() == []


def test_a_call_with_nothing_to_change_changes_nothing(store):
    store.upsert_feeder("F001", "A")
    store.set_telemetry_sources("F001", "simulated", "none")
    store.set_telemetry_sources("F001")
    details = store.feeder_details("F001")
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("simulated", "none")


def test_labels_survive_band_and_metadata_updates(store):
    store.upsert_feeder("F001", "A", OFFICIAL)
    store.set_telemetry_sources("F001", "none", "none")
    store.upsert_feeder("F001", "C")
    store.upsert_feeder("F001", "C", {"disco": "EKEDC"})
    details = store.feeder_details("F001")
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("none", "none")
    assert details["disco"] == "EKEDC" and details["band"] == "C"


def test_labelling_does_not_touch_metadata_or_the_feeder_list(store):
    store.upsert_feeder("F001", "A", OFFICIAL)
    store.set_telemetry_sources("F001", "simulated", "simulated")
    details = store.feeder_details("F001")
    assert {k: details[k] for k in OFFICIAL} == OFFICIAL
    assert store.feeders() == [{"feeder_id": "F001", "band": "A"}]


def test_reset_forgets_labels(store):
    store.upsert_feeder("F001", "A")
    store.set_telemetry_sources("F001", "simulated", "simulated")
    store.reset()
    store.upsert_feeder("F001", "A")
    assert store.feeder_details("F001")["feeder_telemetry_source"] == "unknown"
