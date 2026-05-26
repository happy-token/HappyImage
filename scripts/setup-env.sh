#!/usr/bin/env bash
# 从 env.shared 生成项目 .env
# 用法：./scripts/setup-env.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()     { echo -e "${RED}✘ $*${RESET}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SHARED_FILE="${HOME}/workspace/config/env/env.shared"
ENV_FILE="${PROJECT_DIR}/.env"

[[ -f "$SHARED_FILE" ]] || die "找不到 env.shared：$SHARED_FILE"

shared_get() {
  grep -E "^${1}=" "$SHARED_FILE" 2>/dev/null | cut -d= -f2- || echo ""
}

APPLE_ID="$(shared_get APPLE_ID)"
APPLE_TEAM_ID="$(shared_get APPLE_TEAM_ID)"
CSC_NAME="$(shared_get CSC_NAME)"
GITHUB_TOKEN="$(shared_get GITHUB_TOKEN)"
APPLE_APP_SPECIFIC_PASSWORD="$(shared_get HAPPYIMAGE)"

echo ""
echo -e "${BOLD}项目：${CYAN}HappyImage${RESET}"
echo -e "${BOLD}来源：${CYAN}${SHARED_FILE}${RESET}"
echo ""

[[ -n "$APPLE_ID" ]]                      || die "env.shared 缺少 APPLE_ID"
[[ -n "$APPLE_TEAM_ID" ]]                 || die "env.shared 缺少 APPLE_TEAM_ID"
[[ -n "$APPLE_APP_SPECIFIC_PASSWORD" ]]   || die "env.shared 缺少 HAPPYIMAGE（App 专用密码）"

info "写入 ${ENV_FILE} ..."

# 如果 .env 已存在，保留用户自定义参数，只更新 Apple 相关字段
if [[ -f "$ENV_FILE" ]]; then
  info ".env 已存在，仅更新 Apple/GitHub 字段..."
  # 用临时文件逐字段更新
  TMP_FILE=$(mktemp /tmp/env_XXXXXX)
  cp "$ENV_FILE" "$TMP_FILE"

  update_env() {
    local key="$1" value="$2"
    if grep -qE "^${key}=" "$TMP_FILE" 2>/dev/null; then
      # macOS sed 兼容
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$TMP_FILE"
    else
      echo "${key}=${value}" >> "$TMP_FILE"
    fi
  }

  update_env "APPLE_ID" "$APPLE_ID"
  update_env "APPLE_APP_SPECIFIC_PASSWORD" "$APPLE_APP_SPECIFIC_PASSWORD"
  update_env "APPLE_TEAM_ID" "$APPLE_TEAM_ID"
  update_env "CSC_NAME" "\"${CSC_NAME}\""
  [[ -n "$GITHUB_TOKEN" ]] && update_env "GITHUB_TOKEN" "$GITHUB_TOKEN"

  mv "$TMP_FILE" "$ENV_FILE"
else
  {
    echo "# Apple 公证"
    echo "APPLE_ID=${APPLE_ID}"
    echo "APPLE_APP_SPECIFIC_PASSWORD=${APPLE_APP_SPECIFIC_PASSWORD}"
    echo "APPLE_TEAM_ID=${APPLE_TEAM_ID}"
    echo ""
    echo "# 签名证书"
    echo "CSC_NAME=\"${CSC_NAME}\""
    if [[ -n "$GITHUB_TOKEN" ]]; then
      echo ""
      echo "# GitHub Release"
      echo "GITHUB_TOKEN=${GITHUB_TOKEN}"
    fi
  } > "$ENV_FILE"
fi

success ".env 已写入"

if [[ -f "${PROJECT_DIR}/.gitignore" ]]; then
  if ! grep -qE "^\.env$" "${PROJECT_DIR}/.gitignore"; then
    echo ".env" >> "${PROJECT_DIR}/.gitignore"
    warn ".env 已加入 .gitignore"
  fi
fi

echo ""
success "完成"
echo ""
