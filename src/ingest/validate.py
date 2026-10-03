"""Validate and normalise raw meter and feeder readings."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

WAT = timezone(timedelta(hours=1))  # West Africa Time, no DST
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_KWH_PER_READING = 1000.0
MAX_FEEDER_KWH_PER_READING = 100000.0
MAX_VOLTAGE = 500.0
MAX_CLOCK_SKEW = timedelta(minutes=5)


class ValidationError(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass(frozen=True)
class MeterReading:
    meter_id: str
    timestamp: datetime  # naive, WAT
    kwh: float
    voltage: Optional[float] = None
    tamper: bool = False


@dataclass(frozen=True)
class FeederReading:
    feeder_id: str
    timestamp: datetime  # naive, WAT
    voltage: float
    kwh: Optional[float] = None  # energy into the feeder in this slot, if metered at the feeder head


Reading = Union[MeterReading, FeederReading]


def _id(raw: dict, key: str, errors: list[str]) -> str:
    value = str(raw.get(key) or "").strip()
    if not ID_PATTERN.match(value):
        errors.append(f"{key}: must be 1-64 letters, digits, '-' or '_'")
    return value


def _timestamp(raw: dict, now: datetime, errors: list[str]) -> Optional[datetime]:
    """Parse ISO 8601. Aware times are converted to WAT; naive times are assumed WAT."""
    try:
        ts = datetime.fromisoformat(str(raw.get("timestamp", "")).strip())
    except ValueError:
        errors.append("timestamp: must be ISO 8601")
        return None
    if ts.tzinfo is not None:
        ts = ts.astimezone(WAT).replace(tzinfo=None)
    if ts > now + MAX_CLOCK_SKEW:
        errors.append("timestamp: is in the future")
    return ts


def _number(raw: dict, key: str, low: float, high: float, errors: list[str], required: bool = True) -> Optional[float]:
    value = raw.get(key)
    if value is None or value == "":
        if required:
            errors.append(f"{key}: is required")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        errors.append(f"{key}: must be a number")
        return None
    if not math.isfinite(number) or not low <= number <= high:
        errors.append(f"{key}: must be between {low:g} and {high:g}")
    return number


def _flag(raw: dict, key: str, errors: list[str]) -> bool:
    value = raw.get(key, False)
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in ("", "0", "false", "no"):
        return False
    if text in ("1", "true", "yes"):
        return True
    errors.append(f"{key}: must be true or false")
    return False


def _now_wat() -> datetime:
    return datetime.now(WAT).replace(tzinfo=None)


def validate_meter(raw: dict, now: Optional[datetime] = None) -> MeterReading:
    errors: list[str] = []
    meter_id = _id(raw, "meter_id", errors)
    ts = _timestamp(raw, now or _now_wat(), errors)
    kwh = _number(raw, "kwh", 0, MAX_KWH_PER_READING, errors)
    voltage = _number(raw, "voltage", 0, MAX_VOLTAGE, errors, required=False)
    tamper = _flag(raw, "tamper", errors)
    if errors:
        raise ValidationError(errors)
    return MeterReading(meter_id, ts, kwh, voltage, tamper)


def validate_feeder(raw: dict, now: Optional[datetime] = None) -> FeederReading:
    errors: list[str] = []
    feeder_id = _id(raw, "feeder_id", errors)
    ts = _timestamp(raw, now or _now_wat(), errors)
    voltage = _number(raw, "voltage", 0, MAX_VOLTAGE, errors)
    kwh = _number(raw, "kwh", 0, MAX_FEEDER_KWH_PER_READING, errors, required=False)
    if errors:
        raise ValidationError(errors)
    return FeederReading(feeder_id, ts, voltage, kwh)


VALIDATORS = {"meter": validate_meter, "feeder": validate_feeder}
