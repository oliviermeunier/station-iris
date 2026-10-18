//! Seasonal envelope: what range did a value span around this date in other years?

use std::collections::BTreeSet;

use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};

/// Days on each side of the target day that still count as "the same date".
pub const DEFAULT_HALF_WINDOW_DAYS: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Envelope {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    /// Number of distinct reference years that contributed.
    pub years: u32,
}

/// Envelope around `target` built from years strictly before `target.year()`.
#[must_use]
pub fn envelope_at(
    history: &[(NaiveDate, f64)],
    target: NaiveDate,
    half_window_days: u32,
) -> Option<Envelope> {
    envelope_where(history, target, half_window_days, |year| {
        year < target.year()
    })
}

/// One envelope per calendar day (index 0 = 1 January … 364 = 31 December; 29 February
/// shares 28 February's), built from every year except `exclude_year`. Chart bands map
/// any displayed date onto this table.
#[must_use]
pub fn day_of_year_envelopes(
    history: &[(NaiveDate, f64)],
    exclude_year: i32,
    half_window_days: u32,
) -> Vec<Option<Envelope>> {
    // 2001 is not a leap year, so it yields exactly 365 calendar days.
    let Some(first) = NaiveDate::from_ymd_opt(2001, 1, 1) else {
        return Vec::new();
    };
    first
        .iter_days()
        .take(365)
        .map(|day| envelope_where(history, day, half_window_days, |year| year != exclude_year))
        .collect()
}

/// Index into [`day_of_year_envelopes`] for any date.
#[must_use]
pub fn day_index(date: NaiveDate) -> usize {
    let ordinal = date.ordinal0() as usize;
    if date.leap_year() && ordinal >= 59 {
        // 29 February (ordinal0 59) and later shift back by one day.
        ordinal.saturating_sub(1)
    } else {
        ordinal
    }
}

fn envelope_where(
    history: &[(NaiveDate, f64)],
    target: NaiveDate,
    half_window_days: u32,
    keep_year: impl Fn(i32) -> bool,
) -> Option<Envelope> {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut sum = 0.0;
    let mut count = 0_u32;
    let mut years = BTreeSet::new();

    for &(date, value) in history {
        if !value.is_finite() {
            continue;
        }
        // A date near New Year can match the target day of the previous or next year.
        for anchor_year in [date.year() - 1, date.year(), date.year() + 1] {
            if !keep_year(anchor_year) {
                continue;
            }
            let Some(anchor) = same_day_in_year(target, anchor_year) else {
                continue;
            };
            if (date - anchor).num_days().unsigned_abs() <= u64::from(half_window_days) {
                min = min.min(value);
                max = max.max(value);
                sum += value;
                count += 1;
                years.insert(anchor_year);
                break;
            }
        }
    }

    (count > 0).then(|| Envelope {
        min,
        max,
        mean: sum / f64::from(count),
        years: years.len() as u32,
    })
}

/// The same month/day in another year; 29 February falls back to 28 February.
fn same_day_in_year(target: NaiveDate, year: i32) -> Option<NaiveDate> {
    NaiveDate::from_ymd_opt(year, target.month(), target.day())
        .or_else(|| NaiveDate::from_ymd_opt(year, 2, 28))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    #[test]
    fn envelope_uses_only_past_years() {
        let history = vec![
            (d(2024, 10, 15), 1.0),
            (d(2025, 10, 15), 3.0),
            (d(2026, 10, 15), 9.0),
        ];
        let env = envelope_at(&history, d(2026, 10, 15), 3).unwrap();
        assert_eq!(env.min, 1.0);
        assert_eq!(env.max, 3.0);
        assert_eq!(env.years, 2);
    }

    #[test]
    fn envelope_window_three_days() {
        let history = vec![
            (d(2025, 10, 12), 1.0),
            (d(2025, 10, 11), 100.0),
            (d(2025, 10, 18), 2.0),
        ];
        let env = envelope_at(&history, d(2026, 10, 15), 3).unwrap();
        assert_eq!(env.min, 1.0);
        assert_eq!(env.max, 2.0);
    }

    #[test]
    fn envelope_none_when_no_past_year() {
        let history = vec![(d(2026, 10, 14), 1.0)];
        assert!(envelope_at(&history, d(2026, 10, 15), 3).is_none());
        assert!(envelope_at(&[], d(2026, 10, 15), 3).is_none());
    }

    #[test]
    fn envelope_mean_is_average() {
        let history = vec![
            (d(2024, 10, 15), 1.0),
            (d(2025, 10, 15), 2.0),
            (d(2025, 10, 16), 6.0),
        ];
        let env = envelope_at(&history, d(2026, 10, 15), 3).unwrap();
        assert!((env.mean - 3.0).abs() < 1e-9);
    }

    #[test]
    fn envelope_crosses_new_year() {
        let history = vec![(d(2025, 1, 1), 5.0)];
        let env = envelope_at(&history, d(2026, 12, 30), 3).unwrap();
        assert_eq!(env.max, 5.0);
    }

    #[test]
    fn envelope_ignores_non_finite_values() {
        let history = vec![(d(2025, 10, 15), f64::NAN), (d(2025, 10, 16), 2.0)];
        let env = envelope_at(&history, d(2026, 10, 15), 3).unwrap();
        assert_eq!(env.min, 2.0);
    }

    #[test]
    fn day_of_year_envelopes_exclude_given_year() {
        let history = vec![(d(2025, 10, 15), 1.0), (d(2026, 10, 15), 5.0)];
        let table = day_of_year_envelopes(&history, 2026, 0);
        assert_eq!(table.len(), 365);
        let env = table[day_index(d(2026, 10, 15))].unwrap();
        assert_eq!(env.max, 1.0);
        assert!(table[day_index(d(2026, 10, 16))].is_none());
    }

    #[test]
    fn day_index_handles_leap_years() {
        assert_eq!(day_index(d(2026, 1, 1)), 0);
        assert_eq!(day_index(d(2026, 12, 31)), 364);
        assert_eq!(day_index(d(2024, 2, 29)), day_index(d(2024, 2, 28)));
        assert_eq!(day_index(d(2024, 12, 31)), 364);
    }
}
