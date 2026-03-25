#!/bin/bash
# io-run.sh — Orchestrator runner and UAT driver
#
# Usage:
#   ./io-run.sh implement [P [T]]  P = max parallel agents (default 3, max 5); T = total tasks to complete (default unlimited)
#   ./io-run.sh audit [N]          Run N audit rounds
#   ./io-run.sh full [N]           Run N full (audit+implement) rounds
#   ./io-run.sh uat [P [N]]        Automated Playwright UAT; P = parallel agents (default: CFG_MAX_PARALLEL), N = unit limit (0 = all)
#   ./io-run.sh human-uat [N]      Human UAT with interactive pass/fail prompts; N = unit limit (always serial)
#   ./io-run.sh release-uat [N]    Human release sign-off — Approve/Reject per feature; N = unit limit (always serial)
#   ./io-run.sh bug                Interactive bug triage — describe a bug, get a fix task
#   ./io-run.sh status             Show task counts and UAT coverage
#   ./io-run.sh restore-backup     Restore comms/tasks.db from .bak file
#   ./io-run.sh cleanup-branches   Prune stale FAILED-* and CONFLICT-* git branches
#   ./io-run.sh auto [P]           Cycle implement→UAT→implement until all done; P = parallel agents
#   ./io-run.sh integration-test   Run automated integration journey tests
#
# Each implement/audit round is a fresh claude session.
# Progress is saved to comms/tasks.db (SQLite) after every round.
# Ctrl+C stops cleanly between rounds.

set -euo pipefail

# Auto-detect repo root from git; fall back to hardcoded default for the io project.
REPO="$(git -C "$(cd "$(dirname "$0")" && pwd)" rev-parse --show-toplevel 2>/dev/null || echo "/home/io/io-dev/io")"
cd "$REPO"

# ── Config loading ─────────────────────────────────────────────────────────────
# Reads io-orchestrator.config.json (if present) and exports CFG_* shell vars.
# Falls back to hardcoded io-project defaults when the file is absent.
load_config() {
    local config="$REPO/io-orchestrator.config.json"
    if [ ! -f "$config" ]; then
        CFG_REGISTRY_DB="comms/tasks.db"
        CFG_TASK_DIR="docs/tasks"
        CFG_CATALOG_DIR="docs/catalogs"
        CFG_STATE_DIR="docs/state"
        CFG_UAT_DIR="docs/uat"
        CFG_DECISIONS_DIR="docs/decisions"
        CFG_MAX_PARALLEL=3
        CFG_MAX_AUDIT_PARALLEL=2
        CFG_STALE_MINUTES=30
        CFG_CHECKPOINT_EVERY=3
        CFG_MAX_IMPL_ATTEMPTS=3
        CFG_MODEL_ORCHESTRATOR="claude-opus-4-6"
        CFG_MODEL_WORKER="claude-sonnet-4-6"
        CFG_NI_STALE_HOURS=48
        CFG_NI_ESCALATE_HOURS=144
        CFG_WORKTREE_BASE="/tmp/io-worktrees"
        CFG_TEST_COMMAND="cargo test"
        CFG_BUILD_COMMAND="cargo build"
        CFG_LINT_COMMAND="cargo clippy -- -D warnings"
        CFG_CHECK_COMMAND="cargo check"
        CFG_FRONTEND_TEST="cd frontend && pnpm test"
        CFG_FRONTEND_BUILD="cd frontend && pnpm build"
        CFG_FRONTEND_CHECK="cd frontend && npx tsc --noEmit"
        CFG_SPEC_DOCS="/home/io/spec_docs"
        CFG_COMMS_DIR="comms"
        CFG_NEEDS_INPUT_DIR="comms/needs_input"
        CFG_RATE_LIMIT_BACKOFF_SEC=60
        CFG_MAX_ZERO_WAVES=3
        return
    fi
    eval "$(python3 - "$config" "$REPO" <<'PYEOF'
import json, sys, os
config_path, repo_root = sys.argv[1], sys.argv[2]
with open(config_path) as f:
    c = json.load(f)
p   = c.get("paths", {})
cmd = c.get("commands", {})
ag  = c.get("agents", {})
ts  = c.get("task_store", {})
proj = c.get("project", {})
root = proj.get("root", ".")
if root == ".":
    root = repo_root
root = os.path.realpath(root)
print(f"REPO={root!r}")
# registry_db: prefer paths.registry_db, fall back to task_store.path
reg_db = p.get("registry_db") or ts.get("path") or "comms/tasks.db"
print(f"CFG_REGISTRY_DB={reg_db!r}")
print(f"CFG_TASK_DIR={p.get('task_dir', 'docs/tasks')!r}")
print(f"CFG_CATALOG_DIR={p.get('catalog_dir', 'docs/catalogs')!r}")
print(f"CFG_STATE_DIR={p.get('state_dir', 'docs/state')!r}")
print(f"CFG_MAX_PARALLEL={ag.get('max_parallel', 3)!r}")
print(f"CFG_MAX_AUDIT_PARALLEL={ag.get('max_audit_parallel', min(2, ag.get('max_parallel', 3)))!r}")
print(f"CFG_STALE_MINUTES={ag.get('stale_task_threshold_min', 30)!r}")
print(f"CFG_CHECKPOINT_EVERY={ag.get('checkpoint_every', 3)!r}")
print(f"CFG_MAX_IMPL_ATTEMPTS={ag.get('max_impl_attempts', 3)!r}")
print(f"CFG_MODEL_ORCHESTRATOR={ag.get('model_orchestrator', 'claude-opus-4-6')!r}")
print(f"CFG_MODEL_WORKER={ag.get('model_worker', 'claude-sonnet-4-6')!r}")
print(f"CFG_NI_STALE_HOURS={ag.get('needs_input_stale_hours', 48)!r}")
print(f"CFG_NI_ESCALATE_HOURS={ag.get('needs_input_escalate_hours', 144)!r}")
print(f"CFG_WORKTREE_BASE={p.get('worktree_base', '/tmp/io-worktrees')!r}")
print(f"CFG_TEST_COMMAND={cmd.get('test', cmd.get('test_backend', 'cargo test'))!r}")
print(f"CFG_BUILD_COMMAND={cmd.get('build', cmd.get('build_backend', 'cargo build'))!r}")
print(f"CFG_LINT_COMMAND={cmd.get('lint', cmd.get('lint_backend', 'cargo clippy -- -D warnings'))!r}")
print(f"CFG_CHECK_COMMAND={cmd.get('check', cmd.get('check_backend', 'cargo check'))!r}")
print(f"CFG_FRONTEND_TEST={cmd.get('frontend_test', cmd.get('test_frontend', 'cd frontend && pnpm test'))!r}")
print(f"CFG_FRONTEND_BUILD={cmd.get('frontend_build', cmd.get('build_frontend', 'cd frontend && pnpm build'))!r}")
print(f"CFG_FRONTEND_CHECK={cmd.get('frontend_check', cmd.get('check_frontend', 'cd frontend && npx tsc --noEmit'))!r}")
print(f"CFG_SPEC_DOCS={p.get('spec_docs', '/home/io/spec_docs')!r}")
print(f"CFG_COMMS_DIR={p.get('comms_dir', 'comms')!r}")
print(f"CFG_NEEDS_INPUT_DIR={p.get('needs_input_dir', 'comms/needs_input')!r}")
print(f"CFG_UAT_DIR={p.get('uat_dir', 'docs/uat')!r}")
print(f"CFG_DECISIONS_DIR={p.get('decisions_dir', 'docs/decisions')!r}")
print(f"CFG_RATE_LIMIT_BACKOFF_SEC={ag.get('rate_limit_backoff_sec', 60)!r}")
print(f"CFG_MAX_ZERO_WAVES={ag.get('max_zero_waves', 3)!r}")
PYEOF
)" || {
        echo "WARNING: Failed to parse io-orchestrator.config.json — using hardcoded defaults" >&2
        CFG_REGISTRY_DB="comms/tasks.db"
        CFG_TASK_DIR="docs/tasks"
        CFG_CATALOG_DIR="docs/catalogs"
        CFG_STATE_DIR="docs/state"
        CFG_MAX_PARALLEL=3
        CFG_MAX_AUDIT_PARALLEL=2
        CFG_STALE_MINUTES=30
        CFG_CHECKPOINT_EVERY=3
        CFG_MAX_IMPL_ATTEMPTS=3
        CFG_MODEL_ORCHESTRATOR="claude-opus-4-6"
        CFG_MODEL_WORKER="claude-sonnet-4-6"
        CFG_NI_STALE_HOURS=48
        CFG_NI_ESCALATE_HOURS=144
        CFG_WORKTREE_BASE="/tmp/io-worktrees"
        CFG_TEST_COMMAND="cargo test"
        CFG_BUILD_COMMAND="cargo build"
        CFG_LINT_COMMAND="cargo clippy -- -D warnings"
        CFG_CHECK_COMMAND="cargo check"
        CFG_FRONTEND_TEST="cd frontend && pnpm test"
        CFG_FRONTEND_BUILD="cd frontend && pnpm build"
        CFG_FRONTEND_CHECK="cd frontend && npx tsc --noEmit"
        CFG_SPEC_DOCS="/home/io/spec_docs"
        CFG_COMMS_DIR="comms"
        CFG_NEEDS_INPUT_DIR="comms/needs_input"
        CFG_UAT_DIR="docs/uat"
        CFG_DECISIONS_DIR="docs/decisions"
        CFG_RATE_LIMIT_BACKOFF_SEC=60
        CFG_MAX_ZERO_WAVES=3
    }
}

load_config
# Derive LAST_ROUND.json from the configured comms directory
CFG_LAST_ROUND_JSON="${CFG_COMMS_DIR:-comms}/LAST_ROUND.json"

# ── Timestamp helper ───────────────────────────────────────────────────────────
ts() { date '+[%Y-%m-%dT%H:%M:%S]'; }

MODE=${1:-implement}
ARG2=${2:-}
ARG3=${3:-}

echo "$(ts) io-run.sh started — mode: $MODE" >&2

# ── run-lock: prevent concurrent invocations ──────────────────────────────────
# Single lock for all modes except 'status' (status is read-only, never blocks).
if [[ "$MODE" != "status" ]]; then
    LOCK_FILE="/tmp/io-run.lock"
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        echo "ERROR: Another io-run.sh instance is already running (lock: $LOCK_FILE)."
        echo "       If no other instance is running, wait a moment and retry — the lock releases automatically."
        exit 1
    fi
    # Release lock on exit (including crashes). Modes that register their own EXIT trap
    # must call _io_lock_cleanup at the end of their trap body.
    trap '_io_lock_cleanup' EXIT
fi

# ── helpers ───────────────────────────────────────────────────────────────────
# Kill all processes listening on a given port (handles process-tree spawning)
kill_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill 2>/dev/null || true
    fi
}

# Release the run-lock file descriptor and remove the file
_io_lock_cleanup() {
    exec 9>&- 2>/dev/null || true
    rm -f "${LOCK_FILE:-}" 2>/dev/null || true
}

# Rotate /tmp/io-*.log files — keep last 3 per prefix, delete older ones
rotate_logs() {
    local prefix="$1"
    # List matching files sorted by modification time (oldest first), skip last 3
    local files
    files=$(ls -t /tmp/${prefix}*.log 2>/dev/null | tail -n +4)
    if [ -n "$files" ]; then
        echo "$files" | xargs rm -f 2>/dev/null || true
    fi
}

# Start backend if not already running. Sets BACKEND_STARTED=1 if started.
# Usage: ensure_backend_running <log-prefix>  (e.g. "io-uat-backend")
ensure_backend_running() {
    local log_prefix="${1:-io-backend}"
    if curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
        echo "Backend already running (port 3000)."
        return 0
    fi
    echo "Backend not detected on port 3000. Starting services via dev.sh..."
    echo "(Note: first run requires cargo build — may take several minutes)"
    rotate_logs "$log_prefix"
    "$REPO/dev.sh" start > "/tmp/${log_prefix}.log" 2>&1 &
    BACKEND_PID=$!
    BACKEND_STARTED=1
    local BACKEND_EXITED_EARLY=""
    # Wait up to 15 minutes for api-gateway health (first build can take 10-20 min)
    # Note: dev.sh start backgrounds services and may exit before they are up —
    # the port 3000 health check is the real gate; PID check only catches abnormal exits
    for i in $(seq 1 900); do
        sleep 1
        if [ -z "$BACKEND_EXITED_EARLY" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            wait "$BACKEND_PID" 2>/dev/null
            DEV_EXIT=$?
            if [ "$DEV_EXIT" -ne 0 ]; then
                echo "ERROR: dev.sh start exited with code $DEV_EXIT."
                echo "Check /tmp/${log_prefix}.log for details:"
                tail -20 "/tmp/${log_prefix}.log"
                exit 1
            fi
            # dev.sh exited 0 (normal — services backgrounded); continue polling port 3000
            BACKEND_EXITED_EARLY=1
        fi
        if curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
            echo "Backend services ready."
            return 0
        fi
        if [ $((i % 30)) -eq 0 ]; then
            echo "  Still waiting for backend... (${i}s elapsed)"
        fi
        if [ "$i" = "900" ]; then
            echo "ERROR: Backend failed to start after 15 minutes."
            echo "Check /tmp/${log_prefix}.log for details:"
            tail -20 "/tmp/${log_prefix}.log"
            exit 1
        fi
    done
}

# Start frontend dev server if not already running. Sets DEV_SERVER_STARTED=1 if started.
# Usage: ensure_frontend_running <log-prefix>  (e.g. "io-uat-devserver")
ensure_frontend_running() {
    local log_prefix="${1:-io-devserver}"
    if curl -s --max-time 5 http://localhost:5173 > /dev/null 2>&1; then
        echo "Frontend dev server already running on port 5173."
        return 0
    fi
    echo "Starting frontend dev server..."
    rotate_logs "$log_prefix"
    ( cd "$REPO/frontend" && exec pnpm dev ) > "/tmp/${log_prefix}.log" 2>&1 &
    DEV_SERVER_STARTED=1
    for i in $(seq 1 40); do
        sleep 1
        if curl -s --max-time 3 http://localhost:5173 > /dev/null 2>&1; then
            # Vite HTTP server is up but initial TS compilation takes a few more seconds
            echo "Frontend dev server responding, waiting for initial compilation..."
            sleep 4
            echo "Frontend dev server ready (port 5173)."
            return 0
        fi
        if [ "$i" = "40" ]; then
            echo "ERROR: Frontend dev server failed to start after 40s."
            echo "Check /tmp/${log_prefix}.log for details."
            exit 1
        fi
    done
}

# ── SQLite adapter ────────────────────────────────────────────────────────────
# SQLite (comms/tasks.db) is the authoritative task store.
# Agents write directly to it — no JSON sync step is required.

DB_FILE="${CFG_REGISTRY_DB:-comms/tasks.db}"

# Run a SQL query against the task database. Prints results to stdout.
# Usage: db_query <sql>
db_query() {
    python3 -c "
import sqlite3, sys
con = sqlite3.connect('$REPO/$DB_FILE', timeout=10)
for row in con.execute(sys.argv[1]).fetchall():
    print('|'.join(str(c) for c in row))
con.close()
" "$1"
}

# Atomically claim the next available task. Prints task ID on success, empty on none.
# Uses BEGIN IMMEDIATE (WAL-mode write lock) to prevent concurrent claims.
# Usage: TASK_ID=$(claim_next_task <worker-name>)
claim_next_task() {
    local worker="${1:-io-run}"
    python3 - "$worker" "$REPO/$DB_FILE" <<'PYEOF'
import sys, sqlite3, json
from pathlib import Path

worker  = sys.argv[1]
db_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("comms/tasks.db")
if not db_path.exists():
    sys.exit(0)

con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")
try:
    # BEGIN IMMEDIATE acquires a write lock immediately — prevents race conditions
    con.execute("BEGIN IMMEDIATE")
    # Build set of verified task IDs for dependency checking
    verified_ids = {r[0] for r in con.execute("SELECT id FROM io_tasks WHERE status='verified'").fetchall()}
    candidates = con.execute("""
        SELECT id, depends_on FROM io_tasks
        WHERE status IN ('pending', 'failed')
        ORDER BY wave ASC,
                 CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                 id ASC
    """).fetchall()
    task_id = None
    for row_id, deps_raw in candidates:
        deps = json.loads(deps_raw) if deps_raw and deps_raw not in ('[]', '') else []
        if not all(d in verified_ids for d in deps):
            continue
        # File conflict check: skip if a currently-implementing task owns overlapping files.
        # Backwards compatible — if io_task_files doesn't exist yet, skip the check.
        try:
            conflict = con.execute("""
                SELECT DISTINCT t.id
                FROM io_task_files tf
                JOIN io_tasks t ON t.id = tf.task_id
                WHERE t.status = 'implementing'
                  AND tf.file_path IN (
                      SELECT file_path FROM io_task_files WHERE task_id = ?
                  )
                LIMIT 1
            """, (row_id,)).fetchone()
            if conflict:
                print(f"  Skipping {row_id} — file conflict with active task {conflict[0]}", file=sys.stderr)
                continue
        except Exception:
            pass  # io_task_files not yet created — proceed without conflict check
        task_id = row_id
        break
    if task_id is None:
        con.execute("ROLLBACK")
        sys.exit(0)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    con.execute(
        "UPDATE io_tasks SET status='implementing', claimed_at=?, claimed_by=?, updated_at=? WHERE id=?",
        (now, worker, now, task_id)
    )
    con.execute("COMMIT")
    print(task_id)
except Exception as e:
    try: con.execute("ROLLBACK")
    except: pass
    print(f"claim_next_task error: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    con.close()
PYEOF
}

# Update a task's status in the database.
# Usage: update_task_status <task-id> <status>
# Valid statuses: pending, implementing, verified, failed, escalated, needs_input,
#                 blocked, needs_decomposition, decomposed
update_task_status() {
    local task_id="$1"
    local status="$2"
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - "$REPO/$DB_FILE" "$task_id" "$status" <<'PYEOF' 2>/dev/null || true
import sqlite3, sys
from datetime import datetime, timezone
db_path, task_id, status = sys.argv[1], sys.argv[2], sys.argv[3]
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
con = sqlite3.connect(db_path)
con.execute("PRAGMA journal_mode=WAL")
con.execute("UPDATE io_tasks SET status=?, updated_at=? WHERE id=?", (status, now, task_id))
con.commit()
con.close()
PYEOF
}

# Count tasks with status in (pending, failed) — the "available work" count.
# Prints 0 if database does not exist.
get_pending_work_count() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        echo 0
        return
    fi
    db_query "SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed');"
}

# Run unblock pass: promote 'blocked' tasks to 'pending' when all dependencies are verified.
# Called before parallel implement batches so get_pending_work_count sees newly-unblocked tasks.
run_unblock_pass() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - "$REPO/$DB_FILE" <<'PYEOF' 2>/dev/null || true
import sqlite3, json, sys
from datetime import datetime, timezone
from pathlib import Path

db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
if not db_path.exists():
    raise SystemExit(0)

now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")

verified_ids = {r[0] for r in con.execute("SELECT id FROM io_tasks WHERE status='verified'").fetchall()}
blocked_rows = con.execute("SELECT id, depends_on FROM io_tasks WHERE status='blocked'").fetchall()
unblocked = 0
for row_id, deps_raw in blocked_rows:
    deps = json.loads(deps_raw) if deps_raw and deps_raw not in ('[]', '') else []
    if all(d in verified_ids for d in deps):
        con.execute("UPDATE io_tasks SET status='pending', updated_at=? WHERE id=?", (now, row_id))
        unblocked += 1
if unblocked:
    con.commit()
con.close()
PYEOF
}

