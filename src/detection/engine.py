"""Theft and anomaly detection. Every flag carries a reason, a confidence, and its evidence.

Flags are leads for a human reviewer, not findings. Nothing here triggers action on its own.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import mean, median, pstdev

from src.accountability.engine import slot_start
from src.ingest.validate import FeederReading, MeterReading

DETECTION_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "detection.json"


def load_detection_config(path: Path = DETECTION_CONFIG_PATH) -> dict:
    return json.loads(Path(path).read_text())


def _flag(rule, subject_type, subject_id, feeder_id, period, reason, confidence, evidence) -> dict:
    return {
        "rule": rule,
        "subject_type": subject_type,
        "subject_id": subject_id,
        "feeder_id": feeder_id,
        "period_start": period[0].isoformat(),
        "period_end": period[1].isoformat(),
        "reason": reason,
        "confidence": round(max(0.0, min(confidence, 0.95)), 2),
        "evidence": evidence,
    }


def tamper_events(meter_id, feeder_id, readings: list[MeterReading], period) -> list[dict]:
    events = [r.timestamp for r in readings if r.tamper]
    if not events:
        return []
    return [
        _flag(
            "tamper_event", "meter", meter_id, feeder_id, period,
            f"Meter reported {len(events)} tamper event(s), first at {events[0]:%Y-%m-%d %H:%M}",
            0.6 + 0.05 * len(events),
            {"count": len(events), "first": events[0].isoformat(), "last": events[-1].isoformat()},
        )
    ]


def zero_with_supply(meter_id, feeder_id, readings: list[MeterReading], supplied: dict, interval, period, cfg) -> list[dict]:
    """Meter reads zero while the feeder shows supply. Natural zero use is possible, so
    confidence grows with how long it lasts."""
    zero_slots = [r.timestamp for r in readings if r.kwh == 0 and supplied.get(slot_start(r.timestamp, interval))]
    hours = len(zero_slots) * interval / 60
    if hours < cfg["min_hours"]:
        return []
    supplied_hours = sum(1 for on in supplied.values() if on) * interval / 60
    return [
        _flag(
            "zero_with_supply", "meter", meter_id, feeder_id, period,
            f"Meter read zero for {hours:.1f}h while the feeder was supplying power",
            0.4 + 0.5 * min(1.0, hours / 24),
            {"zero_hours": hours, "supplied_hours": supplied_hours, "first": zero_slots[0].isoformat()},
        )
    ]


def consumption_drop(meter_id, feeder_id, readings: list[MeterReading], supplied: dict, interval, period, cfg) -> list[dict]:
    """Sustained fall in energy per supplied hour. Normalising by supply hours keeps outages
    from looking like theft."""
    kwh_by_day: dict[date, float] = defaultdict(float)
    slots_by_day: dict[date, int] = defaultdict(int)
    for r in readings:
        if supplied.get(slot_start(r.timestamp, interval)):
            kwh_by_day[r.timestamp.date()] += r.kwh
            slots_by_day[r.timestamp.date()] += 1
    days = sorted(d for d in slots_by_day if slots_by_day[d] * interval >= 60)
    rates = [kwh_by_day[d] / (slots_by_day[d] * interval / 60) for d in days]
    # Robust first guess at normal use, then find the low run at the end of the period and
    # re-measure the baseline from everything before it.
    if len(rates) < cfg["min_baseline_days"] + cfg["min_recent_days"]:
        return []
    first_guess = median(rates[: len(rates) // 2])
    if first_guess <= 0:
        return []
    low = first_guess * (1 - cfg["min_drop"])
    start_idx = len(rates)
    while start_idx > 0 and rates[start_idx - 1] < low:
        start_idx -= 1
    baseline, recent = rates[:start_idx], rates[start_idx:]
    if len(baseline) < cfg["min_baseline_days"] or len(recent) < cfg["min_recent_days"]:
        return []
    base, now = median(baseline), median(recent)
    drop = 1 - now / base
    if drop < cfg["min_drop"]:
        return []
    cv = pstdev(baseline) / mean(baseline)
    return [
        _flag(
            "consumption_drop", "meter", meter_id, feeder_id, period,
            f"Energy per supplied hour fell {drop:.0%} ({base:.2f} -> {now:.2f} kWh/h), low since {days[start_idx]}",
            drop * (1 - min(0.5, cv)),
            {
                "baseline_kwh_per_hour": round(base, 3),
                "recent_kwh_per_hour": round(now, 3),
                "drop": round(drop, 3),
                "low_since": days[start_idx].isoformat(),
                "low_days": len(recent),
                "baseline_variability": round(cv, 3),
            },
        )
    ]


def feeder_imbalance(feeder_id, feeder: list[FeederReading], meters: dict[str, list[MeterReading]], interval, threshold, period, cfg) -> list[dict]:
    """Energy into the feeder vs energy billed at its meters, per day. Missing meter readings
    are filled with that meter's same-day average so data gaps do not look like losses."""
    feeder_kwh = {slot_start(r.timestamp, interval): r.kwh for r in feeder if r.kwh is not None and r.voltage >= threshold}
    if not feeder_kwh:
        return []
    by_meter = {m: {slot_start(r.timestamp, interval): r.kwh for r in rs} for m, rs in meters.items()}
    day_slots: dict[date, list] = defaultdict(list)
    day_in: dict[date, float] = defaultdict(float)
    day_out: dict[date, float] = defaultdict(float)
    for slot, kwh in feeder_kwh.items():
        day_slots[slot.date()].append(slot)
        day_in[slot.date()] += kwh
    for slots in by_meter.values():
        for d, supplied_slots in day_slots.items():
            present = [slots[s] for s in supplied_slots if s in slots]
            if present:
                day_out[d] += sum(present) + (len(supplied_slots) - len(present)) * mean(present)

    limit = cfg["expected_loss"] + cfg["tolerance"]
    losses = {d: 1 - day_out[d] / day_in[d] for d in sorted(day_in) if day_in[d] > 0}
    bad = {d: loss for d, loss in losses.items() if loss > limit}
    if len(bad) < cfg["min_days"]:
        return []
    unaccounted = sum(day_in[d] * (loss - cfg["expected_loss"]) for d, loss in bad.items())
    excess = mean(bad.values()) - cfg["expected_loss"]
    return [
        _flag(
            "feeder_imbalance", "feeder", feeder_id, feeder_id, period,
            f"Metered consumption is {mean(bad.values()):.0%} below feeder energy on {len(bad)} day(s) "
            f"(expected loss {cfg['expected_loss']:.0%}); ~{unaccounted:,.0f} kWh unaccounted",
            0.5 + 0.4 * min(1.0, excess / 0.2) * min(1.0, len(bad) / 7),
            {
                "days_over_limit": len(bad),
                "average_loss": round(mean(bad.values()), 3),
                "expected_loss": cfg["expected_loss"],
                "unaccounted_kwh": round(unaccounted, 1),
                "first_day": min(bad).isoformat(),
                "daily_loss": {d.isoformat(): round(v, 3) for d, v in losses.items()},
            },
        )
    ]


def detect_feeder(
    feeder_id: str,
    period: tuple[date, date],
    feeder: list[FeederReading],
    meters: dict[str, list[MeterReading]],
    config: dict,
    det_cfg: dict,
) -> list[dict]:
    """Run every rule for one feeder over a period. The feeder flag names the meters
    that were also flagged, so field teams know where to start."""
    interval, threshold = config["sample_interval_minutes"], config["supply_voltage_threshold"]
    supplied = {slot_start(r.timestamp, interval): r.voltage >= threshold for r in feeder}
    flags: list[dict] = []
    for meter_id, readings in sorted(meters.items()):
        flags += tamper_events(meter_id, feeder_id, readings, period)
        flags += zero_with_supply(meter_id, feeder_id, readings, supplied, interval, period, det_cfg["zero_with_supply"])
        flags += consumption_drop(meter_id, feeder_id, readings, supplied, interval, period, det_cfg["consumption_drop"])
    for f in feeder_imbalance(feeder_id, feeder, meters, interval, threshold, period, det_cfg["feeder_imbalance"]):
        f["evidence"]["suspect_meters"] = sorted({x["subject_id"] for x in flags})
        flags.append(f)
    return [f for f in flags if f["confidence"] >= det_cfg["min_confidence"]]
