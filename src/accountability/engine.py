"""Service accountability engine: delivered supply hours vs committed Band."""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable, Optional, Union

CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "bands.json"


def load_config(path: Path = CONFIG_PATH) -> dict:
    return json.loads(Path(path).read_text())


@dataclass(frozen=True)
class DaySupply:
    """Delivered hours for one day, plus how many hours of that day we actually have data for."""

    hours: float
    observed_hours: float = 24.0

    @property
    def coverage(self) -> float:
        return self.observed_hours / 24


def slot_start(ts: datetime, interval_minutes: int) -> datetime:
    minute = (ts.hour * 60 + ts.minute) // interval_minutes * interval_minutes
    return ts.replace(hour=minute // 60, minute=minute % 60, second=0, microsecond=0)


def daily_supply(samples: Iterable[tuple[datetime, float]], config: dict) -> dict[date, DaySupply]:
    """Convert (timestamp, voltage) samples into delivered and observed hours per day.

    Samples are bucketed into fixed slots so duplicates are counted once. A slot with no
    sample is missing data, not an outage: it lowers coverage instead of delivered hours.
    """
    interval = config["sample_interval_minutes"]
    threshold = config["supply_voltage_threshold"]
    slots: dict[datetime, float] = {}
    for ts, voltage in samples:
        slots.setdefault(slot_start(ts, interval), voltage)
    interval_h = interval / 60
    supplied: dict[date, float] = defaultdict(float)
    observed: dict[date, float] = defaultdict(float)
    for slot, voltage in slots.items():
        observed[slot.date()] += interval_h
        if voltage >= threshold:
            supplied[slot.date()] += interval_h
    return {d: DaySupply(hours=supplied[d], observed_hours=observed[d]) for d in observed}


def fill_missing_days(daily: dict, start: Optional[date] = None, end: Optional[date] = None) -> dict:
    """Add zero-coverage days for dates with no samples at all, from start (or the first day)
    up to and including end (or the last day)."""
    if not daily and (start is None or end is None):
        return dict(daily)
    d = start or min(daily)
    last = end or max(daily)
    filled = dict(daily)
    while d <= last:
        filled.setdefault(d, DaySupply(hours=0.0, observed_hours=0.0))
        d += timedelta(days=1)
    return filled


def daily_supply_hours(samples: Iterable[tuple[datetime, float]], config: dict) -> dict[date, float]:
    """Delivered hours per day, ignoring coverage. Prefer daily_supply for evidence."""
    return {d: s.hours for d, s in daily_supply(samples, config).items()}


def classify_band(hours: float, config: dict) -> Optional[str]:
    """Highest Band whose minimum daily hours are met, or None if below the lowest."""
    for band, minimum in sorted(config["bands"].items(), key=lambda kv: -kv[1]):
        if hours >= minimum:
            return band
    return None


def _exemption(d: date, band: str, config: dict) -> Optional[dict]:
    for ex in config.get("downgrade_exemptions", []):
        if ex["band"] == band and date.fromisoformat(ex["from"]) <= d <= date.fromisoformat(ex["to"]):
            return ex
    return None


@dataclass
class FeederReport:
    committed_band: str
    committed_hours: float
    average_hours: float = 0.0
    days: list[dict] = field(default_factory=list)
    current_failure_streak: int = 0
    max_failure_streak: int = 0
    explanation_dates: list[date] = field(default_factory=list)
    downgrade_triggered: bool = False
    downgrade_date: Optional[date] = None
    recommended_band: Optional[str] = None
    compensation_flag: bool = False
    special_compensation_days: list[date] = field(default_factory=list)
    insufficient_data_days: list[date] = field(default_factory=list)

    @property
    def explanation_required(self) -> bool:
        return bool(self.explanation_dates)


def evaluate_feeder(
    daily: dict[date, Union[float, DaySupply]], committed_band: str, config: dict
) -> FeederReport:
    """Apply the Band commitment, 7-Day Rule, and compensation rules to daily supply.

    Plain floats are treated as fully observed days. Days below min_day_coverage are
    reported as insufficient data: they are not judged, and they break any streak,
    because consecutive failures cannot be proven across a gap.
    """
    committed = config["bands"][committed_band]
    report = FeederReport(committed_band=committed_band, committed_hours=committed)
    min_coverage = config.get("min_day_coverage", 0.0)
    streak = 0  # consecutive failed days, drives the explanation requirement
    downgrade_hours: list[float] = []  # consecutive non-exempt failed days, drives the downgrade
    judged_hours: list[float] = []

    daily = fill_missing_days(daily)
    for d in sorted(daily):
        supply = daily[d] if isinstance(daily[d], DaySupply) else DaySupply(hours=daily[d])
        exemption = _exemption(d, committed_band, config)
        entry = {"date": d, "hours": round(supply.hours, 2), "coverage": round(supply.coverage, 3), "exempt": bool(exemption)}

        if supply.coverage < min_coverage:
            report.insufficient_data_days.append(d)
            streak, downgrade_hours = 0, []
            report.days.append({**entry, "status": "insufficient_data", "streak": 0})
            continue

        judged_hours.append(supply.hours)
        met = supply.hours >= committed
        streak = 0 if met else streak + 1
        if streak == config["explanation_after_consecutive_days"]:
            report.explanation_dates.append(d)
        if met or exemption:
            downgrade_hours = []
        else:
            downgrade_hours.append(supply.hours)
        if exemption and supply.hours < exemption["special_compensation_below_hours"]:
            report.special_compensation_days.append(d)

        report.days.append({**entry, "status": "met" if met else "failed", "streak": streak})
        report.max_failure_streak = max(report.max_failure_streak, streak)
        if len(downgrade_hours) >= config["downgrade_after_consecutive_days"] and not report.downgrade_triggered:
            report.downgrade_triggered = True
            report.downgrade_date = d
            report.recommended_band = classify_band(sum(downgrade_hours) / len(downgrade_hours), config)

    report.current_failure_streak = streak
    if judged_hours:
        report.average_hours = sum(judged_hours) / len(judged_hours)
        rule = config.get("compensation", {}).get(committed_band)
        report.compensation_flag = bool(rule) and rule["min_average_hours"] <= report.average_hours < committed
    return report
