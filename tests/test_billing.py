import json
from datetime import date, datetime, timedelta
from decimal import Decimal

from src.accountability.engine import load_config
from src.billing.engine import build_bill
from src.ingest.validate import MeterReading

CFG = load_config()
TARIFF = {
    "version": "test",
    "currency": "NGN",
    "vat_rate": "0.075",
    "energy_rate_per_kwh": {"A": "200.00", "B": "60.00", "C": "50.00", "D": "40.00", "E": "30.00"},
}
START = date(2026, 9, 1)


def _slots(days):
    t = datetime.combine(START, datetime.min.time())
    return [t + timedelta(minutes=15 * i) for i in range(96 * days)]


def _bill(meter, feeder, days=1, band="A"):
    return build_bill("M001", "F001", band, START, START + timedelta(days=days), meter, feeder, TARIFF, CFG)


def test_fully_metered_day_bills_actual_energy_plus_vat():
    slots = _slots(1)
    bill = _bill([MeterReading("M001", t, 0.1) for t in slots], [(t, 230.0) for t in slots])
    assert len(bill.lines) == 1 and bill.lines[0].kwh == Decimal("9.6")
    assert bill.subtotal == Decimal("1920.00") and bill.vat == Decimal("144.00") and bill.total == Decimal("2064.00")
    assert bill.data_quality["estimated_slots"] == 0


def test_missing_reading_while_feeder_on_is_estimated():
    slots = _slots(1)
    meter = [MeterReading("M001", t, 0.2) for t in slots[1:]]
    bill = _bill(meter, [(t, 230.0) for t in slots])
    est = [line for line in bill.lines if line.estimated]
    assert len(est) == 1 and est[0].kwh == Decimal("0.2")
    assert bill.data_quality["estimated_slots"] == 1


def test_missing_reading_while_feeder_off_is_not_estimated():
    slots = _slots(1)
    feeder = [(t, 0.0 if i == 0 else 230.0) for i, t in enumerate(slots)]
    meter = [MeterReading("M001", t, 0.2) for t in slots[1:]]
    bill = _bill(meter, feeder)
    assert not any(line.estimated for line in bill.lines)
    assert bill.data_quality["unbilled_unknown_slots"] == 0


def test_missing_reading_with_unknown_supply_is_not_billed():
    slots = _slots(1)
    meter = [MeterReading("M001", t, 0.2) for t in slots[1:]]
    bill = _bill(meter, [(t, 230.0) for t in slots[1:]])
    assert not any(line.estimated for line in bill.lines)
    assert bill.data_quality["unbilled_unknown_slots"] == 1


def test_downgrade_produces_credit_recommendation_not_applied():
    slots = _slots(8)
    # 17h/day supply: first 68 slots of each day on, rest off
    feeder = [(t, 230.0 if i % 96 < 68 else 0.0) for i, t in enumerate(slots)]
    meter = [MeterReading("M001", t, 0.1 if i % 96 < 68 else 0.0) for i, t in enumerate(slots)]
    bill = _bill(meter, feeder, days=8)
    assert bill.supply["downgrade_triggered_on"] == date(2026, 9, 7)
    credit = next(r for r in bill.recommendations if r["type"] == "downgrade_credit")
    # Only day 8 is after the downgrade date: 6.8 kWh x (200 - 60) x 1.075
    assert credit["amount"] == Decimal("1023.40")
    assert bill.subtotal == Decimal("10880.00")  # 54.4 kWh x 200, credit not applied


def test_day_without_feeder_data_counts_as_insufficient():
    slots = _slots(2)
    feeder = [(t, 230.0) for t in slots[:96]]
    bill = _bill([], feeder, days=2)
    assert bill.supply["days_insufficient_data"] == 1


def test_to_dict_is_json_safe():
    slots = _slots(1)
    bill = _bill([MeterReading("M001", t, 0.1) for t in slots], [(t, 230.0) for t in slots])
    json.dumps(bill.to_dict())
