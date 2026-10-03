"""Usage: python -m src.accountability.cli data/feeder_readings.csv --feeder F001 --band A"""
import argparse
import csv
from datetime import datetime

from .engine import daily_supply, evaluate_feeder, load_config


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("csv_path")
    p.add_argument("--feeder", default="F001")
    p.add_argument("--band", default="A")
    args = p.parse_args()
    config = load_config()
    with open(args.csv_path, newline="") as f:
        samples = [
            (datetime.fromisoformat(r["timestamp"]), float(r["voltage"]))
            for r in csv.DictReader(f)
            if r["feeder_id"] == args.feeder
        ]
    report = evaluate_feeder(daily_supply(samples, config), args.band, config)
    print(f"Committed: Band {report.committed_band} ({report.committed_hours}h/day)")
    for d in report.days:
        flags = " exempt" if d["exempt"] else ""
        print(f"  {d['date']}  {d['hours']:5.2f}h  cov={d['coverage']:.0%}  {d['status']:<17} streak={d['streak']}{flags}")
    print(f"Average (judged days): {report.average_hours:.2f}h")
    print(f"Explanation required on: {[str(d) for d in report.explanation_dates] or 'none'}")
    print(f"Downgrade triggered: {report.downgrade_triggered} ({report.downgrade_date}) -> recommended band: {report.recommended_band}")
    print(f"Compensation flag: {report.compensation_flag}")
    if report.special_compensation_days:
        print(f"Special compensation days: {len(report.special_compensation_days)}")
    if report.insufficient_data_days:
        print(f"Insufficient data (not judged): {[str(d) for d in report.insufficient_data_days]}")


if __name__ == "__main__":
    main()
