"""Say where a feeder's readings come from, or list what is set now.

    python scripts/set_telemetry_source.py --list
    python scripts/set_telemetry_source.py --feeder F001 F002 F003 --feeder-source simulated --meter-source simulated

Sources: simulated, authorized_external, lume_hardware, none (no readings expected), unknown (not yet said).
Either all the feeders you name are updated or none are: a typo in one feeder id changes nothing.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.store import TELEMETRY_SOURCES  # noqa: E402
from src.store_dynamodb import DynamoDBStore  # noqa: E402


def list_sources(store, out=print) -> list[dict]:
    rows = [store.feeder_details(f["feeder_id"]) for f in store.feeders()]
    for d in rows:
        out(f"  {d['feeder_id']:<46} band {d['band']}  feeder: {d['feeder_telemetry_source']:<20} meters: {d['meter_telemetry_source']}")
    if not rows:
        out("  (no feeders registered)")
    return rows


def apply(store, feeder_ids: list[str], feeder_source=None, meter_source=None, out=print) -> bool:
    for value in (feeder_source, meter_source):
        if value is not None and value not in TELEMETRY_SOURCES:
            out(f"ABORTED: {value!r} is not one of {', '.join(TELEMETRY_SOURCES)}. Nothing was changed.")
            return False
    if feeder_source is None and meter_source is None:
        out("ABORTED: give --feeder-source and/or --meter-source. Nothing was changed.")
        return False
    missing = [f for f in feeder_ids if store.feeder_band(f) is None]
    if missing:
        out(f"ABORTED: unknown feeder(s): {', '.join(missing)}. Nothing was changed.")
        return False
    for feeder_id in feeder_ids:
        store.set_telemetry_sources(feeder_id, feeder_source, meter_source)
        out(f"Updated {feeder_id}: feeder={feeder_source or 'unchanged'}, meters={meter_source or 'unchanged'}")
    return True


def main() -> int:
    import boto3

    p = argparse.ArgumentParser()
    p.add_argument("--list", action="store_true")
    p.add_argument("--feeder", nargs="+", default=[])
    p.add_argument("--feeder-source")
    p.add_argument("--meter-source")
    p.add_argument("--region", default="eu-west-1")
    p.add_argument("--readings", default="nesi-powertech-readings")
    p.add_argument("--platform", default="nesi-powertech-platform")
    p.add_argument("--audit", default="nesi-powertech-audit")
    args = p.parse_args()
    who = boto3.session.Session(region_name=args.region).client("sts").get_caller_identity()["Arn"]
    print("Running as:", re.sub(r"\d{12}", "************", who))
    store = DynamoDBStore(args.readings, args.platform, args.audit, region_name=args.region)
    if args.list or not args.feeder:
        list_sources(store)
        return 0
    ok = apply(store, args.feeder, args.feeder_source, args.meter_source)
    if ok:
        print("Now:")
        list_sources(store)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