# Launch catcher agents fire-and-forget for pending tasks without context packages.
# Each catcher reads the task spec + current code and writes comms/context/{task_id}.md.
# Catchers are launched in the background — we do NOT wait for them.
# implement-agent will use the context package if present when it starts.
# Usage: launch_catchers <n_max> <catcher_agent_file>
launch_catchers() {
    local n_max="$1"
    local agent_file="$2"
    local ctx_dir="$REPO/${CFG_COMMS_DIR:-comms}/context"
    mkdir -p "$ctx_dir"

    # Get up to n_max pending tasks that haven't been enriched yet
    local task_ids
    task_ids=$(python3 - "$REPO/$DB_FILE" "$n_max" <<'PYEOF' 2>/dev/null || true
import sqlite3, sys
from pathlib import Path
db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
if not db.exists():
    sys.exit(0)
con = sqlite3.connect(db, timeout=5)
try:
    rows = con.execute("""
        SELECT id FROM io_tasks
        WHERE status IN ('pending', 'failed')
          AND context_enriched_at IS NULL
          AND spec_body IS NOT NULL
        ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id
        LIMIT ?
    """, (n,)).fetchall()
    print("\n".join(r[0] for r in rows))
except Exception:
    pass  # context_enriched_at column may not exist on old DBs — safe no-op
con.close()
PYEOF
    ) || true

    [ -z "$task_ids" ] && return 0

    local launched=0
    while IFS= read -r task_id; do
        [ -z "$task_id" ] && continue
        # Skip if context package already exists on disk (double-check beyond DB)
        [ -f "$ctx_dir/${task_id}.md" ] && continue
        (
            claude --dangerously-skip-permissions \
                   --model claude-haiku-4-5-20251001 \
                   --agent "$agent_file" \
                   --print "TASK_ID: ${task_id}" \
                   < /dev/null > "/tmp/io-catcher-${task_id}.log" 2>&1
        ) &
        launched=$((launched + 1))
    done <<< "$task_ids"

    [ "$launched" -gt 0 ] && echo "  🔍 Launched ${launched} catcher(s) in background (enriching context packages)"
    return 0
}

# Reclaim stale tasks stuck in 'implementing' status.
# A task is stale if claimed_at is older than CFG_STALE_MINUTES AND
# the CURRENT.md heartbeat file has not been updated within that window.
# Stale tasks reset to 'pending' (or 'failed' if attempt_count >= CFG_MAX_IMPL_ATTEMPTS).
# Usage: reclaim_stale_tasks
reclaim_stale_tasks() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - "$REPO/$DB_FILE" "${CFG_STATE_DIR:-docs/state}" \
        "${CFG_STALE_MINUTES:-30}" "${CFG_MAX_IMPL_ATTEMPTS:-3}" "$REPO" <<'PYEOF' 2>/dev/null || true
import sqlite3, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

db_path      = Path(sys.argv[1])
state_dir    = sys.argv[2]
stale_min    = int(sys.argv[3])
max_attempts = int(sys.argv[4])
repo_root    = Path(sys.argv[5])

if not db_path.exists():
    sys.exit(0)

now          = datetime.now(timezone.utc)
stale_cutoff = now - timedelta(minutes=stale_min)

con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")
con.execute("PRAGMA busy_timeout=10000")

rows = con.execute("""
    SELECT id, unit, claimed_at, attempt_count
    FROM io_tasks
    WHERE status = 'implementing'
      AND claimed_at IS NOT NULL
""").fetchall()

reclaimed = 0
for task_id, unit, claimed_at_str, attempt_count in rows:
    try:
        claimed_at = datetime.fromisoformat(claimed_at_str.replace('Z', '+00:00'))
    except Exception:
        continue
    if claimed_at > stale_cutoff:
        continue  # not stale yet

    # Heartbeat check: is CURRENT.md newer than the stale cutoff?
    unit_lower = (unit or '').lower()
    cur_md = None
    for u in (unit_lower, unit or ''):
        candidate = repo_root / state_dir / u / task_id / 'CURRENT.md'
        if candidate.exists():
            cur_md = candidate
            break

    if cur_md is not None:
        mtime = datetime.fromtimestamp(cur_md.stat().st_mtime, tz=timezone.utc)
        if mtime > stale_cutoff:
            continue  # agent is still heartbeating — leave it alone

    # Stale — reclaim
    stuck_min    = int((now - claimed_at).total_seconds() / 60)
    new_attempts = (attempt_count or 0) + 1
    new_status   = 'failed' if new_attempts > max_attempts else 'pending'

    con.execute("""
        UPDATE io_tasks
        SET status=?, claimed_at=NULL, claimed_by=NULL, attempt_count=?, updated_at=?
        WHERE id=?
    """, (new_status, new_attempts, now.strftime('%Y-%m-%dT%H:%M:%SZ'), task_id))
    print(f"⚠ Reclaimed stale task {task_id} (stuck for {stuck_min}m, attempt {new_attempts}) → {new_status}")
    reclaimed += 1

if reclaimed:
    con.commit()
con.close()
PYEOF
}

# Atomically claim the next unit eligible for audit. Prints unit ID on success, empty on none.
# Uses BEGIN IMMEDIATE (WAL-mode write lock) to prevent concurrent claims.
# Eligible: last_audit_round IS NULL (never audited) OR verified_since_last_audit > 0 (new verified tasks since last audit)
# AND (claimed_at IS NULL OR claimed_at < now - CFG_STALE_MINUTES)
# Usage: UNIT_ID=$(claim_next_unit <worker-name>)
claim_next_unit() {
    local worker="${1:-io-audit}"
    python3 - "$worker" "$REPO/$DB_FILE" "${CFG_STALE_MINUTES:-30}" <<'PYEOF'
import sys, sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta

worker     = sys.argv[1]
db_path    = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("comms/tasks.db")
stale_min  = int(sys.argv[3]) if len(sys.argv) > 3 else 30
if not db_path.exists():
    sys.exit(0)

now          = datetime.now(timezone.utc)
stale_cutoff = (now - timedelta(minutes=stale_min)).strftime('%Y-%m-%dT%H:%M:%SZ')

con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")
try:
    con.execute("BEGIN IMMEDIATE")
    row = con.execute("""
        SELECT unit FROM io_queue
        WHERE (last_audit_round IS NULL OR verified_since_last_audit > 0)
          AND (claimed_at IS NULL OR claimed_at < ?)
        ORDER BY last_audit_round ASC NULLS FIRST,
                 CASE WHEN last_audit_round IS NULL THEN 0 ELSE 1 END,
                 unit ASC
        LIMIT 1
    """, (stale_cutoff,)).fetchone()
    if row is None:
        con.execute("ROLLBACK")
        sys.exit(0)
    unit_id = row[0]
    now_str = now.strftime('%Y-%m-%dT%H:%M:%SZ')
    con.execute(
        "UPDATE io_queue SET claimed_at=?, claimed_by=? WHERE unit=?",
        (now_str, worker, unit_id)
    )
    con.execute("COMMIT")
    print(unit_id)
except Exception as e:
    try: con.execute("ROLLBACK")
    except: pass
    print(f"claim_next_unit error: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    con.close()
PYEOF
}

# Reclaim stale audit unit claims — reset claimed_at/claimed_by when claim is older than CFG_STALE_MINUTES.
# Audit agents do not write heartbeat files, so only the claim timestamp is checked.
# Usage: reclaim_stale_units
reclaim_stale_units() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - "$REPO/$DB_FILE" "${CFG_STALE_MINUTES:-30}" <<'PYEOF' 2>/dev/null || true
import sqlite3, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

db_path   = Path(sys.argv[1])
stale_min = int(sys.argv[2]) if len(sys.argv) > 2 else 30
if not db_path.exists():
    sys.exit(0)

now          = datetime.now(timezone.utc)
stale_cutoff = now - timedelta(minutes=stale_min)

con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")
con.execute("PRAGMA busy_timeout=10000")

rows = con.execute("""
    SELECT unit, claimed_at FROM io_queue
    WHERE claimed_at IS NOT NULL
""").fetchall()

reclaimed = 0
for unit_id, claimed_at_str in rows:
    try:
        claimed_at = datetime.fromisoformat(claimed_at_str.replace('Z', '+00:00'))
    except Exception:
        continue
    if claimed_at > stale_cutoff:
        continue  # not stale yet
    stuck_min = int((now - claimed_at).total_seconds() / 60)
    con.execute(
        "UPDATE io_queue SET claimed_at=NULL, claimed_by=NULL WHERE unit=?",
        (unit_id,)
    )
    print(f"⚠ Reclaimed stale audit unit {unit_id} (stuck for {stuck_min}m)")
    reclaimed += 1

if reclaimed:
    con.commit()
con.close()
PYEOF
}

# Release a unit's audit claim after audit completes (success or failure).
# Usage: release_unit_claim <unit-id>
release_unit_claim() {
    local unit_id="$1"
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - "$REPO/$DB_FILE" "$unit_id" <<'PYEOF' 2>/dev/null || true
import sqlite3, sys
from pathlib import Path
db_path = Path(sys.argv[1])
unit_id = sys.argv[2]
if not db_path.exists():
    sys.exit(0)
con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")
con.execute("UPDATE io_queue SET claimed_at=NULL, claimed_by=NULL WHERE unit=?", (unit_id,))
con.commit()
con.close()
PYEOF
}

# ── Config token expansion ────────────────────────────────────────────────────
# Expand {{TOKEN}} placeholders in agent .md files within a target directory.
# Called from launch_agent_in_worktree after the worktree is created so that
# agents in the worktree see real paths rather than template tokens.
# Usage: expand_agent_tokens <target_dir>
expand_agent_tokens() {
    local target="$1"
    local agents_dir="$target/.claude/agents"
    [ -d "$agents_dir" ] || return 0
    # BSD sed (macOS) requires -i '' while GNU sed uses -i alone.
    local SED_INPLACE=("-i")
    [[ "$(uname)" == "Darwin" ]] && SED_INPLACE=("-i" "")
    find "$agents_dir" -name "*.md" -print0 | while IFS= read -r -d '' f; do
        sed "${SED_INPLACE[@]}" \
            -e "s|{{PROJECT_ROOT}}|${REPO}|g" \
            -e "s|{{TASK_DIR}}|${CFG_TASK_DIR:-docs/tasks}|g" \
            -e "s|{{CATALOG_DIR}}|${CFG_CATALOG_DIR:-docs/catalogs}|g" \
            -e "s|{{STATE_DIR}}|${CFG_STATE_DIR:-docs/state}|g" \
            -e "s|{{REGISTRY_DB}}|${REPO}/${CFG_REGISTRY_DB:-comms/tasks.db}|g" \
            -e "s|{{TEST_COMMAND}}|${CFG_TEST_COMMAND:-cargo test}|g" \
            -e "s|{{BUILD_COMMAND}}|${CFG_BUILD_COMMAND:-cargo build}|g" \
            -e "s|{{LINT_COMMAND}}|${CFG_LINT_COMMAND:-cargo clippy -- -D warnings}|g" \
            -e "s|{{CHECK_COMMAND}}|${CFG_CHECK_COMMAND:-cargo check}|g" \
            -e "s|{{FRONTEND_TEST_COMMAND}}|${CFG_FRONTEND_TEST:-cd frontend \&\& pnpm test}|g" \
            -e "s|{{FRONTEND_BUILD_COMMAND}}|${CFG_FRONTEND_BUILD:-cd frontend \&\& pnpm build}|g" \
            -e "s|{{FRONTEND_CHECK_COMMAND}}|${CFG_FRONTEND_CHECK:-cd frontend \&\& npx tsc --noEmit}|g" \
            -e "s|{{SPEC_DOCS_ROOT}}|${CFG_SPEC_DOCS:-/home/io/spec_docs}|g" \
            -e "s|{{COMMS_DIR}}|${CFG_COMMS_DIR:-comms}|g" \
            -e "s|{{NEEDS_INPUT_DIR}}|${CFG_NEEDS_INPUT_DIR:-comms/needs_input}|g" \
            -e "s|{{UAT_DIR}}|${CFG_UAT_DIR:-docs/uat}|g" \
            -e "s|{{DECISIONS_DIR}}|${CFG_DECISIONS_DIR:-docs/decisions}|g" \
            -e "s|{{CHECKPOINT_EVERY}}|${CFG_CHECKPOINT_EVERY:-3}|g" \
            -e "s|{{MAX_IMPL_ATTEMPTS}}|${CFG_MAX_IMPL_ATTEMPTS:-3}|g" \
            -e "s|{{MODEL_ORCHESTRATOR}}|${CFG_MODEL_ORCHESTRATOR:-claude-opus-4-6}|g" \
            -e "s|{{MODEL_WORKER}}|${CFG_MODEL_WORKER:-claude-sonnet-4-6}|g" \
            -e "s|{{NEEDS_INPUT_STALE_HOURS}}|${CFG_NI_STALE_HOURS:-48}|g" \
            -e "s|{{NEEDS_INPUT_ESCALATE_HOURS}}|${CFG_NI_ESCALATE_HOURS:-144}|g" \
            -e "s|{{STALE_MINUTES}}|${CFG_STALE_MINUTES:-30}|g" \
            "$f" 2>/dev/null || true
    done
}

# Expand {{TOKEN}} placeholders in a single agent file into a temp location.
# Returns the temp file path via stdout and the temp dir in _AGENT_TMP_DIR.
# Caller is responsible for: rm -rf "$_AGENT_TMP_DIR" when done.
# Usage: agent_file=$(expand_agent_to_tmp <agent-name>)
_AGENT_TMP_DIR=""
expand_agent_to_tmp() {
    local name="$1"
    local src="$REPO/.claude/agents/$name.md"
    if [ ! -f "$src" ]; then
        echo "ERROR: agent file not found: $src" >&2
        return 1
    fi
    _AGENT_TMP_DIR=$(mktemp -d)
    mkdir -p "$_AGENT_TMP_DIR/.claude/agents"
    cp "$src" "$_AGENT_TMP_DIR/.claude/agents/$name.md"
    expand_agent_tokens "$_AGENT_TMP_DIR"
    echo "$_AGENT_TMP_DIR/.claude/agents/$name.md"
}

# ── Wave 2: Git Worktree Isolation ───────────────────────────────────────────
# Each agent invocation gets its own branch + worktree.
# Wave 3 will launch multiple agents in parallel; Wave 2 wires the single-agent case.

WORKTREE_BASE="${CFG_WORKTREE_BASE:-/tmp/io-worktrees}"

# Remove a worktree and, on failure, rename its branch for inspection.
# Usage: cleanup_worktree <task_id> <success|failure>
cleanup_worktree() {
    local task_id="$1"
    local outcome="${2:-failure}"
    local branch_name="io-task/${task_id}"
    local worktree_path="${WORKTREE_BASE}/${task_id}"

    git -C "$REPO" worktree remove --force "$worktree_path" 2>/dev/null || true

    if [ "$outcome" = "failure" ]; then
        local failed_branch="io-task/FAILED-${task_id}"
        if git -C "$REPO" branch -m "$branch_name" "$failed_branch" 2>/dev/null; then
            echo "  ⚠ Task ${task_id}: worktree removed, branch → ${failed_branch}"
        else
            echo "  ⚠ Task ${task_id}: worktree removed (branch already renamed or missing)"
        fi
    fi
}

