#!/bin/bash
# test-orchestrator-install.sh — Validate io-orchestrator works in a clean project
#
# Creates a minimal project structure in a temp dir, copies orchestrator files
# into it, runs ./io-run.sh status, and verifies it exits 0.
#
# Usage: bash scripts/test-orchestrator-install.sh [--keep]
#   --keep  Do not delete the temp dir after the test (for inspection)

set -euo pipefail

REPO="$(git -C "$(cd "$(dirname "$0")" && pwd)" rev-parse --show-toplevel 2>/dev/null)"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

TMPDIR_BASE="${TMPDIR:-/tmp}"
TEST_DIR="$(mktemp -d "${TMPDIR_BASE}/io-orch-test-XXXXXX")"

cleanup() {
    if [ "$KEEP" = "0" ]; then
        rm -rf "$TEST_DIR"
    else
        echo "  Test dir preserved: $TEST_DIR"
    fi
}
trap cleanup EXIT

echo ""
echo "io-orchestrator install validation"
echo "==================================="
echo "  Test dir: $TEST_DIR"
echo ""

# ── 1. Scaffold minimal project ───────────────────────────────────────────────
echo "1. Scaffolding minimal project..."

# Git repo required for io-run.sh's rev-parse
git -C "$TEST_DIR" init -q
git -C "$TEST_DIR" config user.email "test@example.com"
git -C "$TEST_DIR" config user.name "Test"

# Required directories
mkdir -p "$TEST_DIR/comms"
mkdir -p "$TEST_DIR/docs/tasks"
mkdir -p "$TEST_DIR/docs/state"
mkdir -p "$TEST_DIR/docs/uat"
mkdir -p "$TEST_DIR/.claude/agents"

# ── 2. Copy orchestrator files ─────────────────────────────────────────────────
echo "2. Copying orchestrator files..."

cp "$REPO/io-run.sh" "$TEST_DIR/io-run.sh"
cp "$REPO/comms/schema.sql" "$TEST_DIR/comms/schema.sql"
cp "$REPO/comms/migrate_to_sqlite.py" "$TEST_DIR/comms/migrate_to_sqlite.py"

# Minimal config pointing at this test project
cat > "$TEST_DIR/io-orchestrator.config.json" <<'JSON'
{
  "schema": "io-orchestrator/v1",
  "project": { "name": "test-project", "root": "." },
  "commands": {
    "build_backend":  "echo ok",
    "test_backend":   "echo ok",
    "lint_backend":   "echo ok",
    "check_backend":  "echo ok",
    "build_frontend": "echo ok",
    "test_frontend":  "echo ok",
    "lint_frontend":  "echo ok",
    "check_frontend": "echo ok"
  },
  "agents": {
    "max_parallel":             2,
    "model_orchestrator":       "claude-opus-4-6",
    "model_worker":             "claude-sonnet-4-6",
    "heartbeat_interval_sec":   30,
    "stale_task_threshold_min": 30,
    "max_impl_attempts":        3,
    "rate_limit_backoff_sec":   60,
    "max_zero_waves":           3
  },
  "paths": {
    "registry_db":   "comms/tasks.db",
    "task_dir":      "docs/tasks",
    "state_dir":     "docs/state",
    "uat_dir":       "docs/uat",
    "comms_dir":     "comms",
    "worktree_base": "/tmp/io-orch-test-worktrees"
  },
  "never_touch": [".env", ".git/", "comms/context/"],
  "units": []
}
JSON

echo "   done"

# ── 3. Initialize the database ─────────────────────────────────────────────────
echo "3. Initializing SQLite database..."
(cd "$TEST_DIR" && python3 - <<'PYEOF'
import sqlite3
from pathlib import Path

db = Path("comms/tasks.db")
schema = Path("comms/schema.sql")
con = sqlite3.connect(str(db), timeout=10)
con.execute("PRAGMA journal_mode=WAL")
con.execute("PRAGMA busy_timeout=10000")
con.executescript(schema.read_text())
con.execute("INSERT OR IGNORE INTO io_global(key,value) VALUES ('audit_round','0')")
con.commit()
con.close()
print("  DB initialized: comms/tasks.db")
PYEOF
) 2>&1 | sed 's/^/   /'
echo "   done"

# ── 4. Run status — must exit 0 ───────────────────────────────────────────────
echo "4. Running: ./io-run.sh status"
if (cd "$TEST_DIR" && bash io-run.sh status 2>&1) | sed 's/^/   /'; then
    echo ""
    echo "✅ PASS: status exited 0"
else
    echo ""
    echo "❌ FAIL: status exited non-zero"
    exit 1
fi

echo ""
echo "All checks passed."
