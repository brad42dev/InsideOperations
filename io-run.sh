#!/bin/bash
# io-run.sh — Orchestrator runner and UAT driver
#
# Usage:
#   ./io-run.sh implement [P [T]]  P = max parallel agents (default 3, max 5); T = total tasks to complete (default unlimited)
#   ./io-run.sh audit [N]          Run N audit rounds
#   ./io-run.sh full [N]           Run N full (audit+implement) rounds
#   ./io-run.sh uat [UNIT]         Automated Playwright UAT — all pending units, or one unit
#   ./io-run.sh human-uat [UNIT]   Human UAT with interactive pass/fail prompts
#   ./io-run.sh release-uat [UNIT] Human release sign-off — Approve/Reject per feature
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

MODE=${1:-implement}
ARG2=${2:-}
ARG3=${3:-}

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

    echo "  Worktree: ${worktree_path}  Branch: ${branch_name}" >&2

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

    # Launch agent in subshell. EXIT trap fires on crash OR clean exit.
    # AGENT_OUTCOME starts as "failure"; reset to "success" only if claude exits 0.
    # Redirect subshell stdout to stderr so agent output is visible in the terminal
    # but not captured by the pid=$(...) command substitution in the caller.
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
        timeout "${_timeout_min}m" \
            claude --dangerously-skip-permissions \
                   --agent "$agent_file" \
                   --print "$prompt_text" < /dev/null \
            || _exit=$?
        if [ "$_exit" -eq 0 ]; then
            AGENT_OUTCOME="success"
        else
            if [ "$_exit" -eq 124 ]; then
                echo "  ✗ Task ${_task_id}: agent timed out after ${_timeout_min}m" >&2
            fi
            AGENT_OUTCOME="failure"
        fi
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

    local offset=0
    while [ $offset -lt $total ]; do
        local batch_pids=()
        local batch_units=()

        # Launch up to max_agents units in this batch
        local i=$offset
        while [ $i -lt $total ] && [ ${#batch_pids[@]} -lt "$max_agents" ]; do
            local unit_id="${units_arr[$i]}"
            echo "  → UAT starting: $unit_id"
            # Each claude session runs independently; output goes to stderr so it
            # appears in the terminal without polluting the caller's capture context.
            (
                claude --dangerously-skip-permissions \
                       --agent "$agent_file" \
                       --print "$uat_mode $unit_id" < /dev/null
            ) >&2 &
            batch_pids+=($!)
            batch_units+=("$unit_id")
            i=$((i + 1))
        done
        offset=$i

        echo "  Running ${#batch_pids[@]} UAT agent(s) in parallel..."

        # Collect results for this batch
        for idx in "${!batch_pids[@]}"; do
            local pid="${batch_pids[$idx]}"
            local unit_id="${batch_units[$idx]}"
            local exit_code=0
            wait "$pid" || exit_code=$?

            echo "─── UAT result: $unit_id ───────────────────────────────────"
            if [ "$exit_code" -ne 0 ]; then
                echo "  ⚠ $unit_id — claude exited $exit_code (crash/OOM?) — treating as error"
                _RPU_SKIPPED=$((_RPU_SKIPPED + 1))
                echo ""
                continue
            fi

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
            echo ""
        done
    done
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

    local agent_pids=()
    local agent_tasks=()

    for i in $(seq 1 "$max_agents"); do
        local task_id
        task_id=$(claim_next_task "io-run-$$-${i}") || {
            echo "  WARNING: claim_next_task failed (SQLite timeout or error) — stopping agent launch" >&2
            break
        }
        if [ -z "$task_id" ]; then
            echo "  No more tasks available (claimed $((i - 1)) of ${max_agents})"
            break
        fi

        echo "  Agent ${i}: claimed task ${task_id}"
        local pid
        # "implement force {task_id} 1" — implement exactly that task (claimed via
        # SQLite above) and exit. Without 'force', parallel agents would all compete
        # for the same highest-priority task from JSON; the '1' caps to one task.
        pid=$(launch_agent_in_worktree "$task_id" "audit-orchestrator" "implement force $task_id 1")
        agent_pids+=("$pid")
        agent_tasks+=("$task_id")
        echo "  Agent ${i}: PID ${pid}"
    done

    _RPI_CLAIMED=${#agent_pids[@]}

    if [ "$_RPI_CLAIMED" -eq 0 ]; then
        echo "  No tasks claimed — nothing to run."
        return 0
    fi

    echo ""
    echo "  Running ${#agent_pids[@]} agent(s) in parallel..."

    local failed=0
    local _rl_tasks=()  # rate-limited tasks — collected for a single batched sleep
    for idx in "${!agent_pids[@]}"; do
        local pid="${agent_pids[$idx]}"
        local task_id="${agent_tasks[$idx]}"
        if wait "$pid"; then
            echo "  ✅ Agent PID ${pid} (task ${task_id}) — completed"
            "$REPO/io-gh-mirror.sh" mirror "$task_id" "verified" "Completed by agent PID ${pid}" || true
        else
            local exit_code=$?
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
    done

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
# ── context enrichment and utilization (D1/D2/E1) ─────────────────────────────
try:
    con2 = sqlite3.connect(DB_FILE, timeout=5)
    total_tasks = con2.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    enriched = con2.execute(
        "SELECT COUNT(*) FROM io_tasks WHERE context_enriched_at IS NOT NULL"
    ).fetchone()[0]
    unenriched = con2.execute(
        "SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed') AND context_enriched_at IS NULL"
    ).fetchone()[0]
    try:
        avg_util = con2.execute(
            "SELECT AVG(context_utilization_pct) FROM io_task_attempts WHERE context_utilization_pct IS NOT NULL"
        ).fetchone()[0]
    except Exception:
        avg_util = None
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
        if avg_util is not None:
            print(f"  avg ctx util   : {avg_util:.1f}%")
    if total_tracked is not None and total_tracked > 0:
        print(f"")
        print(f"File Overlap Guard")
        print(f"  tasks with files : {tasks_with_files}")
        print(f"  total tracked    : {total_tracked}  ({confirmed_files} confirmed)")
except Exception:
    pass  # columns may not exist on old schema — safe no-op

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
    UNIT_FILTER="$ARG2"

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
    if [ -n "$UNIT_FILTER" ]; then
        UNITS="$UNIT_FILTER"
    else
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
        echo "Starting auto UAT — $UNIT_COUNT unit(s), up to ${CFG_MAX_PARALLEL:-3} in parallel"
    else
        echo "Starting $UAT_MODE UAT — $UNIT_COUNT unit(s) (serial — requires human input)"
    fi
    echo "Ctrl+C stops between units."
    echo ""

    INTERRUPTED=0
    PASSED=0
    FAILED=0
    SKIPPED=0
    UAT_AGENT_FILE=$(expand_agent_to_tmp "uat-agent")
    UAT_AGENT_TMP="$_AGENT_TMP_DIR"
    trap 'rm -rf "$UAT_AGENT_TMP" 2>/dev/null; INTERRUPTED=1; echo ""; echo "Stopping after current batch..."' INT

    if [ "$UAT_MODE" = "auto" ]; then
        # Parallel: each unit gets its own claude session; no interactive input needed
        run_parallel_uat "$UNITS" "${CFG_MAX_PARALLEL:-3}" "$UAT_AGENT_FILE" "auto"
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
            claude --dangerously-skip-permissions --agent "$UAT_AGENT_FILE" --print "$UAT_MODE $UNIT_ID" < /dev/null || UAT_EXIT=$?
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
    rm -rf "$UAT_AGENT_TMP" 2>/dev/null || true
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
    UNIT_FILTER="$ARG2"

    BACKEND_STARTED=""
    DEV_SERVER_STARTED=""
    trap 'if [ -n "$DEV_SERVER_STARTED" ]; then echo "Stopping dev server..."; kill_port 5173; fi; if [ -n "$BACKEND_STARTED" ]; then echo "Stopping backend services..."; "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi; _io_lock_cleanup' EXIT

    ensure_backend_running "io-release-uat-backend"
    ensure_frontend_running "io-release-uat-devserver"

    # Determine units to release-sign-off
    if [ -n "$UNIT_FILTER" ]; then
        UNITS="$UNIT_FILTER"
    else
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
        claude --dangerously-skip-permissions --agent "$REL_AGENT_FILE" --print "release $UNIT_ID" < /dev/null || RELEASE_EXIT=$?
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
    claude --dangerously-skip-permissions --agent "$BUG_AGENT_FILE" --print "$BUG_DESC" < /dev/null || true
    rm -rf "$BUG_AGENT_TMP" 2>/dev/null || true
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
# Dispatches implement + UAT agents proportionally based on pending work ratio.
# Both agent types run in parallel within each batch.
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

        # Reclaim stale tasks before counting pending work
        reclaim_stale_tasks
        run_unblock_pass

        # D1: Fire-and-forget catcher agents for unenriched pending tasks
        if [ -n "$CATCHER_AGENT_FILE" ]; then
            launch_catchers "$AUTO_PARALLEL" "$CATCHER_AGENT_FILE" || true
        fi

        # ── C1: Count pending work for both types ─────────────────────────────
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

        # ── C1: Proportional slot allocation ──────────────────────────────────
        if [ "$PENDING_UAT" -eq 0 ]; then
            IMPL_SLOTS=$AUTO_PARALLEL
            UAT_SLOTS=0
        elif [ "$PENDING_IMPL" -eq 0 ]; then
            IMPL_SLOTS=0
            UAT_SLOTS=$AUTO_PARALLEL
        else
            # ceil(AUTO_PARALLEL * pending_impl / total_work), clamped to [1, AUTO_PARALLEL-1]
            IMPL_SLOTS=$(python3 -c "import math; v=math.ceil($AUTO_PARALLEL * $PENDING_IMPL / $TOTAL_WORK); print(max(1, min($AUTO_PARALLEL - 1, v)))")
            UAT_SLOTS=$((AUTO_PARALLEL - IMPL_SLOTS))
        fi

        echo "  Batch ${AUTO_BATCH}: ${IMPL_SLOTS} implement + ${UAT_SLOTS} UAT agents"
        echo "  (pending: ${PENDING_IMPL} impl task(s), ${PENDING_UAT} UAT unit(s))"
        echo ""

        # Ensure backend/frontend running before launching UAT agents
        if [ "$UAT_SLOTS" -gt 0 ] && [ -z "$BACKEND_STARTED" ] && [ -z "$DEV_SERVER_STARTED" ]; then
            trap 'if [ -n "$DEV_SERVER_STARTED" ]; then echo "Stopping dev server..."; kill_port 5173; fi; if [ -n "$BACKEND_STARTED" ]; then echo "Stopping backend services..."; "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi; _io_lock_cleanup' EXIT
            ensure_backend_running "io-auto-uat-backend"
            ensure_frontend_running "io-auto-uat-devserver"
        fi

        # ── Launch implement and UAT agents in parallel ───────────────────────
        # Results are written to temp files because subshells can't set parent vars.
        _IMPL_RESULT_FILE="/tmp/io-auto-impl-$$"
        _UAT_RESULT_FILE="/tmp/io-auto-uat-$$"
        echo "0 0" > "$_IMPL_RESULT_FILE"   # claimed verified
        echo "0 0 0" > "$_UAT_RESULT_FILE"  # passed failed skipped

        _IMPL_BG_PID=""
        _UAT_BG_PID=""
        _UAT_AGENT_TMP_AUTO=""

        if [ "$IMPL_SLOTS" -gt 0 ]; then
            (
                run_parallel_implement "$IMPL_SLOTS" || true
                echo "$_RPI_CLAIMED $_RPI_VERIFIED" > "$_IMPL_RESULT_FILE"
            ) &
            _IMPL_BG_PID=$!
        fi

        if [ "$UAT_SLOTS" -gt 0 ] && [ "$PENDING_UAT" -gt 0 ]; then
            # Take up to UAT_SLOTS units from the front of the sorted list
            UAT_BATCH=$(echo "$UAT_UNITS_ALL" | head -n "$UAT_SLOTS")
            UAT_AGENT_FILE_AUTO=$(expand_agent_to_tmp "uat-agent")
            _UAT_AGENT_TMP_AUTO="$_AGENT_TMP_DIR"
            (
                run_parallel_uat "$UAT_BATCH" "$UAT_SLOTS" "$UAT_AGENT_FILE_AUTO" "auto"
                echo "$_RPU_PASSED $_RPU_FAILED $_RPU_SKIPPED" > "$_UAT_RESULT_FILE"
            ) &
            _UAT_BG_PID=$!
        fi

        # Wait for both agent sets to finish
        if [ -n "$_IMPL_BG_PID" ]; then
            wait "$_IMPL_BG_PID" || AUTO_ROUND_FAILED=1
        fi
        if [ -n "$_UAT_BG_PID" ]; then
            wait "$_UAT_BG_PID" || true
            rm -rf "${_UAT_AGENT_TMP_AUTO:-}" 2>/dev/null || true
        fi

        # Read back results from temp files
        read -r BATCH_IMPL_CLAIMED BATCH_IMPL_VERIFIED < "$_IMPL_RESULT_FILE" || { BATCH_IMPL_CLAIMED=0; BATCH_IMPL_VERIFIED=0; }
        read -r BATCH_UAT_PASSED BATCH_UAT_FAILED BATCH_UAT_SKIPPED < "$_UAT_RESULT_FILE" || { BATCH_UAT_PASSED=0; BATCH_UAT_FAILED=0; BATCH_UAT_SKIPPED=0; }
        rm -f "$_IMPL_RESULT_FILE" "$_UAT_RESULT_FILE" 2>/dev/null || true

        echo ""
        [ "$IMPL_SLOTS" -gt 0 ] && echo "  Implement: ${BATCH_IMPL_CLAIMED} claimed, ${BATCH_IMPL_VERIFIED} verified"
        [ "$UAT_SLOTS" -gt 0 ]  && echo "  UAT: ✅ ${BATCH_UAT_PASSED} pass, ❌ ${BATCH_UAT_FAILED} fail, — ${BATCH_UAT_SKIPPED} skipped"
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
    echo "Usage: $0 [implement|audit|full|auto|uat|human-uat|release-uat|bug|status|restore-backup|cleanup-branches|integration-test] [N or UNIT-ID]"
    exit 1
fi

# implement: P = parallel agents, T = task limit (0 = unlimited)
# audit/full: ARG2 = number of rounds
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
    COUNT=${ARG2:-${CFG_CHECKPOINT_EVERY:-5}}
    if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [ "$COUNT" -lt 1 ]; then
        echo "Count must be a positive integer"
        exit 1
    fi
    PARALLEL=1
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
    # implement: parallel agents, respecting remaining task budget.
    # audit/full: serial orchestrator (one unit at a time, coordinates sub-agents).
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
    else
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