# Create a git worktree for task_id, launch claude inside it, and return the PID.
# Usage: AGENT_PID=$(launch_agent_in_worktree <task_id> <agent_file> <prompt_text>)
# The launched subshell registers its own EXIT trap to cleanup on crash.
launch_agent_in_worktree() {
    local task_id="$1"
    local agent_file="$2"
    local prompt_text="$3"
    local branch_name="io-task/${task_id}"
    local worktree_path="${WORKTREE_BASE}/${task_id}"

    mkdir -p "$WORKTREE_BASE"

    # Remove stale worktree entry if present (e.g., from a previous crashed run)
    git -C "$REPO" worktree remove --force "$worktree_path" 2>/dev/null || true

    # Add worktree — resume existing branch or create a new one from HEAD.
    # All output goes to stderr: this function is called via pid=$(...) so stdout
    # must only contain the final `echo $!` — anything else corrupts $pid.
    if git -C "$REPO" show-ref --verify --quiet "refs/heads/${branch_name}" 2>/dev/null; then
        echo "  Resuming branch ${branch_name} in worktree" >&2
        git -C "$REPO" worktree add "$worktree_path" "$branch_name" >&2
    else
        git -C "$REPO" worktree add "$worktree_path" -b "$branch_name" >&2
    fi

    echo "$(ts) impl agent launching: ${task_id}  worktree: ${worktree_path}" >&2

    # Symlink node_modules from main repo so TypeScript checks work in the worktree
    # (node_modules is git-ignored and therefore absent from the worktree checkout).
    if [ -d "$REPO/frontend/node_modules" ]; then
        ln -sfn "$REPO/frontend/node_modules" "$worktree_path/frontend/node_modules" 2>/dev/null || true
    fi

    # Expand config tokens in agent files within the worktree so agents see
    # real paths (e.g. {{PROJECT_ROOT}} → /home/io/io-dev/io) at runtime.
    expand_agent_tokens "$worktree_path"
    # Mark expanded agent files as assume-unchanged so 'git add -A' in the
    # Ledger Write step doesn't commit the expanded (non-template) versions
    # to the task branch and corrupt the templates when merged back to main.
    git -C "$worktree_path" update-index --assume-unchanged \
        $(git -C "$worktree_path" ls-files '.claude/agents/' 2>/dev/null | tr '\n' ' ') \
        2>/dev/null || true

    # Capture locals for the subshell — trap string can't expand parent vars lazily
    local _task_id="$task_id"
    local _worktree_path="$worktree_path"
    # Rate-limit signal file: parent checks this after wait returns non-zero.
    local _rl_signal="/tmp/io-rl-${task_id}"
    rm -f "$_rl_signal" 2>/dev/null || true

    # ── Context metrics setup (outside subshell — heredocs inside (...)>&2 & inside
    # pid=$(...) corrupt the capture pipe in bash; use temp files instead) ──────────
    local _impl_usage_file="/tmp/io-usage-impl-${_task_id}"
    local _impl_update_script="/tmp/io-impl-upd-${_task_id}.py"
    rm -f "$_impl_usage_file" "$_impl_update_script" 2>/dev/null || true

    # Record attempt start (runs before the subshell so row_id is available inside it)
    local _impl_insert_script="/tmp/io-impl-ins-${_task_id}.py"
    cat > "$_impl_insert_script" << 'IMPL_INSEOF'
import sqlite3, sys
db, task_id = sys.argv[1], sys.argv[2]
try:
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    # Migrate: add columns introduced after initial schema (idempotent; fails silently if already present)
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    n = con.execute('SELECT COUNT(*)+1 FROM io_task_attempts WHERE task_id=?',(task_id,)).fetchone()[0]
    row = con.execute('SELECT spec_body FROM io_tasks WHERE id=?', (task_id,)).fetchone()
    tfb = len((row[0] or '').encode('utf-8')) if row and row[0] else None
    con.execute("INSERT INTO io_task_attempts(task_id,attempt_number,started_at,task_file_bytes) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),?)",(task_id,n,tfb))
    con.commit()
    row_id = con.execute('SELECT last_insert_rowid()').fetchone()[0]
    con.close()
    print(row_id)
except Exception:
    print(0)
IMPL_INSEOF
    local _impl_attempt_row
    _impl_attempt_row=$(python3 "$_impl_insert_script" "$REPO/$DB_FILE" "$_task_id" 2>/dev/null)
    rm -f "$_impl_insert_script" 2>/dev/null || true

    # Write UPDATE script to a temp file (called inside subshell after agent exits)
    cat > "$_impl_update_script" << 'IMPL_UPEOF'
import sqlite3, json, sys
from pathlib import Path
db, task_id, row_id_str, usage_file = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
row_id = int(row_id_str)
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    # Total context = fresh input + cache hits; cache_creation = initial injection
    input_tok  = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win    = data.get('modelUsage', {})
    ctx_win    = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct   = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    task_row = con.execute('SELECT status FROM io_tasks WHERE id=?', (task_id,)).fetchone()
    result   = task_row[0] if task_row else 'unknown'
    if row_id > 0:
        con.execute('''UPDATE io_task_attempts
                       SET finished_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                           result=?,context_injection_tokens=?,
                           context_final_tokens=?,context_utilization_pct=?
                       WHERE id=?''', (result, input_tok, output_tok, util_pct, row_id))
        con.commit()
    con.close()
except Exception:
    pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
IMPL_UPEOF

    # Launch agent in subshell. EXIT trap fires on crash OR clean exit.
    # AGENT_OUTCOME starts as "failure"; reset to "success" only if claude exits 0.
    # Redirect subshell stdout to stderr so agent output is visible in the terminal
    # but not captured by the pid=$(...) command substitution in the caller.
    # NO heredocs inside this subshell — they corrupt the outer pid=$(...) capture.
    (
        AGENT_OUTCOME="failure"
        _subshell_rl_signal="$_rl_signal"
        _subshell_worktree="$_worktree_path"
        _subshell_task_id="$_task_id"
        trap '
            # Before removing the worktree: check if the agent flagged rate-limiting
            if find "$_subshell_worktree/docs/state" -name "CURRENT.md" \
                    -exec grep -l "^rate_limited: true" {} \; 2>/dev/null | grep -q .; then
                touch "$_subshell_rl_signal" 2>/dev/null || true
                echo "  ⚠ Task ${_subshell_task_id}: rate limit signal detected" >&2
            fi
            cleanup_worktree "'"$_task_id"'" "$AGENT_OUTCOME"
        ' EXIT
        cd "$_worktree_path"
        _exit=0
        # Hard kill at 2× stale threshold so reclaim_stale_tasks has time to fire
        # before the process is killed. CFG_STALE_MINUTES=30 → 60m hard kill.
        _timeout_min=$(( (${CFG_STALE_MINUTES:-30}) * 2 ))

        # Run agent — output-format json writes final usage JSON to stdout;
        # redirect stdout to usage file so we can parse token counts after.
        timeout "${_timeout_min}m" \
            claude --dangerously-skip-permissions \
                   --agent "$agent_file" \
                   --print "$prompt_text" \
                   --output-format json < /dev/null \
            > "$_impl_usage_file" \
            || _exit=$?
        if [ "$_exit" -eq 0 ]; then
            AGENT_OUTCOME="success"
        else
            if [ "$_exit" -eq 124 ]; then
                echo "  ✗ Task ${_task_id}: agent timed out after ${_timeout_min}m" >&2
            fi
            AGENT_OUTCOME="failure"
        fi

        # Parse usage JSON and update attempt row (no heredoc — uses pre-written script)
        python3 "$_impl_update_script" "$REPO/$DB_FILE" "$_task_id" "${_impl_attempt_row:-0}" "$_impl_usage_file" 2>/dev/null || true
        rm -f "$_impl_update_script" 2>/dev/null || true
    ) >&2 &
    echo $!
}

# Merge all io-task/* branches (except FAILED-* and CONFLICT-*) back into the
# current branch of the main repo. Sequential — Wave 3 calls this after all
# parallel agents complete.
# Usage: merge_completed_branches
merge_completed_branches() {
    local merged=0
    local conflicts=0

    local branches
    branches=$(git -C "$REPO" branch --list 'io-task/*' \
               | grep -v 'FAILED-\|CONFLICT-' \
               | sed 's/^[* ]*//' \
               | grep -v '^[[:space:]]*$' || true)

    git -C "$REPO" worktree prune 2>/dev/null || true

    if [ -z "$branches" ]; then
        return 0
    fi

    echo ""
    echo "Merging completed task branches..."
    while IFS= read -r branch; do
        [ -z "$branch" ] && continue
        local task_id="${branch#io-task/}"

        if git -C "$REPO" merge --no-ff "$branch" \
               -m "merge: ${branch} (task ${task_id})" 2>/dev/null; then
            git -C "$REPO" branch -d "$branch" 2>/dev/null || true
            echo "  ✅ Merged: ${branch}"
            merged=$((merged + 1))
        else
            git -C "$REPO" merge --abort 2>/dev/null || true
            local conflict_branch="io-task/CONFLICT-${task_id}"
            git -C "$REPO" branch -m "$branch" "$conflict_branch" 2>/dev/null || true
            echo "  ⚠ CONFLICT in ${branch} — manual resolution needed"
            echo "    After resolving: git merge ${conflict_branch} && git branch -d ${conflict_branch}"
            conflicts=$((conflicts + 1))
        fi
    done <<< "$branches"

    if [ "$merged" -gt 0 ] || [ "$conflicts" -gt 0 ]; then
        echo "  Branches: ${merged} merged, ${conflicts} conflict(s)"
    fi

    return $((conflicts > 0 ? 1 : 0))
}

# Print remediation instructions for any lingering CONFLICT-* branches.
# Called after merge_completed_branches() so operators know what to fix manually.
report_conflict_branches() {
    local branches
    branches=$(git -C "$REPO" branch --list 'io-task/CONFLICT-*' \
               | sed 's/^[* ]*//' \
               | grep -v '^[[:space:]]*$' || true)
    [ -z "$branches" ] && return 0

    echo ""
    echo "━━━ Unresolved Merge Conflicts ━━━"
    while IFS= read -r branch; do
        [ -z "$branch" ] && continue
        local task_id="${branch#io-task/CONFLICT-}"
        echo "  ⚠ CONFLICT: ${branch}"
        echo "    Resolve steps:"
        echo "      1. git diff HEAD...${branch}"
        echo "      2. git merge ${branch}  # triggers conflict"
        echo "      3. Fix conflicts, then: git add -A && git commit"
        echo "      4. git branch -d ${branch}"
    done <<< "$branches"
    echo ""
}

# Prune accumulated FAILED-* and CONFLICT-* branches from previous task runs.
# Keeps the branch namespace clean. Run periodically, not after every task.
# Usage: cleanup_failed_branches [--dry-run]
cleanup_failed_branches() {
    local dry_run="${1:-}"
    local pruned=0

    local branches
    branches=$(git -C "$REPO" branch --list 'io-task/FAILED-*' 'io-task/CONFLICT-*' \
               | sed 's/^[* ]*//' \
               | grep -v '^[[:space:]]*$' || true)

    if [ -z "$branches" ]; then
        echo "  No FAILED-* or CONFLICT-* branches to clean up."
        return 0
    fi

    echo "  Cleaning up stale task branches..."
    while IFS= read -r branch; do
        [ -z "$branch" ] && continue
        if [ "$dry_run" = "--dry-run" ]; then
            echo "  (dry-run) would delete: ${branch}"
        else
            if git -C "$REPO" branch -D "$branch" 2>/dev/null; then
                echo "  🗑 Deleted: ${branch}"
                pruned=$((pruned + 1))
            else
                echo "  ⚠ Could not delete: ${branch}"
            fi
        fi
    done <<< "$branches"

    [ "$dry_run" != "--dry-run" ] && echo "  Pruned ${pruned} stale branch(es)."
}

# ── Parallel UAT ─────────────────────────────────────────────────────────────
# Run UAT for multiple units in parallel. Each unit gets its own claude session.
# human-uat is always serial (requires interactive prompts) — only auto UAT parallelizes.
#
# Output variables set by run_parallel_uat:
_RPU_PASSED=0
_RPU_FAILED=0
_RPU_SKIPPED=0
#
# Usage: run_parallel_uat <units_newline_list> <max_agents> <agent_file> <uat_mode>
run_parallel_uat() {
    local units_list="$1"
    local max_agents="${2:-3}"
    local agent_file="$3"
    local uat_mode="${4:-auto}"

    _RPU_PASSED=0; _RPU_FAILED=0; _RPU_SKIPPED=0

    local _hard_cap="${CFG_MAX_PARALLEL:-5}"
    if [ "$max_agents" -gt "$_hard_cap" ]; then
        echo "  ⚠ Capping parallel UAT agents at ${_hard_cap} (requested ${max_agents})"
        max_agents=$_hard_cap
    fi

    # Load units into array
    local units_arr=()
    while IFS= read -r u; do [ -n "$u" ] && units_arr+=("$u"); done <<< "$units_list"
    local total=${#units_arr[@]}
    [ "$total" -eq 0 ] && return 0

    echo "  UAT worker pool: up to ${max_agents} agent(s) running at a time, ${total} unit(s) total"

    local active_pids=()
    local active_units=()
    local next_idx=0

    # Worker pool: fill slots as they open, never idle while work remains.
    while [ "$next_idx" -lt "$total" ] || [ "${#active_pids[@]}" -gt 0 ]; do
        # Fill all open slots
        while [ "$next_idx" -lt "$total" ] && [ "${#active_pids[@]}" -lt "$max_agents" ]; do
            local unit_id="${units_arr[$next_idx]}"
            next_idx=$((next_idx + 1))
            local _uat_log="/tmp/io-uat-${unit_id}-$(date '+%Y%m%dT%H%M%S').log"
            local _uat_usage_file="/tmp/io-usage-uat-${unit_id}"
            rm -f "$_uat_usage_file" 2>/dev/null || true
            echo "$(ts) UAT agent launching: $unit_id ($next_idx/$total) — log: $_uat_log"
            (
                echo "$(ts) UAT $unit_id starting" | tee "$_uat_log"
                # --output-format json writes final usage JSON to stdout → usage file;
                # stderr (errors) appended to log. Heredocs safe here — no pid=$(...) capture.
                claude --dangerously-skip-permissions \
                       --agent "$agent_file" \
                       --print "$uat_mode $unit_id" \
                       --output-format json < /dev/null \
                > "$_uat_usage_file" 2>>"$_uat_log" || true
                echo "$(ts) UAT $unit_id finished" | tee -a "$_uat_log"
                python3 - "$REPO/$DB_FILE" "$unit_id" "$_uat_usage_file" "${CFG_UAT_DIR:-docs/uat}" 2>/dev/null <<'UAT_PYEOF' || true
import sqlite3, json, sys
from pathlib import Path
import re
db, unit_id, usage_file, uat_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok  = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win    = data.get('modelUsage', {})
    ctx_win    = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct   = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    verdict = 'unknown'
    try:
        cf = Path(uat_dir) / unit_id / 'CURRENT.md'
        m  = re.search(r'^verdict:\s*(\S+)', cf.read_text(), re.MULTILINE)
        if m: verdict = m.group(1)
    except Exception: pass
    task_id = f'UAT-{unit_id}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    # Migrate: add columns introduced after initial schema (idempotent)
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    # Sum spec_body bytes across all tasks in this unit (= total task spec the UAT agent covers)
    tasks = con.execute("SELECT id, spec_body FROM io_tasks WHERE unit=?", (unit_id,)).fetchall()
    tfb = sum(len((sb or '').encode('utf-8')) for _, sb in tasks) or None
    # Linked impl context: most-recent verified attempt for each task in this unit
    util_vals = []
    for (tid, _) in tasks:
        row = con.execute(
            "SELECT context_utilization_pct FROM io_task_attempts WHERE task_id=? AND result='verified' ORDER BY finished_at DESC LIMIT 1",
            (tid,)).fetchone()
        if row and row[0] is not None:
            util_vals.append(row[0])
    impl_avg = round(sum(util_vals)/len(util_vals), 1) if util_vals else None
    impl_max = round(max(util_vals), 1) if util_vals else None
    impl_cnt = len(util_vals)
    n = con.execute('SELECT COUNT(*)+1 FROM io_task_attempts WHERE task_id=?',(task_id,)).fetchone()[0]
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct,
        task_file_bytes,linked_impl_avg_util_pct,linked_impl_max_util_pct,linked_impl_task_count)
        VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),?,?,?,?,?,?,?,?)''',
        (task_id, n, verdict, input_tok, output_tok, util_pct, tfb, impl_avg, impl_max, impl_cnt))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
UAT_PYEOF
            ) >&2 &
            active_pids+=($!)
            active_units+=("$unit_id")
        done

        [ "${#active_pids[@]}" -eq 0 ] && break

        # Wait for any active agent to finish, then immediately fill the freed slot
        wait -n "${active_pids[@]}" 2>/dev/null || true

        # Collect all agents that have finished (may be more than one)
        local _new_pids=()
        local _new_units=()
        for i in "${!active_pids[@]}"; do
            local pid="${active_pids[$i]}"
            local unit_id="${active_units[$i]}"
            if ! kill -0 "$pid" 2>/dev/null; then
                local exit_code=0
                wait "$pid" 2>/dev/null || exit_code=$?
                echo "$(ts) ─── UAT result: $unit_id ───────────────────────────────"
                if [ "$exit_code" -ne 0 ]; then
                    echo "  ⚠ $unit_id — claude exited $exit_code (crash/OOM?) — treating as error"
                    _RPU_SKIPPED=$((_RPU_SKIPPED + 1))
                else
                    local result_file="${CFG_UAT_DIR:-docs/uat}/$unit_id/CURRENT.md"
                    if [ -f "$result_file" ]; then
                        local verdict
                        verdict=$(grep "^verdict:" "$result_file" 2>/dev/null | sed 's/verdict:[[:space:]]*//' | awk '{print $1}' || echo "unknown")
                        case "$verdict" in
                            pass)    _RPU_PASSED=$((_RPU_PASSED + 1));   echo "  ✅ $unit_id — pass" ;;
                            fail)    _RPU_FAILED=$((_RPU_FAILED + 1));   echo "  ❌ $unit_id — fail (bug tasks created)" ;;
                            partial) _RPU_FAILED=$((_RPU_FAILED + 1));   echo "  ~ $unit_id — partial" ;;
                            *)       _RPU_SKIPPED=$((_RPU_SKIPPED + 1)); echo "  — $unit_id — skipped (verdict: $verdict)" ;;
                        esac
                    else
                        _RPU_SKIPPED=$((_RPU_SKIPPED + 1))
                        echo "  — $unit_id — no result file (agent may have crashed)"
                    fi
                fi
                echo ""
            else
                _new_pids+=("$pid")
                _new_units+=("$unit_id")
            fi
        done
        active_pids=("${_new_pids[@]+"${_new_pids[@]}"}")
        active_units=("${_new_units[@]+"${_new_units[@]}"}")
    done
}

# ── Parallel Audit Runner ────────────────────────────────────────────────────
# Output variables set by run_parallel_audit:
#   _RPA_CLAIMED  — number of units claimed (launched) this call
_RPA_CLAIMED=0

# Launch up to N parallel audit agents, each claiming an independent unit from SQLite.
# Waits for all agents. Runs in the main repo (no worktree — audit makes no git commits).
# Usage: run_parallel_audit <N>
run_parallel_audit() {
    _RPA_CLAIMED=0
    local max_agents="${1:-1}"
    local _hard_cap="${CFG_MAX_PARALLEL:-5}"
    if [ "$max_agents" -gt "$_hard_cap" ]; then
        echo "  ⚠ Capping parallel audit agents at ${_hard_cap} (requested ${max_agents})"
        max_agents=$_hard_cap
    fi

    reclaim_stale_units

    local active_pids=()
    local active_units=()
    local _exhausted=0
    local _timeout_min=$(( (${CFG_STALE_MINUTES:-30}) * 2 ))

    # Worker pool: claim a new unit as soon as a slot opens.
    while [ "${_exhausted}" -eq 0 ] || [ "${#active_pids[@]}" -gt 0 ]; do
        # Fill all open slots
        while [ "${_exhausted}" -eq 0 ] && [ "${#active_pids[@]}" -lt "$max_agents" ]; do
            local unit_id
            unit_id=$(claim_next_unit "io-audit-$$") || {
                echo "  WARNING: claim_next_unit failed (SQLite timeout or error) — stopping" >&2
                _exhausted=1
                break
            }
            if [ -z "$unit_id" ]; then
                echo "  No more units eligible for audit."
                _exhausted=1
                break
            fi

            echo "$(ts) audit agent launching: ${unit_id}"
            local agent_file
            agent_file=$(expand_agent_to_tmp "audit-orchestrator")
            local _this_audit_tmp="$_AGENT_TMP_DIR"
            local _this_unit="$unit_id"
            # Context metrics setup — temp files outside pid=() to avoid heredoc/pipe corruption
            local _audit_usage="/tmp/io-usage-audit-${unit_id}"
            local _audit_ins="/tmp/io-audit-ins-${unit_id}.py"
            rm -f "$_audit_usage" "$_audit_ins" 2>/dev/null || true
            cat > "$_audit_ins" << 'AUDIT_INS_EOF'
import sqlite3, json, sys
from pathlib import Path
db, unit_id, usage_file = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win = data.get('modelUsage', {})
    ctx_win = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    task_id = f'AUDIT-{unit_id}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    n = con.execute('SELECT COUNT(*)+1 FROM io_task_attempts WHERE task_id=?', (task_id,)).fetchone()[0]
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct)
        VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),'audit',?,?,?)''',
        (task_id, n, input_tok, output_tok, util_pct))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
