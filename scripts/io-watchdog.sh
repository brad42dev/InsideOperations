#!/usr/bin/env bash
# =============================================================================
# io-watchdog.sh — Layer 3 external process watchdog
#
# Runs every minute (via cron). Independently checks:
#   1. Process liveness  — is each service PID alive?
#   2. Health endpoint   — does /health/ready respond with "ready" or "degraded"?
#   3. OPC data flow     — is live data reaching the DB within the last 5 minutes?
#
# If any service is dead and AUTO_RESTART=1, it is restarted with the correct
# environment and PORT. PID files are updated on each successful restart so that
# dev.sh status stays accurate.
#
# Circuit breaker: after MAX_RESTART_ATTEMPTS consecutive "not running" checks,
# the watchdog stops restarting and fires an alert instead. Resets automatically
# when the service is confirmed healthy.
#
# DEGRADED alerting: after MAX_DEGRADED_MINUTES consecutive degraded health
# checks, an alert is fired. Resets when the service returns to healthy.
#
# Alerting: always appended to ALERT_LOG. If ALERT_WEBHOOK_URL is set in .env,
# a JSON POST is sent to that URL on every alert event.
#
# Usage:
#   ./scripts/io-watchdog.sh                   # check-only
#   AUTO_RESTART=1 ./scripts/io-watchdog.sh    # check + restart dead services
#
# Cron install:
#   PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
#   * * * * * cd /home/io/io-dev/io && AUTO_RESTART=1 ./scripts/io-watchdog.sh >> /tmp/io-watchdog.log 2>&1
# =============================================================================

set -uo pipefail
# NOTE: deliberately omit -e. With -e, any function returning a non-zero
# exit code (e.g. check_health returning 2/3 for degraded/unreachable) would
# silently abort the script before the case statement that handles it.

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

AUTO_RESTART="${AUTO_RESTART:-0}"
WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_FILE="$WORK_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

DB_URL="${IO_DATABASE_URL:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/io_dev}}"

PID_DIR="/tmp/io-dev-pids"
LOG_DIR="/tmp/io-dev-logs"
FAIL_COUNT_DIR="/tmp/io-restart-counts"
ALERT_LOG="/tmp/io-alerts.log"

# How many consecutive "not running" cycles before the circuit breaker opens
MAX_RESTART_ATTEMPTS="${MAX_RESTART_ATTEMPTS:-5}"
# How many consecutive "degraded" cycles before an alert fires
MAX_DEGRADED_MINUTES="${MAX_DEGRADED_MINUTES:-5}"

# Ports must match BACKEND_SERVICES in api-gateway and SERVICE_PORTS in io-boot.sh
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

TS()   { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
log()  { echo "$(TS) [INFO]  $*"; }
warn() { echo "$(TS) [WARN]  $*"; }
err()  { echo "$(TS) [ERROR] $*"; }

# =============================================================================
# Alerting — appends to ALERT_LOG and optionally POSTs to ALERT_WEBHOOK_URL
# =============================================================================
send_alert() {
  local svc="$1"
  local msg="$2"
  local ts; ts=$(TS)
  echo "$ts [ALERT] $msg" | tee -a "$ALERT_LOG"
  if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
    curl -sf --max-time 5 -X POST "$ALERT_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"[io-watchdog] $msg\",\"service\":\"$svc\",\"timestamp\":\"$ts\"}" \
      > /dev/null 2>&1 || true
  fi
}

# =============================================================================
# Circuit-breaker and DEGRADED-counter helpers
# Each service gets a counter file: FAIL_COUNT_DIR/<svc> and FAIL_COUNT_DIR/<svc>.degraded
# =============================================================================
get_count()   { local f="$FAIL_COUNT_DIR/$1"; [[ -f "$f" ]] && cat "$f" || echo 0; }
inc_count()   { mkdir -p "$FAIL_COUNT_DIR"; echo $(( $(get_count "$1") + 1 )) > "$FAIL_COUNT_DIR/$1"; }
reset_count() { rm -f "$FAIL_COUNT_DIR/$1"; }

# =============================================================================
# Check 1 — Process liveness
# Uses pgrep -f (full command line) because Linux truncates comm names to 15
# chars — pgrep -x would never match binaries with names longer than 15 chars
# (e.g. recognition-service = 19 chars).
# =============================================================================
check_process() {
  local bin="${SERVICE_BINS[$1]:-$1}"
  pgrep -f "target/debug/${bin}" > /dev/null 2>&1
}

# =============================================================================
# Check 2 — Health endpoint
# Returns: 0=healthy  3=degraded  2=unreachable/not_ready
# =============================================================================
check_health() {
  local port="${SERVICE_PORTS[$1]}"
  local body
  body=$(curl -sf --max-time 3 "http://127.0.0.1:${port}/health/ready" 2>/dev/null) || return 2
  if echo "$body" | grep -q '"status":"ready"'; then
    return 0
  elif echo "$body" | grep -q '"status":"degraded"'; then
    return 3
  else
    return 2
  fi
}

# =============================================================================
# Check 3 — OPC data flow (direct DB query — independent of all services)
# Returns: 0=ok  1=stale  2=no_active_sources
# Skipped silently if psql is not available.
# =============================================================================
check_opc_data_flow() {
  command -v psql > /dev/null 2>&1 || return 0
  local result
  result=$(psql "$DB_URL" -t -A -c "
    SELECT
      CASE
        WHEN COUNT(*) FILTER (WHERE status = 'active') = 0
             AND COUNT(*) > 0
             THEN 'no_active_sources'
        WHEN (SELECT MAX(updated_at) FROM points_current) < NOW() - INTERVAL '5 minutes'
             AND (SELECT COUNT(*) FROM points_current) > 0
             THEN 'stale'
        ELSE 'ok'
      END
    FROM point_sources
    WHERE enabled = true
  " 2>/dev/null) || return 0
  case "${result}" in
    ok)                return 0 ;;
    stale)             return 1 ;;
    no_active_sources) return 2 ;;
    *)                 return 0 ;;
  esac
}

