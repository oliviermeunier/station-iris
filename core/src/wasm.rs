//! Browser bindings: JSON strings in, JSON strings out, so the TypeScript side owns
//! the data shapes and this layer stays thin.

// wasm-bindgen exports: `#[must_use]` means nothing to JS callers, and owned `Option<String>`
// is how optional strings cross the boundary.
#![allow(clippy::must_use_candidate, clippy::needless_pass_by_value)]

use chrono::NaiveDate;
use serde::de::DeserializeOwned;
use wasm_bindgen::prelude::*;

use crate::{balance, consensus, envelope, geo, river, verdict};

fn parse<T: DeserializeOwned>(json: &str) -> Result<T, JsError> {
    serde_json::from_str(json).map_err(|e| JsError::new(&format!("invalid input: {e}")))
}

fn date(s: &str) -> Result<NaiveDate, JsError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|e| JsError::new(&format!("invalid date {s}: {e}")))
}

fn to_json<T: serde::Serialize>(value: &T) -> Result<String, JsError> {
    serde_json::to_string(value).map_err(|e| JsError::new(&e.to_string()))
}

fn dated(points: Vec<(String, f64)>) -> Result<Vec<(NaiveDate, f64)>, JsError> {
    points
        .into_iter()
        .map(|(d, v)| Ok((date(&d)?, v)))
        .collect()
}

/// `history`: `[["YYYY-MM-DD", value], …]` → `Envelope` or `null`.
#[wasm_bindgen(js_name = envelopeAt)]
pub fn envelope_at(history: &str, target: &str, half_window_days: u32) -> Result<String, JsError> {
    let history = dated(parse(history)?)?;
    to_json(&envelope::envelope_at(
        &history,
        date(target)?,
        half_window_days,
    ))
}

/// `history` as above → 365 entries of `Envelope` or `null`.
#[wasm_bindgen(js_name = dayOfYearEnvelopes)]
pub fn day_of_year_envelopes(
    history: &str,
    exclude_year: i32,
    half_window_days: u32,
) -> Result<String, JsError> {
    let history = dated(parse(history)?)?;
    to_json(&envelope::day_of_year_envelopes(
        &history,
        exclude_year,
        half_window_days,
    ))
}

#[wasm_bindgen(js_name = dayIndex)]
pub fn day_index(d: &str) -> Result<usize, JsError> {
    Ok(envelope::day_index(date(d)?))
}

/// `envelope`: `{min, max, mean, years}` → `"belowAll" | "low" | "normal" | "high" | "aboveAll"`.
#[wasm_bindgen]
pub fn classify(value: f64, envelope: &str) -> Result<String, JsError> {
    let env: envelope::Envelope = parse(envelope)?;
    to_json(&verdict::classify(value, &env)).map(|s| s.trim_matches('"').to_string())
}

#[wasm_bindgen(js_name = fillRatio)]
pub fn fill_ratio(value: f64, min: f64, max: f64) -> f64 {
    verdict::fill_ratio(
        value,
        &envelope::Envelope {
            min,
            max,
            mean: f64::midpoint(min, max),
            years: 0,
        },
    )
}

/// `series`: `[[v|null, …] per model]`, `dates`: `["YYYY-MM-DD", …]` → `DayConsensus[]`.
#[wasm_bindgen]
pub fn consensus(
    series: &str,
    dates: &str,
    rain_threshold: Option<f64>,
) -> Result<String, JsError> {
    let series: Vec<Vec<Option<f64>>> = parse(series)?;
    let dates: Vec<String> = parse(dates)?;
    let dates = dates
        .iter()
        .map(|d| date(d))
        .collect::<Result<Vec<_>, _>>()?;
    to_json(&consensus::consensus(&series, &dates, rain_threshold))
}

/// `days`: `[["YYYY-MM-DD", rain|null, et0|null], …]` → `Balance`.
#[wasm_bindgen(js_name = waterBalance)]
pub fn water_balance(days: &str, end: &str, window_days: u32) -> Result<String, JsError> {
    let raw: Vec<(String, Option<f64>, Option<f64>)> = parse(days)?;
    let days = raw
        .into_iter()
        .map(|(d, r, e)| Ok((date(&d)?, r, e)))
        .collect::<Result<Vec<_>, JsError>>()?;
    to_json(&balance::water_balance(&days, date(end)?, window_days))
}

/// `stations`: `Station[]` → `Station[]` ordered upstream to downstream.
#[wasm_bindgen(js_name = riverProfile)]
pub fn river_profile(
    stations: &str,
    lat: f64,
    lon: f64,
    up_km: f64,
    down_km: f64,
) -> Result<String, JsError> {
    let stations: Vec<river::Station> = parse(stations)?;
    to_json(&river::profile(&stations, (lat, lon), up_km, down_km))
}

#[wasm_bindgen(js_name = riverKey)]
pub fn river_key(label_station: &str, label_river: Option<String>) -> String {
    river::river_key(label_station, label_river.as_deref())
}

#[wasm_bindgen(js_name = distanceKm)]
pub fn distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    geo::distance_km((lat1, lon1), (lat2, lon2))
}

/// → `[lon_min, lat_min, lon_max, lat_max]`.
#[wasm_bindgen]
pub fn bbox(lat: f64, lon: f64, radius_km: f64) -> Vec<f64> {
    geo::bbox((lat, lon), radius_km).to_vec()
}
