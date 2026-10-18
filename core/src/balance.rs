//! Rain minus reference evapotranspiration over the last days (negative = drying).

use chrono::{Days, NaiveDate};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Balance {
    pub rain: f64,
    pub et0: f64,
    pub balance: f64,
    /// Days in the window that had both values.
    pub days_covered: u32,
    pub window_days: u32,
}

/// `days` holds `(date, rain_mm, et0_mm)`; the window ends on `end` included.
#[must_use]
pub fn water_balance(
    days: &[(NaiveDate, Option<f64>, Option<f64>)],
    end: NaiveDate,
    window_days: u32,
) -> Balance {
    let start = end
        .checked_sub_days(Days::new(u64::from(window_days.saturating_sub(1))))
        .unwrap_or(end);
    let mut rain = 0.0;
    let mut et0 = 0.0;
    let mut days_covered = 0;
    for &(date, r, e) in days {
        if date < start || date > end {
            continue;
        }
        if let (Some(r), Some(e)) = (r, e) {
            rain += r;
            et0 += e;
            days_covered += 1;
        }
    }
    Balance {
        rain,
        et0,
        balance: rain - et0,
        days_covered,
        window_days,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, day).unwrap()
    }

    #[test]
    fn balance_week() {
        let days: Vec<_> = (1..=10).map(|day| (d(day), Some(1.0), Some(2.0))).collect();
        let b = water_balance(&days, d(10), 7);
        assert_eq!(b.days_covered, 7);
        assert_eq!(b.rain, 7.0);
        assert_eq!(b.balance, -7.0);
    }

    #[test]
    fn balance_skips_incomplete_days() {
        let days = vec![(d(9), Some(3.0), None), (d(10), Some(1.0), Some(0.5))];
        let b = water_balance(&days, d(10), 7);
        assert_eq!(b.days_covered, 1);
        assert_eq!(b.balance, 0.5);
    }
}
