from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.api.auth import hash_password
from src.ingest.validate import FeederReading, MeterReading
from src.store import SQLiteStore

START = datetime(2026, 9, 1)
SLOTS = [START + timedelta(minutes=15 * i) for i in range(96 * 3)]
PASSWORD = "test-password"


@pytest.fixture()
def store(store):  # builds on the shared fixture in conftest, so every test runs against each store
    s = store
    s.upsert_feeder("F001", "A")
    s.set_telemetry_sources("F001", "simulated", "simulated")
    for m in ("M001", "M002"):
        s.upsert_meter(m, "F001")
    s.save([FeederReading("F001", t, 230.0 if t.hour >= 6 else 0.0, 2.0) for t in SLOTS])
    s.save([MeterReading(m, t, 0.1 if t.hour >= 6 else 0.0) for m in ("M001", "M002") for t in SLOTS])
    s.add_user("cust", hash_password(PASSWORD), "customer", "Customer", "M001")
    s.add_user("ops", hash_password(PASSWORD), "operations", "Ops")
    s.add_user("reg", hash_password(PASSWORD), "regulator", "Regulator")
    flag = {
        "subject_type": "meter", "subject_id": "M002", "feeder_id": "F001",
        "period_start": "2026-09-01", "period_end": "2026-09-04", "reason": "test", "evidence": {},
    }
    s.save_flags([{**flag, "rule": "tamper_event", "confidence": 0.7}, {**flag, "rule": "consumption_drop", "confidence": 0.9}])
    return s


@pytest.fixture()
def client(store):
    return TestClient(create_app(store, ingest_api_key="device-key"))


def _login(client, username):
    resp = client.post("/auth/login", json={"username": username, "password": PASSWORD})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def test_wrong_password_is_rejected_and_audited(client, store):
    assert client.post("/auth/login", json={"username": "ops", "password": "nope"}).status_code == 401
    assert client.post("/auth/login", json={"username": "ghost", "password": "nope"}).status_code == 401
    assert [e["action"] for e in store.audit_entries()] == ["auth.login_failed", "auth.login_failed"]