AUDIT_INS_EOF
            local pid
            pid=$(
                (
                    _exit=0
                    timeout "${_timeout_min}m" \
                        claude --dangerously-skip-permissions \
                               --agent "$agent_file" \
                               --print "audit force ${_this_unit} 1" \
                               --output-format json < /dev/null \
                        > "$_audit_usage" \
                        || _exit=$?
                    if [ "$_exit" -eq 124 ]; then
                        echo "  ✗ Audit unit ${_this_unit}: agent timed out after ${_timeout_min}m" >&2
                    fi
                    python3 "$_audit_ins" "$REPO/$DB_FILE" "$_this_unit" "$_audit_usage" 2>/dev/null || true
                    rm -f "$_audit_ins" 2>/dev/null || true
                    release_unit_claim "$_this_unit"
                    rm -rf "$_this_audit_tmp" 2>/dev/null || true
                    exit "$_exit"
                ) >&2 &
                echo $!
            )
            active_pids+=("$pid")
            active_units+=("$unit_id")
            _RPA_CLAIMED=$((_RPA_CLAIMED + 1))
            echo "  Audit agent: PID ${pid} → unit ${unit_id}"
        done

        [ "${#active_pids[@]}" -eq 0 ] && break

        # Wait for any active agent to finish, then immediately fill the freed slot
        wait -n "${active_pids[@]}" 2>/dev/null || true

        # Collect all agents that have finished
        local _new_pids=()
        local _new_units=()
        for i in "${!active_pids[@]}"; do
            local pid="${active_pids[$i]}"
            local unit_id="${active_units[$i]}"
            if ! kill -0 "$pid" 2>/dev/null; then
                local exit_code=0
                wait "$pid" 2>/dev/null || exit_code=$?
                if [ "$exit_code" -eq 0 ]; then
                    echo "  ✅ Audit agent PID ${pid} (unit ${unit_id}) — completed"
                elif [ "$exit_code" -eq 124 ]; then
                    echo "  ✗ Audit agent PID ${pid} (unit ${unit_id}) — timed out"
                else
                    echo "  ❌ Audit agent PID ${pid} (unit ${unit_id}) — failed (exit ${exit_code})"
                fi
            else
                _new_pids+=("$pid")
                _new_units+=("$unit_id")
            fi
        done
        active_pids=("${_new_pids[@]+"${_new_pids[@]}"}")
        active_units=("${_new_units[@]+"${_new_units[@]}"}")
    done

    if [ "$_RPA_CLAIMED" -eq 0 ]; then
        echo "  No units claimed — nothing to audit."
    fi
}

# ── Wave 3: Parallel Orchestrator ────────────────────────────────────────────
# Output variables set by run_parallel_implement:
#   _RPI_CLAIMED  — number of tasks claimed (launched) this call
#   _RPI_VERIFIED — number of tasks that completed with status 'verified'
_RPI_CLAIMED=0
_RPI_VERIFIED=0

