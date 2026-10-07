"""The official NERC register: validation, the SQLite loader, the DynamoDB loader, and the labelling tool."""
import csv
import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from conftest import TABLES
from scripts.load_official_dynamodb import DEFAULT_CSV, load_official
from scripts.official_data.load_nerc_feeders import load, read_official_rows
from scripts.set_telemetry_source import apply, list_sources
from src.api.app import create_app
from src.api.auth import hash_password
from src.ingest.validate import FeederReading, MeterReading
from src.store import SQLiteStore
from src.store_dynamodb import DynamoDBStore

UNILORIN = "IBEDC-KWARA-CHALLENGE-UNILORIN-33KV"
HEADER = "feeder_id,source_feeder_name,disco,state,business_unit,service_band,monthly_energy_cap_kwh,cap_month,energy_reference_month,data_type,source_page,source_url"


def _csv(tmp_path, *rows, header=HEADER):
    path = tmp_path / "f.csv"
    path.write_text("\n".join([header, *rows]) + "\n", encoding="utf-8")
    return path


def _row(fid="X-1", band="A", cap="100", dtype="official"):
    return f"{fid},NAME {fid},DISCO,STATE,UNIT,{band},{cap},2026-09,2026-08,{dtype},2,https://example.org/x.pdf"


@pytest.fixture
def ddb(dynamodb_resource):
    return DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource, allow_reset=True)


# Validation: nothing is written, and bad files are refused whole.

def test_the_real_file_validates():
    rows = read_official_rows(DEFAULT_CSV)
    assert len(rows) == 21 and len({r["feeder_id"] for r in rows}) == 21
    unilorin = next(r for r in rows if r["feeder_id"] == UNILORIN)
    assert unilorin["band"] == "A" and unilorin["metadata"]["monthly_energy_cap_kwh"] == 258.0
    assert unilorin["metadata"]["source_url"].startswith("https://nerc.gov.ng/")


@pytest.mark.parametrize("rows, message", [
    ([_row(band="Z")], "invalid service band"),
    ([_row(dtype="simulated")], "non-official"),
    ([_row("A"), _row("A")], "duplicate"),
    ([_row(fid=" ")], "empty feeder_id"),
    ([_row(cap="lots")], "not a number"),
])
def test_bad_rows_are_refused(tmp_path, rows, message):
    with pytest.raises(ValueError, match=message):
        read_official_rows(_csv(tmp_path, *rows))


def test_a_file_missing_columns_is_refused(tmp_path):
    with pytest.raises(ValueError, match="Missing required columns"):
        read_official_rows(_csv(tmp_path, "X,Y", header="feeder_id,disco"))


def test_one_bad_row_means_nothing_is_loaded(tmp_path, ddb):
    path = _csv(tmp_path, _row("GOOD-1"), _row("BAD-1", band="Q"))
    with pytest.raises(ValueError):
        load_official(ddb, path, out=lambda *_: None)
    assert ddb.feeders() == []


# SQLite loader

def test_sqlite_loader_labels_official_feeders_as_having_no_telemetry(tmp_path):
    db = tmp_path / "n.db"
    assert load(DEFAULT_CSV, str(db)) == 21
    store = SQLiteStore(db)
    details = store.feeder_details(UNILORIN)
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("none", "none")
    store.close()


def test_sqlite_loader_never_overwrites_a_label_chosen_later(tmp_path):
    db = tmp_path / "n.db"
    load(DEFAULT_CSV, str(db))
    store = SQLiteStore(db)
    store.set_telemetry_sources(UNILORIN, "simulated", "simulated")
    store.close()
    load(DEFAULT_CSV, str(db))  # re-run
    store = SQLiteStore(db)
    assert store.feeder_details(UNILORIN)["feeder_telemetry_source"] == "simulated"
    store.close()


# DynamoDB loader

def _demo_feeder(store):
    store.upsert_feeder("F001", "A")
    store.set_telemetry_sources("F001", "simulated", "simulated")
    store.upsert_meter("M001", "F001")
    t0 = __import__("datetime").datetime(2026, 9, 1)
    store.save([FeederReading("F001", t0, 230.0, 2.0), MeterReading("M001", t0, 0.1)])
    store.add_user("reg", hash_password("pw-pw-pw-pw"), "regulator", "Reg")
    store.save_flags([{"rule": "tamper_event", "subject_type": "meter", "subject_id": "M001", "feeder_id": "F001",
                       "period_start": "2026-09-01", "period_end": "2026-09-02", "reason": "r", "confidence": 0.5, "evidence": {}}])
    store.audit("system", "demo", "x")


