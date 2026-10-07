"""Load the official NERC feeder register into the real DynamoDB tables.

    python scripts/load_official_dynamodb.py --dry-run     # say what would happen, change nothing
    python scripts/load_official_dynamodb.py               # load it

Safe by design: it only adds or updates feeder register entries. It never touches readings, meters,
flags, users, sessions or the audit log, never deletes anything, and can be re-run. New feeders are
labelled telemetry "none" (official register entry, no readings expected). A feeder that already
has a label keeps it.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.official_data.load_nerc_feeders import read_official_rows, register  # noqa: E402
from src.store_dynamodb import DynamoDBStore  # noqa: E402

DEFAULT_CSV = ROOT / "data" / "official" / "nerc" / "ibedc_2026-09_kwara_challenge_feeders.csv"


def load_official(store, path: Path, dry_run: bool = False, out=print) -> dict:
    rows = read_official_rows(path)  # validates everything before anything is written
    existing = {f["feeder_id"] for f in store.feeders()}
    new = [r["feeder_id"] for r in rows if r["feeder_id"] not in existing]
    summary = {"rows": len(rows), "new": len(new), "updated": len(rows) - len(new), "labelled_none": 0, "dry_run": dry_run}
    if dry_run:
        out(f"DRY RUN: would add {summary['new']} feeders and update {summary['updated']}. Nothing was changed.")
        return summary
    summary["labelled_none"] = register(store, rows)
    out(f"Added {summary['new']} feeders, updated {summary['updated']}, labelled {summary['labelled_none']} as having no telemetry.")
    out("Readings, meters, flags, users and the audit log were not touched.")
    return summary


def main() -> int:
    import boto3

    p = argparse.ArgumentParser()
    p.add_argument("csv_path", nargs="?", type=Path, default=DEFAULT_CSV)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--region", default="eu-west-1")
    p.add_argument("--readings", default="nesi-powertech-readings")
    p.add_argument("--platform", default="nesi-powertech-platform")
    p.add_argument("--audit", default="nesi-powertech-audit")
    args = p.parse_args()
    who = boto3.session.Session(region_name=args.region).client("sts").get_caller_identity()["Arn"]
    print("Running as:", re.sub(r"\d{12}", "************", who))
    store = DynamoDBStore(args.readings, args.platform, args.audit, region_name=args.region)
    try:
        load_official(store, args.csv_path, args.dry_run)
    except ValueError as err:
        print(f"ABORTED: {err}\nNothing was changed.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
