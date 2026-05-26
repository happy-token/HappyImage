#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${DRY_RUN:-false}"

cd "$ROOT_DIR"

if [[ "$DRY_RUN" != "true" ]]; then
  npm whoami >/dev/null
fi

bun run icons
bun run build:core
bun run build:web
bun run build:cli

publish_workspace() {
  local workspace="$1"
  local package_json="$workspace/package.json"
  local name version existing

  name="$(node -e "console.log(require('./${package_json}').name)")"
  version="$(node -e "console.log(require('./${package_json}').version)")"
  existing="$(npm view "${name}@${version}" version 2>/dev/null || true)"

  if [[ "$existing" == "$version" ]]; then
    echo "Skipping ${name}@${version}; already published."
    return
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    npm publish --workspace "$workspace" --access public --dry-run
  elif [[ -n "${NPM_OTP:-}" ]]; then
    npm publish --workspace "$workspace" --access public --otp "$NPM_OTP"
  else
    npm publish --workspace "$workspace" --access public
  fi
}

publish_workspace packages/core
publish_workspace packages/web-ui
publish_workspace packages/cli