# =============================================================================
# Restart a service
# - Sets PORT so the service binds the correct port
# - Writes PID file so dev.sh status stays accurate
# - Uses pkill -f (full path) for the same reason as pgrep -f above
# =============================================================================
restart_service() {
  local svc="$1"
  local bin="${SERVICE_BINS[$svc]:-$svc}"
  local binary="$WORK_DIR/target/debug/$bin"
  local port="${SERVICE_PORTS[$svc]}"
  local pid_file="$PID_DIR/${svc}.pid"

  if [[ ! -x "$binary" ]]; then
    err "[$svc] Binary not found at $binary — cannot restart"
    return 1
  fi

  warn "[$svc] Dead — restarting from $binary"
  pkill -f "target/debug/$bin" 2>/dev/null || true
  sleep 1

  mkdir -p "$PID_DIR" "$LOG_DIR"
  PORT="$port" nohup "$binary" >> "$LOG_DIR/${svc}.log" 2>&1 &
  local pid=$!
  sleep 3

  if kill -0 "$pid" 2>/dev/null; then
    log "[$svc] Restarted — PID $pid"
    echo "$pid" > "$pid_file"
  else
    err "[$svc] Restart failed — check $LOG_DIR/${svc}.log"
  fi
}

# =============================================================================
# Main
# =============================================================================
ISSUES=0
log "=== io-watchdog START ==="

for svc in "${!SERVICE_PORTS[@]}"; do
  # --- Process liveness ---
  if ! check_process "$svc"; then
    ISSUES=$((ISSUES + 1))
    inc_count "$svc"
    fail_count=$(get_count "$svc")
    err "[$svc] NOT RUNNING (consecutive: $fail_count)"

    if [[ $fail_count -ge $MAX_RESTART_ATTEMPTS ]]; then
      # Circuit open — stop restarting and escalate
      send_alert "$svc" "[$svc] NOT RUNNING for $fail_count consecutive checks — circuit open, manual intervention required"
    elif [[ "$AUTO_RESTART" == "1" ]]; then
      restart_service "$svc"
    fi
    continue  # skip health check — port is dead too
  fi

  # --- Health endpoint ---
  health_rc=0
  check_health "$svc" || health_rc=$?
  case $health_rc in
    0)
      log "[$svc] healthy"
      reset_count "$svc"              # reset not-running circuit breaker
      reset_count "${svc}.degraded"   # reset degraded counter
      ;;
    3)
      warn "[$svc] DEGRADED"
      ISSUES=$((ISSUES + 1))
      inc_count "${svc}.degraded"
      deg_count=$(get_count "${svc}.degraded")
      if [[ $deg_count -ge $MAX_DEGRADED_MINUTES ]]; then
        send_alert "$svc" "[$svc] has been DEGRADED for $deg_count consecutive minutes"
      fi
      ;;
    2)
      err "[$svc] UNREACHABLE (process alive but /health/ready not responding)"
      ISSUES=$((ISSUES + 1))
      ;;
  esac
done

# --- OPC data flow (DB direct — independent of all services) ---
opc_rc=0
check_opc_data_flow || opc_rc=$?
case $opc_rc in
  0) log  "[opc-data-flow] ok" ;;
  1) warn "[opc-data-flow] STALE — no data in last 5 minutes" ; ISSUES=$((ISSUES + 1)) ;;
  2) err  "[opc-data-flow] NO ACTIVE SOURCES" ; ISSUES=$((ISSUES + 1)) ;;
esac

log "=== io-watchdog END — issues: $ISSUES ==="
exit $ISSUES
