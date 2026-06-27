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
STORAGE_BACKEND="${STORAGE_BACKEND:-json}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

check_port_free() {
  if lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $1 is already in use:"
    lsof -nP -iTCP:"$1" -sTCP:LISTEN
    exit 1
  fi
}

database_backend_enabled() {
  case "$(printf '%s' "$STORAGE_BACKEND" | tr '[:upper:]' '[:lower:]')" in
    postgres|postgresql|mysql|database|sqlite) return 0 ;;
    *) return 1 ;;
  esac
}

masked_database_url() {
  python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit

url = os.environ.get("DATABASE_URL", "")
try:
    parsed = urlsplit(url)
    netloc = parsed.netloc
    if parsed.username:
        host = parsed.hostname or ""
        if parsed.port:
            host = f"{host}:{parsed.port}"
        netloc = f"{parsed.username}:****@{host}"
    print(urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment)))
except Exception:
    print("<configured>" if url else "")
PY
}

wait_for_database() {
  if ! database_backend_enabled || [ -z "${DATABASE_URL:-}" ]; then
    return 0
  fi

  echo "Checking database: $(masked_database_url)"
  local attempts=20
  local attempt=1
  while [ "$attempt" -le "$attempts" ]; do
    if (
      cd "$ROOT_DIR/api"
      uv run python - <<'PY'
import os
import sys
from sqlalchemy import create_engine, text

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
try:
    with engine.connect() as conn:
        conn.execute(text("select 1"))
except Exception as exc:
    print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
    sys.exit(1)
PY
    ) >/tmp/happyimage-db-check.out 2>/tmp/happyimage-db-check.err; then
      echo "Database is reachable."
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  echo "Database is not reachable after ${attempts}s."
  echo "Last error:"
  sed -n '1,8p' /tmp/happyimage-db-check.err
  exit 1
}

stop_all() {
  trap - INT TERM EXIT
  echo
  echo "Stopping local dev..."
  local pids
  pids="$(jobs -p || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids >/dev/null 2>&1 || true
  fi
}
trap stop_all INT TERM EXIT

require_command lsof
require_command uv
require_command npx

check_port_free "$API_PORT"
check_port_free "$WEB_PORT"

if [ -n "$TUNNEL_TARGET" ]; then
  require_command ssh
  check_port_free "$TUNNEL_PORT"
  echo "Starting DB tunnel on 127.0.0.1:${TUNNEL_PORT} -> ${TUNNEL_TARGET}:127.0.0.1:5432"
  ssh -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -L "127.0.0.1:${TUNNEL_PORT}:127.0.0.1:5432" \
    "$TUNNEL_TARGET" &
  tunnel_pid="$!"
  sleep 1
  if ! kill -0 "$tunnel_pid" >/dev/null 2>&1; then
    echo "Failed to start DB tunnel to ${TUNNEL_TARGET}."
    echo "Check SSH access and whether local port ${TUNNEL_PORT} is available."
    exit 1
  fi
fi

wait_for_database

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
