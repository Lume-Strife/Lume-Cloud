"""Read models for the dashboards, built from the engines and the store."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from src.accountability.engine import daily_supply, evaluate_feeder, fill_missing_days, load_config
from src.billing.engine import build_bill, load_tariff
from src.store import SQLiteStore


def _bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return datetime.combine(start, datetime.min.time()), datetime.combine(end, datetime.min.time())


def feeder_compliance(store: SQLiteStore, feeder_id: str, band: str, start: date, end: date) -> dict:
    config = load_config()
    t0, t1 = _bounds(start, end)
    daily = fill_missing_days(daily_supply(store.feeder_samples(feeder_id, t0, t1), config), start, end - timedelta(days=1))
    r = evaluate_feeder(daily, band, config)
    judged = [d for d in r.days if d["status"] != "insufficient_data"]
    met = sum(1 for d in judged if d["status"] == "met")
    if r.downgrade_triggered:
        status = "downgrade"
    elif r.compensation_flag or r.explanation_required:
        status = "at_risk"
    else:
        status = "compliant"
    return {
        "feeder_id": feeder_id,
        "band": band,
        "committed_hours": r.committed_hours,
        "average_hours": round(r.average_hours, 2),
        "days_met": met,
        "days_failed": len(judged) - met,
        "days_insufficient_data": len(r.insufficient_data_days),
        "compliance_rate": round(met / len(judged), 3) if judged else None,
        "status": status,
        "explanation_dates": [d.isoformat() for d in r.explanation_dates],
        "downgrade_date": r.downgrade_date.isoformat() if r.downgrade_date else None,
        "recommended_band": r.recommended_band,
        "compensation_flag": r.compensation_flag,
        "special_compensation_days": len(r.special_compensation_days),
        "days": [{**d, "date": d["date"].isoformat()} for d in r.days],
    }


def all_compliance(store: SQLiteStore, start: date, end: date) -> list[dict]:
    return [feeder_compliance(store, f["feeder_id"], f["band"], start, end) for f in store.feeders()]


def feeders_overview(store: SQLiteStore, start: date, end: date) -> list[dict]:
    flags = store.flags()
    out = []
    for c in all_compliance(store, start, end):
        fid = c["feeder_id"]
        feeder_flags = [f for f in flags if f["feeder_id"] == fid]
        imbalance = [f for f in feeder_flags if f["rule"] == "feeder_imbalance" and f["status"] != "dismissed"]
        out.append(
            {
                **{k: v for k, v in c.items() if k != "days"},
                "meters": len(store.meter_ids(fid)),
                "open_cases": sum(1 for c in group_cases(feeder_flags) if c["status"] in ("open", "investigating")),
                "unaccounted_kwh": max((f["evidence"]["unaccounted_kwh"] for f in imbalance), default=0.0),
            }
        )
    return out


def meter_daily_kwh(store: SQLiteStore, meter_id: str, start: date, end: date) -> dict[str, float]:
    t0, t1 = _bounds(start, end)
    per_day: dict[str, float] = defaultdict(float)
    for r in store.meter_readings(meter_id, t0, t1):
        per_day[r.timestamp.date().isoformat()] += r.kwh
    return {d: round(v, 3) for d, v in sorted(per_day.items())}


def meter_bill(store: SQLiteStore, meter_id: str, start: date, end: date) -> dict:
    feeder_id = store.meter_feeder(meter_id)
    band = store.feeder_band(feeder_id)
    t0, t1 = _bounds(start, end)
    bill = build_bill(
        meter_id, feeder_id, band, start, end,
        store.meter_readings(meter_id, t0, t1), store.feeder_samples(feeder_id, t0, t1),
        load_tariff(), load_config(),
    )
    return bill.to_dict()


def customer_summary(store: SQLiteStore, meter_id: str, start: date, end: date) -> dict:
    feeder_id = store.meter_feeder(meter_id)
    compliance = feeder_compliance(store, feeder_id, store.feeder_band(feeder_id), start, end)
    usage = meter_daily_kwh(store, meter_id, start, end)
    return {
        "meter_id": meter_id,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "bill": meter_bill(store, meter_id, start, end),
        "supply": {k: compliance[k] for k in ("band", "committed_hours", "average_hours", "days_met", "days_failed", "days_insufficient_data", "status")},
        "daily": [
            {"date": d["date"], "kwh": usage.get(d["date"], 0.0), "supply_hours": d["hours"], "status": d["status"]}
            for d in compliance["days"]
        ],
    }


def meter_detail(store: SQLiteStore, meter_id: str, start: date, end: date) -> dict:
    feeder_id = store.meter_feeder(meter_id)
    usage = meter_daily_kwh(store, meter_id, start, end)
    compliance = feeder_compliance(store, feeder_id, store.feeder_band(feeder_id), start, end)
    return {
        "meter_id": meter_id,
        "feeder_id": feeder_id,
        "daily": [{"date": d["date"], "kwh": usage.get(d["date"], 0.0), "supply_hours": d["hours"]} for d in compliance["days"]],
        "flags": [f for f in store.flags() if f["subject_id"] == meter_id],
    }


# A case is every flag raised against one meter or feeder. Field teams visit meters, not rules,
# so the queue and decisions work per case.

STATUS_ORDER = ("open", "investigating", "confirmed", "dismissed")


def case_status(flags: list[dict]) -> str:
    """The least-settled status wins: one new flag reopens an already decided case."""
    return min((f["status"] for f in flags), key=STATUS_ORDER.index)


def group_cases(flags: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for f in flags:
        groups[(f["subject_type"], f["subject_id"])].append(f)
    cases = []
    for (subject_type, subject_id), fs in groups.items():
        fs = sorted(fs, key=lambda f: -f["confidence"])
        cases.append(
            {
                "subject_type": subject_type,
                "subject_id": subject_id,
                "feeder_id": fs[0]["feeder_id"],
                # Strongest single signal, not a combined score: the rules overlap (a stopped
                # meter trips both zero-reading and usage-drop), so combining would overstate.
                "confidence": fs[0]["confidence"],
                "status": case_status(fs),
                "period_start": min(f["period_start"] for f in fs),
                "period_end": max(f["period_end"] for f in fs),
                "flags": fs,
            }
        )
    return sorted(cases, key=lambda c: (-c["confidence"], c["subject_id"]))


def cases(store: SQLiteStore, status: Optional[str] = None, feeder_id: Optional[str] = None) -> list[dict]:
    found = group_cases(store.flags(feeder_id=feeder_id))
    return [c for c in found if status is None or c["status"] == status]


def case(store: SQLiteStore, subject_type: str, subject_id: str) -> Optional[dict]:
    flags = [f for f in store.flags() if f["subject_type"] == subject_type and f["subject_id"] == subject_id]
    if not flags:
        return None
    found = group_cases(flags)[0]
    if subject_type == "meter":
        start, end = date.fromisoformat(found["period_start"]), date.fromisoformat(found["period_end"])
        found["meter"] = meter_detail(store, subject_id, start, end)
        del found["meter"]["flags"]
    else:
        suspects = {m for f in flags for m in f["evidence"].get("suspect_meters", [])}
        found["suspect_cases"] = [c for c in cases(store, feeder_id=subject_id) if c["subject_id"] in suspects]
        for c in found["suspect_cases"]:
            del c["flags"]
    return found
