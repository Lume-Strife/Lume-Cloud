"""Usage: python -m src.billing.cli M001 --from 2026-09-01 --to 2026-10-01 [--db data/platform.db] [--json]

--to is exclusive. Bill data comes from the store populated by src.ingest.load.
"""
import argparse
import json
import sys
from datetime import date, datetime

from src.accountability.engine import load_config
from src.ingest.store import SQLiteStore

from .engine import build_bill, load_tariff


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("meter_id")
    p.add_argument("--from", dest="start", required=True, type=date.fromisoformat)
    p.add_argument("--to", dest="end", required=True, type=date.fromisoformat)
    p.add_argument("--db", default="data/platform.db")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    store = SQLiteStore(args.db)
    feeder_id = store.meter_feeder(args.meter_id)
    if feeder_id is None:
        sys.exit(f"Unknown meter {args.meter_id}")
    band = store.feeder_band(feeder_id)
    start = datetime.combine(args.start, datetime.min.time())
    end = datetime.combine(args.end, datetime.min.time())
    bill = build_bill(
        args.meter_id,
        feeder_id,
        band,
        args.start,
        args.end,
        store.meter_readings(args.meter_id, start, end),
        store.feeder_samples(feeder_id, start, end),
        load_tariff(),
        load_config(),
    )
    store.close()

    if args.json:
        print(json.dumps(bill.to_dict(), indent=2))
        return
    c = bill.currency
    print(f"Bill: meter {bill.meter_id} | feeder {bill.feeder_id} | Band {bill.band} | {bill.period_start} to {bill.period_end} (excl.)")
    print(f"Tariff: {bill.tariff_version}  (SIMULATED DATA)")
    for line in bill.lines:
        tag = " [EST]" if line.estimated else ""
        print(f"  {line.description:<70} {line.kwh:>9} kWh x {line.rate:>7} = {c} {line.amount:>12,}{tag}")
    print(f"  {'Subtotal':<99} {c} {bill.subtotal:>12,}")
    print(f"  {'VAT':<99} {c} {bill.vat:>12,}")
    print(f"  {'TOTAL':<99} {c} {bill.total:>12,}")
    s = bill.supply
    print(
        f"Supply: {s['average_delivered_hours']}h/day delivered vs {s['committed_hours_per_day']}h committed | "
        f"met {s['days_met']}, failed {s['days_failed']}, insufficient data {s['days_insufficient_data']}"
    )
    q = bill.data_quality
    print(
        f"Data: {q['metered_slots']}/{q['expected_slots']} slots metered, "
        f"{q['estimated_slots']} estimated, {q['unbilled_unknown_slots']} unbilled (supply unknown)"
    )
    for r in bill.recommendations:
        amount = f" -> credit {c} {r['amount']:,}" if r["amount"] is not None else ""
        print(f"RECOMMENDATION (not applied): {r['description']}{amount}")


if __name__ == "__main__":
    main()
