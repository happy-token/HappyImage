#!/usr/bin/env bash
# Bundle runtime node_modules for the packaged desktop app.
# Only copies packages needed by the sidecar server at runtime.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEST="$SCRIPT_DIR/../deps/node_modules"

rm -rf "$DEST"
mkdir -p "$DEST"

copy_pkg() {
  local pkg="$1"
  local src="$ROOT/node_modules/$pkg"
  local dst="$DEST/$pkg"
  if [[ ! -e "$src" ]]; then
    echo "Missing runtime dependency: $pkg" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$dst")"
  cp -a "$src" "$dst"
}

# Core runtime deps and their transitive packages.
copy_pkg "@anthropic-ai/sdk"
copy_pkg "standardwebhooks"
copy_pkg "json-schema-to-ts"
copy_pkg "@babel/runtime"
copy_pkg "ts-algebra"
copy_pkg "@stablelib/base64"
copy_pkg "fast-sha256"

# Web server deps (used by @happytokenai/happyimage-web/server)
copy_pkg "hono"
copy_pkg "marked"
copy_pkg "dompurify"

echo "Bundled deps: $(du -sh "$DEST" | cut -f1)"
