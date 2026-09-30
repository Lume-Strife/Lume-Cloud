"""Service accountability engine: delivered supply hours vs committed Band."""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional

CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "bands.json"


def load_config(path: Path = CONFIG_PATH) -> dict:
    return json.loads(Path(path).read_text())


def daily_supply_hours(samples: Iterable[tuple[datetime, float]], config: dict) -> dict[date, float]:
    """Convert (timestamp, voltage) samples into delivered hours per day."""
    interval_h = config["sample_interval_minutes"] / 60
    threshold = config["supply_voltage_threshold"]
    hours: dict[date, float] = defaultdict(float)
    for ts, voltage in samples:
        hours[ts.date()] += interval_h if voltage >= threshold else 0.0
    return dict(hours)


def classify_band(hours: float, config: dict) -> Optional[str]:
    """Highest Band whose minimum daily hours are met, or None if below the lowest."""
    for band, minimum in sorted(config["bands"].items(), key=lambda kv: -kv[1]):
        if hours >= minimum:
            return band
    return None


@dataclass
class FeederReport:
    committed_band: str
    committed_hours: float
    average_hours: float
    days: list[dict] = field(default_factory=list)
    current_failure_streak: int = 0
    max_failure_streak: int = 0
    explanation_required: bool = False
    downgrade_triggered: bool = False
    downgrade_date: Optional[date] = None
    recommended_band: Optional[str] = None
    compensation_flag: bool = False


def evaluate_feeder(daily_hours: dict[date, float], committed_band: str, config: dict) -> FeederReport:
    committed = config["bands"][committed_band]
    days = sorted(daily_hours)
    report = FeederReport(
        committed_band=committed_band,
        committed_hours=committed,
        average_hours=(sum(daily_hours.values()) / len(days)) if days else 0.0,
    )
    streak = 0
    streak_hours: list[float] = []
    for d in days:
        h = daily_hours[d]
        met = h >= committed
        streak = 0 if met else streak + 1
        streak_hours = [] if met else streak_hours + [h]
        report.days.append({"date": d, "hours": round(h, 2), "met": met, "streak": streak})
        report.max_failure_streak = max(report.max_failure_streak, streak)
        if streak >= config["downgrade_after_consecutive_days"] and not report.downgrade_triggered:
            report.downgrade_triggered = True
            report.downgrade_date = d
            report.recommended_band = classify_band(sum(streak_hours) / len(streak_hours), config)
    report.current_failure_streak = streak
    report.explanation_required = streak >= config["explanation_after_consecutive_days"]
    report.compensation_flag = bool(days) and report.average_hours < config["compensation_ratio"] * committed
    return report
