"""Run detection over every feeder in the store and save new flags.

Usage: python -m src.detection.run [--from 2026-09-01 --to 2026-10-01] [--db data/platform.db]
       [--truth data/injected_anomalies.csv]   # compare against simulator ground truth
"""
from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timedelta
from typing import Optional

from src.accountability.engine import load_config
from src.store import SQLiteStore

from .engine import detect_feeder, load_detection_config


def run_detection(store: SQLiteStore, start: date, end: date, actor: str = "system") -> list[dict]:
    """Detect over [start, end) for all feeders. Returns every flag found; only new ones are stored."""
    config, det_cfg = load_config(), load_detection_config()
    t0, t1 = datetime.combine(start, datetime.min.time()), datetime.combine(end, datetime.min.time())
    found: list[dict] = []
    for f in store.feeders():
        fid = f["feeder_id"]
        meters = {m: store.meter_readings(m, t0, t1) for m in store.meter_ids(fid)}
        found += detect_feeder(fid, (start, end), store.feeder_readings(fid, t0, t1), meters, config, det_cfg)
    created = store.save_flags(found)
    store.audit(actor, "detection.run", f"{start}..{end}", {"flags_found": len(found), "flags_created": created})
    return found


def default_period(store: SQLiteStore) -> Optional[tuple[date, date]]:
    span = store.reading_range()
    return (span[0].date(), span[1].date() + timedelta(days=1)) if span else None


def score_against_truth(flags: list[dict], truth_path: str) -> None:
    with open(truth_path, newline="") as f:
        truth = {r["meter_id"]: r["kind"] for r in csv.DictReader(f)}
    flagged = {f["subject_id"] for f in flags if f["subject_type"] == "meter"}
    hits = flagged & truth.keys()
    print(f"Injected: {len(truth)} | flagged meters: {len(flagged)} | caught: {len(hits)} | false positives: {len(flagged - truth.keys())}")
    for meter_id in sorted(truth.keys() - flagged):
        print(f"  missed {meter_id} ({truth[meter_id]})")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--from", dest="start", type=date.fromisoformat)
    p.add_argument("--to", dest="end", type=date.fromisoformat)
    p.add_argument("--db", default="data/platform.db")
    p.add_argument("--truth")
    args = p.parse_args()
    store = SQLiteStore(args.db)
    period = (args.start, args.end) if args.start and args.end else default_period(store)
    if period is None:
        raise SystemExit("No readings in the store. Run src.ingest.load first.")
    flags = run_detection(store, *period)
    for f in sorted(flags, key=lambda f: -f["confidence"]):
        print(f"  {f['confidence']:.2f}  {f['rule']:<17} {f['subject_id']:<6} {f['reason']}")
    if args.truth:
        score_against_truth(flags, args.truth)
    store.close()


if __name__ == "__main__":
    main()