# Launch up to N agents in parallel, each claiming an independent task from SQLite.
# Waits for all agents, merges all completed branches, and returns the count of
# failed agents. Safe to call with N=1 (supersedes Wave 2 single-agent path).
# Usage: run_parallel_implement <N>
run_parallel_implement() {
    _RPI_CLAIMED=0
    _RPI_VERIFIED=0
    local max_agents="${1:-3}"
    # Caller already enforces CFG_MAX_PARALLEL; this guard is a last-resort safety belt
    local _hard_cap="${CFG_MAX_PARALLEL:-5}"
    if [ "$max_agents" -gt "$_hard_cap" ]; then
        echo "  ⚠ Capping parallel agents at ${_hard_cap} (requested ${max_agents})"
        max_agents=$_hard_cap
    fi

    # Decompose fire-and-forget: dispatch needs_decomposition tasks alongside implement agents
    if [ -f "$REPO/.claude/agents/decompose-agent.md" ] && [ -f "$REPO/$DB_FILE" ]; then
        local _decomp_tasks
        _decomp_tasks=$(python3 - "$REPO/$DB_FILE" "$max_agents" <<'PYEOF' 2>/dev/null
import sqlite3, sys
from pathlib import Path
db = Path(sys.argv[1])
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 1
con = sqlite3.connect(str(db), timeout=5)
rows = con.execute(
    "SELECT id, unit FROM io_tasks WHERE status='needs_decomposition' LIMIT ?", (limit,)
).fetchall()
con.close()
for tid, unit in rows:
    print(f"{tid} {unit}")
PYEOF
) || _decomp_tasks=""
        if [ -n "$_decomp_tasks" ]; then
            local _decomp_n=0
            while IFS=' ' read -r _dtid _dunit; do
                [ -z "$_dtid" ] && continue
                launch_agent_in_worktree "$_dtid" "decompose-agent" \
                    "TASK_ID: ${_dtid}
UNIT: ${_dunit}" > /dev/null
                _decomp_n=$((_decomp_n + 1))
            done <<< "$_decomp_tasks"
            [ "$_decomp_n" -gt 0 ] && echo "  🔧 Launched ${_decomp_n} decompose agent(s) in background"
        fi
    fi

    local active_pids=()
    local active_tasks=()
    local agent_tasks=()  # all tasks ever launched — used for _RPI_VERIFIED query
    local failed=0
    local _rl_tasks=()  # rate-limited tasks — collected for a single batched sleep
    local _exhausted=0

    # Worker pool: claim a new task as soon as a slot opens.
    while [ "${_exhausted}" -eq 0 ] || [ "${#active_pids[@]}" -gt 0 ]; do
        # Fill all open slots
        while [ "${_exhausted}" -eq 0 ] && [ "${#active_pids[@]}" -lt "$max_agents" ]; do
            local task_id
            task_id=$(claim_next_task "io-run-$$") || {
                echo "  WARNING: claim_next_task failed (SQLite timeout or error) — stopping" >&2
                _exhausted=1
                break
            }
            if [ -z "$task_id" ]; then
                echo "  No more tasks available."
                _exhausted=1
                break
            fi

            echo "$(ts) impl agent claimed: ${task_id}"
            local pid
            # "implement force {task_id} 1" — implement exactly this claimed task and exit.
            pid=$(launch_agent_in_worktree "$task_id" "audit-orchestrator" "implement force $task_id 1")
            active_pids+=("$pid")
            active_tasks+=("$task_id")
            agent_tasks+=("$task_id")
            echo "  Agent: PID ${pid} → task ${task_id}"
        done

        [ "${#active_pids[@]}" -eq 0 ] && break

        # Wait for any active agent to finish, then immediately fill the freed slot
        wait -n "${active_pids[@]}" 2>/dev/null || true

        # Collect all agents that have finished
        local _new_pids=()
        local _new_tasks=()
        for i in "${!active_pids[@]}"; do
            local pid="${active_pids[$i]}"
            local task_id="${active_tasks[$i]}"
            if ! kill -0 "$pid" 2>/dev/null; then
                local exit_code=0
                wait "$pid" 2>/dev/null || exit_code=$?
                if [ "$exit_code" -eq 0 ]; then
                    echo "  ✅ Agent PID ${pid} (task ${task_id}) — completed"
                    "$REPO/io-gh-mirror.sh" mirror "$task_id" "verified" "Completed by agent PID ${pid}" || true
                else
                    local rl_signal="/tmp/io-rl-${task_id}"
                    if [ -f "$rl_signal" ]; then
                        rm -f "$rl_signal" 2>/dev/null || true
                        echo "  ⚠ Task ${task_id} rate-limited — will re-queue after backoff"
                        _rl_tasks+=("$task_id")
                    else
                        echo "  ❌ Agent PID ${pid} (task ${task_id}) — failed (exit ${exit_code})"
                        update_task_status "$task_id" "failed"
                        "$REPO/io-gh-mirror.sh" mirror "$task_id" "failed" "Agent PID ${pid} exited ${exit_code}" || true
                        failed=$((failed + 1))
                    fi
                fi
            else
                _new_pids+=("$pid")
                _new_tasks+=("$task_id")
            fi
        done
        active_pids=("${_new_pids[@]+"${_new_pids[@]}"}")
        active_tasks=("${_new_tasks[@]+"${_new_tasks[@]}"}")
    done

    _RPI_CLAIMED=${#agent_tasks[@]}

    if [ "$_RPI_CLAIMED" -eq 0 ]; then
        echo "  No tasks claimed — nothing to run."
        return 0
    fi

    # Re-queue rate-limited tasks with a single shared sleep (not N × sleep).
    if [ "${#_rl_tasks[@]}" -gt 0 ]; then
        echo "  ⚠ ${#_rl_tasks[@]} task(s) rate-limited — waiting ${CFG_RATE_LIMIT_BACKOFF_SEC:-60}s then re-queuing all"
        sleep "${CFG_RATE_LIMIT_BACKOFF_SEC:-60}"
        for _rl_tid in "${_rl_tasks[@]}"; do
            update_task_status "$_rl_tid" "pending"
            "$REPO/io-gh-mirror.sh" mirror "$_rl_tid" "pending" "Rate-limited — re-queued" || true
        done
    fi

    merge_completed_branches || true
    report_conflict_branches || true

    # Count actually-verified tasks from DB (not subshell exit codes, which can be
    # 0 even when the agent didn't write 'verified' to the registry).
    if [ ${#agent_tasks[@]} -gt 0 ]; then
        local _task_list
        _task_list=$(printf "'%s'," "${agent_tasks[@]}")
        _task_list="${_task_list%,}"  # strip trailing comma
        _RPI_VERIFIED=$(python3 -c "
import sqlite3, sys
try:
    con = sqlite3.connect('$REPO/$DB_FILE', timeout=5)
    n = con.execute(\"SELECT COUNT(*) FROM io_tasks WHERE status='verified' AND id IN ($_task_list)\").fetchone()[0]
    con.close()
    print(n)
except Exception:
    print(0)
" 2>/dev/null || echo 0)
    fi

    return $failed
}

# Check that task files on disk match registry entries. Warns but does not abort.
check_registry_integrity() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - "$REPO/$DB_FILE" "${CFG_TASK_DIR:-docs/tasks}" <<'PYEOF' 2>/dev/null || true
import sqlite3, glob, os, sys
from pathlib import Path

db_path  = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
task_dir = sys.argv[2] if len(sys.argv) > 2 else "docs/tasks"
if not db_path.exists():
    sys.exit(0)

try:
    con = sqlite3.connect(db_path, timeout=5)
    rows = con.execute("SELECT id, status FROM io_tasks").fetchall()
    con.close()
except Exception as e:
    print(f"  ⚠ registry integrity check: cannot read DB: {e}", file=sys.stderr)
    sys.exit(0)

# Build set of IDs from task files on disk
disk_ids = set()
for fpath in glob.glob(f"{task_dir}/**/*.md", recursive=True):
    basename = os.path.basename(fpath)
    # Strip .md and split on hyphens
    stem  = basename[:-3] if basename.endswith('.md') else basename
    parts = stem.split('-')
    for i in range(2, len(parts)):
        if parts[i][:3].isdigit():
            disk_ids.add('-'.join(parts[:i+1]))
            break

reg_ids    = {r[0] for r in rows}
reg_status = {r[0]: r[1] for r in rows}

on_disk_not_in_reg = disk_ids - reg_ids
# Only warn about missing files for non-verified tasks (verified tasks may have been cleaned up)
in_reg_not_on_disk = {tid for tid in (reg_ids - disk_ids)
                      if reg_status.get(tid) not in ('verified',)}

if on_disk_not_in_reg or in_reg_not_on_disk:
    print(f"  ⚠ Registry integrity: {len(on_disk_not_in_reg)} task files not in registry, "
          f"{len(in_reg_not_on_disk)} registry entries missing task files")
    if on_disk_not_in_reg:
        for tid in sorted(on_disk_not_in_reg)[:5]:
            print(f"    + disk only: {tid}")
PYEOF
}

# ── restore-backup ────────────────────────────────────────────────────────────
if [ "$MODE" = "restore-backup" ]; then
    MAIN="$REPO/$DB_FILE"
    BAK="${MAIN}.bak"
    if [ ! -f "$BAK" ]; then
        echo "ERROR: No backup found at $BAK"
        echo "  (SQLite backups are created automatically by migrate_to_sqlite.py)"
        exit 1
    fi
    # Validate backup is a valid SQLite file
    if ! python3 -c "import sqlite3; sqlite3.connect('$BAK').execute('SELECT COUNT(*) FROM io_tasks')" > /dev/null 2>&1; then
        echo "ERROR: Backup file $BAK is not a valid SQLite database. Cannot restore."
        exit 1
    fi
    # Save current as .pre-restore in case user wants to undo the restore
    cp "$MAIN" "$MAIN.pre-restore" 2>/dev/null || true
    cp "$BAK" "$MAIN"
    echo "Restored $BAK → $MAIN"
    echo "(Previous state saved to $MAIN.pre-restore)"
    exit 0
fi

# ── status ────────────────────────────────────────────────────────────────────
if [ "$MODE" = "status" ]; then
    echo ""
    python3 - "$REPO/$DB_FILE" "${CFG_NEEDS_INPUT_DIR:-comms/needs_input}" "${CFG_STATE_DIR:-docs/state}" <<'PYEOF'
import sqlite3, subprocess, sys, os
from collections import defaultdict
from pathlib import Path

DB_FILE   = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
NI_DIR    = sys.argv[2] if len(sys.argv) > 2 else "comms/needs_input"
STATE_DIR = sys.argv[3] if len(sys.argv) > 3 else "docs/state"

# ── load task data from SQLite ─────────────────────────────────────────────────
if not DB_FILE.exists():
    print(f"ERROR: {DB_FILE} not found. Run: python3 comms/migrate_to_sqlite.py")
    sys.exit(1)

try:
    con = sqlite3.connect(DB_FILE, timeout=5)
    rows = con.execute("SELECT status, uat_status FROM io_tasks").fetchall()
    registry = [{"status": r[0], "uat_status": r[1]} for r in rows]
    total = con.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    try:
        audit_round = con.execute("SELECT value FROM io_global WHERE key='audit_round'").fetchone()
        audit_round = f", audit_round={audit_round[0]}" if audit_round else ""
    except Exception:
        audit_round = ""
    con.close()
    source = f"SQLite ({DB_FILE}{audit_round})"
except Exception as e:
    print(f"ERROR: SQLite read failed: {e}")
    sys.exit(1)

# ── status summary ────────────────────────────────────────────────────────────
by_status = {}
for t in registry:
    s = t.get("status", "unknown")
    by_status[s] = by_status.get(s, 0) + 1

print(f"Task Status Summary  [{source}]")
print("=" * 40)
order = ["verified", "implementing", "needs_input", "pending", "failed", "escalated",
         "blocked", "needs_decomposition", "decomposed"]
icons = {"verified":"✅","implementing":"🔄","needs_input":"⏸ ","pending":"·","failed":"❌",
         "escalated":"⛔","blocked":"🔒","needs_decomposition":"📐","decomposed":"✂️ "}
for s in order:
    if s in by_status:
        icon = icons.get(s, " ")
        print(f"  {icon} {s:20s} {by_status[s]:4d}")
other = {k:v for k,v in by_status.items() if k not in order}
for s,n in other.items():
    print(f"    {s:20s} {n:4d}")
print(f"  {'─'*26}")
print(f"    {'total':20s} {total:4d}")

# ── UAT coverage ──────────────────────────────────────────────────────────────
uat_counts = defaultdict(int)
for t in registry:
    if t.get("status") == "verified":
        uat = t.get("uat_status")
        if uat == "release-approved": uat_counts["release-approved"] += 1
        elif uat == "pass":           uat_counts["pass"] += 1
        elif uat == "fail":           uat_counts["fail"] += 1
        elif uat == "partial":        uat_counts["partial"] += 1
        else:                         uat_counts["pending"] += 1

total_verified = sum(1 for t in registry if t.get("status") == "verified")
if total_verified > 0:
    print(f"")
    print(f"UAT Coverage ({total_verified} verified tasks)")
    if uat_counts["release-approved"]:
        print(f"  🚀 release-approved {uat_counts['release-approved']:4d}")
    print(f"  ✅ pass       {uat_counts['pass']:4d}")
    print(f"  ❌ fail       {uat_counts['fail']:4d}")
    print(f"  ~ partial     {uat_counts['partial']:4d}")
    print(f"  · not run     {uat_counts['pending']:4d}")

# ── orphaned completions ──────────────────────────────────────────────────────
result = subprocess.run(
    ["find", STATE_DIR, "-name", "CURRENT.md"],
    capture_output=True, text=True
)
# Cross-reference with DB: skip tasks already verified so we don't show false alarms.
try:
    _con_oc = sqlite3.connect(DB_FILE, timeout=5)
    _verified_ids = {r[0] for r in _con_oc.execute("SELECT id FROM io_tasks WHERE status='verified'").fetchall()}
    _con_oc.close()
except Exception:
    _verified_ids = set()
completed = 0
for path in result.stdout.strip().split("\n"):
    if not path:
        continue
    try:
        # path structure: {STATE_DIR}/{unit}/{task_id}/CURRENT.md
        parts = path.replace("\\", "/").split("/")
        task_id_candidate = parts[-2] if len(parts) >= 2 else ""
        if task_id_candidate in _verified_ids:
            continue  # already verified in DB — not orphaned
        with open(path) as f:
            for line in f:
                if line.startswith("status: completed"):
                    completed += 1
                    break
    except:
        pass

if completed > 0:
    print(f"")
    print(f"  ⚠️  {completed} task(s) completed locally but not yet verified in registry")
    print(f"     (reconciliation runs automatically on next orchestrator startup)")

# ── needs_input files ─────────────────────────────────────────────────────────
import glob
from datetime import datetime, timezone

ni_files = glob.glob(f"{NI_DIR}/*.md")
stale_files = glob.glob(f"{NI_DIR}/stale/*.md")
# ── context enrichment (D1) ────────────────────────────────────────────────────
try:
    con2 = sqlite3.connect(DB_FILE, timeout=5)
    total_tasks = con2.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    enriched = con2.execute(
        "SELECT COUNT(*) FROM io_tasks WHERE context_enriched_at IS NOT NULL"
    ).fetchone()[0]
    unenriched = con2.execute(
        "SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed') AND context_enriched_at IS NULL"
    ).fetchone()[0]
    # File overlap guard stats (E1)
    try:
        tasks_with_files = con2.execute(
            "SELECT COUNT(DISTINCT task_id) FROM io_task_files WHERE status='predicted'"
        ).fetchone()[0]
        total_tracked = con2.execute("SELECT COUNT(*) FROM io_task_files").fetchone()[0]
        confirmed_files = con2.execute(
            "SELECT COUNT(*) FROM io_task_files WHERE status='confirmed'"
        ).fetchone()[0]
    except Exception:
        tasks_with_files = total_tracked = confirmed_files = None
    con2.close()
    if enriched > 0 or unenriched > 0:
        print(f"")
        print(f"Context Enrichment")
        enrich_rate = f" ({enriched * 100 // total_tasks}%)" if total_tasks > 0 else ""
        print(f"  enriched tasks : {enriched}{enrich_rate}")
        print(f"  pending (none) : {unenriched}")
    if total_tracked is not None and total_tracked > 0:
        print(f"")
        print(f"File Overlap Guard")
        print(f"  tasks with files : {tasks_with_files}")
        print(f"  total tracked    : {total_tracked}  ({confirmed_files} confirmed)")
except Exception:
    pass  # columns may not exist on old schema — safe no-op

# ── agent context usage (D2) ──────────────────────────────────────────────────
try:
    con3 = sqlite3.connect(DB_FILE, timeout=5)
    type_rows = con3.execute("""
        SELECT
            CASE WHEN task_id LIKE 'UAT-%'   THEN 'uat'
                 WHEN task_id LIKE 'AUDIT-%' THEN 'audit'
                 WHEN task_id LIKE 'BUG-%'   THEN 'bug'
                 WHEN task_id LIKE 'SPEC-%'  THEN 'spec'
                 ELSE 'impl' END AS atype,
            COUNT(*) AS runs,
            ROUND(AVG(context_injection_tokens))  AS avg_input,
            ROUND(AVG(context_utilization_pct),1) AS avg_util,
            SUM(CASE WHEN result IN ('verified','pass','audit','triage') THEN 1 ELSE 0 END) AS successes
        FROM io_task_attempts
        WHERE context_injection_tokens IS NOT NULL
        GROUP BY atype
        ORDER BY atype
    """).fetchall()
    if type_rows:
        print(f"")
        print(f"Agent Context Usage")
        for atype, runs, avg_input, avg_util, successes in type_rows:
            avg_k   = f"{int(avg_input)//1000}K" if avg_input else "?"
            util_s  = f"  avg_ctx={avg_util:.1f}%" if avg_util is not None else ""
            pass_rt = f"  pass_rate={int(successes*100//runs)}%" if runs else ""
            print(f"  {atype:6s}  runs={runs}  avg_input={avg_k} tokens{util_s}{pass_rt}")

    # UAT failure rate by context band
    band_rows = con3.execute("""
        SELECT
            CASE
                WHEN context_injection_tokens < 80000  THEN '1_<80K'
                WHEN context_injection_tokens < 110000 THEN '2_80-110K'
                WHEN context_injection_tokens < 130000 THEN '3_110-130K'
                ELSE                                        '4_>130K'
            END AS band,
            result,
            COUNT(*) AS cnt
        FROM io_task_attempts
        WHERE task_id LIKE 'UAT-%' AND context_injection_tokens IS NOT NULL
        GROUP BY band, result
        ORDER BY band, result
    """).fetchall()
    if band_rows:
        print(f"")
        print(f"UAT by Context Band")
        prev_band = None
        for band, result, cnt in band_rows:
            label = band[2:]  # strip sort prefix
            if label != prev_band:
                print(f"  {label}")
                prev_band = label
            icon = '✅' if result in ('pass','verified') else ('❌' if result == 'fail' else ' ~')
            print(f"    {icon} {result}: {cnt}")

    # Impl attempt distribution
    att_rows = con3.execute("""
        SELECT attempt_number, COUNT(*) AS cnt,
               SUM(CASE WHEN result='verified' THEN 1 ELSE 0 END) AS ok
        FROM io_task_attempts
        WHERE task_id NOT LIKE 'UAT-%' AND task_id NOT LIKE 'AUDIT-%'
          AND task_id NOT LIKE 'BUG-%' AND attempt_number IS NOT NULL
        GROUP BY attempt_number
        ORDER BY attempt_number
    """).fetchall()
    if att_rows:
        print(f"")
        print(f"Impl Attempt Distribution")
        for att_num, cnt, ok in att_rows:
            pct = f"  ({int(ok*100//cnt)}% ok)" if cnt else ""
            print(f"  attempt {att_num}: {cnt} run(s){pct}")

    # UAT verdict vs impl context band (the correlation table)
    corr_rows = con3.execute("""
        SELECT
            CASE
                WHEN linked_impl_max_util_pct < 50 THEN '1_<50%'
                WHEN linked_impl_max_util_pct < 65 THEN '2_50-65%'
                WHEN linked_impl_max_util_pct < 80 THEN '3_65-80%'
                ELSE                                    '4_>80%'
            END AS impl_band,
            result,
            COUNT(*) AS cnt
        FROM io_task_attempts
        WHERE task_id LIKE 'UAT-%' AND linked_impl_max_util_pct IS NOT NULL
        GROUP BY impl_band, result
        ORDER BY impl_band, result
    """).fetchall()
    if corr_rows:
        print(f"")
        print(f"UAT Verdict by Impl Context Band (max util across unit tasks)")
        prev_band = None
        for band, result, cnt in corr_rows:
            label = band[2:]
            if label != prev_band:
                print(f"  impl used {label}")
                prev_band = label
            icon = '✅' if result in ('pass','verified','release-approved') else ('❌' if result == 'fail' else ' ~')
            print(f"    {icon} {result}: {cnt}")

    con3.close()
except Exception:
    pass  # io_task_attempts may be empty — safe no-op

if ni_files or stale_files:
    print(f"")
    print(f"  Pending Questions ({len(ni_files)} active, {len(stale_files)} auto-escalated)")
    now = datetime.now(timezone.utc)
    for fpath in sorted(ni_files):
        task_id = os.path.basename(fpath).replace(".md", "")
        created_str = ""
        question_line = ""
        try:
            with open(fpath) as f:
                lines = f.readlines()
            for line in lines:
                if line.startswith("created:"):
                    created_str = line.split(":", 1)[1].strip()
                if line.startswith("## Question"):
                    idx = lines.index(line)
                    for qline in lines[idx+1:]:
                        if qline.strip():
                            question_line = qline.strip()[:80]
                            break
        except Exception:
            pass
        elapsed = ""
        flag = "  ⏸ "
        if created_str:
            try:
                created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                hours = (now - created_dt).total_seconds() / 3600
                if hours >= 144:
                    elapsed = f"  ⚠️  {int(hours/24)}d (auto-escalating soon)"
                    flag = "  ⚠️ "
                elif hours >= 48:
                    elapsed = f"  ⚠️  {int(hours)}h"
                    flag = "  ⚠️ "
                else:
                    elapsed = f"  {int(hours)}h"
            except Exception:
                elapsed = "  ?"
        print(f"    {flag} {task_id}{elapsed}")
        if question_line:
            print(f"         → {question_line}")
    print(f"     Run: claude --agent audit-orchestrator  (enter review_input mode)")
PYEOF
    echo ""
    exit 0
fi

# ── uat modes ─────────────────────────────────────────────────────────────────
if [ "$MODE" = "uat" ] || [ "$MODE" = "human-uat" ]; then
    UAT_MODE="auto"
    [ "$MODE" = "human-uat" ] && UAT_MODE="human"

    # Parse CLI args
    # uat [P [N]]: P = parallel agents (default CFG_MAX_PARALLEL), N = unit limit (0 = all)
    # human-uat [N]: N = unit limit only — always serial, no P arg
    if [ "$MODE" = "uat" ]; then
        UAT_PARALLEL="${ARG2:-${CFG_MAX_PARALLEL:-3}}"
        UAT_LIMIT="${ARG3:-0}"
        _max_p="${CFG_MAX_PARALLEL:-5}"
        if [ "$UAT_PARALLEL" -gt "$_max_p" ] 2>/dev/null; then
            echo "  ⚠ Capping parallel UAT agents at ${_max_p} (requested ${UAT_PARALLEL})"
            UAT_PARALLEL=$_max_p
        fi
    else
        # human-uat: always serial — only a unit limit applies
        UAT_LIMIT="${ARG2:-0}"
        UAT_PARALLEL=1
    fi

    # ── ensure backend and frontend are running ───────────────────────────────
    BACKEND_STARTED=""
    DEV_SERVER_STARTED=""

    # Set EXIT trap now — before starting any processes — so cleanup fires even
    # if startup fails (e.g. backend timeout or frontend startup error).
    # BACKEND_STARTED and DEV_SERVER_STARTED must be initialized above first.
    # Use absolute path for dev.sh so cleanup works regardless of CWD at exit time.
    trap 'if [ -n "$DEV_SERVER_STARTED" ]; then echo "Stopping dev server..."; kill_port 5173; fi; if [ -n "$BACKEND_STARTED" ]; then echo "Stopping backend services..."; "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi; _io_lock_cleanup' EXIT

    ensure_backend_running "io-uat-backend"
    ensure_frontend_running "io-uat-devserver"

    # Get units to test
    if ! UNITS=$(python3 - "$REPO/$DB_FILE" <<'PYEOF'
import sqlite3, sys
from pathlib import Path
db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
if not db.exists():
    print("ERROR: tasks.db not found", file=sys.stderr); sys.exit(1)
con = sqlite3.connect(db, timeout=5)
rows = con.execute("""
    SELECT t.unit, COALESCE(q.wave, 99) as wave
    FROM io_tasks t
    LEFT JOIN io_queue q ON q.unit = t.unit
    WHERE t.status = 'verified' AND (t.uat_status IS NULL OR t.uat_status = 'partial')
    GROUP BY t.unit
    ORDER BY wave ASC, t.unit ASC
""").fetchall()
con.close()
print("\n".join(r[0] for r in rows))
PYEOF
    ); then
        echo "ERROR: Failed to read UAT unit list from tasks.db."
        exit 1
    fi

    # Apply unit limit if set
    if [ "${UAT_LIMIT:-0}" -gt 0 ] 2>/dev/null; then
        UNITS=$(echo "$UNITS" | head -n "$UAT_LIMIT")
    fi

    if [ -z "$UNITS" ]; then
        echo ""
        echo "No units with pending UAT. All verified tasks have been tested."
        "$0" status
        exit 0
    fi

    check_registry_integrity

    UNIT_COUNT=$(echo "$UNITS" | grep -c "." || true)
    echo ""
    if [ "$UAT_MODE" = "auto" ]; then
        echo "Starting auto UAT — $UNIT_COUNT unit(s), up to ${UAT_PARALLEL} in parallel"
    else
        echo "Starting $UAT_MODE UAT — $UNIT_COUNT unit(s) (serial — requires human input)"
    fi
    echo "Ctrl+C stops between units."
    echo ""

    INTERRUPTED=0
    PASSED=0
    FAILED=0
    SKIPPED=0
    trap 'INTERRUPTED=1; echo ""; echo "Stopping after current batch..."' INT

    if [ "$UAT_MODE" = "auto" ]; then
        # Parallel: each unit gets its own claude session; no interactive input needed
        run_parallel_uat "$UNITS" "${UAT_PARALLEL}" "uat-agent" "auto"
        PASSED=$_RPU_PASSED
        FAILED=$_RPU_FAILED
        SKIPPED=$_RPU_SKIPPED
    else
        # Serial: human-uat requires interactive prompts, must stay sequential
        while IFS= read -r UNIT_ID; do
            [ $INTERRUPTED -eq 1 ] && break
            [ -z "$UNIT_ID" ] && continue

            echo "─── UAT: $UNIT_ID ─────────────────────────────────────────────"
            UAT_EXIT=0
            _human_uat_usage="/tmp/io-usage-uat-${UNIT_ID}"
            rm -f "$_human_uat_usage" 2>/dev/null || true
            claude --dangerously-skip-permissions --agent "uat-agent" \
                --print "$UAT_MODE $UNIT_ID" --output-format json < /dev/null \
                > "$_human_uat_usage" || UAT_EXIT=$?
            python3 - "$REPO/$DB_FILE" "$UNIT_ID" "$_human_uat_usage" "${CFG_UAT_DIR:-docs/uat}" 2>/dev/null <<'HUMAN_UAT_PYEOF' || true
import sqlite3, json, sys
from pathlib import Path
import re
db, unit_id, usage_file, uat_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok  = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win    = data.get('modelUsage', {})
    ctx_win    = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct   = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    verdict = 'unknown'
    try:
        cf = Path(uat_dir) / unit_id / 'CURRENT.md'
        m  = re.search(r'^verdict:\s*(\S+)', cf.read_text(), re.MULTILINE)
        if m: verdict = m.group(1)
    except Exception: pass
    task_id = f'UAT-{unit_id}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    tasks = con.execute("SELECT id, spec_body FROM io_tasks WHERE unit=?", (unit_id,)).fetchall()
    tfb = sum(len((sb or '').encode('utf-8')) for _, sb in tasks) or None
    util_vals = []
    for (tid, _) in tasks:
        row = con.execute(
            "SELECT context_utilization_pct FROM io_task_attempts WHERE task_id=? AND result='verified' ORDER BY finished_at DESC LIMIT 1",
            (tid,)).fetchone()
        if row and row[0] is not None:
            util_vals.append(row[0])
    impl_avg = round(sum(util_vals)/len(util_vals), 1) if util_vals else None
    impl_max = round(max(util_vals), 1) if util_vals else None
    impl_cnt = len(util_vals)
    n = con.execute('SELECT COUNT(*)+1 FROM io_task_attempts WHERE task_id=?',(task_id,)).fetchone()[0]
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct,
        task_file_bytes,linked_impl_avg_util_pct,linked_impl_max_util_pct,linked_impl_task_count)
        VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),?,?,?,?,?,?,?,?)''',
        (task_id, n, verdict, input_tok, output_tok, util_pct, tfb, impl_avg, impl_max, impl_cnt))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
HUMAN_UAT_PYEOF
            if [ "$UAT_EXIT" -ne 0 ]; then
                echo "  ⚠ $UNIT_ID — claude exited $UAT_EXIT (crash/OOM?) — treating as error"
                SKIPPED=$((SKIPPED + 1))
                echo ""
                continue
            fi

            RESULT_FILE="${CFG_UAT_DIR:-docs/uat}/$UNIT_ID/CURRENT.md"
            if [ -f "$RESULT_FILE" ]; then
                VERDICT=$(grep "^verdict:" "$RESULT_FILE" 2>/dev/null | sed 's/verdict:[[:space:]]*//' | awk '{print $1}' || echo "unknown")
                case "$VERDICT" in
                    pass)    PASSED=$((PASSED + 1));  echo "  ✅ $UNIT_ID — pass" ;;
                    fail)    FAILED=$((FAILED + 1));  echo "  ❌ $UNIT_ID — fail (bug tasks created)" ;;
                    partial) FAILED=$((FAILED + 1));  echo "  ~ $UNIT_ID — partial" ;;
                    *)       SKIPPED=$((SKIPPED + 1)); echo "  — $UNIT_ID — skipped (verdict: $VERDICT)" ;;
                esac
            else
                SKIPPED=$((SKIPPED + 1))
                echo "  — $UNIT_ID — no result file written (agent may have crashed)"
            fi
            echo ""
        done <<< "$UNITS"
    fi
    trap - INT

    echo "═══════════════════════════════════════════"
    echo "UAT Complete"
    echo "  ✅ Pass:    $PASSED"
    echo "  ❌ Fail:    $FAILED  (new bug tasks added to implement queue)"
    echo "  — Skipped: $SKIPPED"
    echo ""
    if [ "$FAILED" -gt 0 ]; then
        echo "Run ./io-run.sh implement to fix UAT failures."
        echo ""
    fi
    "$0" status
    echo ""
    exit 0
fi

# ── release-uat mode ──────────────────────────────────────────────────────────
if [ "$MODE" = "release-uat" ]; then
    # release-uat [N]: N = unit limit only — always serial (human approve/reject per feature)
    RELEASE_LIMIT="${ARG2:-0}"

    BACKEND_STARTED=""
    DEV_SERVER_STARTED=""
    trap 'if [ -n "$DEV_SERVER_STARTED" ]; then echo "Stopping dev server..."; kill_port 5173; fi; if [ -n "$BACKEND_STARTED" ]; then echo "Stopping backend services..."; "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi; _io_lock_cleanup' EXIT

    ensure_backend_running "io-release-uat-backend"
    ensure_frontend_running "io-release-uat-devserver"

    # Determine units to release-sign-off
    if ! UNITS=$(python3 - "$REPO/$DB_FILE" <<'PYEOF'
import sqlite3, sys
from pathlib import Path
db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
if not db.exists():
    print("ERROR: tasks.db not found", file=sys.stderr); sys.exit(1)
con = sqlite3.connect(db, timeout=5)
rows = con.execute("""
    SELECT t.unit, COALESCE(q.wave, 99) as wave
    FROM io_tasks t
    LEFT JOIN io_queue q ON q.unit = t.unit
    WHERE t.status = 'verified' AND t.uat_status IN ('pass', 'partial')
    GROUP BY t.unit
    ORDER BY wave ASC, t.unit ASC
""").fetchall()
con.close()
print("\n".join(r[0] for r in rows))
PYEOF
    ); then
        echo "ERROR: Failed to read release unit list from tasks.db."
        exit 1
    fi

    # Apply unit limit if set
    if [ "${RELEASE_LIMIT:-0}" -gt 0 ] 2>/dev/null; then
        UNITS=$(echo "$UNITS" | head -n "$RELEASE_LIMIT")
    fi

    if [ -z "$UNITS" ]; then
        echo ""
        echo "No units ready for release sign-off (need uat_status=pass or partial)."
        "$0" status
        exit 0
    fi

    UNIT_COUNT=$(echo "$UNITS" | grep -c "." || true)
    echo ""
    echo "Starting release UAT — $UNIT_COUNT unit(s)"
    echo "You will Approve or Reject each feature. Ctrl+C stops between units."
    echo ""

    APPROVED=0
    REJECTED=0
    SKIPPED=0
    REL_AGENT_FILE=$(expand_agent_to_tmp "uat-agent")
    REL_AGENT_TMP="$_AGENT_TMP_DIR"

    while IFS= read -r UNIT_ID; do
        [ -z "$UNIT_ID" ] && continue
        echo "─── RELEASE: $UNIT_ID ──────────────────────────────────────"
        RELEASE_EXIT=0
        _rel_usage="/tmp/io-usage-rel-${UNIT_ID}"
        rm -f "$_rel_usage" 2>/dev/null || true
        claude --dangerously-skip-permissions --agent "$REL_AGENT_FILE" \
            --print "release $UNIT_ID" --output-format json < /dev/null \
            > "$_rel_usage" || RELEASE_EXIT=$?
        python3 - "$REPO/$DB_FILE" "$UNIT_ID" "$_rel_usage" "${CFG_UAT_DIR:-docs/uat}" 2>/dev/null <<'REL_UAT_PYEOF' || true
import sqlite3, json, sys
from pathlib import Path
import re
db, unit_id, usage_file, uat_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok  = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win    = data.get('modelUsage', {})
    ctx_win    = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct   = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    verdict = 'unknown'
    try:
        cf = Path(uat_dir) / unit_id / 'CURRENT.md'
        m  = re.search(r'^verdict:\s*(\S+)', cf.read_text(), re.MULTILINE)
        if m: verdict = m.group(1)
    except Exception: pass
    task_id = f'UAT-{unit_id}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    tasks = con.execute("SELECT id, spec_body FROM io_tasks WHERE unit=?", (unit_id,)).fetchall()
    tfb = sum(len((sb or '').encode('utf-8')) for _, sb in tasks) or None
    util_vals = []
    for (tid, _) in tasks:
        row = con.execute(
            "SELECT context_utilization_pct FROM io_task_attempts WHERE task_id=? AND result='verified' ORDER BY finished_at DESC LIMIT 1",
            (tid,)).fetchone()
        if row and row[0] is not None:
            util_vals.append(row[0])
    impl_avg = round(sum(util_vals)/len(util_vals), 1) if util_vals else None
    impl_max = round(max(util_vals), 1) if util_vals else None
    impl_cnt = len(util_vals)
    n = con.execute('SELECT COUNT(*)+1 FROM io_task_attempts WHERE task_id=?',(task_id,)).fetchone()[0]
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct,
        task_file_bytes,linked_impl_avg_util_pct,linked_impl_max_util_pct,linked_impl_task_count)
        VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),?,?,?,?,?,?,?,?)''',
        (task_id, n, verdict, input_tok, output_tok, util_pct, tfb, impl_avg, impl_max, impl_cnt))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
