#!/usr/bin/env bash
# 统一 bump @happyimage/* 包版本，替换 workspace:^ 为实际 semver
# 用法：./scripts/version-bump.sh <version>
# 示例：./scripts/version-bump.sh 0.2.0
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
die() { echo -e "${RED}✘ $*${RESET}"; exit 1; }

VERSION="${1:?用法: $0 <version>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PACKAGES=("packages/core" "packages/cli" "packages/web-ui" "packages/desktop")

echo -e "${BOLD}Bumping @happyimage packages to ${CYAN}v${VERSION}${RESET}"
echo ""

for pkg in "${PACKAGES[@]}"; do
  pjson="${PROJECT_DIR}/${pkg}/package.json"
  [[ -f "$pjson" ]] || { echo "  SKIP: $pkg (no package.json)"; continue; }

  name=$(node -e "console.log(require('${pjson}').name)")
  old=$(node -e "console.log(require('${pjson}').version)")

  # 更新版本号（macOS sed 兼容）
  sed -i '' "s/\"version\": \"${old}\"/\"version\": \"${VERSION}\"/" "$pjson"
  echo -e "  ${CYAN}${name}${RESET}: ${old} → ${GREEN}${VERSION}${RESET}"
done

# 替换 workspace:^ 引用为实际 semver
echo ""
echo "Replacing workspace:^ references..."
for pkg in "${PACKAGES[@]}"; do
  pjson="${PROJECT_DIR}/${pkg}/package.json"
  sed -i '' "s/\"workspace:\^[0-9.]*\"/\"^${VERSION}\"/g" "$pjson"
done
echo -e "  ${GREEN}✔${RESET} All workspace:^ → ^${VERSION}"

echo ""
echo -e "${GREEN}Version bump complete.${RESET}"
echo "  Next: git add packages/*/package.json && git commit -m 'chore: bump to v${VERSION}'"
