//! Great-circle distances and bounding boxes. Points are `(lat, lon)` in degrees.

const EARTH_RADIUS_KM: f64 = 6371.0;

#[must_use]
pub fn distance_km(a: (f64, f64), b: (f64, f64)) -> f64 {
    let (lat1, lon1) = (a.0.to_radians(), a.1.to_radians());
    let (lat2, lon2) = (b.0.to_radians(), b.1.to_radians());
    let h = ((lat2 - lat1) / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * ((lon2 - lon1) / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_KM * h.sqrt().asin()
}

/// `[lon_min, lat_min, lon_max, lat_max]`, the order Hub'Eau expects for `bbox`.
#[must_use]
pub fn bbox(center: (f64, f64), radius_km: f64) -> [f64; 4] {
    let dlat = (radius_km / EARTH_RADIUS_KM).to_degrees();
    let dlon = dlat / center.0.to_radians().cos().max(0.01);
    [
        center.1 - dlon,
        center.0 - dlat,
        center.1 + dlon,
        center.0 + dlat,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distance_paris_lyon_about_392km() {
        let km = distance_km((48.8566, 2.3522), (45.7640, 4.8357));
        assert!((km - 392.0).abs() < 3.0, "{km}");
    }

    #[test]
    fn bbox_contains_center_and_radius() {
        let center = (47.616, -0.467);
        let [lon_min, lat_min, lon_max, lat_max] = bbox(center, 10.0);
        assert!(lon_min < center.1 && center.1 < lon_max);
        assert!(lat_min < center.0 && center.0 < lat_max);
        let east = distance_km(center, (center.0, lon_max));
        assert!((east - 10.0).abs() < 0.2, "{east}");
    }
}
