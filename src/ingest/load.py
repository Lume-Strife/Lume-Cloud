"""Bulk-load simulator output into the store.

Usage: python -m src.ingest.load data/ --db data/platform.db
Reads feeders.csv, meters.csv, feeder_readings.csv and meter_readings.csv from the directory.
"""
import argparse
import csv
from pathlib import Path

from .handler import ingest
from .store import SQLiteStore


def _rows(path: Path):
    with open(path, newline="") as f:
        yield from csv.DictReader(f)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("data_dir")
    p.add_argument("--db", default="data/platform.db")
    args = p.parse_args()
    data = Path(args.data_dir)
    store = SQLiteStore(args.db)

    for row in _rows(data / "feeders.csv"):
        store.upsert_feeder(row["feeder_id"], row["band"])
    for row in _rows(data / "meters.csv"):
        store.upsert_meter(row["meter_id"], row["feeder_id"])

    for kind in ("feeder", "meter"):
        result = ingest(kind, _rows(data / f"{kind}_readings.csv"), store)
        print(
            f"{kind}: accepted={result.accepted} duplicates={result.duplicates} "
            f"conflicts={result.conflicts} rejected={len(result.rejected)}"
        )
        for r in result.rejected[:5]:
            print(f"  row {r['index'] + 2}: {'; '.join(r['errors'])}")
    store.close()


if __name__ == "__main__":
    main()
