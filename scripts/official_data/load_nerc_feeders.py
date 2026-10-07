"""Load official NERC feeder metadata into the local SQLite store.

    python -m scripts.official_data.load_nerc_feeders data/official/nerc/<file>.csv --db data/platform.db

read_official_rows() validates a file and writes nothing, so the DynamoDB loader
(scripts/load_official_dynamodb.py) shares exactly the same checks.
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

from src.store import SQLiteStore

REQUIRED_COLUMNS = {
    "feeder_id", "source_feeder_name", "disco", "state", "business_unit",
    "service_band", "monthly_energy_cap_kwh", "data_type", "source_url",
}


def read_official_rows(path: Path) -> list[dict]:
    """Read and validate an official feeder file. Returns {feeder_id, band, metadata} rows; writes nothing."""
    with Path(path).open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing required columns: {sorted(missing)}")
        rows, seen = [], set()
        for line, row in enumerate(reader, start=2):
            feeder_id = row["feeder_id"].strip()
            if not feeder_id:
                raise ValueError(f"{path}, line {line}: empty feeder_id")
            if feeder_id in seen:
                raise ValueError(f"{path}, line {line}: duplicate feeder_id {feeder_id}")
            seen.add(feeder_id)
            band = row["service_band"].strip().upper()
            if row["data_type"].strip().lower() != "official":
                raise ValueError(f"{path}: non-official row found for {feeder_id}")
            if band not in {"A", "B", "C", "D", "E"}:
                raise ValueError(f"{feeder_id}: invalid service band {band!r}")
            try:
                cap = float(row["monthly_energy_cap_kwh"])
            except ValueError:
                raise ValueError(f"{feeder_id}: monthly_energy_cap_kwh is not a number: {row['monthly_energy_cap_kwh']!r}") from None
            rows.append({
                "feeder_id": feeder_id,
                "band": band,
                "metadata": {
                    "source_feeder_name": row["source_feeder_name"].strip(),
                    "disco": row["disco"].strip(),
                    "state": row["state"].strip(),
                    "business_unit": row["business_unit"].strip(),
                    "monthly_energy_cap_kwh": cap,
                    "data_type": "official",
                    "source_url": row["source_url"].strip(),
                },
            })
    return rows


def register(store, rows: list[dict]) -> int:
    """Add the feeders to a store. Official register entries have no telemetry, so an unlabelled feeder is
    labelled "none". A feeder that already has a label keeps it, so re-running never undoes a later choice."""
    labelled = 0
    for row in rows:
        store.upsert_feeder(row["feeder_id"], row["band"], metadata=row["metadata"])
        if store.feeder_details(row["feeder_id"])["feeder_telemetry_source"] == "unknown":
            store.set_telemetry_sources(row["feeder_id"], "none", "none")
            labelled += 1
    return labelled


def load(path: Path, db_path: str) -> int:
    rows = read_official_rows(path)
    store = SQLiteStore(db_path)
    try:
        register(store, rows)
    finally:
        store.close()
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load official NERC feeder metadata into Lume.")
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--db", default="data/platform.db")
    args = parser.parse_args()
    print(f"Loaded {load(args.csv_path, args.db)} official NERC feeder records.")


if __name__ == "__main__":
    main()
