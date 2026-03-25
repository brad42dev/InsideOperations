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
#   ./io-run.sh restore-backup     Restore AUDIT_PROGRESS.json from .bak file
#   ./io-run.sh integration-test   Run automated integration journey tests
#
# Each implement/audit round is a fresh claude session.
# Progress is saved to AUDIT_PROGRESS.json after every round.
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
        CFG_PROGRESS_JSON="comms/AUDIT_PROGRESS.json"
        CFG_TASK_DIR="docs/tasks"
        CFG_CATALOG_DIR="docs/catalogs"
        CFG_STATE_DIR="docs/state"
        CFG_MAX_PARALLEL=3
        CFG_STALE_MINUTES=30
        CFG_WORKTREE_BASE="/tmp/io-worktrees"
        CFG_TEST_COMMAND="cargo test"
        CFG_BUILD_COMMAND="cargo build"
        CFG_LINT_COMMAND="cargo clippy -- -D warnings"
        CFG_CHECK_COMMAND="cargo check"
        CFG_FRONTEND_TEST="cd frontend && pnpm test"
        CFG_FRONTEND_BUILD="cd frontend && pnpm build"
        CFG_FRONTEND_CHECK="cd frontend && npx tsc --noEmit"
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
print(f"CFG_PROGRESS_JSON={p.get('registry_file', p.get('progress_json', 'comms/AUDIT_PROGRESS.json'))!r}")
print(f"CFG_TASK_DIR={p.get('task_dir', 'docs/tasks')!r}")
print(f"CFG_CATALOG_DIR={p.get('catalog_dir', 'docs/catalogs')!r}")
print(f"CFG_STATE_DIR={p.get('state_dir', 'docs/state')!r}")
print(f"CFG_MAX_PARALLEL={ag.get('max_parallel', 3)!r}")
print(f"CFG_STALE_MINUTES={ag.get('stale_task_threshold_min', 30)!r}")
print(f"CFG_WORKTREE_BASE={p.get('worktree_base', '/tmp/io-worktrees')!r}")
print(f"CFG_TEST_COMMAND={cmd.get('test', cmd.get('test_backend', 'cargo test'))!r}")
print(f"CFG_BUILD_COMMAND={cmd.get('build', cmd.get('build_backend', 'cargo build'))!r}")
print(f"CFG_LINT_COMMAND={cmd.get('lint', cmd.get('lint_backend', 'cargo clippy -- -D warnings'))!r}")
print(f"CFG_CHECK_COMMAND={cmd.get('check', cmd.get('check_backend', 'cargo check'))!r}")
print(f"CFG_FRONTEND_TEST={cmd.get('frontend_test', cmd.get('test_frontend', 'cd frontend && pnpm test'))!r}")
print(f"CFG_FRONTEND_BUILD={cmd.get('frontend_build', cmd.get('build_frontend', 'cd frontend && pnpm build'))!r}")
print(f"CFG_FRONTEND_CHECK={cmd.get('frontend_check', cmd.get('check_frontend', 'cd frontend && npx tsc --noEmit'))!r}")
PYEOF
)" || {
        echo "WARNING: Failed to parse io-orchestrator.config.json — using hardcoded defaults" >&2
        CFG_REGISTRY_DB="comms/tasks.db"
        CFG_PROGRESS_JSON="comms/AUDIT_PROGRESS.json"
        CFG_TASK_DIR="docs/tasks"
        CFG_CATALOG_DIR="docs/catalogs"
        CFG_STATE_DIR="docs/state"
        CFG_MAX_PARALLEL=3
        CFG_STALE_MINUTES=30
        CFG_WORKTREE_BASE="/tmp/io-worktrees"
        CFG_TEST_COMMAND="cargo test"
        CFG_BUILD_COMMAND="cargo build"
        CFG_LINT_COMMAND="cargo clippy -- -D warnings"
        CFG_CHECK_COMMAND="cargo check"
        CFG_FRONTEND_TEST="cd frontend && pnpm test"
        CFG_FRONTEND_BUILD="cd frontend && pnpm build"
        CFG_FRONTEND_CHECK="cd frontend && npx tsc --noEmit"
    }
}

load_config

MODE=${1:-implement}
ARG2=${2:-}
ARG3=${3:-}