REL_UAT_PYEOF
        if [ "$RELEASE_EXIT" -ne 0 ]; then
            echo "  ⚠ $UNIT_ID — claude exited $RELEASE_EXIT (crash?) — skipping"
            SKIPPED=$((SKIPPED + 1))
            echo ""
            continue
        fi

        RESULT_FILE="${CFG_UAT_DIR:-docs/uat}/$UNIT_ID/CURRENT.md"
        if [ -f "$RESULT_FILE" ]; then
            VERDICT=$(grep "^verdict:" "$RESULT_FILE" 2>/dev/null | sed 's/verdict:[[:space:]]*//' | awk '{print $1}' || echo "unknown")
            case "$VERDICT" in
                release-approved) APPROVED=$((APPROVED + 1)); echo "  🚀 $UNIT_ID — release approved" ;;
                fail)             REJECTED=$((REJECTED + 1)); echo "  ❌ $UNIT_ID — rejected (bug tasks created)" ;;
                *)                SKIPPED=$((SKIPPED + 1));  echo "  — $UNIT_ID — skipped/partial (verdict: $VERDICT)" ;;
            esac
        else
            SKIPPED=$((SKIPPED + 1))
            echo "  — $UNIT_ID — no result file (agent may have crashed)"
        fi
        echo ""
    done <<< "$UNITS"
    rm -rf "$REL_AGENT_TMP" 2>/dev/null || true

    echo "═══════════════════════════════════════════"
    echo "Release UAT Complete"
    echo "  🚀 Approved: $APPROVED"
    echo "  ❌ Rejected: $REJECTED  (bug tasks created — run ./io-run.sh implement)"
    echo "  — Skipped:  $SKIPPED"
    echo ""
    "$0" status
    echo ""
    exit 0
fi

# ── bug mode ───────────────────────────────────────────────────────────────────
if [ "$MODE" = "bug" ]; then
    echo ""
    echo "Bug triage — describe the bug and the agent will research and create a fix task."
    echo "Ctrl+C to cancel."
    echo ""
    # Pass any extra args as the initial bug description; if none, agent will ask
    BUG_DESC="${ARG2:-}"
    BUG_AGENT_FILE=$(expand_agent_to_tmp "bug-agent")
    BUG_AGENT_TMP="$_AGENT_TMP_DIR"
    _bug_usage="/tmp/io-usage-bug-$(date '+%Y%m%dT%H%M%S')"
    rm -f "$_bug_usage" 2>/dev/null || true
    claude --dangerously-skip-permissions --agent "$BUG_AGENT_FILE" \
        --print "$BUG_DESC" --output-format json < /dev/null \
        > "$_bug_usage" || true
    python3 - "$REPO/$DB_FILE" "$_bug_usage" 2>/dev/null <<'BUG_PYEOF' || true
import sqlite3, json, sys, time
from pathlib import Path
db, usage_file = sys.argv[1], sys.argv[2]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win = data.get('modelUsage', {})
    ctx_win = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    task_id = f'BUG-{int(time.time())}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct)
        VALUES(?,1,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),'triage',?,?,?)''',
        (task_id, input_tok, output_tok, util_pct))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
BUG_PYEOF
    rm -rf "$BUG_AGENT_TMP" 2>/dev/null || true
    echo ""
    exit 0
fi

# ── feature mode ──────────────────────────────────────────────────────────────
# feature-agent requires multi-turn Q&A so we always launch interactively.
# If a description is supplied it is printed prominently — type/paste it as
# your first message when the session opens.
# Metrics are not captured for interactive sessions (terminal UI owns stdout).
if [ "$MODE" = "feature" ]; then
    FEAT_DESC="${ARG2:-}"
    FEAT_AGENT_FILE=$(expand_agent_to_tmp "feature-agent")
    FEAT_AGENT_TMP="$_AGENT_TMP_DIR"
    echo ""
    echo "Feature definition — interactive Q&A; generates decision file + task files."
    echo "Ctrl+C to cancel."
    if [ -n "$FEAT_DESC" ]; then
        echo ""
        echo "  ┌─ Feature description ─────────────────────────────────────────"
        echo "  │  $FEAT_DESC"
        echo "  └───────────────────────────────────────────────────────────────"
        echo "  Type or paste the above when the session starts."
    fi
    echo ""
    claude --dangerously-skip-permissions --agent "$FEAT_AGENT_FILE" || true
    rm -rf "$FEAT_AGENT_TMP" 2>/dev/null || true
    echo ""
    exit 0
fi

# ── spec mode ─────────────────────────────────────────────────────────────────
# spec-scout is one-shot research: with a topic it runs non-interactively and
# captures metrics.  Without a topic it falls back to interactive.
if [ "$MODE" = "spec" ]; then
    SPEC_TOPIC="${ARG2:-}"
    SPEC_AGENT_FILE=$(expand_agent_to_tmp "spec-scout")
    SPEC_AGENT_TMP="$_AGENT_TMP_DIR"
    echo ""
    if [ -n "$SPEC_TOPIC" ]; then
        echo "Spec scout: $SPEC_TOPIC"
        echo ""
        _spec_usage="/tmp/io-usage-spec-$(date '+%Y%m%dT%H%M%S')"
        rm -f "$_spec_usage" 2>/dev/null || true
        SPEC_EXIT=0
        claude --dangerously-skip-permissions --agent "$SPEC_AGENT_FILE" \
            --print "$SPEC_TOPIC" --output-format json < /dev/null \
            > "$_spec_usage" || SPEC_EXIT=$?
        python3 - "$REPO/$DB_FILE" "$_spec_usage" 2>/dev/null <<'SPEC_PYEOF' || true
import sqlite3, json, sys, time
from pathlib import Path
db, usage_file = sys.argv[1], sys.argv[2]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win = data.get('modelUsage', {})
    ctx_win = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    task_id = f'SPEC-{int(time.time())}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct)
        VALUES(?,1,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),'research',?,?,?)''',
        (task_id, input_tok, output_tok, util_pct))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
SPEC_PYEOF
        if [ "$SPEC_EXIT" -ne 0 ]; then
            echo "  ⚠ spec-scout exited $SPEC_EXIT"
        fi
    else
        echo "Spec scout — researches design, implementation status, and conflicts."
        echo "Ctrl+C to cancel."
        echo ""
        # Interactive — no metrics (terminal UI owns stdout)
        claude --dangerously-skip-permissions --agent "$SPEC_AGENT_FILE" || true
    fi
    rm -rf "$SPEC_AGENT_TMP" 2>/dev/null || true
    echo ""
    exit 0
fi

# ── integration-test mode ─────────────────────────────────────────────────────
if [ "$MODE" = "integration-test" ]; then
    BACKEND_STARTED=""
    DEV_SERVER_STARTED=""
    trap 'if [ -n "$DEV_SERVER_STARTED" ]; then kill_port 5173; fi; if [ -n "$BACKEND_STARTED" ]; then "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi; _io_lock_cleanup' EXIT

    ensure_backend_running "io-integration-backend"
    ensure_frontend_running "io-integration-devserver"

    echo ""
    echo "Running integration tests..."
    set +e
    ( cd "$REPO/frontend" && npx tsx tests/integration/runner.ts )
    EXIT_CODE=$?
    set -e
    echo ""
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ All integration tests passed."
    else
        echo "❌ Integration tests failed. See ${CFG_UAT_DIR:-docs/uat}/integration/REPORT.md"
    fi
    exit $EXIT_CODE
fi

# ── cleanup-branches mode ─────────────────────────────────────────────────────
if [ "$MODE" = "cleanup-branches" ]; then
    echo ""
    DRY_RUN_FLAG="${ARG2:-}"
    cleanup_failed_branches "$DRY_RUN_FLAG"
    echo ""
    exit 0
fi

