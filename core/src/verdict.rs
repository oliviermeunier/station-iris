//! Where does today's value sit within the known envelope for this date?

use serde::Serialize;

use crate::envelope::Envelope;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Position {
    BelowAll,
    Low,
    Normal,
    High,
    AboveAll,
}

/// Thirds of the envelope on a "bigger means more" scale. Callers measuring depth to
/// water must negate both the value and the envelope first.
#[must_use]
pub fn classify(value: f64, env: &Envelope) -> Position {
    if value < env.min {
        return Position::BelowAll;
    }
    if value > env.max {
        return Position::AboveAll;
    }
    let span = env.max - env.min;
    if span <= f64::EPSILON {
        return Position::Normal;
    }
    let relative = (value - env.min) / span;
    if relative < 1.0 / 3.0 {
        Position::Low
    } else if relative <= 2.0 / 3.0 {
        Position::Normal
    } else {
        Position::High
    }
}

/// Fill level in `[0, 1]` for drawing a reservoir; clamps values outside the envelope.
#[must_use]
pub fn fill_ratio(value: f64, env: &Envelope) -> f64 {
    let span = env.max - env.min;
    if span <= f64::EPSILON {
        return 0.5;
    }
    ((value - env.min) / span).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ENV: Envelope = Envelope {
        min: 0.0,
        max: 3.0,
        mean: 1.5,
        years: 10,
    };

    #[test]
    fn classify_thirds() {
        assert_eq!(classify(0.5, &ENV), Position::Low);
        assert_eq!(classify(1.5, &ENV), Position::Normal);
        assert_eq!(classify(2.9, &ENV), Position::High);
        assert_eq!(classify(-1.0, &ENV), Position::BelowAll);
        assert_eq!(classify(4.0, &ENV), Position::AboveAll);
    }

    #[test]
    fn classify_flat_envelope_is_normal() {
        let env = Envelope {
            min: 2.0,
            max: 2.0,
            mean: 2.0,
            years: 1,
        };
        assert_eq!(classify(2.0, &env), Position::Normal);
    }

    #[test]
    fn fill_ratio_clamps() {
        assert_eq!(fill_ratio(-5.0, &ENV), 0.0);
        assert_eq!(fill_ratio(9.0, &ENV), 1.0);
        assert!((fill_ratio(1.5, &ENV) - 0.5).abs() < 1e-9);
    }
}
