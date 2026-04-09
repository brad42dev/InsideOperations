#!/usr/bin/env bash
# fresh-history-recovery.sh
#
# Wipes all time-series history and recovers it cleanly, one day at a time.
# Each day: recover (6h windows) → aggregate refresh → compress → next day.
#
# Usage:
#   ./scripts/fresh-history-recovery.sh [--days N] [--start YYYY-MM-DD] [--dry-run]
#
# Defaults: 30 days back from today.

set -euo pipefail

PGURL="postgresql://io:io_password@localhost:5432/io_dev"
PSQL="docker exec io_dev_db psql -U io -d io_dev"
SOURCE_ID="11110000-0000-0000-0000-000000000001"
COMPRESSION_JOB_ID=1000
LOG="/tmp/fresh-history-recovery.log"
DRY_RUN=false
DAYS=30
START_DATE=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --days)    DAYS="$2";       shift 2 ;;
    --start)   START_DATE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true;   shift   ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$START_DATE" ]]; then
  START_DATE=$(date -u -d "$DAYS days ago" +%Y-%m-%d)
fi

END_DATE=$(date -u +%Y-%m-%d)

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG"; }
psql_run() { $PSQL -c "$1" 2>&1; }

log "======================================"
log "Fresh History Recovery"
log "  Start: $START_DATE"
log "  End:   $END_DATE"
log "  Days:  $DAYS"
log "  Dry run: $DRY_RUN"
log "======================================"

if [[ "$DRY_RUN" == "true" ]]; then
  log "DRY RUN — would wipe and recover $DAYS days from $START_DATE to $END_DATE"
  exit 0
fi

# ── Step 1: Stop services that write to the history table ──────────────────
log "Stopping opc-service and archive-service..."
pkill -f 'target/debug/opc-service'     2>/dev/null && log "  opc-service stopped"     || log "  opc-service not running"
pkill -f 'target/debug/archive-service' 2>/dev/null && log "  archive-service stopped" || log "  archive-service not running"
sleep 3

# Terminate any in-flight inserts to points_history_raw
log "Terminating any in-flight inserts..."
$PSQL -t -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'active'
    AND query LIKE '%INSERT INTO points_history_raw%'
    AND pid != pg_backend_pid();" 2>&1 | tee -a "$LOG"
sleep 2

# ── Step 2: Disable compression policy ────────────────────────────────────
log "Disabling compression policy (job $COMPRESSION_JOB_ID)..."
psql_run "SELECT alter_job($COMPRESSION_JOB_ID, scheduled => false);"

# ── Step 3: Wipe all time-series data ─────────────────────────────────────
log "Truncating all history tables..."
$PSQL -c "
  TRUNCATE TABLE
    points_history_raw,
    points_history_1m,
    points_history_5m,
    points_history_15m,
    points_history_1h,
    points_history_1d
  CASCADE;" 2>&1 | tee -a "$LOG"

# ── Step 4: Cancel all existing recovery jobs ─────────────────────────────
log "Clearing all existing recovery jobs..."
psql_run "DELETE FROM opc_history_recovery_jobs;"

# ── Step 5: Seed recovery jobs, one day at a time (oldest → newest) ────────
log "Seeding recovery jobs ($START_DATE → $END_DATE, 6h windows)..."

current="$START_DATE"
total_jobs=0
while [[ "$current" < "$END_DATE" ]]; do
  next=$(date -u -d "$current + 1 day" +%Y-%m-%d)
  # 4 × 6-hour windows per day
  for hour in 00 06 12 18; do
    from="${current}T${hour}:00:00+00"
    to_hour=$(printf "%02d" $((10#$hour + 6)))
    if [[ $((10#$hour + 6)) -ge 24 ]]; then
      to="${next}T00:00:00+00"
    else
      to="${current}T${to_hour}:00:00+00"
    fi
    $PSQL -t -c "
      INSERT INTO opc_history_recovery_jobs (source_id, from_time, to_time, status, created_at)
      VALUES (
        '$SOURCE_ID',
        '$from'::timestamptz,
        '$to'::timestamptz,
        'pending',
        now()
      );" > /dev/null 2>&1
    total_jobs=$((total_jobs + 1))
  done
  current="$next"
done
log "  Inserted $total_jobs recovery jobs"

# ── Step 6: Restart opc-service and archive-service ───────────────────────
log "Starting opc-service..."
cd /home/io/io-dev/io
nohup ./target/debug/opc-service >> /tmp/opc-service.log 2>&1 &
OPC_PID=$!
log "  opc-service PID: $OPC_PID"

sleep 5

log "Starting archive-service..."
nohup ./target/debug/archive-service >> /tmp/archive-service.log 2>&1 &
ARCHIVE_PID=$!
log "  archive-service PID: $ARCHIVE_PID"

# ── Step 7: Monitor progress ───────────────────────────────────────────────
log ""
log "Recovery running. Monitor with:"
log "  tail -f $LOG"
log "  docker exec io_dev_db psql -U io -d io_dev -c \"SELECT status, count(*) FROM opc_history_recovery_jobs GROUP BY status;\""
log "  df -h /"
log ""
log "When all jobs are complete, run to re-enable compression:"
log "  docker exec io_dev_db psql -U io -d io_dev -c \"SELECT alter_job($COMPRESSION_JOB_ID, scheduled => true);\""
log ""
log "Setup complete. $total_jobs recovery jobs queued."
