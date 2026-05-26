#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist/npm"

cd "$ROOT_DIR"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

bun run icons
bun run build:core
bun run build:web
bun run build:cli

npm pack --workspace packages/core --pack-destination "$OUT_DIR"
npm pack --workspace packages/web-ui --pack-destination "$OUT_DIR"
npm pack --workspace packages/cli --pack-destination "$OUT_DIR"

echo "npm packages written to $OUT_DIR"
