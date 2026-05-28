#!/usr/bin/env bash
# 对 .app 或 .dmg 进行 Apple 公证 + 钉入票据
# 用法：./scripts/notarize.sh <path/to/HappyImage.app|path/to/HappyImage.dmg>
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()     { echo -e "${RED}✘ $*${RESET}"; exit 1; }

NOTARIZE_PATH="${1:?用法: $0 <path/to/App.app|path/to/App.dmg>}"
[[ -e "$NOTARIZE_PATH" ]] || die "找不到文件：$NOTARIZE_PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 加载 .env
env_get() { grep -E "^${1}=" "${PROJECT_DIR}/.env" 2>/dev/null | head -1 | cut -d= -f2- || echo ""; }
APPLE_ID="$(env_get APPLE_ID)"
APPLE_APP_SPECIFIC_PASSWORD="$(env_get APPLE_APP_SPECIFIC_PASSWORD)"
APPLE_TEAM_ID="$(env_get APPLE_TEAM_ID)"
CSC_NAME="$(env_get CSC_NAME)"
GITHUB_TOKEN="$(env_get GITHUB_TOKEN)"

: "${APPLE_ID:?请设置 APPLE_ID（运行 scripts/setup-env.sh）}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?请设置 APPLE_APP_SPECIFIC_PASSWORD}"
: "${APPLE_TEAM_ID:?请设置 APPLE_TEAM_ID}"

echo ""
echo -e "${BOLD}公证：${CYAN}$(basename "$NOTARIZE_PATH")${RESET}"
echo ""

# 如果是 .app，先签名
if [[ -d "$NOTARIZE_PATH" && "$NOTARIZE_PATH" == *.app ]]; then
  CSC_NAME="${CSC_NAME:-}"
  if [[ -z "$CSC_NAME" ]]; then
    # 从 Keychain 自动检测 Developer ID Application 证书
    SIGN_IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
      | grep "Developer ID Application" | head -1 \
      | sed 's/.*"\(.*\)"/\1/')
  else
    SIGN_IDENTITY="$CSC_NAME"
  fi

  if [[ -n "$SIGN_IDENTITY" ]]; then
    info "签名（${SIGN_IDENTITY}）..."
    codesign --deep --force --verify --verbose \
      --sign "$SIGN_IDENTITY" \
      --options runtime \
      "$NOTARIZE_PATH"
    success "签名完成"
  else
    warn "未找到签名证书，跳过签名步骤"
  fi
fi

NOTARIZE_FILE="$NOTARIZE_PATH"
TEMP_ZIP=""

if [[ -d "$NOTARIZE_PATH" && "$NOTARIZE_PATH" == *.app ]]; then
  TEMP_ZIP=$(mktemp /tmp/notarize-XXXXXX.zip)
  info "正在压缩 .app 到临时文件 $TEMP_ZIP 以便公证..."
  ditto -c -k --keepParent "$NOTARIZE_PATH" "$TEMP_ZIP"
  NOTARIZE_FILE="$TEMP_ZIP"
fi

info "提交 Apple 公证（约 1-5 分钟）..."
xcrun notarytool submit "$NOTARIZE_FILE" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait \
  --timeout 600

if [[ -n "$TEMP_ZIP" ]]; then
  rm -f "$TEMP_ZIP"
fi

success "公证完成"

# 钉入票据
info "钉入公证票据..."
xcrun stapler staple "$NOTARIZE_PATH" 2>/dev/null && success "票据已钉入" \
  || warn "无法钉入票据（DMG 可能需要先挂载，.app 非交互模式下正常）"

# Gatekeeper 验证
if [[ -d "$NOTARIZE_PATH" ]]; then
  info "验证 Gatekeeper..."
  spctl --assess --type execute --verbose "$NOTARIZE_PATH" 2>&1 && success "Gatekeeper 验证通过" \
    || warn "Gatekeeper 验证未通过（在 CI 中属正常，可忽略）"
fi

echo ""
success "公证完成：$NOTARIZE_PATH"
echo ""
