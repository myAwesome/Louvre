#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn()  { echo -e "${YELLOW}[dev]${NC} $*"; }
error() { echo -e "${RED}[dev]${NC} $*" >&2; }

# ── prereqs ───────────────────────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command not found: $1"
    exit 1
  fi
}
check_cmd node
check_cmd npm
check_cmd go

# ── env files ─────────────────────────────────────────────────────────────────
if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn "Created .env from .env.example — review before continuing."
fi

if [[ ! -f "$ROOT/server/.env" ]]; then
  cp "$ROOT/server/.env.example" "$ROOT/server/.env"
  warn "Created server/.env from server/.env.example — set DB_DSN and ASSETS_DIR."
fi

# ── frontend deps ─────────────────────────────────────────────────────────────
if [[ ! -d "$ROOT/node_modules" ]]; then
  info "Installing npm dependencies..."
  npm --prefix "$ROOT" install
fi

# ── go deps ───────────────────────────────────────────────────────────────────
info "Tidying Go modules..."
(cd "$ROOT/server" && go mod tidy)

# ── start servers ─────────────────────────────────────────────────────────────
cleanup() {
  info "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

info "Starting Go API on :8080..."
(cd "$ROOT/server" && go run main.go) &
BACKEND_PID=$!

info "Starting React dev server on :3000..."
npm --prefix "$ROOT" start &
FRONTEND_PID=$!

info "Both servers running. Press Ctrl+C to stop."
wait
