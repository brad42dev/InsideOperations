#!/bin/bash
# io-orchestrator-init.sh — Bootstrap io-orchestrator in a new project directory.
#
# Usage:
#   ./io-orchestrator-init.sh [TARGET_DIR]
#
#   TARGET_DIR defaults to the current directory.
#   Copies io-run.sh, io-gh-mirror.sh, io-watchdog.sh, and .claude/agents/*.md
#   into TARGET_DIR, auto-detects the project language, and generates a starter
#   io-orchestrator.config.json with sensible defaults.
#
# After running this script, fill in the following manually:
#   1. units[] — list your project's modules/services (id, name, source_paths, spec_doc)
#   2. paths.spec_docs — where your spec documents live
#   3. project.description — brief description of what your project does
#
# This script is idempotent — safe to re-run if you need to update agent files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${1:-$(pwd)}"

if [ ! -d "$TARGET_DIR" ]; then
    echo "ERROR: Target directory does not exist: $TARGET_DIR"
    exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
echo "io-orchestrator-init: target = $TARGET_DIR"

# ── Detect project language ───────────────────────────────────────────────────
LANG_DETECTED="unknown"
HAS_RUST=0
HAS_NODE=0
HAS_PYTHON=0
HAS_GO=0

[ -f "$TARGET_DIR/Cargo.toml" ]          && HAS_RUST=1   && LANG_DETECTED="rust"
[ -f "$TARGET_DIR/package.json" ]        && HAS_NODE=1   && LANG_DETECTED="node"
( [ -f "$TARGET_DIR/pyproject.toml" ] || [ -f "$TARGET_DIR/setup.py" ] ) && HAS_PYTHON=1 && LANG_DETECTED="python"
[ -f "$TARGET_DIR/go.mod" ]              && HAS_GO=1     && LANG_DETECTED="go"

# Polyglot: both Rust and Node (like the io project)
if [ "$HAS_RUST" -eq 1 ] && [ "$HAS_NODE" -eq 1 ]; then
    LANG_DETECTED="rust+node"
fi

echo "  Detected language: $LANG_DETECTED"

# ── Set command defaults by language ─────────────────────────────────────────
case "$LANG_DETECTED" in
    rust)
        CMD_TEST="cargo test"
        CMD_BUILD="cargo build"
        CMD_LINT="cargo clippy -- -D warnings"
        CMD_CHECK="cargo check"
        CMD_FRONTEND_TEST=""
        CMD_FRONTEND_BUILD=""
        CMD_FRONTEND_CHECK=""
        ;;
    node)
        CMD_TEST="npm test"
        CMD_BUILD="npm run build"
        CMD_LINT="npm run lint"
        CMD_CHECK="npx tsc --noEmit"
        CMD_FRONTEND_TEST="npm test"
        CMD_FRONTEND_BUILD="npm run build"
        CMD_FRONTEND_CHECK="npx tsc --noEmit"
        # Try pnpm if present
        if command -v pnpm > /dev/null 2>&1; then
            CMD_TEST="pnpm test"
            CMD_BUILD="pnpm build"
            CMD_LINT="pnpm lint"
            CMD_FRONTEND_TEST="pnpm test"
            CMD_FRONTEND_BUILD="pnpm build"
        fi
        ;;
    rust+node)
        CMD_TEST="cargo test"
        CMD_BUILD="cargo build"
        CMD_LINT="cargo clippy -- -D warnings"
        CMD_CHECK="cargo check"
        FRONTEND_DIR="frontend"
        [ -d "$TARGET_DIR/frontend" ] && true || FRONTEND_DIR="."
        if command -v pnpm > /dev/null 2>&1; then
            CMD_FRONTEND_TEST="cd $FRONTEND_DIR && pnpm test"
            CMD_FRONTEND_BUILD="cd $FRONTEND_DIR && pnpm build"
            CMD_FRONTEND_CHECK="cd $FRONTEND_DIR && npx tsc --noEmit"
        else
            CMD_FRONTEND_TEST="cd $FRONTEND_DIR && npm test"
            CMD_FRONTEND_BUILD="cd $FRONTEND_DIR && npm run build"
            CMD_FRONTEND_CHECK="cd $FRONTEND_DIR && npx tsc --noEmit"
        fi
        ;;
    python)
        CMD_TEST="pytest"
        CMD_BUILD="python -m build"
        CMD_LINT="ruff check ."
        CMD_CHECK="mypy ."
        CMD_FRONTEND_TEST=""
        CMD_FRONTEND_BUILD=""
        CMD_FRONTEND_CHECK=""
        ;;
    go)
        CMD_TEST="go test ./..."
        CMD_BUILD="go build ./..."
        CMD_LINT="golangci-lint run"
        CMD_CHECK="go vet ./..."
        CMD_FRONTEND_TEST=""
        CMD_FRONTEND_BUILD=""
        CMD_FRONTEND_CHECK=""
        ;;
    *)
        CMD_TEST="echo 'configure test command'"
        CMD_BUILD="echo 'configure build command'"
        CMD_LINT="echo 'configure lint command'"
        CMD_CHECK="echo 'configure check command'"
        CMD_FRONTEND_TEST=""
        CMD_FRONTEND_BUILD=""
        CMD_FRONTEND_CHECK=""
        ;;
esac

# ── Auto-detect project name ──────────────────────────────────────────────────
PROJECT_NAME="$(basename "$TARGET_DIR")"
if [ -f "$TARGET_DIR/Cargo.toml" ]; then
    CARGO_NAME=$(grep '^name' "$TARGET_DIR/Cargo.toml" 2>/dev/null | head -1 | sed 's/name *= *"\(.*\)"/\1/' || echo "")
    [ -n "$CARGO_NAME" ] && PROJECT_NAME="$CARGO_NAME"