# ── auto mode ─────────────────────────────────────────────────────────────────
# Dispatches audit + implement + UAT agents proportionally based on pending work ratio.
# All three agent types run in parallel within each batch.
# Repeats until no pending tasks remain and no UAT failures create new tasks.
# C2 kill switch: exits after CFG_MAX_ZERO_WAVES consecutive zero-progress batches.
if [ "$MODE" = "auto" ]; then
    AUTO_PARALLEL=${ARG2:-${CFG_MAX_PARALLEL:-3}}
    if ! [[ "$AUTO_PARALLEL" =~ ^[0-9]+$ ]] || [ "$AUTO_PARALLEL" -lt 1 ]; then
        echo "Parallel agent count must be a positive integer"
        exit 1
    fi
    _MAX_SAFE=${CFG_MAX_PARALLEL:-5}
    if [ "$AUTO_PARALLEL" -gt "$_MAX_SAFE" ]; then
        echo "⚠ Capping parallel agents at ${_MAX_SAFE} (requested ${AUTO_PARALLEL})"
        AUTO_PARALLEL=$_MAX_SAFE
    fi

    AUTO_INTERRUPTED=0
    AUTO_ROUND_FAILED=0
    trap 'AUTO_INTERRUPTED=1; echo ""; echo "Stopping after current batch..."' INT
    trap '_io_lock_cleanup' EXIT

    BACKEND_STARTED=""
    DEV_SERVER_STARTED=""

    # C2: kill switch counter — consecutive batches with zero verified progress
    CONSECUTIVE_ZERO_VERIFIED=0
    _MAX_ZERO_WAVES=${CFG_MAX_ZERO_WAVES:-3}

    # D1: Pre-expand catcher agent once for all batches (fire-and-forget enrichment)
    CATCHER_AGENT_FILE=""
    _CATCHER_AGENT_TMP=""
    if [ -f "$REPO/.claude/agents/catcher-agent.md" ]; then
        CATCHER_AGENT_FILE=$(expand_agent_to_tmp "catcher-agent") || CATCHER_AGENT_FILE=""
        _CATCHER_AGENT_TMP="$_AGENT_TMP_DIR"
    fi

    echo ""
    echo "Starting auto mode — proportional implement+UAT dispatch until complete"
    echo "Max parallel agents: ${AUTO_PARALLEL}  |  kill switch after ${_MAX_ZERO_WAVES} consecutive zero batches"
    [ -n "$CATCHER_AGENT_FILE" ] && echo "Context pre-enrichment: enabled (catcher-agent)"
    echo "Ctrl+C stops between batches."
    echo ""

    AUTO_BATCH=0

    while [ $AUTO_INTERRUPTED -eq 0 ]; do
        AUTO_BATCH=$((AUTO_BATCH + 1))
        echo "══════════════════════════════════════════════════"
        echo "  Auto batch ${AUTO_BATCH}"
        echo "══════════════════════════════════════════════════"
        echo ""

        # Reclaim stale tasks and unit claims before counting pending work
        reclaim_stale_tasks
        reclaim_stale_units
        run_unblock_pass

        # D1: Fire-and-forget catcher agents for unenriched pending tasks
        if [ -n "$CATCHER_AGENT_FILE" ]; then
            launch_catchers "$AUTO_PARALLEL" "$CATCHER_AGENT_FILE" || true
        fi

        # ── C1: Count pending work for all three types ────────────────────────
        PENDING_IMPL=$(get_pending_work_count)

        UAT_UNITS_ALL=""
        if ! UAT_UNITS_ALL=$(python3 - "$REPO/$DB_FILE" <<'PYEOF'
import sqlite3, sys
from pathlib import Path
db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
if not db.exists():
    print("ERROR: tasks.db not found", file=sys.stderr); sys.exit(1)
con = sqlite3.connect(db, timeout=5)
rows = con.execute("""
    SELECT t.unit, COALESCE(q.wave, 99) as wave
    FROM io_tasks t
    LEFT JOIN io_queue q ON q.unit = t.unit
    WHERE t.status = 'verified' AND (t.uat_status IS NULL OR t.uat_status = 'partial')
    GROUP BY t.unit
    ORDER BY wave ASC, t.unit ASC
""").fetchall()
con.close()
print("\n".join(r[0] for r in rows))
PYEOF
        ); then
            echo "ERROR: Failed to read UAT unit list from tasks.db — treating as 0 UAT units."
            UAT_UNITS_ALL=""
        fi

        PENDING_UAT=$(echo "$UAT_UNITS_ALL" | grep -c "." 2>/dev/null || echo 0)
        [ -z "$UAT_UNITS_ALL" ] && PENDING_UAT=0

        TOTAL_WORK=$((PENDING_IMPL + PENDING_UAT))

        if [ "$TOTAL_WORK" -eq 0 ]; then
            echo "✅ Auto mode complete — no pending tasks and no UAT needed."
            break
        fi

        # ── C1: Unified worker pool — 60/40 impl/UAT ratio ───────────────────
        # Slots are assigned per-completion, not pre-committed per type.
        # Impl targets 60% of impl+UAT slots; UAT targets 40%.
        echo "  Batch ${AUTO_BATCH}: up to ${AUTO_PARALLEL} agent(s) — impl≈60%% / UAT≈40%%"
        echo "  (pending: ${PENDING_IMPL} impl task(s), ${PENDING_UAT} UAT unit(s))"
        echo ""

        if [ "$PENDING_UAT" -gt 0 ]; then
            if [ -z "$BACKEND_STARTED" ] && [ -z "$DEV_SERVER_STARTED" ]; then
                trap 'if [ -n "$DEV_SERVER_STARTED" ]; then echo "Stopping dev server..."; kill_port 5173; fi; if [ -n "$BACKEND_STARTED" ]; then echo "Stopping backend services..."; "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi; _io_lock_cleanup' EXIT
                ensure_backend_running "io-auto-uat-backend"
                ensure_frontend_running "io-auto-uat-devserver"
            fi
        fi

        # Load UAT units into indexed array for pool dispatching
        local _uat_arr=()
        if [ -n "$UAT_UNITS_ALL" ]; then
            while IFS= read -r _u; do [ -n "$_u" ] && _uat_arr+=("$_u"); done <<< "$UAT_UNITS_ALL"
        fi
        local _uat_idx=0

        # Pool state: parallel arrays of active agent PIDs with their type and item ID
        local _auto_pids=()
        local _auto_types=()   # "impl" | "uat"
        local _auto_ids=()     # task_id (impl) or unit_id (uat)

        # Counters
        local _impl_launched=0 _uat_launched=0
        local _impl_exhausted=0 _uat_exhausted=0
        [ "$PENDING_IMPL" -eq 0 ] && _impl_exhausted=1
        [ "$PENDING_UAT" -eq 0 ]  && _uat_exhausted=1

        BATCH_IMPL_CLAIMED=0 BATCH_IMPL_VERIFIED=0
        BATCH_UAT_PASSED=0 BATCH_UAT_FAILED=0 BATCH_UAT_SKIPPED=0
        local _auto_impl_tasks=()   # for DB verified-count query
        local _auto_rl_tasks=()     # rate-limited impl tasks — re-queue after pool drains

        while [ "${#_auto_pids[@]}" -gt 0 ] || \
              [ "$_impl_exhausted" -eq 0 ] || \
              [ "$_uat_exhausted" -eq 0 ]; do

            # ── Fill all open slots ──────────────────────────────────────────
            while [ "${#_auto_pids[@]}" -lt "$AUTO_PARALLEL" ]; do
                # Choose type: 60/40 impl/UAT ratio
                local _next="none"
                if [ "$_impl_exhausted" -eq 0 ] && [ "$_uat_exhausted" -eq 0 ]; then
                    local _total_iu=$((_impl_launched + _uat_launched))
                    local _impl_pct=0
                    [ "$_total_iu" -gt 0 ] && _impl_pct=$((_impl_launched * 100 / _total_iu))
                    [ "$_impl_pct" -lt 60 ] && _next="impl" || _next="uat"
                elif [ "$_impl_exhausted" -eq 0 ]; then _next="impl"
                elif [ "$_uat_exhausted" -eq 0 ];  then _next="uat"
                else break  # nothing left to dispatch
                fi

                if [ "$_next" = "impl" ]; then
                    local _tid
                    _tid=$(claim_next_task "io-auto-$$") || { _impl_exhausted=1; continue; }
                    [ -z "$_tid" ] && { _impl_exhausted=1; echo "  No more impl tasks."; continue; }
                    echo "  [impl ] claimed task ${_tid}"
                    local _pid
                    _pid=$(launch_agent_in_worktree "$_tid" "audit-orchestrator" "implement force $_tid 1")
                    _auto_pids+=("$_pid"); _auto_types+=("impl"); _auto_ids+=("$_tid")
                    _auto_impl_tasks+=("$_tid")
                    _impl_launched=$((_impl_launched + 1))
                    BATCH_IMPL_CLAIMED=$((BATCH_IMPL_CLAIMED + 1))
                    echo "  [impl ] PID ${_pid} → task ${_tid}"

                elif [ "$_next" = "uat" ]; then
                    if [ "$_uat_idx" -ge "${#_uat_arr[@]}" ]; then
                        _uat_exhausted=1; echo "  No more UAT units."; continue
                    fi
                    local _uid="${_uat_arr[$_uat_idx]}"
                    _uat_idx=$((_uat_idx + 1))
                    local _auto_uat_log="/tmp/io-uat-${_uid}-$(date '+%Y%m%dT%H%M%S').log"
                    local _auto_uat_usage="/tmp/io-usage-uat-${_uid}"
                    rm -f "$_auto_uat_usage" 2>/dev/null || true
                    echo "$(ts) [uat  ] agent launching: ${_uid} (${_uat_idx}/${#_uat_arr[@]}) — log: $_auto_uat_log"
                    (
                        echo "$(ts) UAT ${_uid} starting" | tee "$_auto_uat_log"
                        claude --dangerously-skip-permissions \
                               --agent "uat-agent" \
                               --print "auto ${_uid}" \
                               --output-format json < /dev/null \
                        > "$_auto_uat_usage" 2>>"$_auto_uat_log" || true
                        echo "$(ts) UAT ${_uid} finished" | tee -a "$_auto_uat_log"
                        python3 - "$REPO/$DB_FILE" "$_uid" "$_auto_uat_usage" "${CFG_UAT_DIR:-docs/uat}" 2>/dev/null <<'AUTO_UAT_PYEOF' || true
import sqlite3, json, sys
from pathlib import Path
import re
db, unit_id, usage_file, uat_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    data = json.loads(Path(usage_file).read_text())
    u = data.get('usage', {})
    input_tok  = u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
    output_tok = u.get('output_tokens', 0)
    ctx_win    = data.get('modelUsage', {})
    ctx_win    = next(iter(ctx_win.values()), {}).get('contextWindow', 200000) if ctx_win else 200000
    util_pct   = round(input_tok / ctx_win * 100, 1) if input_tok > 0 else None
    verdict = 'unknown'
    try:
        cf = Path(uat_dir) / unit_id / 'CURRENT.md'
        m  = re.search(r'^verdict:\s*(\S+)', cf.read_text(), re.MULTILINE)
        if m: verdict = m.group(1)
    except Exception: pass
    task_id = f'UAT-{unit_id}'
    con = sqlite3.connect(db, timeout=10)
    con.execute('PRAGMA journal_mode=WAL')
    # Migrate: add columns introduced after initial schema (idempotent)
    for col, typ in [('task_file_bytes','INTEGER'),('linked_impl_avg_util_pct','REAL'),
                     ('linked_impl_max_util_pct','REAL'),('linked_impl_task_count','INTEGER')]:
        try: con.execute(f'ALTER TABLE io_task_attempts ADD COLUMN {col} {typ}')
        except Exception: pass
    # Sum spec_body bytes across all tasks in this unit
    tasks = con.execute("SELECT id, spec_body FROM io_tasks WHERE unit=?", (unit_id,)).fetchall()
    tfb = sum(len((sb or '').encode('utf-8')) for _, sb in tasks) or None
    # Linked impl context: most-recent verified attempt for each task in this unit
    util_vals = []
    for (tid, _) in tasks:
        row = con.execute(
            "SELECT context_utilization_pct FROM io_task_attempts WHERE task_id=? AND result='verified' ORDER BY finished_at DESC LIMIT 1",
            (tid,)).fetchone()
        if row and row[0] is not None:
            util_vals.append(row[0])
    impl_avg = round(sum(util_vals)/len(util_vals), 1) if util_vals else None
    impl_max = round(max(util_vals), 1) if util_vals else None
    impl_cnt = len(util_vals)
    n = con.execute('SELECT COUNT(*)+1 FROM io_task_attempts WHERE task_id=?',(task_id,)).fetchone()[0]
    con.execute('''INSERT INTO io_task_attempts(task_id,attempt_number,started_at,finished_at,result,
        context_injection_tokens,context_final_tokens,context_utilization_pct,
        task_file_bytes,linked_impl_avg_util_pct,linked_impl_max_util_pct,linked_impl_task_count)
        VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'),?,?,?,?,?,?,?,?)''',
        (task_id, n, verdict, input_tok, output_tok, util_pct, tfb, impl_avg, impl_max, impl_cnt))
    con.commit()
    con.close()
except Exception: pass
finally:
    try: Path(usage_file).unlink(missing_ok=True)
    except Exception: pass
AUTO_UAT_PYEOF
                    ) >&2 &
                    local _pid=$!
                    _auto_pids+=("$_pid"); _auto_types+=("uat"); _auto_ids+=("$_uid")
                    _uat_launched=$((_uat_launched + 1))
                    echo "  [uat  ] PID ${_pid} → unit ${_uid}"

                fi
            done

            [ "${#_auto_pids[@]}" -eq 0 ] && break

            # ── Wait for any agent to finish, then refill ────────────────────
            wait -n "${_auto_pids[@]}" 2>/dev/null || true

            # Collect all agents that finished in this tick
            local _np=() _nt=() _ni=()
            for _ai in "${!_auto_pids[@]}"; do
                local _pid="${_auto_pids[$_ai]}"
                local _type="${_auto_types[$_ai]}"
                local _id="${_auto_ids[$_ai]}"
                if ! kill -0 "$_pid" 2>/dev/null; then
                    local _ec=0; wait "$_pid" 2>/dev/null || _ec=$?

                    if [ "$_type" = "impl" ]; then
                        if [ "$_ec" -eq 0 ]; then
                            echo "  ✅ [impl ] PID ${_pid} (task ${_id}) — completed"
                            "$REPO/io-gh-mirror.sh" mirror "$_id" "verified" "PID ${_pid}" || true
                        else
                            local _rl="/tmp/io-rl-${_id}"
                            if [ -f "$_rl" ]; then
                                rm -f "$_rl" 2>/dev/null || true
                                echo "  ⚠ [impl ] task ${_id} rate-limited — will re-queue"
                                _auto_rl_tasks+=("$_id")
                                BATCH_IMPL_CLAIMED=$((BATCH_IMPL_CLAIMED - 1))
                            else
                                echo "  ❌ [impl ] PID ${_pid} (task ${_id}) — failed (exit ${_ec})"
                                update_task_status "$_id" "failed"
                                "$REPO/io-gh-mirror.sh" mirror "$_id" "failed" "PID ${_pid} exit ${_ec}" || true
                                AUTO_ROUND_FAILED=1
                            fi
                        fi

                    elif [ "$_type" = "uat" ]; then
                        if [ "$_ec" -ne 0 ]; then
                            echo "  ⚠ [uat  ] ${_id} — claude exited ${_ec} — treating as error"
                            BATCH_UAT_SKIPPED=$((BATCH_UAT_SKIPPED + 1))
                        else
                            local _rf="${CFG_UAT_DIR:-docs/uat}/${_id}/CURRENT.md"
                            if [ -f "$_rf" ]; then
                                local _vd
                                _vd=$(grep "^verdict:" "$_rf" 2>/dev/null | sed 's/verdict:[[:space:]]*//' | awk '{print $1}' || echo "unknown")
                                case "$_vd" in
                                    pass)    BATCH_UAT_PASSED=$((BATCH_UAT_PASSED + 1));   echo "  ✅ [uat  ] ${_id} — pass" ;;
                                    fail)    BATCH_UAT_FAILED=$((BATCH_UAT_FAILED + 1));   echo "  ❌ [uat  ] ${_id} — fail" ;;
                                    partial) BATCH_UAT_FAILED=$((BATCH_UAT_FAILED + 1));   echo "  ~ [uat  ] ${_id} — partial" ;;
                                    *)       BATCH_UAT_SKIPPED=$((BATCH_UAT_SKIPPED + 1)); echo "  — [uat  ] ${_id} — skipped (${_vd})" ;;
                                esac
                            else
                                BATCH_UAT_SKIPPED=$((BATCH_UAT_SKIPPED + 1))
                                echo "  — [uat  ] ${_id} — no result file"
                            fi
                        fi

                    fi
                else
                    _np+=("$_pid"); _nt+=("$_type"); _ni+=("$_id")
                fi
            done
            _auto_pids=("${_np[@]+"${_np[@]}"}")
            _auto_types=("${_nt[@]+"${_nt[@]}"}")
            _auto_ids=("${_ni[@]+"${_ni[@]}"}")
        done


        # Re-queue rate-limited impl tasks (single sleep for all)
        if [ "${#_auto_rl_tasks[@]}" -gt 0 ]; then
            echo "  ⚠ ${#_auto_rl_tasks[@]} impl task(s) rate-limited — waiting ${CFG_RATE_LIMIT_BACKOFF_SEC:-60}s then re-queuing"
            sleep "${CFG_RATE_LIMIT_BACKOFF_SEC:-60}"
            for _rl_tid in "${_auto_rl_tasks[@]}"; do
                update_task_status "$_rl_tid" "pending"
                "$REPO/io-gh-mirror.sh" mirror "$_rl_tid" "pending" "Rate-limited — re-queued" || true
            done
        fi

        # Query actually-verified impl tasks from DB (exit codes can't be trusted)
        if [ "${#_auto_impl_tasks[@]}" -gt 0 ]; then
            local _tl
            _tl=$(printf "'%s'," "${_auto_impl_tasks[@]}")
            _tl="${_tl%,}"
            BATCH_IMPL_VERIFIED=$(python3 -c "
import sqlite3
try:
    con = sqlite3.connect('$REPO/$DB_FILE', timeout=5)
    n = con.execute(\"SELECT COUNT(*) FROM io_tasks WHERE status='verified' AND id IN ($_tl)\").fetchone()[0]
    con.close()
    print(n)
except Exception:
    print(0)
" 2>/dev/null || echo 0)
        fi

        merge_completed_branches || true
        report_conflict_branches || true

        echo ""
        [ "$BATCH_IMPL_CLAIMED" -gt 0 ] && echo "  Implement: ${BATCH_IMPL_CLAIMED} claimed, ${BATCH_IMPL_VERIFIED} verified"
        [ "$(( BATCH_UAT_PASSED + BATCH_UAT_FAILED + BATCH_UAT_SKIPPED ))" -gt 0 ] && \
            echo "  UAT: ✅ ${BATCH_UAT_PASSED} pass, ❌ ${BATCH_UAT_FAILED} fail, — ${BATCH_UAT_SKIPPED} skipped"
        echo ""

        # ── C2: Kill switch — track consecutive zero-verified batches ─────────
        BATCH_PROGRESS=$((BATCH_IMPL_VERIFIED + BATCH_UAT_PASSED))
        if [ "$BATCH_PROGRESS" -gt 0 ]; then
            CONSECUTIVE_ZERO_VERIFIED=0
        else
            CONSECUTIVE_ZERO_VERIFIED=$((CONSECUTIVE_ZERO_VERIFIED + 1))
            echo "  ⚠ Zero verified progress in this batch (${CONSECUTIVE_ZERO_VERIFIED}/${_MAX_ZERO_WAVES} consecutive)"
            if [ "$CONSECUTIVE_ZERO_VERIFIED" -ge "$_MAX_ZERO_WAVES" ]; then
                echo ""
                echo "⚠ Kill switch triggered: ${CONSECUTIVE_ZERO_VERIFIED} consecutive batches with no verified progress."
                echo "  All remaining tasks may be blocked or failing repeatedly."
                echo "  Run ./io-run.sh status to inspect."
                AUTO_ROUND_FAILED=1
                break
            fi
        fi

        # Pause for needs_input if any appeared
        NI_COUNT=$(find "${CFG_NEEDS_INPUT_DIR:-comms/needs_input}" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ') || NI_COUNT=0
        if [ "$NI_COUNT" -gt 0 ]; then
            echo ""
            echo "⏸  $NI_COUNT task(s) need your input — pausing"
            ORCH_AGENT_FILE_AUTO=$(expand_agent_to_tmp "audit-orchestrator")
            claude --dangerously-skip-permissions --agent "$ORCH_AGENT_FILE_AUTO" || true
            rm -rf "$_AGENT_TMP_DIR" 2>/dev/null || true
            echo "Answers recorded. Resuming..."
            echo ""
        fi
    done

    echo ""
    echo "═══════════════════════════════════════════"
    if [ $AUTO_INTERRUPTED -eq 1 ]; then
        echo "Auto mode stopped early (Ctrl+C). Progress saved."
    elif [ $AUTO_ROUND_FAILED -eq 1 ]; then
        echo "Auto mode finished — ⚠ one or more agents had failures (see above)."
    else
        echo "Auto mode finished."
    fi
    # Cleanup catcher agent temp dir
    rm -rf "${_CATCHER_AGENT_TMP:-}" 2>/dev/null || true
    echo ""
    "$0" status
    echo ""
    exit $AUTO_ROUND_FAILED
fi

# ── validate implement/audit/full mode ────────────────────────────────────────
if [[ "$MODE" != "implement" && "$MODE" != "audit" && "$MODE" != "full" ]]; then
    echo "Usage: $0 implement [P [T]] | audit [P [N]] | full [P] | auto [P] | uat [P [N]] | human-uat [N] | release-uat [N] | bug [desc] | feature [desc] | spec [topic] | status | restore-backup | cleanup-branches | integration-test"
    exit 1
fi

# implement: P = parallel agents, T = task limit (0 = unlimited)
# audit/full: P = parallel agents (default 1 for backwards compat), N = unit limit or round count
if [ "$MODE" = "implement" ]; then
    PARALLEL=${ARG2:-${CFG_MAX_PARALLEL:-3}}
    TASK_LIMIT=${ARG3:-0}
    if ! [[ "$PARALLEL" =~ ^[0-9]+$ ]] || [ "$PARALLEL" -lt 1 ]; then
        echo "Parallel agent count must be a positive integer"
        exit 1
    fi
    if ! [[ "$TASK_LIMIT" =~ ^[0-9]+$ ]]; then
        echo "Task limit must be a non-negative integer (0 = unlimited)"
        exit 1
    fi
    _MAX_SAFE=${CFG_MAX_PARALLEL:-5}
    if [ "$PARALLEL" -gt "$_MAX_SAFE" ]; then
        echo "⚠ Capping parallel agents at ${_MAX_SAFE} (requested ${PARALLEL})"
        PARALLEL=$_MAX_SAFE
    fi
    COUNT=0  # unused in implement mode (SQLite claim loop runs until depleted)
else
    # P = parallel agents (default 1 — serial, backwards compat with old COUNT behavior)
    PARALLEL=${ARG2:-1}
    if ! [[ "$PARALLEL" =~ ^[0-9]+$ ]] || [ "$PARALLEL" -lt 1 ]; then
        echo "Parallel agent count must be a positive integer"
        exit 1
    fi
    _MAX_SAFE=${CFG_MAX_PARALLEL:-5}
    if [ "$PARALLEL" -gt "$_MAX_SAFE" ]; then
        echo "⚠ Capping parallel audit agents at ${_MAX_SAFE} (requested ${PARALLEL})"
        PARALLEL=$_MAX_SAFE
    fi
    if [ "$PARALLEL" -eq 1 ]; then
        # Serial mode: COUNT = number of orchestrator rounds (unit: one per round)
        COUNT=${ARG3:-${CFG_CHECKPOINT_EVERY:-5}}
        if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [ "$COUNT" -lt 1 ]; then
            echo "Count must be a positive integer"
            exit 1
        fi
    else
        # Parallel mode: AUDIT_UNIT_LIMIT = total units to audit (0 = unlimited)
        AUDIT_UNIT_LIMIT=${ARG3:-0}
        if ! [[ "$AUDIT_UNIT_LIMIT" =~ ^[0-9]+$ ]]; then
            echo "Unit limit must be a non-negative integer (0 = unlimited)"
            exit 1
        fi
        COUNT=999999  # effectively unlimited; loop breaks on no-work or unit-limit
    fi
    TASK_LIMIT=0
fi

# ── trap Ctrl+C and EXIT ───────────────────────────────────────────────────────
INTERRUPTED=0
ROUND_FAILED=0
trap 'INTERRUPTED=1; echo ""; echo "Stopping after current round..."' INT
trap '_io_lock_cleanup' EXIT

# ── main loop ─────────────────────────────────────────────────────────────────
ROUND=0
TASKS_DONE=0

check_registry_integrity

echo ""
if [ "$MODE" = "implement" ]; then
    LIMIT_MSG="unlimited tasks"
    [ "$TASK_LIMIT" -gt 0 ] && LIMIT_MSG="${TASK_LIMIT} task(s) total"
    echo "Starting implement — up to ${PARALLEL} agent(s) in parallel, ${LIMIT_MSG}"
elif [ "$PARALLEL" -gt 1 ] && [ "$MODE" = "audit" ]; then
    AUDIT_LIMIT_MSG="unlimited units"
    [ "${AUDIT_UNIT_LIMIT:-0}" -gt 0 ] && AUDIT_LIMIT_MSG="${AUDIT_UNIT_LIMIT} unit(s) total"
    echo "Starting audit — up to ${PARALLEL} agent(s) in parallel, ${AUDIT_LIMIT_MSG}"
elif [ "$PARALLEL" -gt 1 ] && [ "$MODE" = "full" ]; then
    echo "Starting full — up to ${PARALLEL} parallel audit agent(s) then ${PARALLEL} parallel implement agent(s)"
else
    echo "Starting $MODE — $COUNT round(s)"
fi
echo "Progress saved after every round. Ctrl+C stops between rounds."
echo ""

# Pre-expand the audit-orchestrator agent once (for audit/full modes that call it directly).
ORCH_AGENT_FILE=$(expand_agent_to_tmp "audit-orchestrator")
ORCH_AGENT_TMP="$_AGENT_TMP_DIR"

# Unblock pass: promote any blocked tasks whose dependencies are now verified,
# so get_pending_work_count sees them before the first round check.
run_unblock_pass

while [ $INTERRUPTED -eq 0 ]; do

    # Termination: implement stops at task limit; audit/full stop after COUNT rounds
    if [ "$MODE" = "implement" ]; then
        if [ "$TASK_LIMIT" -gt 0 ] && [ "$TASKS_DONE" -ge "$TASK_LIMIT" ]; then
            echo "Task limit reached (${TASKS_DONE}/${TASK_LIMIT})."
            break
        fi
    else
        if [ "$ROUND" -ge "$COUNT" ]; then break; fi
    fi

    # Reclaim any tasks stuck in 'implementing' with a stale claim
    if [ "$MODE" = "implement" ]; then
        reclaim_stale_tasks
    fi

    # Check for available work before spending a session on it. All modes use SQLite.
    if [ "$MODE" = "implement" ]; then
        PENDING_COUNT=$(get_pending_work_count)
        if [ "$PENDING_COUNT" -eq 0 ]; then
            echo ""
            echo "No more work available for '$MODE'. All caught up."
            break
        fi
        HAS_WORK=1
    elif ! HAS_WORK=$(python3 - "$REPO/$DB_FILE" "${CFG_DECISIONS_DIR:-docs/decisions}" "$MODE" <<'PYEOF'
import sqlite3, sys, os, glob as _glob
from pathlib import Path
from datetime import datetime, timezone

db_path       = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("comms/tasks.db")
decisions_dir = sys.argv[2] if len(sys.argv) > 2 else "docs/decisions"
mode          = sys.argv[3] if len(sys.argv) > 3 else "audit"

if not db_path.exists():
    print("ERROR: tasks.db not found", file=sys.stderr); sys.exit(1)

con = sqlite3.connect(db_path, timeout=5)
con.row_factory = sqlite3.Row

def wave0_recency_eligible():
    """True if any decision file is newer than any unit's last_audit_date."""
    decision_files = _glob.glob(f"{decisions_dir}/*.md")
    if not decision_files:
        return False
    newest = max(os.path.getmtime(f) for f in decision_files)
    rows = con.execute("SELECT last_audit_date FROM io_queue WHERE last_audit_date IS NOT NULL").fetchall()
    for row in rows:
        try:
            ts = datetime.fromisoformat(row[0].replace("Z", "+00:00")).timestamp()
            if newest > ts:
                return True
        except Exception:
            pass
    return False

if mode == "audit":
    eligible = con.execute("""
        SELECT COUNT(*) FROM io_queue
        WHERE last_audit_round IS NULL OR verified_since_last_audit > 0
    """).fetchone()[0]
    if not eligible:
        eligible = 1 if wave0_recency_eligible() else 0
    print(1 if eligible else 0)
elif mode == "implement":
    n = con.execute("SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed')").fetchone()[0]
    print(1 if n else 0)
else:  # full
    has_audit = con.execute("""
        SELECT COUNT(*) FROM io_queue
        WHERE last_audit_round IS NULL OR verified_since_last_audit > 0
    """).fetchone()[0]
    if not has_audit:
        has_audit = 1 if wave0_recency_eligible() else 0
    has_impl = con.execute(
        "SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed')"
    ).fetchone()[0]
    print(1 if (has_audit or has_impl) else 0)

con.close()
PYEOF
    ); then
        echo "ERROR: Failed to read tasks.db — stopping."
        break
    fi
    if [ "$HAS_WORK" = "0" ]; then
        echo ""
        echo "No more work available for '$MODE'. All caught up."
        break
    fi

    ROUND=$((ROUND + 1))
    if [ "$MODE" = "implement" ]; then
        echo "─── implement batch ${ROUND} (${TASKS_DONE} tasks done) ───────────────────────────"
    else
        echo "─── $MODE round $ROUND of $COUNT ───────────────────────────────"
    fi

    # Persist round state so restart after Ctrl+C shows progress
    if ! python3 -c "
import json, os, sys
data = {'mode': '$MODE', 'rounds_completed': $ROUND, 'rounds_total': $COUNT, 'started_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'}
last_round_json = '${CFG_LAST_ROUND_JSON}'
tmp = last_round_json + '.tmp'
try:
    with open(tmp, 'w') as f:
        json.dump(data, f)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, last_round_json)
except Exception as e:
    print(f'ERROR writing {last_round_json}: {e}', file=sys.stderr)
    try: os.unlink(tmp)
    except: pass
    sys.exit(1)
" 2>&1; then
        echo "⚠ WARNING: Failed to write ${CFG_LAST_ROUND_JSON} — round progress not persisted"
    fi

    # Run one round with fresh context.
    # implement:          parallel agents, respecting remaining task budget.
    # audit/full P>1:     parallel audit agents (and implement for full) per round.
    # audit/full P==1:    serial orchestrator (one unit at a time, coordinates sub-agents).
    ORCH_EXIT=0
    if [ "$MODE" = "implement" ]; then
        TO_CLAIM="$PARALLEL"
        if [ "$TASK_LIMIT" -gt 0 ]; then
            REMAINING=$((TASK_LIMIT - TASKS_DONE))
            [ "$REMAINING" -lt "$TO_CLAIM" ] && TO_CLAIM="$REMAINING"
        fi
        run_parallel_implement "$TO_CLAIM" || ORCH_EXIT=$?
        TASKS_DONE=$((TASKS_DONE + _RPI_CLAIMED))
        if [ "$_RPI_CLAIMED" -eq 0 ]; then
            echo "No claimable tasks — all remaining tasks may be blocked on dependencies."
            break
        fi
    elif [ "$PARALLEL" -gt 1 ] && [ "$MODE" = "audit" ]; then
        run_parallel_audit "$PARALLEL" || ORCH_EXIT=$?
        TASKS_DONE=$((TASKS_DONE + _RPA_CLAIMED))
        if [ "$_RPA_CLAIMED" -eq 0 ]; then
            echo "No units eligible for audit."
            break
        fi
        if [ "${AUDIT_UNIT_LIMIT:-0}" -gt 0 ] && [ "$TASKS_DONE" -ge "$AUDIT_UNIT_LIMIT" ]; then
            echo "Audit unit limit reached (${TASKS_DONE}/${AUDIT_UNIT_LIMIT})."
            break
        fi
    elif [ "$PARALLEL" -gt 1 ] && [ "$MODE" = "full" ]; then
        # full parallel: audit a batch then implement a batch
        run_parallel_audit "$PARALLEL" || ORCH_EXIT=$?
        run_parallel_implement "$PARALLEL" || ORCH_EXIT=$?
        if [ "$_RPA_CLAIMED" -eq 0 ] && [ "$_RPI_CLAIMED" -eq 0 ]; then
            echo "No units or tasks available."
            break
        fi
    else
        # Serial audit/full: single orchestrator session per round (current behavior)
        claude --dangerously-skip-permissions --agent "$ORCH_AGENT_FILE" --print "$MODE 1" || ORCH_EXIT=$?
    fi

    if [ "$ORCH_EXIT" -ne 0 ]; then
        ROUND_FAILED=1
        echo ""
        echo "⚠ audit-orchestrator exited $ORCH_EXIT — checking ${CFG_LAST_ROUND_JSON} for partial work..."
        python3 -c "
import json, sys
try:
    with open('${CFG_LAST_ROUND_JSON}') as f:
        r = json.load(f)
    print(f'  Last round: mode={r.get(\"mode\")}, work_done={r.get(\"work_done\")}')
except: pass
" 2>/dev/null || true
        echo "  Continuing to next round (work may be partial)."
        echo ""
    fi

    # Check for new needs_input files
    NI_COUNT=$(find "${CFG_NEEDS_INPUT_DIR:-comms/needs_input}" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ') || NI_COUNT=0
    if [ "$NI_COUNT" -gt 0 ]; then
        echo ""
        echo "⏸  $NI_COUNT task(s) need your input — pausing automated run"
        echo ""
        # Launch interactive session — orchestrator auto-detects needs_input and enters review_input
        claude --dangerously-skip-permissions --agent "$ORCH_AGENT_FILE"
        echo ""
        echo "Answers recorded. Resuming automated run..."
        echo ""
    fi
done

rm -rf "$ORCH_AGENT_TMP" 2>/dev/null || true

# ── summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
if [ $INTERRUPTED -eq 1 ]; then
    echo "Stopped early (Ctrl+C). Progress saved."
elif [ "$MODE" = "implement" ]; then
    if [ $ROUND_FAILED -eq 1 ]; then
        echo "${TASKS_DONE} task(s) processed in ${ROUND} batch(es) — ⚠ one or more agents had failures (see above)."
    else
        echo "${TASKS_DONE} task(s) processed in ${ROUND} batch(es)."
    fi
elif [ $ROUND_FAILED -eq 1 ]; then
    echo "All $COUNT round(s) complete — ⚠ one or more rounds had failures (see above)."
else
    echo "All $COUNT round(s) complete."
fi
echo ""
"$0" status
echo ""
# Exit non-zero if any round failed — allows CI/CD callers to detect failures
exit $ROUND_FAILED
