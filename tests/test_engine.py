from datetime import date, datetime, timedelta

from src.accountability.engine import (
    DaySupply,
    classify_band,
    daily_supply,
    daily_supply_hours,
    evaluate_feeder,
    fill_missing_days,
    load_config,
)

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


def test_compensation_applies_between_floor_and_commitment():
    assert evaluate_feeder(_days([19] * 5), "A", CFG).compensation_flag
    assert evaluate_feeder(_days([18] * 5), "A", CFG).compensation_flag


def test_no_compensation_below_floor_or_when_met():
    assert not evaluate_feeder(_days([17] * 5), "A", CFG).compensation_flag
    assert not evaluate_feeder(_days([21] * 5), "A", CFG).compensation_flag


def test_no_compensation_for_bands_without_a_rule():
    assert not evaluate_feeder(_days([15] * 5), "B", CFG).compensation_flag


def test_missing_samples_lower_coverage_not_hours():
    start = datetime(2026, 9, 1)
    samples = [(start + timedelta(minutes=15 * i), 230.0) for i in range(48)]  # second half of day missing
    day = daily_supply(samples, CFG)[date(2026, 9, 1)]
    assert day.hours == 12.0 and day.coverage == 0.5


def test_duplicate_samples_count_once():
    start = datetime(2026, 9, 1)
    samples = [(start + timedelta(minutes=15 * i), 230.0) for i in range(96)] * 2
    assert daily_supply(samples, CFG)[date(2026, 9, 1)].hours == 24.0


def test_insufficient_data_day_is_not_judged_and_breaks_streak():
    days = _days([17] * 7)
    days[date(2026, 9, 4)] = DaySupply(hours=10, observed_hours=12)
    r = evaluate_feeder(days, "A", CFG)
    assert r.insufficient_data_days == [date(2026, 9, 4)]
    assert not r.downgrade_triggered and r.max_failure_streak == 3
    assert r.average_hours == 17


def test_explanation_recorded_even_after_recovery():
    r = evaluate_feeder(_days([17, 17, 21, 21]), "A", CFG)
    assert r.explanation_dates == [date(2026, 9, 2)] and r.current_failure_streak == 0


def test_exempt_window_blocks_downgrade_and_flags_special_compensation():
    days = {date(2026, 3, 1) + timedelta(days=i): 15 for i in range(10)}
    r = evaluate_feeder(days, "A", CFG)
    assert not r.downgrade_triggered
    assert len(r.special_compensation_days) == 10
    assert r.explanation_required


def test_exemption_ends_and_streak_counts_from_april():
    days = {date(2026, 3, 25) + timedelta(days=i): 15 for i in range(14)}  # Mar 25 - Apr 7
    r = evaluate_feeder(days, "A", CFG)
    assert r.downgrade_triggered and r.downgrade_date == date(2026, 4, 7)
    assert r.recommended_band == "C"


def test_exemption_does_not_apply_to_other_bands():
    days = {date(2026, 3, 1) + timedelta(days=i): 10 for i in range(7)}
    assert evaluate_feeder(days, "B", CFG).downgrade_triggered


def test_day_with_no_samples_at_all_breaks_streak():
    days = _days([17] * 7)
    del days[date(2026, 9, 4)]
    r = evaluate_feeder(days, "A", CFG)
    assert r.insufficient_data_days == [date(2026, 9, 4)] and not r.downgrade_triggered


def test_fill_missing_days_covers_requested_period():
    filled = fill_missing_days({}, date(2026, 9, 1), date(2026, 9, 3))
    assert sorted(filled) == [date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 3)]
    assert all(s.coverage == 0 for s in filled.values())
