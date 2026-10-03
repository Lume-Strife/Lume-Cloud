"""Generate SIMULATED feeders, meters, readings and injected theft. Label as simulated in any demo.

Feeder-head energy is the true load of every meter plus technical loss, so theft shows up as
energy that enters the feeder but is never metered. injected_anomalies.csv is the ground truth.
"""
from __future__ import annotations

import argparse
import csv
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

SLOTS = 96  # 15-minute slots per day
THEFT_KINDS = ("bypass", "meter_stopped", "bypass_with_tamper")


def diurnal(slot: int) -> float:
    """Household load shape: low overnight, morning bump, evening peak."""
    hour = slot / 4
    return 0.6 + 0.35 * math.exp(-((hour - 7.5) ** 2) / 4) + 0.9 * math.exp(-((hour - 20) ** 2) / 6)


def outage_mask(target_hours: float) -> list[bool]:
    hours_on = max(0.0, min(24.0, random.gauss(target_hours, 1.5)))
    off_slots = SLOTS - round(hours_on * 4)
    down: set[int] = set()
    while len(down) < off_slots:  # random outage blocks until the day's target is met
        start_slot = random.randint(0, SLOTS - 1)
        for i in range(start_slot, min(SLOTS, start_slot + random.randint(2, 16))):
            if len(down) < off_slots:
                down.add(i)
    return [i not in down for i in range(SLOTS)]


def parse_feeders(spec: str) -> list[tuple[str, str, float]]:
    out = []
    for item in spec.split(","):
        feeder_id, band, hours = item.split(":")
        out.append((feeder_id, band, float(hours)))
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--meters", type=int, default=30, help="meters per feeder")
    p.add_argument("--feeders", default="F001:A:18.5,F002:B:17,F003:C:13", help="id:band:avg_hours,...")
    p.add_argument("--theft-rate", type=float, default=0.1, help="fraction of meters with injected theft")
    p.add_argument("--drop-rate", type=float, default=0.0, help="fraction of readings lost in transit")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default="data")
    p.add_argument("--start", default="2026-09-01")
    args = p.parse_args()

    random.seed(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    start = datetime.fromisoformat(args.start)
    feeders = parse_feeders(args.feeders)

    def lost() -> bool:
        return random.random() < args.drop_rate

    meters: list[dict] = []
    for f_idx, (feeder_id, _, _) in enumerate(feeders):
        for m in range(args.meters):
            meters.append(
                {
                    "meter_id": f"M{f_idx * args.meters + m + 1:04d}",
                    "feeder_id": feeder_id,
                    "base": random.uniform(0.04, 0.3),  # kWh per slot at diurnal factor 1
                    "theft": None,
                    "theft_day": None,
                }
            )
    # Leave the first half of the period clean so detection has a baseline.
    for m in random.sample(meters, round(len(meters) * args.theft_rate)):
        m["theft"] = random.choice(THEFT_KINDS)
        m["theft_day"] = random.randint(args.days // 2, max(args.days // 2, args.days - 5))

    with open(out / "feeders.csv", "w", newline="") as f:
        csv.writer(f).writerows([["feeder_id", "band"]] + [[fid, band] for fid, band, _ in feeders])
    with open(out / "meters.csv", "w", newline="") as f:
        csv.writer(f).writerows([["meter_id", "feeder_id"]] + [[m["meter_id"], m["feeder_id"]] for m in meters])
    with open(out / "injected_anomalies.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["meter_id", "feeder_id", "kind", "start_date"])
        for m in meters:
            if m["theft"]:
                w.writerow([m["meter_id"], m["feeder_id"], m["theft"], (start + timedelta(days=m["theft_day"])).date()])

    with open(out / "feeder_readings.csv", "w", newline="") as ff, open(out / "meter_readings.csv", "w", newline="") as mf:
        fw, mw = csv.writer(ff), csv.writer(mf)
        fw.writerow(["timestamp", "feeder_id", "voltage", "kwh"])
        mw.writerow(["timestamp", "meter_id", "kwh", "tamper"])
        for feeder_id, _, target_hours in feeders:
            feeder_meters = [m for m in meters if m["feeder_id"] == feeder_id]
            for day in range(args.days):
                up = outage_mask(target_hours)
                day_factor = {m["meter_id"]: random.uniform(0.85, 1.15) for m in feeder_meters}
                for slot in range(SLOTS):
                    ts = (start + timedelta(days=day, minutes=15 * slot)).isoformat()
                    true_total = 0.0
                    for m in feeder_meters:
                        true_kwh = m["base"] * diurnal(slot) * day_factor[m["meter_id"]] * random.uniform(0.8, 1.2) if up[slot] else 0.0
                        true_total += true_kwh
                        stealing = m["theft"] and day >= m["theft_day"]
                        reported = true_kwh
                        if stealing and m["theft"] in ("bypass", "bypass_with_tamper"):
                            reported = true_kwh * 0.25
                        elif stealing and m["theft"] == "meter_stopped":
                            reported = 0.0
                        tamper = m["theft"] == "bypass_with_tamper" and day == m["theft_day"] and slot in (40, 41, 42)
                        if not lost():
                            mw.writerow([ts, m["meter_id"], round(reported, 4), int(tamper)])
                    voltage = round(random.gauss(225, 6), 1) if up[slot] else 0.0
                    feeder_kwh = round(true_total * random.uniform(1.06, 1.09), 3) if up[slot] else 0.0
                    if not lost():
                        fw.writerow([ts, feeder_id, voltage, feeder_kwh])
    print(f"Wrote SIMULATED data for {len(feeders)} feeders / {len(meters)} meters to {out}/")


if __name__ == "__main__":
    main()
