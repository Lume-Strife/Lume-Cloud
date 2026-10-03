"""Billing engine: itemised bill per meter per cycle, tied to the feeder's delivered supply."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Optional

from src.accountability.engine import daily_supply, evaluate_feeder, fill_missing_days, slot_start
from src.ingest.validate import MeterReading

TARIFF_PATH = Path(__file__).resolve().parents[2] / "config" / "tariffs.json"
KOBO = Decimal("0.01")


def load_tariff(path: Path = TARIFF_PATH) -> dict:
    return json.loads(Path(path).read_text())


def _money(value: Decimal) -> Decimal:
    return value.quantize(KOBO, rounding=ROUND_HALF_UP)


def _kwh(value: float) -> Decimal:
    return Decimal(str(round(value, 3)))


@dataclass
class BillLine:
    description: str
    kwh: Decimal
    rate: Decimal
    amount: Decimal
    estimated: bool = False


@dataclass
class Bill:
    meter_id: str
    feeder_id: str
    band: str
    period_start: date
    period_end: date  # exclusive
    currency: str
    tariff_version: str
    lines: list[BillLine] = field(default_factory=list)
    subtotal: Decimal = Decimal("0")
    vat: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    supply: dict = field(default_factory=dict)
    recommendations: list[dict] = field(default_factory=list)  # never applied to the total
    data_quality: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        def clean(v):
            if isinstance(v, Decimal):
                return str(v)
            if isinstance(v, date):
                return v.isoformat()
            if isinstance(v, dict):
                return {k: clean(x) for k, x in v.items()}
            if isinstance(v, list):
                return [clean(x) for x in v]
            return v

        return clean(asdict(self))


def build_bill(
    meter_id: str,
    feeder_id: str,
    band: str,
    period_start: date,
    period_end: date,
    meter_readings: list[MeterReading],
    feeder_samples: list[tuple[datetime, float]],
    tariff: dict,
    config: dict,
) -> Bill:
    """Bill actual readings, estimate only slots where the feeder proves supply was on.

    Missing meter slots are estimated at the customer's average kWh per supplied slot,
    but only when feeder data shows supply in that slot. If the feeder data is missing
    too, the slot is left unbilled: the customer is not charged for unproven supply.
    """
    interval = config["sample_interval_minutes"]
    threshold = config["supply_voltage_threshold"]
    rates = {b: Decimal(r) for b, r in tariff["energy_rate_per_kwh"].items()}
    rate = rates[band]

    meter_by_slot: dict[datetime, MeterReading] = {}
    for r in meter_readings:
        meter_by_slot.setdefault(slot_start(r.timestamp, interval), r)
    supplied_by_slot: dict[datetime, bool] = {}
    for ts, voltage in feeder_samples:
        supplied_by_slot.setdefault(slot_start(ts, interval), voltage >= threshold)

    supplied_actual = [r.kwh for s, r in meter_by_slot.items() if supplied_by_slot.get(s)]
    estimate_per_slot = sum(supplied_actual) / len(supplied_actual) if supplied_actual else None

    kwh_by_day: dict[date, float] = {}
    actual_kwh = estimated_kwh = 0.0
    expected = metered_slots = estimated_slots = unbilled_slots = 0
    slot = datetime.combine(period_start, datetime.min.time())
    end = datetime.combine(period_end, datetime.min.time())
    while slot < end:
        expected += 1
        reading = meter_by_slot.get(slot)
        if reading is not None:
            kwh = reading.kwh
            actual_kwh += kwh
            metered_slots += 1
        elif supplied_by_slot.get(slot) and estimate_per_slot is not None:
            kwh = estimate_per_slot
            estimated_kwh += kwh
            estimated_slots += 1
        else:
            kwh = 0.0
            # No reading and supply was off: nothing to bill. Unknown supply: not billed.
            if slot not in supplied_by_slot or (supplied_by_slot[slot] and estimate_per_slot is None):
                unbilled_slots += 1
        kwh_by_day[slot.date()] = kwh_by_day.get(slot.date(), 0.0) + kwh
        slot += timedelta(minutes=interval)

    bill = Bill(
        meter_id=meter_id,
        feeder_id=feeder_id,
        band=band,
        period_start=period_start,
        period_end=period_end,
        currency=tariff["currency"],
        tariff_version=tariff["version"],
    )
    bill.lines.append(BillLine(f"Energy, Band {band} (metered)", _kwh(actual_kwh), rate, _money(_kwh(actual_kwh) * rate)))
    if estimated_slots:
        bill.lines.append(
            BillLine(
                f"Energy, Band {band} (estimated: {estimated_slots} missing readings while feeder was on)",
                _kwh(estimated_kwh),
                rate,
                _money(_kwh(estimated_kwh) * rate),
                estimated=True,
            )
        )
    vat_rate = Decimal(tariff["vat_rate"])
    bill.subtotal = sum((line.amount for line in bill.lines), Decimal("0"))
    bill.vat = _money(bill.subtotal * vat_rate)
    bill.total = bill.subtotal + bill.vat
    bill.data_quality = {
        "expected_slots": expected,
        "metered_slots": metered_slots,
        "estimated_slots": estimated_slots,
        "unbilled_unknown_slots": unbilled_slots,
        "meter_readings_used": len(meter_readings),
        "feeder_samples_used": len(feeder_samples),
    }

    last_day = period_end - timedelta(days=1)
    report = evaluate_feeder(fill_missing_days(daily_supply(feeder_samples, config), period_start, last_day), band, config)
    judged = [d for d in report.days if d["status"] != "insufficient_data"]
    bill.supply = {
        "committed_hours_per_day": report.committed_hours,
        "average_delivered_hours": round(report.average_hours, 2),
        "days_met": sum(1 for d in judged if d["status"] == "met"),
        "days_failed": sum(1 for d in judged if d["status"] == "failed"),
        "days_insufficient_data": len(report.insufficient_data_days),
        "explanation_required_on": report.explanation_dates,
        "downgrade_triggered_on": report.downgrade_date,
        "recommended_band": report.recommended_band,
    }

    if report.downgrade_triggered:
        new_band = report.recommended_band or min(rates, key=lambda b: rates[b])
        kwh_after = _kwh(sum(k for d, k in kwh_by_day.items() if d > report.downgrade_date))
        credit = _money(kwh_after * (rate - rates[new_band]) * (1 + vat_rate))
        if credit > 0:
            bill.recommendations.append(
                {
                    "type": "downgrade_credit",
                    "description": (
                        f"7-Day Rule downgrade on {report.downgrade_date}: rebill {kwh_after} kWh "
                        f"consumed after that date at Band {new_band} instead of Band {band}"
                    ),
                    "amount": credit,
                }
            )
    if report.compensation_flag:
        bill.recommendations.append(
            {
                "type": "compensation_review",
                "description": f"Average {report.average_hours:.2f}h is below the Band {band} commitment; eligible under the compensation framework",
                "amount": None,
            }
        )
    if report.special_compensation_days:
        bill.recommendations.append(
            {
                "type": "special_compensation_review",
                "description": f"{len(report.special_compensation_days)} day(s) in a downgrade-exemption window below the special compensation threshold",
                "amount": None,
            }
        )
    return bill