def _snapshot(store):
    return ([i for t in (store.readings, store.audit_table) for i in sorted(store._scan_all(t), key=lambda x: (x["pk"], x["sk"]))],
            [i for i in store._scan_all(store.platform) if not i["pk"].startswith("REGISTRY")])


def test_dry_run_changes_nothing(ddb):
    lines = []
    summary = load_official(ddb, DEFAULT_CSV, dry_run=True, out=lines.append)
    assert summary["new"] == 21 and summary["dry_run"] and ddb.feeders() == [] and "DRY RUN" in lines[0]


def test_loading_adds_the_register_and_labels_it(ddb):
    summary = load_official(ddb, DEFAULT_CSV, out=lambda *_: None)
    assert (summary["new"], summary["updated"], summary["labelled_none"]) == (21, 0, 21)
    details = ddb.feeder_details(UNILORIN)
    assert details["band"] == "A" and details["monthly_energy_cap_kwh"] == 258.0 and details["data_type"] == "official"
    assert (details["feeder_telemetry_source"], details["meter_telemetry_source"]) == ("none", "none")


def test_loading_leaves_everything_else_exactly_as_it_was(ddb):
    _demo_feeder(ddb)
    before = _snapshot(ddb)
    load_official(ddb, DEFAULT_CSV, out=lambda *_: None)
    assert _snapshot(ddb) == before  # readings, audit, users, flags, sessions, markers all untouched
    assert ddb.feeder_details("F001")["feeder_telemetry_source"] == "simulated" and len(ddb.feeders()) == 22


def test_loading_twice_is_harmless_and_keeps_later_labels(ddb):
    load_official(ddb, DEFAULT_CSV, out=lambda *_: None)
    ddb.set_telemetry_sources(UNILORIN, "authorized_external", "simulated")
    second = load_official(ddb, DEFAULT_CSV, out=lambda *_: None)
    assert (second["new"], second["updated"], second["labelled_none"]) == (0, 21, 0)
    assert ddb.feeder_details(UNILORIN)["feeder_telemetry_source"] == "authorized_external"
    assert len(ddb.feeders()) == 21


def test_the_live_scenario_dashboards_are_unchanged_and_the_register_is_available_on_request(ddb):
    _demo_feeder(ddb)
    load_official(ddb, DEFAULT_CSV, out=lambda *_: None)
    client = TestClient(create_app(ddb))
    token = client.post("/auth/login", json={"username": "reg", "password": "pw-pw-pw-pw"}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    default = client.get("/regulator/compliance", headers=h).json()
    assert [r["feeder_id"] for r in default] == ["F001"] and default[0]["feeder_telemetry_source"] == "simulated"
    full = client.get("/regulator/compliance?include_untracked=true", headers=h).json()
    official = [r for r in full if r["feeder_id"].startswith("IBEDC")]
    assert len(full) == 22 and len(official) == 21
    assert {r["status"] for r in official} == {"no_data"}  # never "compliant", never "breached"
    csv_text = client.get("/regulator/compliance.csv?include_untracked=true", headers=h).text
    assert csv_text.splitlines()[0].startswith("# TELEMETRY SOURCES: none / simulated")
    assert len(list(csv.reader(io.StringIO(csv_text)))) == 2 + 22


# Labelling tool

def test_apply_labels_the_named_feeders(ddb):
    for f in ("F001", "F002"):
        ddb.upsert_feeder(f, "A")
    lines = []
    assert apply(ddb, ["F001", "F002"], "simulated", "simulated", out=lines.append) is True
    assert all(ddb.feeder_details(f)["feeder_telemetry_source"] == "simulated" for f in ("F001", "F002"))


def test_a_typo_in_one_feeder_changes_nothing(ddb):
    ddb.upsert_feeder("F001", "A")
    lines = []
    assert apply(ddb, ["F001", "F00l"], "simulated", "simulated", out=lines.append) is False
    assert "unknown feeder" in lines[0] and ddb.feeder_details("F001")["feeder_telemetry_source"] == "unknown"


def test_a_bad_source_or_no_source_changes_nothing(ddb):
    ddb.upsert_feeder("F001", "A")
    assert apply(ddb, ["F001"], "real", None, out=lambda *_: None) is False
    assert apply(ddb, ["F001"], None, None, out=lambda *_: None) is False
    assert ddb.feeder_details("F001")["feeder_telemetry_source"] == "unknown"


def test_list_shows_what_is_set_and_changes_nothing(ddb):
    ddb.upsert_feeder("F001", "A")
    ddb.set_telemetry_sources("F001", "simulated", "none")
    lines = []
    rows = list_sources(ddb, out=lines.append)
    assert rows[0]["feeder_telemetry_source"] == "simulated" and "simulated" in lines[0] and "none" in lines[0]
