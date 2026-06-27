#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/dev-local.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

API_PORT="${HAPPYTOKEN_API_PORT:-8000}"
WEB_PORT="${HAPPYTOKEN_WEB_PORT:-3000}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:${API_PORT}}"

TUNNEL_TARGET="${HAPPYIMAGE_TUNNEL_TARGET:-}"
TUNNEL_PORT="${HAPPYIMAGE_TUNNEL_PORT:-15432}"

check_port_free() {
  if lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $1 is already in use:"
    lsof -nP -iTCP:"$1" -sTCP:LISTEN
    exit 1
  fi
}

stop_all() {
  echo
  echo "Stopping local dev..."
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}
trap stop_all INT TERM EXIT

check_port_free "$API_PORT"
check_port_free "$WEB_PORT"

if [ -n "$TUNNEL_TARGET" ]; then
  echo "Starting DB tunnel on 127.0.0.1:${TUNNEL_PORT} -> ${TUNNEL_TARGET}:127.0.0.1:5432"
  ssh -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -L "127.0.0.1:${TUNNEL_PORT}:127.0.0.1:5432" \
    "$TUNNEL_TARGET" &
  sleep 1
fi

if [ ! -f "$ROOT_DIR/web/public/seed-gallery/static/items.json" ]; then
  echo "Warning: web/public/seed-gallery/static/items.json is missing."
fi

echo "Starting API: http://127.0.0.1:${API_PORT}"
(
  cd "$ROOT_DIR/api"
  uv run python main.py
) &

echo "Starting Web: http://127.0.0.1:${WEB_PORT}"
echo "Web BACKEND_URL=${BACKEND_URL}"
(
  cd "$ROOT_DIR/web"
  CI=true npx -y pnpm@10.33.2 install --frozen-lockfile --config.confirmModulesPurge=false
  BACKEND_URL="$BACKEND_URL" PORT="$WEB_PORT" npx -y pnpm@10.33.2 run dev
) &

wait
