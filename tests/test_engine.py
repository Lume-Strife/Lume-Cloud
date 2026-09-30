from datetime import date, datetime, timedelta

from src.accountability.engine import classify_band, daily_supply_hours, evaluate_feeder, load_config

CFG = load_config()


def test_full_day_supply_is_24_hours():
    start = datetime(2026, 9, 1)
    samples = [(start + timedelta(minutes=15 * i), 230.0) for i in range(96)]
    assert daily_supply_hours(samples, CFG)[date(2026, 9, 1)] == 24.0


def test_outage_samples_do_not_count():
    start = datetime(2026, 9, 1)
    samples = [(start + timedelta(minutes=15 * i), 0.0 if i < 8 else 230.0) for i in range(96)]
    assert daily_supply_hours(samples, CFG)[date(2026, 9, 1)] == 22.0


def test_classify_band_edges():
    assert classify_band(20, CFG) == "A"
    assert classify_band(19.9, CFG) == "B"
    assert classify_band(4, CFG) == "E"
    assert classify_band(3.9, CFG) is None


def _days(hours):
    return {date(2026, 9, 1) + timedelta(days=i): h for i, h in enumerate(hours)}


def test_seven_consecutive_failures_trigger_downgrade():
    r = evaluate_feeder(_days([17] * 7), "A", CFG)
    assert r.downgrade_triggered and r.downgrade_date == date(2026, 9, 7)
    assert r.recommended_band == "B"


def test_six_failures_do_not_trigger_downgrade():
    r = evaluate_feeder(_days([17] * 6), "A", CFG)
    assert not r.downgrade_triggered and r.explanation_required


def test_a_good_day_resets_the_streak():
    r = evaluate_feeder(_days([17, 17, 17, 21, 17, 17, 17]), "A", CFG)
    assert not r.downgrade_triggered and r.max_failure_streak == 3


def test_compensation_flag_below_ratio():
    assert evaluate_feeder(_days([17] * 5), "A", CFG).compensation_flag
    assert not evaluate_feeder(_days([19] * 5), "A", CFG).compensation_flag
