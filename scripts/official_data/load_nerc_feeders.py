from __future__ import annotations

import argparse
import csv
from pathlib import Path

from src.store import SQLiteStore


REQUIRED_COLUMNS = {
    "feeder_id",
    "source_feeder_name",
    "disco",
    "state",
    "business_unit",
    "service_band",
    "monthly_energy_cap_kwh",
    "data_type",
    "source_url",
}


def load(path: Path, db_path: str) -> int:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - columns

        if missing:
            raise ValueError(
                f"Missing required columns: {sorted(missing)}"
            )

        store = SQLiteStore(db_path)
        count = 0

        try:
            for row in reader:
                feeder_id = row["feeder_id"].strip()
                band = row["service_band"].strip().upper()

                if row["data_type"].strip().lower() != "official":
                    raise ValueError(
                        f"{path}: non-official row found for {feeder_id}"
                    )

                if band not in {"A", "B", "C", "D", "E"}:
                    raise ValueError(
                        f"{feeder_id}: invalid service band {band!r}"
                    )

                metadata = {
                    "source_feeder_name": row["source_feeder_name"].strip(),
                    "disco": row["disco"].strip(),
                    "state": row["state"].strip(),
                    "business_unit": row["business_unit"].strip(),
                    "monthly_energy_cap_kwh": float(
                        row["monthly_energy_cap_kwh"]
                    ),
                    "data_type": row["data_type"].strip().lower(),
                    "source_url": row["source_url"].strip(),
                }

                store.upsert_feeder(
                    feeder_id,
                    band,
                    metadata=metadata,
                )

                count += 1

        finally:
            store.close()

    return count


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Load official NERC feeder metadata into Lume."
    )
    parser.add_argument("csv_path", type=Path)
    parser.add_argument(
        "--db",
        default="data/platform.db",
    )
    args = parser.parse_args()

    count = load(args.csv_path, args.db)
    print(f"Loaded {count} official NERC feeder records.")


if __name__ == "__main__":
    main()
