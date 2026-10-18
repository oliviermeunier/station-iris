//! Combine several weather models day by day: mean, spread and how many agree on rain.

use chrono::NaiveDate;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DayConsensus {
    pub date: NaiveDate,
    pub mean: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    /// Models that gave a value this day.
    pub sources: u32,
    /// Models at or above the rain threshold (0 when no threshold is given).
    pub rainy: u32,
}

/// `series[m][d]` is model `m`'s value for `dates[d]`; missing values do not count.
#[must_use]
pub fn consensus(
    series: &[Vec<Option<f64>>],
    dates: &[NaiveDate],
    rain_threshold: Option<f64>,
) -> Vec<DayConsensus> {
    dates
        .iter()
        .enumerate()
        .map(|(day, &date)| {
            let values: Vec<f64> = series
                .iter()
                .filter_map(|model| model.get(day).copied().flatten())
                .filter(|v| v.is_finite())
                .collect();
            let sources = values.len() as u32;
            let rainy =
                rain_threshold.map_or(0, |t| values.iter().filter(|&&v| v >= t).count() as u32);
            DayConsensus {
                date,
                mean: (sources > 0).then(|| values.iter().sum::<f64>() / f64::from(sources)),
                min: values.iter().copied().reduce(f64::min),
                max: values.iter().copied().reduce(f64::max),
                sources,
                rainy,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dates(n: u32) -> Vec<NaiveDate> {
        (1..=n)
            .map(|d| NaiveDate::from_ymd_opt(2026, 10, d).unwrap())
            .collect()
    }

    #[test]
    fn consensus_mean_min_max() {
        let series = vec![vec![Some(10.0)], vec![Some(14.0)], vec![Some(12.0)]];
        let c = consensus(&series, &dates(1), None);
        assert_eq!(c[0].mean, Some(12.0));
        assert_eq!(c[0].min, Some(10.0));
        assert_eq!(c[0].max, Some(14.0));
        assert_eq!(c[0].sources, 3);
        assert_eq!(c[0].rainy, 0);
    }

    #[test]
    fn consensus_ignores_missing_values() {
        let mut series = vec![vec![Some(1.0); 5]; 4];
        series[0][4] = None;
        let c = consensus(&series, &dates(5), Some(1.0));
        assert_eq!(c[4].sources, 3);
        assert_eq!(c[4].rainy, 3);
        assert_eq!(c[0].sources, 4);
    }

    #[test]
    fn consensus_counts_rainy_at_threshold() {
        let series = vec![vec![Some(1.0)], vec![Some(0.9)], vec![Some(5.0)]];
        let c = consensus(&series, &dates(1), Some(1.0));
        assert_eq!(c[0].rainy, 2);
    }

    #[test]
    fn consensus_empty_day() {
        let series = vec![vec![None], vec![None]];
        let c = consensus(&series, &dates(1), Some(1.0));
        assert_eq!(c[0].mean, None);
        assert_eq!(c[0].sources, 0);
    }
}
