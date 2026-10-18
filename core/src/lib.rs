//! Station Iris computation core: pure functions, compiled natively for tests and to
//! WebAssembly for the browser.

#![cfg_attr(test, allow(clippy::unwrap_used, clippy::float_cmp))]

pub mod envelope;
pub mod geo;
pub mod verdict;
