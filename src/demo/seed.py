"""Build a fresh demo database: simulate, load, detect, and create one account per role.

Usage: python -m src.demo.seed [--db data/platform.db] [--data data]
Env:   DEMO_PASSWORD (default "demo-password") for every demo account. Local demo use only.
"""
import argparse
import csv
import os
import subprocess
import sys
from pathlib import Path

from src.api.auth import hash_password
from src.detection.run import default_period, run_detection
from src.ingest.load import load_dir
from src.store import SQLiteStore

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--db", default="data/platform.db")
    p.add_argument("--data", default="data")
    p.add_argument("--seed", default="42")
    args = p.parse_args()
    password = os.environ.get("DEMO_PASSWORD", "demo-password")

    db = Path(args.db)
    subprocess.run(
        [sys.executable, str(ROOT / "simulator" / "simulate.py"), "--out", args.data, "--drop-rate", "0.02", "--seed", args.seed],
        check=True,
    )
    store = SQLiteStore(db)
    store.reset()
    for kind, result in load_dir(store, Path(args.data)).items():
        print(f"Loaded {kind} readings: {result.accepted}")
    start, end = default_period(store)
    print(f"Detection over {start}..{end}: {len(run_detection(store, start, end))} flags")

    with open(Path(args.data) / "injected_anomalies.csv", newline="") as f:
        thieves = {r["meter_id"] for r in csv.DictReader(f)}
    honest = {fid: [m for m in store.meter_ids(fid) if m not in thieves] for fid in (f["feeder_id"] for f in store.feeders())}
    feeders = sorted(honest)
    accounts = [
        ("customer", "customer", "Demo Customer (Band A feeder)", honest[feeders[0]][0]),
        ("customer2", "customer", "Demo Customer (lowest band feeder)", honest[feeders[-1]][0]),
        ("ops", "operations", "Revenue Protection (demo)", None),
        ("regulator", "regulator", "Regulator (demo)", None),
    ]
    for username, role, name, meter_id in accounts:
        store.add_user(username, hash_password(password), role, name, meter_id)
    store.audit("system", "demo.seed", str(db), {"accounts": [a[0] for a in accounts]})
    store.close()

    print("\nDemo accounts (SIMULATED DATA, local use only):")
    for username, role, _, meter_id in accounts:
        print(f"  {username:<10} {role:<11} {('meter ' + meter_id) if meter_id else ''}")
    print(f"  password: {password}")


if __name__ == "__main__":
    main()
