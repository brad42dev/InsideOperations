#!/usr/bin/env bash
# =============================================================================
# io-boot.sh — Ordered service startup for boot (run via cron @reboot)
#
# Starts all 11 IO services in dependency order after the DB becomes healthy.
# The per-minute watchdog (io-watchdog.sh) takes over after this runs.
#
# Install:
#   crontab -e
#   @reboot cd /home/io/io-dev/io && ./scripts/io-boot.sh >> /tmp/io-boot.log 2>&1
# =============================================================================

set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="/tmp/io-boot.log"
DB_CONTAINER="io_dev_db"
DB_WAIT_SECS=120

PID_DIR="/tmp/io-dev-pids"
LOG_DIR="/tmp/io-dev-logs"

TS()   { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log()  { echo "$(TS) [INFO]  $*"; }
warn() { echo "$(TS) [WARN]  $*"; }
err()  { echo "$(TS) [ERROR] $*"; }

ENV_FILE="$WORK_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  log "Sourced $ENV_FILE"
else
  warn ".env not found at $ENV_FILE — services may fail to start"
fi

# =============================================================================
# Wait for the DB container to be healthy
# =============================================================================
wait_for_db() {
  log "Waiting for $DB_CONTAINER to be healthy (max ${DB_WAIT_SECS}s)..."
  local elapsed=0
  while true; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "missing")
    case "$status" in
      healthy)
        log "DB is healthy"
        return 0
        ;;
      missing)
        log "Container $DB_CONTAINER not found — starting Docker..."
        docker start "$DB_CONTAINER" >> "$LOG" 2>&1 || true
        ;;
      starting)
        log "DB starting... (${elapsed}s elapsed)"
        ;;
      *)
        warn "DB status: $status (${elapsed}s elapsed)"
        ;;
    esac
    if [[ $elapsed -ge $DB_WAIT_SECS ]]; then
      err "DB did not become healthy within ${DB_WAIT_SECS}s — aborting boot"
      exit 1
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
}

# Ports must match SERVICE_PORTS in scripts/io-watchdog.sh and BACKEND_SERVICES in api-gateway
declare -A SERVICE_PORTS=(
  ["auth-service"]=3009
  ["event-service"]=3003
  ["parser-service"]=3004
  ["email-service"]=3008
  ["archive-service"]=3005
  ["data-broker"]=3001
  ["import-service"]=3006
  ["alert-service"]=3007
  ["recognition-service"]=3010
  ["api-gateway"]=3000
  ["opc-service"]=3002
)

# =============================================================================
# Start a single service (no-op if already running)
# - Uses pgrep -f (full command path): pgrep -x matches on comm name, which
#   Linux truncates to 15 chars — names longer than 15 chars never match.
# - Sets PORT so the service binds the correct port.
# - Writes PID file so dev.sh status and io-watchdog.sh stay accurate.
# =============================================================================
start_service() {
  local svc="$1"
  local port="$2"
  local binary="$WORK_DIR/target/debug/$svc"
  local pid_file="$PID_DIR/${svc}.pid"

  if pgrep -f "target/debug/$svc" > /dev/null 2>&1; then
    log "[$svc] already running — skipping"
    return 0
  fi

  if [[ ! -x "$binary" ]]; then
    err "[$svc] Binary not found at $binary — skipping"
    return 1
  fi

  mkdir -p "$PID_DIR" "$LOG_DIR"
  PORT="$port" nohup "$binary" >> "$LOG_DIR/${svc}.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$pid_file"
  log "[$svc] Started — PID $pid"
}

# =============================================================================
# Wait for a service's health endpoint to respond
# =============================================================================
wait_healthy() {
  local svc="$1"
  local port="$2"
  local timeout="${3:-20}"
  local elapsed=0
  while true; do
    if curl -sf --max-time 2 "http://127.0.0.1:${port}/health/ready" \
         | grep -qE '"status":"(ready|degraded)"' 2>/dev/null; then
      log "[$svc] health OK"
      return 0
    fi
    if [[ $elapsed -ge $timeout ]]; then
      warn "[$svc] did not become healthy within ${timeout}s — continuing anyway"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
}

# =============================================================================
# Main boot sequence
# =============================================================================
log "=== io-boot START ==="

# Step 1 — Database
wait_for_db

# Step 2 — Auth service (JWT validation needed by API gateway and other services)
start_service "auth-service" "${SERVICE_PORTS[auth-service]}"
wait_healthy  "auth-service" "${SERVICE_PORTS[auth-service]}" 20

# Step 3 — Foundational services (minimal inter-service dependencies)
for svc in event-service parser-service email-service archive-service; do
  start_service "$svc" "${SERVICE_PORTS[$svc]}"
done
sleep 3

# Step 4 — Mid-tier services (depend on event/auth/DB)
for svc in data-broker import-service alert-service recognition-service; do
  start_service "$svc" "${SERVICE_PORTS[$svc]}"
done

# Wait for data-broker specifically — opc-service connects to its UDS socket
# on startup. Starting opc-service before data-broker is ready causes an
# immediate connection failure and a degraded state that persists until restart.
wait_healthy "data-broker" "${SERVICE_PORTS[data-broker]}" 20

# Step 5 — API gateway (public-facing — start after all upstreams are up)
start_service "api-gateway" "${SERVICE_PORTS[api-gateway]}"
wait_healthy  "api-gateway" "${SERVICE_PORTS[api-gateway]}" 20

# Step 6 — OPC service last (connects to external OPC server via data-broker UDS socket)
start_service "opc-service" "${SERVICE_PORTS[opc-service]}"

log "=== io-boot END ==="
