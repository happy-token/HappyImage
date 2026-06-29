#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/scripts/dev-local.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

TUNNEL_TARGET="${HAPPYIMAGE_TUNNEL_TARGET:-jp-v2}"
TUNNEL_PORT="${HAPPYIMAGE_TUNNEL_PORT:-15432}"
TUNNEL_BIND="${HAPPYIMAGE_TUNNEL_BIND:-127.0.0.1}"
SESSION_NAME="${HAPPYIMAGE_TUNNEL_SESSION:-happyimage-db-tunnel}"
LOG_FILE="${HAPPYIMAGE_TUNNEL_LOG:-$ROOT_DIR/tmp/jp-v2-loop.log}"
PID_FILE="${HAPPYIMAGE_TUNNEL_PID_FILE:-$ROOT_DIR/tmp/jp-v2-loop.pid}"

usage() {
  cat <<USAGE
Usage: $0 start|stop|status|logs

Starts a local SSH tunnel for Docker-based HappyImage tests:
  host ${TUNNEL_BIND}:${TUNNEL_PORT} -> ${TUNNEL_TARGET}:127.0.0.1:5432

The Docker API container reaches this through host.docker.internal:${TUNNEL_PORT}.
USAGE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

is_running() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
    return 0
  fi
  if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$TUNNEL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

start() {
  require_command ssh
  mkdir -p "$(dirname "$LOG_FILE")"

  if is_running; then
    echo "Tunnel is already running"
    status
    return 0
  fi

  : >"$LOG_FILE"
  ssh -f -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -L "${TUNNEL_BIND}:${TUNNEL_PORT}:127.0.0.1:5432" \
    "$TUNNEL_TARGET" >>"$LOG_FILE" 2>&1

  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$TUNNEL_PORT" -sTCP:LISTEN | head -1 >"$PID_FILE.tmp" || true
    if [ -s "$PID_FILE.tmp" ]; then
      mv "$PID_FILE.tmp" "$PID_FILE"
    else
      rm -f "$PID_FILE.tmp"
    fi
  fi

  sleep 2
  status
}

stop() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$TUNNEL_PORT" -sTCP:LISTEN | xargs -r kill
  elif [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" >/dev/null 2>&1 || true
  fi
  rm -f "$PID_FILE"
  if is_running; then
    echo "Tunnel may still be running on port $TUNNEL_PORT" >&2
    return 1
  else
    echo "Stopped tunnel on port $TUNNEL_PORT"
  fi
}

status() {
  if is_running; then
    echo "Tunnel: running (${TUNNEL_BIND}:${TUNNEL_PORT} -> ${TUNNEL_TARGET}:127.0.0.1:5432)"
  else
    echo "Tunnel: stopped (${TUNNEL_BIND}:${TUNNEL_PORT})"
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$TUNNEL_PORT" -sTCP:LISTEN || true
  fi
}

logs() {
  if [ -f "$LOG_FILE" ]; then
    tail -100 "$LOG_FILE"
  else
    echo "No log file: $LOG_FILE"
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  logs) logs ;;
  *) usage; exit 1 ;;
esac
