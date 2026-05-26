#!/usr/bin/env bash
# 本地全流程发布：npm 发布 → 桌面构建 → 签名公证 → GitHub Release
# 用法：./scripts/release.sh [--dry-run] [--skip-npm] [--skip-desktop] <version>
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()     { echo -e "${RED}✘ $*${RESET}"; exit 1; }

DRY_RUN=false
SKIP_NPM=false
SKIP_DESKTOP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --skip-npm) SKIP_NPM=true; shift ;;
    --skip-desktop) SKIP_DESKTOP=true; shift ;;
    *) VERSION="$1"; shift ;;
  esac
done

: "${VERSION:?用法: $0 [--dry-run] [--skip-npm] [--skip-desktop] <version>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 加载 .env
env_get() { grep -E "^${1}=" "${PROJECT_DIR}/.env" 2>/dev/null | head -1 | cut -d= -f2- || echo ""; }
APPLE_ID="$(env_get APPLE_ID)"
APPLE_APP_SPECIFIC_PASSWORD="$(env_get APPLE_APP_SPECIFIC_PASSWORD)"
APPLE_TEAM_ID="$(env_get APPLE_TEAM_ID)"
CSC_NAME="$(env_get CSC_NAME)"
GITHUB_TOKEN="$(env_get GITHUB_TOKEN)"

echo ""
echo -e "${BOLD}═══════════════════════════════════${RESET}"
echo -e "${BOLD}  HappyImage Release ${CYAN}v${VERSION}${RESET}"
echo -e "${BOLD}═══════════════════════════════════${RESET}"
echo ""
echo -e "  dry-run:     ${CYAN}${DRY_RUN}${RESET}"
echo -e "  skip-npm:    ${CYAN}${SKIP_NPM}${RESET}"
echo -e "  skip-desktop: ${CYAN}${SKIP_DESKTOP}${RESET}"
echo ""

# ── 1. 版本 bump ─────────────────────────────────────────────
info "Bump versions to ${VERSION}..."
bash "${SCRIPT_DIR}/version-bump.sh" "$VERSION"

# ── 2. 全量构建 ──────────────────────────────────────────────
info "构建所有包..."
(cd "$PROJECT_DIR" && bun run build)
success "构建完成"

# ── 3. npm 发布 ──────────────────────────────────────────────
if $SKIP_NPM; then
  warn "跳过 npm 发布"
else
  if ! $DRY_RUN; then
    : "${NPM_TOKEN:?请设置 NPM_TOKEN 环境变量}"
  fi
  NPM_FLAGS=""
  $DRY_RUN && NPM_FLAGS="--dry-run"
  bash "${SCRIPT_DIR}/publish-npm.sh" $NPM_FLAGS
fi

# ── 4. 桌面构建 ──────────────────────────────────────────────
if $SKIP_DESKTOP; then
  warn "跳过桌面构建"
else
  info "构建桌面应用..."
  if $DRY_RUN; then
    info "[dry-run] electron-builder build --mac --dir"
  else
    (cd "${PROJECT_DIR}/packages/desktop" && bun run build)
  fi
  success "桌面构建完成"

  # ── 5. 公证 ────────────────────────────────────────────────
  if ! $DRY_RUN; then
    : "${APPLE_ID:?请设置 APPLE_ID（运行 scripts/setup-env.sh）}"
    : "${APPLE_APP_SPECIFIC_PASSWORD:?请设置 APPLE_APP_SPECIFIC_PASSWORD}"
    : "${APPLE_TEAM_ID:?请设置 APPLE_TEAM_ID}"

    APP_PATH=$(find "${PROJECT_DIR}/packages/desktop/release" -name "HappyImage.app" -type d | head -1)
    if [[ -n "$APP_PATH" ]]; then
      bash "${SCRIPT_DIR}/notarize.sh" "$APP_PATH"
    else
      warn "未找到 HappyImage.app，跳过公证（可能已是 DMG）"
    fi
  fi
fi

# ── 6. GitHub Release ────────────────────────────────────────
if $DRY_RUN; then
  info "[dry-run] gh release create desktop-v${VERSION}"
else
  command -v gh >/dev/null || die "未找到 gh CLI"

  TAG="desktop-v${VERSION}"

  # 收集构建产物
  RELEASE_DIR="${PROJECT_DIR}/packages/desktop/release"
  ASSETS=()
  for f in "$RELEASE_DIR"/*.dmg "$RELEASE_DIR"/*.zip "$RELEASE_DIR"/latest-mac.yml; do
    [[ -f "$f" ]] && ASSETS+=("$f")
  done

  info "创建 GitHub Release ${TAG}..."
  gh release create "$TAG" "${ASSETS[@]}" \
    --repo happy-token/HappyImage \
    --title "HappyImage Desktop v${VERSION}" \
    --notes "Desktop app release v${VERSION}" \
    --generate-notes

  success "Release 已创建: https://github.com/happy-token/HappyImage/releases/tag/${TAG}"
fi

# ── 7. Git tag ───────────────────────────────────────────────
if ! $DRY_RUN; then
  info "提交版本变更并打 tag..."
  git -C "$PROJECT_DIR" add packages/*/package.json
  git -C "$PROJECT_DIR" commit -m "chore: release v${VERSION}" || warn "无变更可提交"
  git -C "$PROJECT_DIR" tag "v${VERSION}"
  info "运行 git push origin main --tags 推送变更"
fi

echo ""
success "Release v${VERSION} 完成!"
echo ""
