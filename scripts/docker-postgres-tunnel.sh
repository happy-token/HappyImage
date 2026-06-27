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
SESSION_NAME="${HAPPYIMAGE_TUNNEL_SESSION:-happyimage-db-tunnel}"
LOG_FILE="${HAPPYIMAGE_TUNNEL_LOG:-$ROOT_DIR/tmp/jp-v2-loop.log}"

usage() {
  cat <<USAGE
Usage: $0 start|stop|status|logs

Starts a local SSH tunnel for Docker-based HappyImage tests:
  host 0.0.0.0:${TUNNEL_PORT} -> ${TUNNEL_TARGET}:127.0.0.1:5432

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
  tmux has-session -t "$SESSION_NAME" >/dev/null 2>&1
}

start() {
  require_command ssh
  require_command tmux
  mkdir -p "$(dirname "$LOG_FILE")"

  if is_running; then
    echo "Tunnel session is already running: $SESSION_NAME"
    status
    return 0
  fi

  : >"$LOG_FILE"
  tmux new-session -d -s "$SESSION_NAME" \
    "cd '$ROOT_DIR' && while :; do date >> '$LOG_FILE'; ssh -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:${TUNNEL_PORT}:127.0.0.1:5432 -L 0.0.0.0:${TUNNEL_PORT}:127.0.0.1:5432 '$TUNNEL_TARGET' sleep 86400 >> '$LOG_FILE' 2>&1; echo tunnel_exited:\$? >> '$LOG_FILE'; sleep 1; done"

  sleep 2
  status
}

stop() {
  if is_running; then
    tmux kill-session -t "$SESSION_NAME"
    echo "Stopped tunnel session: $SESSION_NAME"
  else
    echo "Tunnel session is not running: $SESSION_NAME"
  fi
}

status() {
  if is_running; then
    echo "Tunnel session: running ($SESSION_NAME)"
  else
    echo "Tunnel session: stopped ($SESSION_NAME)"
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
