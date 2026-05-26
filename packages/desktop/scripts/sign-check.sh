#!/bin/bash
set -euo pipefail

APP_PATH="${1:-release/mac-arm64/HappyImage.app}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: App not found at $APP_PATH"
  echo "Run 'bun run build:dir' first"
  exit 1
fi

echo "=== Code Signature ==="
codesign -dvvv "$APP_PATH" 2>&1 || echo "Not signed"

echo ""
echo "=== Gatekeeper Assessment ==="
spctl -a -v "$APP_PATH" 2>&1 || echo "Gatekeeper assessment failed"

echo ""
echo "=== Entitlements ==="
codesign -d --entitlements - "$APP_PATH" 2>&1 || echo "No entitlements"
