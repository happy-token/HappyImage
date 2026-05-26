#!/bin/bash
set -euo pipefail

APP_PATH="${1:-release/HappyImage-*.dmg}"

if [ -z "${APPLE_ID:-}" ] || [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
  echo "Error: Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID environment variables"
  exit 1
fi

echo "Notarizing $APP_PATH..."
xcrun notarytool submit "$APP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "Stapling ticket..."
xcrun stapler staple "$APP_PATH"

echo "Done."
