from pathlib import Path

from src.store import SQLiteStore

CSV_PATH = Path(
    "data/official/nerc/ibedc_2026-09_kwara_challenge_feeders.csv"
)

FEEDER_ID = "IBEDC-KWARA-CHALLENGE-UNILORIN-33KV"


def test_nerc_csv_contains_unilorin_feeder():
    import csv

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    row = next(r for r in rows if r["feeder_id"] == FEEDER_ID)

    assert row["source_feeder_name"] == "UNILORIN 33KV FEEDER"
    assert row["disco"] == "IBEDC"
    assert row["state"] == "KWARA"
    assert row["service_band"] == "A"
    assert row["data_type"] == "official"


def test_nerc_feeder_metadata_loads_into_store(tmp_path):
    from scripts.official_data.load_nerc_feeders import load

    db = tmp_path / "nerc.db"

    loaded = load(CSV_PATH, str(db))

    assert loaded == 21

    store = SQLiteStore(db)
    try:
        details = store.feeder_details(FEEDER_ID)

        assert details is not None
        assert details["band"] == "A"
        assert details["source_feeder_name"] == "UNILORIN 33KV FEEDER"
        assert details["disco"] == "IBEDC"
        assert details["state"] == "KWARA"
        assert details["business_unit"] == "CHALLENGE"
        assert details["monthly_energy_cap_kwh"] == 258.0
        assert details["data_type"] == "official"
    finally:
        store.close()