elif [ -f "$TARGET_DIR/package.json" ]; then
    PKG_NAME=$(python3 -c "import json; d=json.load(open('$TARGET_DIR/package.json')); print(d.get('name',''))" 2>/dev/null || echo "")
    [ -n "$PKG_NAME" ] && PROJECT_NAME="$PKG_NAME"
fi

# ── Copy orchestrator files ───────────────────────────────────────────────────
echo ""
echo "Copying orchestrator files..."

# Copy shell scripts
for script in io-run.sh io-gh-mirror.sh io-watchdog.sh; do
    if [ -f "$SCRIPT_DIR/$script" ]; then
        cp "$SCRIPT_DIR/$script" "$TARGET_DIR/$script"
        chmod +x "$TARGET_DIR/$script"
        echo "  ✓ $script"
    else
        echo "  ⚠ $script not found in $SCRIPT_DIR — skipping"
    fi
done

# Copy agent files
AGENTS_SRC="$SCRIPT_DIR/.claude/agents"
AGENTS_DST="$TARGET_DIR/.claude/agents"
if [ -d "$AGENTS_SRC" ]; then
    mkdir -p "$AGENTS_DST"
    cp "$AGENTS_SRC"/*.md "$AGENTS_DST/"
    echo "  ✓ .claude/agents/*.md ($(ls "$AGENTS_DST"/*.md 2>/dev/null | wc -l) files)"
else
    echo "  ⚠ .claude/agents/ not found in $SCRIPT_DIR — skipping agent files"
fi

# ── Generate config file ──────────────────────────────────────────────────────
CONFIG_FILE="$TARGET_DIR/io-orchestrator.config.json"

if [ -f "$CONFIG_FILE" ]; then
    echo ""
    echo "  io-orchestrator.config.json already exists — skipping generation."
    echo "  Delete it and re-run to regenerate."
else
    echo ""
    echo "Generating io-orchestrator.config.json..."

    # Build commands section conditionally
    FRONTEND_CMDS=""
    if [ -n "$CMD_FRONTEND_TEST" ]; then
        FRONTEND_CMDS=$(cat <<FEOF
,
    "frontend_test":  "$CMD_FRONTEND_TEST",
    "frontend_build": "$CMD_FRONTEND_BUILD",
    "frontend_check": "$CMD_FRONTEND_CHECK"
FEOF
)
    fi

    cat > "$CONFIG_FILE" << JSONEOF
{
  "schema": "io-orchestrator/v1",
  "project": {
    "name": "$PROJECT_NAME",
    "root": ".",
    "description": "TODO: describe your project"
  },
  "commands": {
    "test":  "$CMD_TEST",
    "build": "$CMD_BUILD",
    "lint":  "$CMD_LINT",
    "check": "$CMD_CHECK"$FRONTEND_CMDS
  },
  "paths": {
    "task_dir":        "docs/tasks",
    "state_dir":       "docs/state",
    "catalog_dir":     "docs/catalogs",
    "decisions_dir":   "docs/decisions",
    "uat_dir":         "docs/uat",
    "spec_docs":       "docs/spec",
    "comms_dir":       "comms",
    "registry_db":     "comms/tasks.db",
    "registry_file":   "comms/AUDIT_PROGRESS.json",
    "needs_input_dir": "comms/needs_input",
    "worktree_base":   "/tmp/io-worktrees"
  },
  "task_store": {
    "type": "sqlite",
    "path": "comms/tasks.db",
    "wal_mode": true
  },
  "agents": {
    "max_parallel":             3,
    "model_orchestrator":       "claude-opus-4-6",
    "model_worker":             "claude-sonnet-4-6",
    "stale_task_threshold_min": 30,
    "checkpoint_every":         3,
    "max_impl_attempts":        3
  },
  "never_touch": [
    ".env",
    ".env.*",
    "*.lock",
    ".git/",
    "node_modules/",
    "migrations/",
    "secrets/"
  ],
  "units": [
    {
      "id": "MOD-EXAMPLE",
      "name": "Example Module — replace with your actual units",
      "wave": 1,
      "source_paths": ["src/"],
      "spec_doc": "docs/spec/example.md"
    }
  ]
}
JSONEOF
    echo "  ✓ io-orchestrator.config.json"
fi

# ── Create required directories ───────────────────────────────────────────────
for dir in comms docs/tasks docs/state docs/catalogs docs/decisions comms/needs_input; do
    mkdir -p "$TARGET_DIR/$dir"
done
echo "  ✓ Created required directories"

# ── Print checklist ───────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "io-orchestrator installed in: $TARGET_DIR"
echo ""
echo "CHECKLIST — complete these steps before running:"
echo ""
echo "  1. Edit io-orchestrator.config.json:"
echo "     □ Replace the example unit in units[] with your actual modules"
echo "       Each unit needs: id, name, wave, source_paths, spec_doc"
echo "     □ Set paths.spec_docs to where your spec files live"
echo "     □ Verify commands.test / build / lint / check are correct"
echo "     □ Update project.description"
echo ""
echo "  2. Write spec documents for each unit:"
echo "     docs/spec/<unit-id>.md — behavioral spec the agent audits against"
echo "     (Without specs, /audit will fail — specs must be human-authored)"
echo ""
echo "  3. Initialize the task database:"
echo "     python3 comms/migrate_to_sqlite.py   # if migrating from JSON"
echo "     — OR —"
echo "     sqlite3 comms/tasks.db < comms/schema.sql  # fresh start"
echo ""
echo "  4. Run your first implement round:"
echo "     ./io-run.sh status       # check task counts"
echo "     ./io-run.sh implement 1  # run 1 parallel agent"
echo ""
echo "  Language detected: $LANG_DETECTED"
echo "════════════════════════════════════════════════════════════"
