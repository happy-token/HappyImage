#!/usr/bin/env bash
# Bundle runtime node_modules for the packaged desktop app.
# Only copies packages needed by the sidecar server at runtime.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEST="$SCRIPT_DIR/../deps/node_modules"

rm -rf "$DEST"
mkdir -p "$DEST"

# Core runtime deps (used by @happytokenai/happyimage-core)
cp -a "$ROOT/node_modules/@anthropic-ai" "$DEST/"

# Web server deps (used by @happytokenai/happyimage-web/server)
# hono, marked, dompurify are small standalone packages
cp -a "$ROOT/node_modules/hono" "$DEST/"
cp -a "$ROOT/node_modules/marked" "$DEST/"
cp -a "$ROOT/node_modules/dompurify" "$DEST/"

echo "Bundled deps: $(du -sh "$DEST" | cut -f1)"
