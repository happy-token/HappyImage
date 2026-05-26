#!/usr/bin/env bash
# 将签名/公证/npm 所需的 secrets 写入 GitHub Actions
# 用法：./scripts/setup-github-secrets.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()     { echo -e "${RED}✘ $*${RESET}"; exit 1; }

REPO="${1:-happy-token/HappyImage}"

command -v gh >/dev/null || die "未找到 gh CLI：brew install gh && gh auth login"
gh auth status &>/dev/null || die "gh 未登录"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 加载 .env（安全方式：逐行读取，避免特殊字符问题）
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  env_get() { grep -E "^${1}=" "${PROJECT_DIR}/.env" 2>/dev/null | head -1 | cut -d= -f2- || echo ""; }
  APPLE_ID="$(env_get APPLE_ID)"
  APPLE_APP_SPECIFIC_PASSWORD="$(env_get APPLE_APP_SPECIFIC_PASSWORD)"
  APPLE_TEAM_ID="$(env_get APPLE_TEAM_ID)"
  CSC_NAME="$(env_get CSC_NAME)"
  GITHUB_TOKEN="$(env_get GITHUB_TOKEN)"
fi

: "${APPLE_ID:?请设置 APPLE_ID（运行 scripts/setup-env.sh）}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?请设置 APPLE_APP_SPECIFIC_PASSWORD}"
: "${APPLE_TEAM_ID:?请设置 APPLE_TEAM_ID}"

echo ""
echo -e "${BOLD}目标仓库：${CYAN}${REPO}${RESET}"
echo ""

# ── 导出 p12 ─────────────────────────────────────────────────
IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
  | grep "Developer ID Application" | head -1 \
  | sed 's/.*"\(.*\)"/\1/' \
  | sed 's/^Developer ID Application: //')

[[ -n "$IDENTITY" ]] || die "Keychain 中未找到 Developer ID Application 证书\n  请先在 Apple Developer 后台下载并安装证书"

info "找到证书：$IDENTITY"

P12_TMP=$(mktemp /tmp/cert_XXXXXX.p12)
trap 'rm -f "$P12_TMP"' EXIT

echo ""
echo -e "${BOLD}导出 p12 证书${RESET}"
echo -e "  macOS 会弹出 Keychain 授权对话框，请允许访问"
echo ""
read -rsp "  设置 p12 导出密码: " P12_PASSWORD
echo ""
[[ -n "$P12_PASSWORD" ]] || die "密码不能为空"
read -rsp "  确认密码: " P12_PASSWORD_CONFIRM
echo ""
[[ "$P12_PASSWORD" == "$P12_PASSWORD_CONFIRM" ]] || die "两次密码不一致"

security export \
  -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -P "$P12_PASSWORD" \
  -o "$P12_TMP" 2>/dev/null || die "导出证书失败"

CSC_LINK_BASE64=$(base64 -i "$P12_TMP")
success "证书导出成功"

# ── 读取 npm token ───────────────────────────────────────────
NPM_TOKEN=""
if [[ -f "${HOME}/.npmrc" ]]; then
  NPM_TOKEN=$(grep "_authToken=" "${HOME}/.npmrc" | head -1 | sed 's/.*_authToken=//')
fi

if [[ -z "$NPM_TOKEN" ]]; then
  read -rsp "  输入 npm publish token: " NPM_TOKEN
  echo ""
fi
[[ -n "$NPM_TOKEN" ]] || die "npm token 不能为空"

# ── 写入 GitHub Secrets ───────────────────────────────────────
echo ""
info "写入 GitHub Secrets → ${REPO}"
echo ""

set_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  success "  $name"
}

set_secret "APPLE_ID"                    "$APPLE_ID"
set_secret "APPLE_APP_SPECIFIC_PASSWORD" "$APPLE_APP_SPECIFIC_PASSWORD"
set_secret "APPLE_TEAM_ID"               "$APPLE_TEAM_ID"
set_secret "CSC_LINK"                    "$CSC_LINK_BASE64"
set_secret "CSC_KEY_PASSWORD"            "$P12_PASSWORD"
set_secret "CSC_NAME"                    "${CSC_NAME:-$IDENTITY}"
set_secret "NPM_TOKEN"                   "$NPM_TOKEN"

echo ""
success "全部 secrets 已写入"
echo ""
gh secret list --repo "$REPO"
echo ""
