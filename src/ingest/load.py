"""Bulk-load simulator output into the store.

Usage: python -m src.ingest.load data/ --db data/platform.db
Reads feeders.csv, meters.csv, feeder_readings.csv and meter_readings.csv from the directory.
"""
import argparse
import csv
from pathlib import Path

from src.store import IngestResult, SQLiteStore

from .handler import ingest


def _rows(path: Path):
    with open(path, newline="") as f:
        yield from csv.DictReader(f)


def load_dir(store: SQLiteStore, data: Path) -> dict[str, IngestResult]:
    for row in _rows(data / "feeders.csv"):
        store.upsert_feeder(row["feeder_id"], row["band"])
    for row in _rows(data / "meters.csv"):
        store.upsert_meter(row["meter_id"], row["feeder_id"])
    return {kind: ingest(kind, _rows(data / f"{kind}_readings.csv"), store) for kind in ("feeder", "meter")}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("data_dir")
    p.add_argument("--db", default="data/platform.db")
    args = p.parse_args()
    store = SQLiteStore(args.db)
    for kind, result in load_dir(store, Path(args.data_dir)).items():
        print(
            f"{kind}: accepted={result.accepted} duplicates={result.duplicates} "
            f"conflicts={result.conflicts} rejected={len(result.rejected)}"
        )
        for r in result.rejected[:5]:
            print(f"  row {r['index'] + 2}: {'; '.join(r['errors'])}")
    store.close()


if __name__ == "__main__":
    main()
