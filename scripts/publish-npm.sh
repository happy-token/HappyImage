#!/usr/bin/env bash
# 顺序构建并发布 @happyimage/* 包到 npm
# 用法：./scripts/publish-npm.sh [--dry-run] [--tag latest]
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
die()     { echo -e "${RED}✘ $*${RESET}"; exit 1; }

DRY_RUN=false
NPM_TAG="latest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --tag) NPM_TAG="$2"; shift 2 ;;
    *) die "Unknown option: $1" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

: "${NPM_TOKEN:?请设置 NPM_TOKEN 环境变量（npm 发布 token）}"

publish_pkg() {
  local dir="$1" name="$2"
  info "构建 ${name}..."
  (cd "${PROJECT_DIR}/${dir}" && bun run build)

  if $DRY_RUN; then
    info "[dry-run] npm publish ${name} --access public --tag ${NPM_TAG}"
    (cd "${PROJECT_DIR}/${dir}" && npm pack --dry-run)
  else
    info "发布 ${name}..."
    (cd "${PROJECT_DIR}/${dir}" && npm publish --access public --tag "${NPM_TAG}")
    success "${name} 已发布"
  fi
}

echo ""
echo -e "${BOLD}npm publish${RESET}"
echo -e "  tag: ${CYAN}${NPM_TAG}${RESET}"
echo -e "  dry-run: ${CYAN}${DRY_RUN}${RESET}"
echo ""

publish_pkg "packages/core" "@happyimage/core"
echo ""
publish_pkg "packages/cli" "@happyimage/cli"

echo ""
success "全部发布完成"
