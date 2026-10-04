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