def test_requests_without_token_are_rejected(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer made-up"}).status_code == 401


def test_logout_ends_session(client):
    h = _login(client, "ops")
    assert client.post("/auth/logout", headers=h).status_code == 200
    assert client.get("/me", headers=h).status_code == 401


@pytest.mark.parametrize(
    "user, path, status",
    [
        ("cust", "/ops/cases", 403),
        ("cust", "/regulator/compliance", 403),
        ("cust", "/audit", 403),
        ("ops", "/customer/summary", 403),
        ("ops", "/regulator/compliance", 403),
        ("reg", "/ops/cases", 403),
        ("reg", "/customer/summary", 403),
        ("ops", "/audit", 200),
        ("reg", "/audit", 200),
    ],
)
def test_roles_are_enforced(client, user, path, status):
    assert client.get(path, headers=_login(client, user)).status_code == status


def test_customer_sees_only_own_meter(client):
    body = client.get("/customer/summary", headers=_login(client, "cust")).json()
    assert body["meter_id"] == "M001"
    assert body["period"] == {"start": "2026-09-01", "end": "2026-09-04"}
    assert len(body["daily"]) == 3 and body["daily"][0]["supply_hours"] == 18.0
    assert body["supply"]["band"] == "A" and body["bill"]["total"]


def test_flags_for_one_meter_form_one_case(client):
    cases = client.get("/ops/cases", headers=_login(client, "ops")).json()
    assert len(cases) == 1
    case = cases[0]
    assert case["subject_id"] == "M002" and case["status"] == "open"
    assert case["confidence"] == 0.9 and [f["rule"] for f in case["flags"]] == ["consumption_drop", "tamper_event"]


def test_case_detail_includes_meter_usage_and_is_audited(client, store):
    case = client.get("/ops/cases/meter/M002", headers=_login(client, "ops")).json()
    assert len(case["meter"]["daily"]) == 3
    assert store.audit_entries()[0]["action"] == "meter.view"


def test_unknown_case_is_404(client):
    h = _login(client, "ops")
    assert client.get("/ops/cases/meter/M001", headers=h).status_code == 404
    assert client.get("/ops/cases/pump/M002", headers=h).status_code == 422


def test_case_decision_requires_note_covers_every_flag_and_is_audited(client, store):
    h = _login(client, "ops")
    url = "/ops/cases/meter/M002/decision"
    assert client.post(url, json={"status": "confirmed"}, headers=h).status_code == 422
    case = client.post(url, json={"status": "confirmed", "note": "Bypass found on site"}, headers=h).json()
    assert case["status"] == "confirmed"
    assert {f["status"] for f in case["flags"]} == {"confirmed"} and {f["decided_by"] for f in case["flags"]} == {"ops"}
    entry = store.audit_entries()[0]
    assert entry["action"] == "case.decide" and entry["details"]["to"] == "confirmed" and len(entry["details"]["flag_ids"]) == 2
    assert store.verify_audit_chain() is None


def test_new_flag_reopens_a_decided_case(client, store):
    h = _login(client, "ops")
    client.post("/ops/cases/meter/M002/decision", json={"status": "dismissed", "note": "Customer away"}, headers=h)
    store.save_flags([{
        "rule": "zero_with_supply", "subject_type": "meter", "subject_id": "M002", "feeder_id": "F001",
        "period_start": "2026-09-04", "period_end": "2026-09-08", "reason": "new", "confidence": 0.5, "evidence": {},
    }])
    assert client.get("/ops/cases?status=open", headers=h).json()[0]["subject_id"] == "M002"


def test_feeder_overview_counts_open_cases(client):
    feeders = client.get("/ops/feeders", headers=_login(client, "ops")).json()
    assert feeders[0]["feeder_id"] == "F001" and feeders[0]["open_cases"] == 1 and feeders[0]["meters"] == 2


def test_compliance_csv_export_is_audited(client, store):
    resp = client.get("/regulator/compliance.csv", headers=_login(client, "reg"))
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/csv")
    assert "SIMULATED" in resp.text and "F001" in resp.text
    assert store.audit_entries()[0]["action"] == "report.export"


def test_bad_period_is_rejected(client):
    h = _login(client, "reg")
    assert client.get("/regulator/compliance?from=2026-09-05&to=2026-09-01", headers=h).status_code == 422
    assert client.get("/regulator/compliance?from=2026-01-01&to=2026-09-01", headers=h).status_code == 422


def test_ingest_needs_api_key(client):
    body = {"kind": "meter", "readings": [{"meter_id": "M001", "timestamp": "2026-09-05T00:00:00", "kwh": 0.1}]}
    assert client.post("/ingest", json=body).status_code == 401
    resp = client.post("/ingest", json=body, headers={"X-Api-Key": "device-key"})
    assert resp.status_code == 200 and resp.json()["accepted"] == 1


def test_ingest_disabled_without_configured_key(store):
    client = TestClient(create_app(store))
    body = {"kind": "meter", "readings": [{"meter_id": "M001", "timestamp": "2026-09-05T00:00:00", "kwh": 0.1}]}
    assert client.post("/ingest", json=body, headers={"X-Api-Key": ""}).status_code == 503


# Official feeders with no telemetry, and the source labels on every feeder row.

UNILORIN = "IBEDC-KWARA-CHALLENGE-UNILORIN-33KV"
OFFICIAL_META = {
    "source_feeder_name": "UNILORIN 33KV FEEDER", "disco": "IBEDC", "state": "KWARA", "business_unit": "CHALLENGE",
    "monthly_energy_cap_kwh": 258.0, "data_type": "official", "source_url": "https://nerc.gov.ng/example.pdf",
}


def _add_official(store):
    store.upsert_feeder(UNILORIN, "A", OFFICIAL_META)
    store.upsert_feeder("IBEDC-KWARA-CHALLENGE-BABA-ODE-11KV", "D", {**OFFICIAL_META, "source_feeder_name": "BABA ODE 11KV FEEDER"})
    for fid in (UNILORIN, "IBEDC-KWARA-CHALLENGE-BABA-ODE-11KV"):
        store.set_telemetry_sources(fid, "none", "none")


def test_official_feeders_without_telemetry_are_hidden_by_default(client, store):
    _add_official(store)
    ops, reg = _login(client, "ops"), _login(client, "reg")
    assert [f["feeder_id"] for f in client.get("/ops/feeders", headers=ops).json()] == ["F001"]
    assert [f["feeder_id"] for f in client.get("/regulator/compliance", headers=reg).json()] == ["F001"]


def test_official_feeders_without_telemetry_are_never_reported_compliant(client, store):
    _add_official(store)
    rows = client.get("/regulator/compliance?include_untracked=true", headers=_login(client, "reg")).json()
    official = {r["feeder_id"]: r for r in rows if r["feeder_id"].startswith("IBEDC")}
    assert len(official) == 2
    for row in official.values():
        assert row["status"] == "no_data" and row["compliance_rate"] is None
        assert row["days_met"] == row["days_failed"] == 0 and row["days_insufficient_data"] == len(row["days"])
        assert (row["feeder_telemetry_source"], row["meter_telemetry_source"]) == ("none", "none")
    assert official[UNILORIN]["official"] == OFFICIAL_META and official[UNILORIN]["band"] == "A"
    assert next(r for r in rows if r["feeder_id"] == "F001")["status"] != "no_data"


def test_ops_overview_can_include_them_too(client, store):
    _add_official(store)
    rows = client.get("/ops/feeders?include_untracked=true", headers=_login(client, "ops")).json()
    row = next(r for r in rows if r["feeder_id"] == UNILORIN)
    assert (row["status"], row["meters"], row["open_cases"]) == ("no_data", 0, 0)


def test_tracked_feeders_say_where_their_data_comes_from(client, store):
    row = client.get("/regulator/compliance", headers=_login(client, "reg")).json()[0]
    assert (row["feeder_telemetry_source"], row["meter_telemetry_source"], row["official"]) == ("simulated", "simulated", None)


def test_a_tracked_feeder_whose_data_stops_is_no_data_not_compliant(client, store):
    store.upsert_feeder("F002", "B")
    store.set_telemetry_sources("F002", "authorized_external", "simulated")
    rows = client.get("/regulator/compliance?from=2026-09-01&to=2026-09-04", headers=_login(client, "reg")).json()
    row = next(r for r in rows if r["feeder_id"] == "F002")
    assert row["status"] == "no_data" and row["compliance_rate"] is None  # listed, because telemetry is expected


def test_csv_banner_is_truthful_about_sources(client, store):
    reg = _login(client, "reg")
    text = client.get("/regulator/compliance.csv", headers=reg).text
    assert text.splitlines()[0].startswith("# SIMULATED DATA") and text.splitlines()[1].endswith("feeder_telemetry_source,meter_telemetry_source")
    _add_official(store)
    mixed = client.get("/regulator/compliance.csv?include_untracked=true", headers=reg).text
    assert mixed.splitlines()[0].startswith("# TELEMETRY SOURCES: none / simulated,period") and UNILORIN in mixed and ",no_data," in mixed


def test_csv_never_claims_simulated_for_unlabelled_data(client, store):
    store.upsert_feeder("F001", "A")  # relabelling is not part of this call, so F001 stays simulated
    store.reset()
    store.upsert_feeder("F009", "A")
    store.save([FeederReading("F009", t, 230.0, 2.0) for t in SLOTS])
    store.add_user("reg", hash_password(PASSWORD), "regulator", "Regulator")
    text = client.get("/regulator/compliance.csv", headers=_login(client, "reg")).text
    assert text.splitlines()[0].startswith("# TELEMETRY SOURCES: unknown") and "SIMULATED" not in text.splitlines()[0]
