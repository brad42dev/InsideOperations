#!/usr/bin/env bash
# =============================================================================
# io-watchdog.sh — Layer 3 external process watchdog
#
# Runs every minute (via cron or systemd timer). Independently checks:
#   1. Process liveness  — is each service PID alive?
#   2. Health endpoint   — does /health/ready respond with "ready" or "degraded"?
#   3. OPC data flow     — is live data reaching the DB within the last 10 minutes?
#
# If any service is dead and AUTO_RESTART=1, it is restarted.
# All events are logged to LOG_FILE.
#
# Usage:
#   ./io-watchdog.sh             # check-only (no restarts)
#   AUTO_RESTART=1 ./io-watchdog.sh  # check + restart dead services
#
# Cron example (every minute):
#   * * * * * cd /home/io/io-dev/io && AUTO_RESTART=1 ./scripts/io-watchdog.sh >> /tmp/io-watchdog.log 2>&1
#
# Systemd timer: see scripts/io-watchdog.timer (not yet created)
# =============================================================================

set -euo pipefail

LOG_FILE="${LOG_FILE:-/tmp/io-watchdog.log}"
AUTO_RESTART="${AUTO_RESTART:-0}"
WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/io_dev}"

# Base ports for each service (matches BACKEND_SERVICES in api-gateway)
declare -A SERVICE_PORTS=(
  ["api-gateway"]=3000
  ["data-broker"]=3001
  ["opc-service"]=3002
  ["event-service"]=3003
  ["parser-service"]=3004
  ["archive-service"]=3005
  ["import-service"]=3006
  ["alert-service"]=3007
  ["email-service"]=3008
  ["auth-service"]=3009
  ["recognition-service"]=3010
)

# Binary names match service names exactly (no prefix needed).
# Maps to target/debug/<binary> — override if production paths differ.
declare -A SERVICE_BINS=(
  ["api-gateway"]="api-gateway"
  ["data-broker"]="data-broker"
  ["opc-service"]="opc-service"
  ["event-service"]="event-service"
  ["parser-service"]="parser-service"
  ["archive-service"]="archive-service"
  ["import-service"]="import-service"
  ["alert-service"]="alert-service"
  ["email-service"]="email-service"
  ["auth-service"]="auth-service"
  ["recognition-service"]="recognition-service"
)

TS() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

log()  { echo "$(TS) [INFO]  $*"; }
warn() { echo "$(TS) [WARN]  $*"; }
err()  { echo "$(TS) [ERROR] $*"; }

# =============================================================================
# Check 1 — Process liveness
# =============================================================================
check_process() {
  local svc="$1"
  local bin="${SERVICE_BINS[$svc]:-$svc}"
  if pgrep -x "$bin" > /dev/null 2>&1; then
    return 0  # alive
  fi
  return 1  # dead
}

# =============================================================================
# Check 2 — Health endpoint responsiveness
# =============================================================================
check_health() {
  local svc="$1"
  local port="${SERVICE_PORTS[$svc]}"
  local url="http://127.0.0.1:${port}/health/ready"
  local body
  body=$(curl -sf --max-time 3 "$url" 2>/dev/null) || { return 2; }  # unreachable
  local status
  status=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  case "$status" in
    ready)   return 0 ;;   # healthy
    degraded) return 3 ;;  # degraded (alive but not fully healthy)
    *)        return 2 ;;  # not_ready / unknown
  esac
}

# =============================================================================
# Check 3 — OPC data flow (direct DB query, no dependency on any service)
# =============================================================================
check_opc_data_flow() {
  # Returns 0 (ok), 1 (stale), 2 (no data / no sources)
  if ! command -v psql > /dev/null 2>&1; then
    return 0  # psql not available — skip check
  fi

  local result
  result=$(psql "$DB_URL" -t -A -c "
    SELECT
      CASE
        WHEN COUNT(*) FILTER (WHERE status = 'active') = 0
             AND COUNT(*) > 0 THEN 'no_active_sources'
        WHEN (SELECT MAX(updated_at) FROM points_current) < NOW() - INTERVAL '10 minutes'
             AND (SELECT COUNT(*) FROM points_current) > 0 THEN 'stale'
        ELSE 'ok'
      END
    FROM point_sources
    WHERE enabled = true
  " 2>/dev/null) || { return 0; }  # DB unreachable — skip

  case "$result" in
    ok)               return 0 ;;
    stale)            return 1 ;;
    no_active_sources) return 2 ;;
    *)                return 0 ;;
  esac
}

# =============================================================================
# Restart a service (dev mode: kill existing and re-launch from target/debug)
# =============================================================================
restart_service() {
  local svc="$1"
  local bin="${SERVICE_BINS[$svc]:-$svc}"
  local binary="$WORK_DIR/target/debug/$bin"

  if [[ ! -x "$binary" ]]; then
    err "[$svc] Binary not found at $binary — cannot restart"
    return 1
  fi

  warn "[$svc] Restarting..."
  pkill -x "$bin" 2>/dev/null || true
  sleep 1

  # Inherit environment (DATABASE_URL, etc.) — in production use systemd restart
  nohup "$binary" > "/tmp/${svc}.log" 2>&1 &
  local pid=$!
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    log "[$svc] Restarted — PID $pid"
  else
    err "[$svc] Restart failed — check /tmp/${svc}.log"
  fi
}

# =============================================================================
# Main loop
# =============================================================================
ISSUES=0

log "=== io-watchdog run START ==="

for svc in "${!SERVICE_PORTS[@]}"; do
  proc_ok=true
  health_ok=true

  # --- Process liveness ---
  if ! check_process "$svc"; then
    err "[$svc] Process NOT RUNNING"
    proc_ok=false
    ISSUES=$((ISSUES + 1))

    if [[ "$AUTO_RESTART" == "1" ]]; then
      restart_service "$svc"
    fi
    continue  # skip health check if process is dead
  fi

  # --- Health endpoint ---
  check_health "$svc"
  health_rc=$?
  case $health_rc in
    0) log "[$svc] healthy" ;;
    3) warn "[$svc] DEGRADED (process alive but health/ready reports degraded)" ; ISSUES=$((ISSUES + 1)) ;;
    2) err  "[$svc] UNREACHABLE (process alive but health/ready not responding)" ; ISSUES=$((ISSUES + 1)) ;;
    *) warn "[$svc] unknown health state" ;;
  esac
done

# --- OPC data flow (independent of service checks) ---
check_opc_data_flow
opc_rc=$?
case $opc_rc in
  0) log "[opc-data-flow] ok" ;;
  1) warn "[opc-data-flow] STALE — no data in last 10 minutes (OPC may be disconnected)" ; ISSUES=$((ISSUES + 1)) ;;
  2) err  "[opc-data-flow] NO ACTIVE SOURCES — all OPC sources offline" ; ISSUES=$((ISSUES + 1)) ;;
esac

log "=== io-watchdog run END — issues: $ISSUES ==="

# Exit non-zero if any issues found (useful for cron alerting)
exit $ISSUES
