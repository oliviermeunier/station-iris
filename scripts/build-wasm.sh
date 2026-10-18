#!/usr/bin/env bash
# Builds the Rust core to WebAssembly and generates the JS bindings used by the web app.
set -euo pipefail
cd "$(dirname "$0")/.."
target_dir="${CARGO_TARGET_DIR:-target}"
cargo build -p iris-core --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir web/src/wasm-pkg \
  "$target_dir/wasm32-unknown-unknown/release/iris_core.wasm"
