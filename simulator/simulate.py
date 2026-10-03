"""Generate SIMULATED feeder voltage and meter readings. Label as simulated in any demo."""
from __future__ import annotations

import argparse
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--days", type=int, default=7)
    p.add_argument("--meters", type=int, default=30)
    p.add_argument("--target-hours", type=float, default=20.0, help="average delivered hours/day")
    p.add_argument("--feeder", default="F001")
    p.add_argument("--band", default="A", help="committed NERC Band for the feeder")
    p.add_argument("--drop-rate", type=float, default=0.0, help="fraction of readings lost in transit")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default="data")
    p.add_argument("--start", default="2026-09-01")
    args = p.parse_args()

    random.seed(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    slots = 96  # 15-minute slots per day
    start = datetime.fromisoformat(args.start)
    meter_ids = [f"M{m + 1:03d}" for m in range(args.meters)]
    with open(out / "feeders.csv", "w", newline="") as f:
        csv.writer(f).writerows([["feeder_id", "band"], [args.feeder, args.band]])
    with open(out / "meters.csv", "w", newline="") as f:
        csv.writer(f).writerows([["meter_id", "feeder_id"]] + [[m, args.feeder] for m in meter_ids])

    def lost() -> bool:
        return random.random() < args.drop_rate

    base_load = [round(random.uniform(0.05, 0.4), 3) for _ in range(args.meters)]  # kWh per slot

    with open(out / "feeder_readings.csv", "w", newline="") as ff, open(out / "meter_readings.csv", "w", newline="") as mf:
        fw = csv.writer(ff)
        mw = csv.writer(mf)
        fw.writerow(["timestamp", "feeder_id", "voltage"])
        mw.writerow(["timestamp", "meter_id", "kwh"])
        for day in range(args.days):
            hours_on = max(0.0, min(24.0, random.gauss(args.target_hours, 1.5)))
            off_slots = slots - round(hours_on * 4)
            down: set[int] = set()
            while len(down) < off_slots:  # random outage blocks until the day's target is met
                start_slot = random.randint(0, slots - 1)
                for i in range(start_slot, min(slots, start_slot + random.randint(2, 16))):
                    if len(down) < off_slots:
                        down.add(i)
            up = [i not in down for i in range(slots)]
            for slot in range(slots):
                ts = (start + timedelta(days=day, minutes=15 * slot)).isoformat()
                voltage = round(random.gauss(225, 6), 1) if up[slot] else 0.0
                if not lost():
                    fw.writerow([ts, args.feeder, voltage])
                for m, meter_id in enumerate(meter_ids):
                    kwh = round(base_load[m] * random.uniform(0.7, 1.3), 3) if up[slot] else 0.0
                    if not lost():
                        mw.writerow([ts, meter_id, kwh])
    print(f"Wrote simulated data to {out}/")


if __name__ == "__main__":
    main()
