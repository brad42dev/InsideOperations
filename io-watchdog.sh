#!/bin/bash
# io-watchdog.sh — Reset stale 'implementing' tasks back to 'failed'.
#
# A task is stale if it has been 'implementing' for more than 30 minutes —
# this indicates the agent crashed without running its EXIT trap.
#
# Usage:
#   ./io-watchdog.sh            Reset stale tasks (idempotent — safe to run anytime)
#   ./io-watchdog.sh --dry-run  Print stale tasks without modifying the database
#
# Designed to be called from cron or manually:
#   # Every 15 minutes (replace with absolute path to this script)
#   */15 * * * * /path/to/project/io-watchdog.sh >> /tmp/io-watchdog.log 2>&1

set -euo pipefail

REPO="$(git -C "$(cd "$(dirname "$0")" && pwd)" rev-parse --show-toplevel 2>/dev/null || echo "/home/io/io-dev/io")"
DB_FILE="$REPO/comms/tasks.db"
STALE_MINUTES=30

DRY_RUN=0
if [[ "${1:-}" = "--dry-run" ]]; then
    DRY_RUN=1
fi

if [ ! -f "$DB_FILE" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) io-watchdog: $DB_FILE not found — nothing to do"
    exit 0
fi

python3 - "$DRY_RUN" "$STALE_MINUTES" "$DB_FILE" <<'PYEOF'
import sys, sqlite3
from datetime import datetime, timezone, timedelta

dry_run      = sys.argv[1] == "1"
stale_after  = int(sys.argv[2])
db_path      = sys.argv[3]

now    = datetime.now(timezone.utc)
cutoff = (now - timedelta(minutes=stale_after)).strftime('%Y-%m-%dT%H:%M:%SZ')
ts     = now.strftime('%Y-%m-%dT%H:%M:%SZ')

con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")

rows = con.execute("""
    SELECT id, claimed_by, claimed_at
    FROM   io_tasks
    WHERE  status = 'implementing'
      AND  claimed_at IS NOT NULL
      AND  claimed_at < ?
    ORDER BY claimed_at ASC
""", (cutoff,)).fetchall()

if not rows:
    print(f"{ts} io-watchdog: no stale tasks (threshold: {stale_after}min)")
    con.close()
    sys.exit(0)

mode_label = "DRY-RUN" if dry_run else "RESET"
print(f"{ts} io-watchdog [{mode_label}]: {len(rows)} stale task(s) (>{stale_after}min):")

for task_id, claimed_by, claimed_at in rows:
    age_str = ""
    if claimed_at:
        try:
            dt = datetime.fromisoformat(claimed_at.replace("Z", "+00:00"))
            age_min = int((now - dt).total_seconds() / 60)
            age_str = f"  age={age_min}min"
        except Exception:
            age_str = ""
    print(f"  {task_id}  claimed_by={claimed_by or '?'}  claimed_at={claimed_at or '?'}{age_str}")

    if not dry_run:
        con.execute(
            "UPDATE io_tasks SET status='failed', claimed_at=NULL, claimed_by=NULL, updated_at=? WHERE id=?",
            (ts, task_id)
        )

if not dry_run:
    con.commit()
    print(f"{ts} io-watchdog: reset {len(rows)} task(s) to 'failed'")

con.close()
PYEOF
