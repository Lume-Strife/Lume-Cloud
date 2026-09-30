"""Usage: python -m src.accountability.cli data/feeder_readings.csv --band A"""
import argparse
import csv
from datetime import datetime

from .engine import daily_supply_hours, evaluate_feeder, load_config


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("csv_path")
    p.add_argument("--band", default="A")
    args = p.parse_args()
    config = load_config()
    with open(args.csv_path, newline="") as f:
        samples = [(datetime.fromisoformat(r["timestamp"]), float(r["voltage"])) for r in csv.DictReader(f)]
    report = evaluate_feeder(daily_supply_hours(samples, config), args.band, config)
    print(f"Committed: Band {report.committed_band} ({report.committed_hours}h/day)")
    for d in report.days:
        print(f"  {d['date']}  {d['hours']:5.2f}h  {'OK  ' if d['met'] else 'FAIL'}  streak={d['streak']}")
    print(f"Average: {report.average_hours:.2f}h | explanation required: {report.explanation_required}")
    print(f"Downgrade triggered: {report.downgrade_triggered} -> recommended band: {report.recommended_band}")
    print(f"Compensation flag: {report.compensation_flag}")


if __name__ == "__main__":
    main()
