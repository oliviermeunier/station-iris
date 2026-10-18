//! Hydrometric stations of one river, ordered from upstream to downstream.

use serde::{Deserialize, Serialize};

use crate::geo::distance_km;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Station {
    pub code: String,
    pub name: String,
    pub river: String,
    pub lat: f64,
    pub lon: f64,
}

/// Normalised river name: the river label when Hub'Eau has one, otherwise the station
/// label before " à " / " au " / " aux ", lower-cased and without its article.
#[must_use]
pub fn river_key(label_station: &str, label_river: Option<&str>) -> String {
    let raw = if let Some(river) = label_river.map(str::trim).filter(|s| !s.is_empty()) {
        river.to_string()
    } else {
        let normalised = label_station.replace('\u{a0}', " ");
        [" à ", " aux ", " au "]
            .iter()
            .filter_map(|sep| normalised.find(sep))
            .min()
            .map_or(normalised.clone(), |i| normalised[..i].to_string())
    };
    let lower = raw.trim().to_lowercase();
    let lower = lower.trim_start_matches('[').trim_end_matches(']');
    for article in ["la ", "le ", "les ", "l'", "l’"] {
        if let Some(rest) = lower.strip_prefix(article) {
            return rest.trim().to_string();
        }
    }
    lower.to_string()
}

/// Stations of the river whose station is nearest to `center`, upstream to downstream.
/// Sandre station codes grow downstream within a river, so sorting by code orders them.
/// Keeps stations within `up_km` upstream and `down_km` downstream of the nearest one.
#[must_use]
pub fn profile(stations: &[Station], center: (f64, f64), up_km: f64, down_km: f64) -> Vec<Station> {
    let Some(nearest) = stations.iter().min_by(|a, b| {
        distance_km(center, (a.lat, a.lon)).total_cmp(&distance_km(center, (b.lat, b.lon)))
    }) else {
        return Vec::new();
    };
    let mut same_river: Vec<Station> = stations
        .iter()
        .filter(|s| s.river == nearest.river)
        .cloned()
        .collect();
    same_river.sort_by(|a, b| a.code.cmp(&b.code));
    same_river
        .into_iter()
        .filter(|s| {
            let km = distance_km((nearest.lat, nearest.lon), (s.lat, s.lon));
            match s.code.cmp(&nearest.code) {
                std::cmp::Ordering::Less => km <= up_km,
                std::cmp::Ordering::Equal => true,
                std::cmp::Ordering::Greater => km <= down_km,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn st(code: &str, lat: f64, lon: f64) -> Station {
        Station {
            code: code.into(),
            name: code.into(),
            river: "sarthe".into(),
            lat,
            lon,
        }
    }

    #[test]
    fn river_key_from_station_label() {
        assert_eq!(
            river_key("La Sarthe à\u{a0}Châteauneuf-sur-Sarthe", None),
            "sarthe"
        );
        assert_eq!(river_key("L'Authion aux Ponts-de-Cé", None), "authion");
        assert_eq!(river_key("x", Some("le Loir")), "loir");
        assert_eq!(river_key("[La Voutonne] à Précigné", None), "voutonne");
    }

    #[test]
    fn profile_orders_upstream_to_downstream() {
        let stations = vec![
            st("M073061010", 47.621, -0.506),
            st("M063061010", 47.838, -0.332),
            st("M072061010", 47.678, -0.487),
            st("M068061010", 47.803, -0.386),
        ];
        let p = profile(&stations, (47.616, -0.467), 30.0, 10.0);
        let codes: Vec<_> = p.iter().map(|s| s.code.as_str()).collect();
        assert_eq!(
            codes,
            ["M063061010", "M068061010", "M072061010", "M073061010"]
        );
    }

    #[test]
    fn profile_limits_distance() {
        let stations = vec![
            st("M010000000", 48.5, -0.4),
            st("M072061010", 47.678, -0.487),
            st("M090000000", 47.0, -0.5),
        ];
        let p = profile(&stations, (47.68, -0.48), 30.0, 10.0);
        assert_eq!(p.len(), 1);
    }

    #[test]
    fn profile_keeps_only_nearest_river() {
        let mut other = st("M153161010", 47.669, -0.245);
        other.river = "loir".into();
        let stations = vec![st("M072061010", 47.678, -0.487), other];
        let p = profile(&stations, (47.67, -0.48), 30.0, 10.0);
        assert_eq!(p.len(), 1);
        assert_eq!(p[0].river, "sarthe");
    }
}