# ── run-lock: prevent concurrent invocations ──────────────────────────────────
# Use mode in lockfile name so 'status' never blocks 'implement'
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
# These functions wrap sqlite3 for task queue operations.
# All fall back gracefully to AUDIT_PROGRESS.json if comms/tasks.db does not exist.

DB_FILE="${CFG_REGISTRY_DB:-comms/tasks.db}"

# Run a SQL query against the task database. Prints results to stdout.
# Usage: db_query <sql>
db_query() {
    sqlite3 "$REPO/$DB_FILE" "$1"
}

# Atomically claim the next available task. Prints task ID on success, empty on none.
# Uses BEGIN IMMEDIATE (WAL-mode write lock) to prevent concurrent claims.
# Usage: TASK_ID=$(claim_next_task <worker-name>)
claim_next_task() {
    local worker="${1:-io-run}"
    python3 - "$worker" <<'PYEOF'
import sys, sqlite3, json
from pathlib import Path

worker = sys.argv[1]
db_path = Path("comms/tasks.db")
if not db_path.exists():
    sys.exit(0)

con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")
try:
    # BEGIN IMMEDIATE acquires a write lock immediately — prevents race conditions
    con.execute("BEGIN IMMEDIATE")
    row = con.execute("""
        SELECT id FROM io_tasks
        WHERE status IN ('pending', 'failed')
          AND (depends_on = '[]' OR depends_on IS NULL OR depends_on = '')
        ORDER BY wave ASC,
                 CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                 id ASC
        LIMIT 1
    """).fetchone()
    if row is None:
        con.execute("ROLLBACK")
        sys.exit(0)
    task_id = row[0]
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
# Valid statuses: pending, implementing, verified, failed, escalated, needs_input
update_task_status() {
    local task_id="$1"
    local status="$2"
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 -c "
import sqlite3, sys
from datetime import datetime, timezone
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
con = sqlite3.connect('$REPO/$DB_FILE')
con.execute(\"PRAGMA journal_mode=WAL\")
con.execute(\"UPDATE io_tasks SET status=?, updated_at=? WHERE id=?\", ('$status', now, '$task_id'))
con.commit()
con.close()
" 2>/dev/null || true
}

# Count tasks with status in (pending, failed) — the "available work" count.
# Prints 0 if database does not exist (callers fall back to JSON).
get_pending_work_count() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        echo 0
        return
    fi
    db_query "SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed');"
}

# Sync all task statuses from AUDIT_PROGRESS.json into SQLite.
# Bridge function for Wave 1: agents still write JSON; this keeps SQLite current.
# Called after each implement/audit/full round and after each UAT run.
# No-op if comms/tasks.db does not exist. Silent on errors (JSON is still authoritative).
sync_sqlite_from_json() {
    if [ ! -f "$REPO/$DB_FILE" ]; then
        return 0
    fi
    python3 - <<'PYEOF' 2>/dev/null || true
import json, sqlite3
from datetime import datetime, timezone
from pathlib import Path

db_path = Path("comms/tasks.db")
json_path = Path("comms/AUDIT_PROGRESS.json")
if not db_path.exists() or not json_path.exists():
    raise SystemExit(0)

with open(json_path, encoding="utf-8") as f:
    data = json.load(f)

now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
con = sqlite3.connect(db_path, timeout=10)
con.execute("PRAGMA journal_mode=WAL")

updated = 0
for task in data.get("task_registry", []):
    task_id    = task.get("id", "")
    status     = task.get("status", "pending")
    uat_status = task.get("uat_status")
    row = con.execute("SELECT status, uat_status FROM io_tasks WHERE id=?", (task_id,)).fetchone()
    if row is None:
        # New task added to JSON since last migration — insert it
        depends_on = json.dumps(task.get("depends_on") or [])
        con.execute(
            """INSERT OR IGNORE INTO io_tasks
               (id, unit, wave, title, status, priority, uat_status, source, depends_on, audit_round, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (task_id, task.get("unit",""), task.get("wave"), task.get("title",""),
             status, task.get("priority","medium"), uat_status, task.get("source"),
             depends_on, task.get("audit_round",0), now)
        )
        updated += 1
    elif row[0] != status or row[1] != uat_status:
        con.execute(
            "UPDATE io_tasks SET status=?, uat_status=?, updated_at=? WHERE id=?",
            (status, uat_status, now, task_id)
        )
        updated += 1

if updated:
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
    find "$agents_dir" -name "*.md" -print0 | while IFS= read -r -d '' f; do
        sed -i \
            -e "s|{{PROJECT_ROOT}}|${REPO}|g" \
            -e "s|{{TASK_DIR}}|${CFG_TASK_DIR:-docs/tasks}|g" \
            -e "s|{{CATALOG_DIR}}|${CFG_CATALOG_DIR:-docs/catalogs}|g" \
            -e "s|{{STATE_DIR}}|${CFG_STATE_DIR:-docs/state}|g" \
            -e "s|{{REGISTRY_DB}}|${CFG_REGISTRY_DB:-comms/tasks.db}|g" \
            -e "s|{{PROGRESS_JSON}}|${CFG_PROGRESS_JSON:-comms/AUDIT_PROGRESS.json}|g" \
            -e "s|{{TEST_COMMAND}}|${CFG_TEST_COMMAND:-cargo test}|g" \
            -e "s|{{BUILD_COMMAND}}|${CFG_BUILD_COMMAND:-cargo build}|g" \
            -e "s|{{LINT_COMMAND}}|${CFG_LINT_COMMAND:-cargo clippy -- -D warnings}|g" \
            -e "s|{{CHECK_COMMAND}}|${CFG_CHECK_COMMAND:-cargo check}|g" \
            -e "s|{{FRONTEND_TEST_COMMAND}}|${CFG_FRONTEND_TEST:-cd frontend \&\& pnpm test}|g" \
            -e "s|{{FRONTEND_BUILD_COMMAND}}|${CFG_FRONTEND_BUILD:-cd frontend \&\& pnpm build}|g" \
            -e "s|{{FRONTEND_CHECK_COMMAND}}|${CFG_FRONTEND_CHECK:-cd frontend \&\& npx tsc --noEmit}|g" \
            "$f" 2>/dev/null || true
    done
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
        git -C "$REPO" branch -m "$branch_name" "$failed_branch" 2>/dev/null || true
        echo "  ⚠ Task ${task_id}: worktree removed, branch → ${failed_branch}"
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

    # Add worktree — resume existing branch or create a new one from HEAD
    if git -C "$REPO" show-ref --verify --quiet "refs/heads/${branch_name}" 2>/dev/null; then
        echo "  Resuming branch ${branch_name} in worktree"
        git -C "$REPO" worktree add "$worktree_path" "$branch_name"
    else
        git -C "$REPO" worktree add "$worktree_path" -b "$branch_name"
    fi

    echo "  Worktree: ${worktree_path}  Branch: ${branch_name}"

    # Expand config tokens in agent files within the worktree so agents see
    # real paths (e.g. {{PROJECT_ROOT}} → /home/io/io-dev/io) at runtime.
    expand_agent_tokens "$worktree_path"

    # Capture locals for the subshell — trap string can't expand parent vars lazily
    local _task_id="$task_id"

    # Launch agent in subshell. EXIT trap fires on crash OR clean exit.
    # AGENT_OUTCOME starts as "failure"; reset to "success" only if claude exits 0.
    (
        AGENT_OUTCOME="failure"
        trap 'cleanup_worktree "'"$_task_id"'" "$AGENT_OUTCOME"' EXIT
        cd "$worktree_path"
        claude --dangerously-skip-permissions \
               --agent "$agent_file" \
               --print "$prompt_text" < /dev/null \
            && AGENT_OUTCOME="success"
    ) &
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

# ── Wave 3: Parallel Orchestrator ────────────────────────────────────────────
# Output variable set by run_parallel_implement — number of tasks claimed this call.
_RPI_CLAIMED=0

# Launch up to N agents in parallel, each claiming an independent task from SQLite.
# Waits for all agents, merges all completed branches, and returns the count of
# failed agents. Safe to call with N=1 (supersedes Wave 2 single-agent path).
# Usage: run_parallel_implement <N>
run_parallel_implement() {
    _RPI_CLAIMED=0
    local max_agents="${1:-3}"
    if [ "$max_agents" -gt 5 ]; then
        echo "  ⚠ Capping parallel agents at 5 (requested ${max_agents})"
        max_agents=5
    fi

    local agent_pids=()
    local agent_tasks=()

    for i in $(seq 1 "$max_agents"); do
        local task_id
        task_id=$(claim_next_task "io-run-$$-${i}")
        if [ -z "$task_id" ]; then
            echo "  No more tasks available (claimed $((i - 1)) of ${max_agents})"
            break
        fi

        echo "  Agent ${i}: claimed task ${task_id}"
        local pid
        pid=$(launch_agent_in_worktree "$task_id" "audit-orchestrator" "implement 1 TASK_ID=$task_id")
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
    for idx in "${!agent_pids[@]}"; do
        local pid="${agent_pids[$idx]}"
        local task_id="${agent_tasks[$idx]}"
        if wait "$pid"; then
            echo "  ✅ Agent PID ${pid} (task ${task_id}) — completed"
            "$REPO/io-gh-mirror.sh" mirror "$task_id" "verified" "Completed by agent PID ${pid}" || true
        else
            local exit_code=$?
            echo "  ❌ Agent PID ${pid} (task ${task_id}) — failed (exit ${exit_code})"
            update_task_status "$task_id" "failed"
            "$REPO/io-gh-mirror.sh" mirror "$task_id" "failed" "Agent PID ${pid} exited ${exit_code}" || true
            failed=$((failed + 1))
        fi
    done

    merge_completed_branches || true

    return $failed
}

# Check that task files on disk match registry entries. Warns but does not abort.
check_registry_integrity() {
    python3 - <<'PYEOF' 2>/dev/null || true
import json, glob, os, sys
try:
    with open("comms/AUDIT_PROGRESS.json") as f:
        d = json.load(f)
except Exception as e:
    print(f"  ⚠ registry integrity check: cannot read AUDIT_PROGRESS.json: {e}", file=sys.stderr)
    sys.exit(0)

# Build set of IDs from task files on disk
disk_ids = set()
for fpath in glob.glob("docs/tasks/**/*.md", recursive=True):
    basename = os.path.basename(fpath)
    parts = basename.split('-')
    for i in range(2, len(parts)):
        if parts[i][:3].isdigit():
            disk_ids.add('-'.join(parts[:i+1]))
            break

reg_ids = {t['id'] for t in d.get('task_registry', [])}
on_disk_not_in_reg = disk_ids - reg_ids
in_reg_not_on_disk = {tid for tid in (reg_ids - disk_ids)
                      if next((t for t in d['task_registry'] if t['id']==tid and t.get('status') not in ('verified',)), None)}

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
    BAK="$REPO/comms/AUDIT_PROGRESS.json.bak"
    MAIN="$REPO/comms/AUDIT_PROGRESS.json"
    if [ ! -f "$BAK" ]; then
        echo "ERROR: No backup found at $BAK"
        exit 1
    fi
    # Validate backup is valid JSON before restoring
    if ! python3 -c "import json; json.load(open('$BAK'))" 2>/dev/null; then
        echo "ERROR: Backup file $BAK is not valid JSON. Cannot restore."
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
    python3 - <<'PYEOF'
import json, subprocess, sys, os
from collections import defaultdict
from pathlib import Path

DB_FILE = Path("comms/tasks.db")

# ── load task data: SQLite preferred, JSON fallback ───────────────────────────
use_sqlite = DB_FILE.exists()

if use_sqlite:
    try:
        import sqlite3
        con = sqlite3.connect(DB_FILE)
        rows = con.execute("SELECT status, uat_status FROM io_tasks").fetchall()
        registry = [{"status": r[0], "uat_status": r[1]} for r in rows]
        total = con.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
        con.close()
        source = f"SQLite ({DB_FILE})"
    except Exception as e:
        print(f"WARNING: SQLite read failed ({e}), falling back to JSON", file=sys.stderr)
        use_sqlite = False

if not use_sqlite:
    try:
        with open("comms/AUDIT_PROGRESS.json") as f:
            data = json.load(f)
        registry = data.get("task_registry", [])
        total = len(registry)
        source = "AUDIT_PROGRESS.json"
    except FileNotFoundError:
        print("ERROR: comms/AUDIT_PROGRESS.json not found and comms/tasks.db does not exist.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: comms/AUDIT_PROGRESS.json is malformed: {e}")
        print("The file may have been partially written. Check it manually.")
        sys.exit(1)

# ── status summary ────────────────────────────────────────────────────────────
by_status = {}
for t in registry:
    s = t.get("status", "unknown")
    by_status[s] = by_status.get(s, 0) + 1

print(f"Task Status Summary  [{source}]")
print("=" * 40)
order = ["verified", "implementing", "needs_input", "pending", "failed", "escalated"]
for s in order:
    if s in by_status:
        icon = {"verified":"✅","implementing":"🔄","needs_input":"⏸ ","pending":"·","failed":"❌","escalated":"⛔"}.get(s, " ")
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
    ["find", "docs/state", "-name", "CURRENT.md"],
    capture_output=True, text=True
)
completed = 0
for path in result.stdout.strip().split("\n"):
    if not path:
        continue
    try:
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

ni_files = glob.glob("comms/needs_input/*.md")
stale_files = glob.glob("comms/needs_input/stale/*.md")
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
        if ! UNITS=$(python3 - <<'PYEOF'
import json, sys
try:
    with open("comms/AUDIT_PROGRESS.json") as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"ERROR: comms/AUDIT_PROGRESS.json: {e}", file=sys.stderr)
    sys.exit(1)

units = set()
for t in data.get("task_registry", []):
    # Include null (not yet tested) and "partial" (browser crash — needs retry)
    if t.get("status") == "verified" and t.get("uat_status") in (None, "partial"):
        units.add(t["unit"])

# Order by wave
queue = {u["id"]: u.get("wave", 99) for u in data.get("queue", []) if "id" in u}
ordered = sorted(units, key=lambda u: (queue.get(u, 99), u))
print("\n".join(ordered))
PYEOF
        ); then
            echo "ERROR: Failed to read UAT unit list from AUDIT_PROGRESS.json. Check the file for corruption."
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
    echo "Starting $UAT_MODE UAT — $UNIT_COUNT unit(s)"
    echo "Ctrl+C stops between units."
    echo ""

    INTERRUPTED=0
    trap 'INTERRUPTED=1; echo ""; echo "Stopping after current unit..."' INT

    PASSED=0
    FAILED=0
    SKIPPED=0

    while IFS= read -r UNIT_ID; do
        [ $INTERRUPTED -eq 1 ] && break
        [ -z "$UNIT_ID" ] && continue

        echo "─── UAT: $UNIT_ID ─────────────────────────────────────────────"
        UAT_EXIT=0
        claude --dangerously-skip-permissions --agent uat-agent --print "$UAT_MODE $UNIT_ID" < /dev/null || UAT_EXIT=$?
        if [ "$UAT_EXIT" -ne 0 ]; then
            echo "  ⚠ $UNIT_ID — claude exited $UAT_EXIT (crash/OOM?) — treating as error"
            SKIPPED=$((SKIPPED + 1))
            echo ""
            continue
        fi

        # Read verdict from result file
        RESULT_FILE="docs/uat/$UNIT_ID/CURRENT.md"
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
        # Sync uat_status updates from JSON → SQLite
        sync_sqlite_from_json
        echo ""
    done <<< "$UNITS"

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
        if ! UNITS=$(python3 - <<'PYEOF'
import json, sys
try:
    with open("comms/AUDIT_PROGRESS.json") as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"ERROR: {e}", file=sys.stderr); sys.exit(1)

units = set()
for t in data.get("task_registry", []):
    # Release-sign-off targets: verified tasks with pass or partial (not yet release-approved)
    if t.get("status") == "verified" and t.get("uat_status") in ("pass", "partial"):
        units.add(t["unit"])

queue = {u["id"]: u.get("wave", 99) for u in data.get("queue", []) if "id" in u}
ordered = sorted(units, key=lambda u: (queue.get(u, 99), u))
print("\n".join(ordered))
PYEOF
        ); then
            echo "ERROR: Failed to read release unit list from AUDIT_PROGRESS.json."
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

    while IFS= read -r UNIT_ID; do
        [ -z "$UNIT_ID" ] && continue
        echo "─── RELEASE: $UNIT_ID ──────────────────────────────────────"
        RELEASE_EXIT=0
        claude --dangerously-skip-permissions --agent uat-agent --print "release $UNIT_ID" < /dev/null || RELEASE_EXIT=$?
        if [ "$RELEASE_EXIT" -ne 0 ]; then
            echo "  ⚠ $UNIT_ID — claude exited $RELEASE_EXIT (crash?) — skipping"
            SKIPPED=$((SKIPPED + 1))
            echo ""
            continue
        fi

        RESULT_FILE="docs/uat/$UNIT_ID/CURRENT.md"
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
        # Sync uat_status updates from JSON → SQLite
        sync_sqlite_from_json
        echo ""
    done <<< "$UNITS"

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
    claude --dangerously-skip-permissions --agent bug-agent --print "$BUG_DESC" < /dev/null || true
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
        echo "❌ Integration tests failed. See docs/uat/integration/REPORT.md"
    fi
    exit $EXIT_CODE
fi

# ── validate implement/audit/full mode ────────────────────────────────────────
if [[ "$MODE" != "implement" && "$MODE" != "audit" && "$MODE" != "full" ]]; then
    echo "Usage: $0 [implement|audit|full|uat|human-uat|status] [N or UNIT-ID]"
    exit 1
fi

# implement: P = parallel agents, T = task limit (0 = unlimited)
# audit/full: ARG2 = number of rounds
if [ "$MODE" = "implement" ]; then
    PARALLEL=${ARG2:-3}
    TASK_LIMIT=${ARG3:-0}
    if ! [[ "$PARALLEL" =~ ^[0-9]+$ ]] || [ "$PARALLEL" -lt 1 ]; then
        echo "Parallel agent count must be a positive integer"
        exit 1
    fi
    if ! [[ "$TASK_LIMIT" =~ ^[0-9]+$ ]]; then
        echo "Task limit must be a non-negative integer (0 = unlimited)"
        exit 1
    fi
    if [ "$PARALLEL" -gt 5 ]; then
        echo "⚠ Capping parallel agents at 5 (requested ${PARALLEL})"
        PARALLEL=5
    fi
    COUNT=0  # unused in implement+SQLite path; kept for non-SQLite fallback
else
    COUNT=${ARG2:-5}
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
if [ "$MODE" = "implement" ] && [ -f "$REPO/$DB_FILE" ]; then
    LIMIT_MSG="unlimited tasks"
    [ "$TASK_LIMIT" -gt 0 ] && LIMIT_MSG="${TASK_LIMIT} task(s) total"
    echo "Starting implement — up to ${PARALLEL} agent(s) in parallel, ${LIMIT_MSG}"
else
    echo "Starting $MODE — $COUNT round(s)"
fi
echo "Progress saved after every round. Ctrl+C stops between rounds."
echo ""

while [ $INTERRUPTED -eq 0 ]; do

    # Termination: implement+SQLite stops at task limit; others stop after COUNT rounds
    if [ "$MODE" = "implement" ] && [ -f "$REPO/$DB_FILE" ]; then
        if [ "$TASK_LIMIT" -gt 0 ] && [ "$TASKS_DONE" -ge "$TASK_LIMIT" ]; then
            echo "Task limit reached (${TASKS_DONE}/${TASK_LIMIT})."
            break
        fi
    else
        if [ "$ROUND" -ge "$COUNT" ]; then break; fi
    fi

    # Check for available work before spending a session on it
    if ! HAS_WORK=$(python3 - <<PYEOF
import json, sys
try:
    with open("comms/AUDIT_PROGRESS.json") as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"ERROR: comms/AUDIT_PROGRESS.json: {e}", file=sys.stderr)
    sys.exit(1)
import os, glob as _glob
from datetime import datetime, timezone

mode = "$MODE"

def wave0_recency_eligible(queue):
    """True if any decision file is newer than any unit's last_audit_date.
    Conservative check — doesn't need the full applies-to matrix."""
    decision_files = _glob.glob("docs/decisions/*.md")
    if not decision_files:
        return False
    newest_decision = max(os.path.getmtime(f) for f in decision_files)
    for u in queue:
        last_audit_date = u.get("last_audit_date")
        if not last_audit_date:
            continue  # epoch — already eligible via last_audit_round=None
        try:
            audit_ts = datetime.fromisoformat(last_audit_date.replace("Z", "+00:00")).timestamp()
            if newest_decision > audit_ts:
                return True
        except Exception:
            pass
    return False

if mode == "audit":
    queue = data.get("queue", [])
    eligible = [u for u in queue
                if u.get("last_audit_round") is None or u.get("verified_since_last_audit", 0) > 0]
    if not eligible:
        eligible = [True] if wave0_recency_eligible(queue) else []
    print(1 if eligible else 0)
elif mode == "implement":
    eligible = [t for t in data.get("task_registry", [])
                if t.get("status") in ("pending", "failed")]
    print(1 if eligible else 0)
else:  # full
    queue = data.get("queue", [])
    has_audit = any(u.get("last_audit_round") is None or u.get("verified_since_last_audit", 0) > 0
                    for u in queue)
    if not has_audit:
        has_audit = wave0_recency_eligible(queue)
    has_impl  = any(t.get("status") in ("pending", "failed")
                    for t in data.get("task_registry", []))
    print(1 if (has_audit or has_impl) else 0)
PYEOF
    ); then
        echo "ERROR: Failed to read AUDIT_PROGRESS.json — stopping. Check the file for corruption."
        break
    fi
    if [ "$HAS_WORK" = "0" ]; then
        echo ""
        echo "No more work available for '$MODE'. All caught up."
        break
    fi

    ROUND=$((ROUND + 1))
    if [ "$MODE" = "implement" ] && [ -f "$REPO/$DB_FILE" ]; then
        echo "─── implement batch ${ROUND} (${TASKS_DONE} tasks done) ───────────────────────────"
    else
        echo "─── $MODE round $ROUND of $COUNT ───────────────────────────────"
    fi

    # Persist round state so restart after Ctrl+C shows progress
    if ! python3 -c "
import json, os, sys
data = {'mode': '$MODE', 'rounds_completed': $ROUND, 'rounds_total': $COUNT, 'started_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'}
tmp = 'comms/LAST_ROUND.json.tmp'
try:
    with open(tmp, 'w') as f:
        json.dump(data, f)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, 'comms/LAST_ROUND.json')
except Exception as e:
    print(f'ERROR writing LAST_ROUND.json: {e}', file=sys.stderr)
    try: os.unlink(tmp)
    except: pass
    sys.exit(1)
" 2>&1; then
        echo "⚠ WARNING: Failed to write LAST_ROUND.json — round progress not persisted"
    fi

    # Run one round with fresh context.
    # implement+SQLite: parallel agents, respecting remaining task budget.
    # audit/full or no-SQLite fallback: serial orchestrator.
    ORCH_EXIT=0
    if [ "$MODE" = "implement" ] && [ -f "$REPO/$DB_FILE" ]; then
        TO_CLAIM="$PARALLEL"
        if [ "$TASK_LIMIT" -gt 0 ]; then
            REMAINING=$((TASK_LIMIT - TASKS_DONE))
            [ "$REMAINING" -lt "$TO_CLAIM" ] && TO_CLAIM="$REMAINING"
        fi
        run_parallel_implement "$TO_CLAIM" || ORCH_EXIT=$?
        TASKS_DONE=$((TASKS_DONE + _RPI_CLAIMED))
    else
        claude --dangerously-skip-permissions --agent audit-orchestrator --print "$MODE 1" || ORCH_EXIT=$?
    fi

    if [ "$ORCH_EXIT" -ne 0 ]; then
        ROUND_FAILED=1
        echo ""
        echo "⚠ audit-orchestrator exited $ORCH_EXIT — checking LAST_ROUND.json for partial work..."
        python3 -c "
import json, sys
try:
    with open('comms/LAST_ROUND.json') as f:
        r = json.load(f)
    print(f'  Last round: mode={r.get(\"mode\")}, work_done={r.get(\"work_done\")}')
except: pass
" 2>/dev/null || true
        echo "  Continuing to next round (work may be partial)."
        echo ""
    fi

    # Sync task statuses from JSON → SQLite (bridge until agents write SQLite directly)
    sync_sqlite_from_json

    # Check for new needs_input files
    NI_COUNT=$(find comms/needs_input -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ') || NI_COUNT=0
    if [ "$NI_COUNT" -gt 0 ]; then
        echo ""
        echo "⏸  $NI_COUNT task(s) need your input — pausing automated run"
        echo ""
        # Launch interactive session — orchestrator auto-detects needs_input and enters review_input
        claude --dangerously-skip-permissions --agent audit-orchestrator
        echo ""
        echo "Answers recorded. Resuming automated run..."
        echo ""
    fi
done

# ── summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
if [ $INTERRUPTED -eq 1 ]; then
    echo "Stopped early (Ctrl+C). Progress saved."
elif [ "$MODE" = "implement" ] && [ -f "$REPO/$DB_FILE" ]; then
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
