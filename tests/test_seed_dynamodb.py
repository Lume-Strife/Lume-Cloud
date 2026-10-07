"""scripts/seed_dynamodb.py, run for real (small simulation) against moto, then used through the API."""
import pytest
from fastapi.testclient import TestClient

from conftest import TABLES
from scripts.seed_dynamodb import prepare, run_simulator, seed, table_counts
from src.api.app import create_app
from src.store_dynamodb import DynamoDBStore


@pytest.fixture
def ddb(dynamodb_resource):
    return DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource, allow_reset=True)


@pytest.fixture(scope="module")
def sim_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("sim")
    run_simulator(out, days=8, meters=6, feeders="F001:A:18.5,F002:C:13", theft_rate=0.3, seed=7)
    return out


def test_seed_loads_data_and_creates_accounts_that_work_through_the_api(ddb, sim_dir):
    lines = []
    result = seed(ddb, sim_dir, workers=2, out=lines.append)
    assert result["loaded"]["feeder"] > 1000 and result["loaded"]["meter"] > 5000 and not result["rejected"]
    assert result["flags"] > 0 and len(ddb.flags()) > 0
    assert [f["feeder_id"] for f in ddb.feeders()] == ["F001", "F002"] and len(ddb.meter_ids()) == 12
    assert ddb.verify_audit_chain() is None and ddb.audit_entries()[0]["action"] == "demo.seed"

    client = TestClient(create_app(ddb))
    for username, role, _, _ in result["accounts"]:
        resp = client.post("/auth/login", json={"username": username, "password": result["passwords"][username]})
        assert resp.status_code == 200, (username, resp.text)
    token = client.post("/auth/login", json={"username": "customer", "password": result["passwords"]["customer"]}).json()["token"]
    summary = client.get("/customer/summary", headers={"Authorization": f"Bearer {token}"})
    assert summary.status_code == 200 and summary.json()


def test_passwords_are_random_and_never_the_public_demo_password(ddb, sim_dir):
    passwords = seed(ddb, sim_dir, workers=1, out=lambda *_: None)["passwords"]
    assert len(set(passwords.values())) == len(passwords)
    assert all(len(p) >= 12 and p != "demo-password" for p in passwords.values())
    assert ddb.user("ops")["password_hash"] != "demo-password"


def test_the_old_public_password_does_not_work(ddb, sim_dir):
    seed(ddb, sim_dir, workers=1, out=lambda *_: None)
    resp = TestClient(create_app(ddb)).post("/auth/login", json={"username": "ops", "password": "demo-password"})
    assert resp.status_code == 401


def test_refuses_tables_that_already_hold_data_and_changes_nothing(ddb):
    ddb.upsert_feeder("REAL", "A")
    lines = []
    assert prepare(ddb, wipe=False, out=lines.append) is False and lines[0].startswith("ABORTED")
    assert ddb.feeder_band("REAL") == "A"


def test_wipe_needs_confirmation(ddb):
    ddb.upsert_feeder("REAL", "A")
    assert prepare(ddb, wipe=True, confirm=lambda: False, out=lambda *_: None) is False
    assert ddb.feeder_band("REAL") == "A"
    assert prepare(ddb, wipe=True, confirm=lambda: True, out=lambda *_: None) is True
    assert table_counts(ddb) == [0, 0, 0]


def test_empty_tables_are_fine_to_seed(ddb):
    assert prepare(ddb, wipe=False, out=lambda *_: None) is True


def test_seeded_feeders_are_labelled_simulated(ddb, sim_dir):
    seed(ddb, sim_dir, workers=1, out=lambda *_: None)
    for f in ddb.feeders():
        details = ddb.feeder_details(f["feeder_id"])
        assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("simulated", "simulated")
