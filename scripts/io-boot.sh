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
DB_WAIT_SECS=120  # max seconds to wait for DB to be healthy

TS()   { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log()  { echo "$(TS) [INFO]  $*"; }
warn() { echo "$(TS) [WARN]  $*"; }
err()  { echo "$(TS) [ERROR] $*"; }

# Source .env so all services get DATABASE_URL, JWT_SECRET, etc.
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

# =============================================================================
# Start a single service (no-op if already running)
# =============================================================================
start_service() {
  local svc="$1"
  local binary="$WORK_DIR/target/debug/$svc"

  if pgrep -x "$svc" > /dev/null 2>&1; then
    log "[$svc] already running — skipping"
    return 0
  fi

  if [[ ! -x "$binary" ]]; then
    err "[$svc] Binary not found at $binary — skipping"
    return 1
  fi

  nohup "$binary" >> "/tmp/${svc}.log" 2>&1 &
  local pid=$!
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
start_service "auth-service"
wait_healthy  "auth-service" 3009 20

# Step 3 — Foundational services (minimal inter-service dependencies)
for svc in event-service parser-service email-service archive-service; do
  start_service "$svc"
done
# Brief pause to let them initialise before dependents start
sleep 3

# Step 4 — Mid-tier services (depend on event/auth/DB)
for svc in data-broker import-service alert-service recognition-service; do
  start_service "$svc"
done
sleep 2

# Step 5 — API gateway (public-facing — start after all upstreams are up)
start_service "api-gateway"
wait_healthy  "api-gateway" 3000 20

# Step 6 — OPC service last (connects to external OPC server via data-broker)
start_service "opc-service"

log "=== io-boot END ==="
