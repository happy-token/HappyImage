#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${MODE:-test}"
VERSION="${VERSION:-$(node -e "console.log(require('./packages/desktop/package.json').version)")}"
REPO="${GITHUB_REPOSITORY:-happy-token/HappyImage}"
TAG="${TAG:-v${VERSION}}"

cd "$ROOT_DIR"

bun run icons
bun run build:core
bun run build:web
bun run build:cli
bunx tsc -p packages/desktop/tsconfig.json --noEmit
bun test packages/desktop/tests/sidecar.test.ts packages/desktop/tests/lifecycle.test.ts packages/desktop/tests/preload.test.ts

case "$MODE" in
  test)
    rm -rf packages/desktop/release
    CSC_IDENTITY_AUTO_DISCOVERY=false bun run --cwd packages/desktop build:dir
    ;;
  package)
    rm -rf packages/desktop/release
    CSC_IDENTITY_AUTO_DISCOVERY=false bun run --cwd packages/desktop build
    ;;
  release)
    rm -rf packages/desktop/release
    bun run --cwd packages/desktop release
    ;;
  github-release)
    command -v gh >/dev/null
    rm -rf packages/desktop/release
    bun run --cwd packages/desktop build
    shopt -s nullglob
    artifacts=(packages/desktop/release/HappyImage-"${VERSION}"-mac.*)
    if [[ ${#artifacts[@]} -eq 0 ]]; then
      echo "No desktop artifacts found for ${VERSION}" >&2
      exit 1
    fi
    if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
      gh release upload "$TAG" "${artifacts[@]}" --repo "$REPO" --clobber
    else
      gh release create "$TAG" "${artifacts[@]}" \
        --repo "$REPO" \
        --title "HappyImage ${TAG}" \
        --generate-notes
    fi
    ;;
  *)
    echo "Unknown MODE: $MODE" >&2
    echo "Use MODE=test, package, release, or github-release." >&2
    exit 1
    ;;
esac
