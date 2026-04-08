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
# environment sourced from WORK_DIR/.env.
#
# Usage:
#   ./scripts/io-watchdog.sh                   # check-only
#   AUTO_RESTART=1 ./scripts/io-watchdog.sh    # check + restart dead services
#
# IMPORTANT — cron must cd into the repo first.  Install with:
#   crontab -e
#   PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
#   * * * * * cd /home/io/io-dev/io && AUTO_RESTART=1 ./scripts/io-watchdog.sh >> /tmp/io-watchdog.log 2>&1
# =============================================================================

set -uo pipefail
# NOTE: deliberately omit -e.  With -e, any function returning a non-zero
# exit code (e.g. check_health returning 2/3 for degraded/unreachable) would
# silently abort the script before the case statement that handles it.  All
# error paths are handled explicitly below.

# Ensure common tools are in PATH even under cron's minimal environment.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

AUTO_RESTART="${AUTO_RESTART:-0}"
WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source .env so restarted services get DATABASE_URL, JWT_SECRET, etc.
# Use set -a/+a (allexport) + source rather than export $(xargs) — xargs
# splits on whitespace and breaks values that contain spaces or metacharacters.
ENV_FILE="$WORK_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

# DB URL: prefer IO_DATABASE_URL from .env, fall back to DATABASE_URL arg, then default.
DB_URL="${IO_DATABASE_URL:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/io_dev}}"

# Base ports for each service (matches BACKEND_SERVICES in api-gateway/src/main.rs)
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

# Binary names match service names exactly in target/debug/.
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
# Check 1 — Process liveness
# =============================================================================
check_process() {
  pgrep -x "${SERVICE_BINS[$1]:-$1}" > /dev/null 2>&1
}

# =============================================================================
# Check 2 — Health endpoint
# Returns: 0=healthy  3=degraded  2=unreachable/not_ready
# =============================================================================
check_health() {
  local port="${SERVICE_PORTS[$1]}"
  local body
  body=$(curl -sf --max-time 3 "http://127.0.0.1:${port}/health/ready" 2>/dev/null) || return 2
  # Extract status field without python3/jq dependency: match "ready" or "degraded" in body.
  if echo "$body" | grep -q '"status":"ready"'; then
    return 0
  elif echo "$body" | grep -q '"status":"degraded"'; then
    return 3
  else
    return 2
  fi
}

# =============================================================================
# Check 3 — OPC data flow (direct DB query — completely independent of services)
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
  " 2>/dev/null) || return 0  # DB unreachable — skip (DB check is separate)

  case "${result}" in
    ok)                return 0 ;;
    stale)             return 1 ;;
    no_active_sources) return 2 ;;
    *)                 return 0 ;;
  esac
}

# =============================================================================
# Restart a service
# Sources WORK_DIR/.env so the process has all required env vars.
# =============================================================================
restart_service() {
  local svc="$1"
  local bin="${SERVICE_BINS[$svc]:-$svc}"
  local binary="$WORK_DIR/target/debug/$bin"

  if [[ ! -x "$binary" ]]; then
    err "[$svc] Binary not found at $binary — cannot restart"
    return 1
  fi

  warn "[$svc] Dead — restarting from $binary"
  pkill -x "$bin" 2>/dev/null || true
  sleep 1

  # Run with the full environment already exported above (via .env source).
  # Log to /tmp/<svc>.log so failures are diagnosable.
  nohup "$binary" >> "/tmp/${svc}.log" 2>&1 &
  local pid=$!
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    log "[$svc] Restarted — PID $pid"
  else
    err "[$svc] Restart failed — check /tmp/${svc}.log"
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
    err "[$svc] NOT RUNNING"
    ISSUES=$((ISSUES + 1))
    if [[ "$AUTO_RESTART" == "1" ]]; then
      restart_service "$svc"
    fi
    continue  # skip health check — port is dead too
  fi

  # --- Health endpoint ---
  # Capture exit code explicitly — do NOT rely on $? after a bare function
  # call, as -e would abort the script before reaching the case statement.
  health_rc=0
  check_health "$svc" || health_rc=$?
  case $health_rc in
    0) log  "[$svc] healthy" ;;
    3) warn "[$svc] DEGRADED" ; ISSUES=$((ISSUES + 1)) ;;
    2) err  "[$svc] UNREACHABLE (process alive but /health/ready not responding)" ; ISSUES=$((ISSUES + 1)) ;;
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
