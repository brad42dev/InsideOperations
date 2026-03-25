#!/bin/bash
# io-gh-mirror.sh — Mirror task status to GitHub Issues (best-effort, display-only).
#
# SQLite is authoritative. GitHub Issues are a human-visible mirror only.
# Agents never read from GitHub — they only write completion summaries as comments.
#
# Usage:
#   ./io-gh-mirror.sh mirror <task_id> <status> [notes]
#       Post a status-update comment to the issue labelled id:<task_id>.
#       No-op if gh is not installed, GH_MIRROR != 1, or no matching issue.
#       Valid statuses: implementing, verified, failed
#
#   ./io-gh-mirror.sh bulk-create
#       Create one GitHub issue per pending/failed task in SQLite.
#       Adds labels: io-task, id:<task_id>, status:<status>, wave:<N>.
#       Skips tasks that already have a matching issue.
#
# Environment:
#   GH_MIRROR=1   Enable mirroring (default: 0 — disabled)
#
# Designed to be called from io-run.sh. All errors are soft — never breaks the
# orchestrator. Runs are idempotent: re-running bulk-create skips existing issues.

set -euo pipefail

REPO="$(git -C "$(cd "$(dirname "$0")" && pwd)" rev-parse --show-toplevel 2>/dev/null || echo "/home/io/io-dev/io")"
if [ -f "$REPO/io-orchestrator.config.json" ]; then
    _db=$(python3 -c "
import json
c = json.load(open('$REPO/io-orchestrator.config.json'))
p = c.get('paths', {}); ts = c.get('task_store', {})
print(p.get('registry_db') or ts.get('path') or 'comms/tasks.db')
" 2>/dev/null || echo "comms/tasks.db")
    DB_FILE="$REPO/$_db"
else
    DB_FILE="$REPO/comms/tasks.db"
fi

SUBCMD="${1:-}"

# ── mirror ────────────────────────────────────────────────────────────────────
if [ "$SUBCMD" = "mirror" ]; then
    TASK_ID="${2:-}"
    STATUS="${3:-}"
    NOTES="${4:-}"

    # Disabled unless explicitly opted in
    if [ "${GH_MIRROR:-0}" != "1" ]; then
        exit 0
    fi

    if ! command -v gh > /dev/null 2>&1; then
        echo "io-gh-mirror: gh not installed — skipping mirror for ${TASK_ID}" >&2
        exit 0
    fi

    if [ -z "$TASK_ID" ] || [ -z "$STATUS" ]; then
        echo "Usage: io-gh-mirror.sh mirror <task_id> <status> [notes]" >&2
        exit 1
    fi

    # Find issue number by label id:<task_id>
    ISSUE_NUMBER=$(gh issue list --label "id:${TASK_ID}" --json number --jq '.[0].number' 2>/dev/null || echo "")
    if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" = "null" ]; then
        exit 0  # No mirror issue — skip silently
    fi

    TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Post comment
    if [ -n "$NOTES" ]; then
        COMMENT_BODY="**${STATUS}** — ${TS}

${NOTES}"
    else
        COMMENT_BODY="**${STATUS}** — ${TS}"
    fi
    gh issue comment "$ISSUE_NUMBER" --body "$COMMENT_BODY" 2>/dev/null || true

    # Adjust labels and state
    case "$STATUS" in
        verified)
            gh issue edit "$ISSUE_NUMBER" \
                --remove-label "status:implementing" \
                --add-label "status:verified" \
                2>/dev/null || true
            gh issue close "$ISSUE_NUMBER" 2>/dev/null || true
            ;;
        failed)
            gh issue edit "$ISSUE_NUMBER" \
                --remove-label "status:implementing" \
                --add-label "status:failed" \
                2>/dev/null || true
            ;;
        implementing)
            gh issue edit "$ISSUE_NUMBER" \
                --remove-label "status:pending" \
                --add-label "status:implementing" \
                2>/dev/null || true
            ;;
    esac

    exit 0
fi

# ── bulk-create ───────────────────────────────────────────────────────────────
if [ "$SUBCMD" = "bulk-create" ]; then
    if ! command -v gh > /dev/null 2>&1; then
        echo "io-gh-mirror: gh not installed — cannot bulk-create issues" >&2
        exit 1
    fi

    if [ ! -f "$DB_FILE" ]; then
        echo "io-gh-mirror: $DB_FILE not found — run comms/migrate_to_sqlite.py first" >&2
        exit 1
    fi

    echo "Ensuring base labels exist..."
    for label in "io-task" "status:pending" "status:implementing" "status:verified" "status:failed"; do
        gh label create "$label" --color "0075ca" --force 2>/dev/null || true
    done

    python3 - "$DB_FILE" <<'PYEOF'
import sys, sqlite3, subprocess, json

db_path = sys.argv[1]
con = sqlite3.connect(db_path)
rows = con.execute("""
    SELECT id, unit, wave, title, status, priority
    FROM io_tasks
    WHERE status IN ('pending', 'failed')
    ORDER BY wave ASC, id ASC
""").fetchall()
con.close()

created = 0
skipped = 0
errors  = 0

for task_id, unit, wave, title, status, priority in rows:
    # Check if issue already exists with this task ID label
    result = subprocess.run(
        ["gh", "issue", "list",
         "--label", f"id:{task_id}",
         "--json", "number",
         "--jq", ".[0].number"],
        capture_output=True, text=True
    )
    existing = result.stdout.strip()
    if existing and existing != "null":
        skipped += 1
        continue

    # Ensure wave label exists
    wave_label = f"wave:{wave}" if wave is not None else "wave:unknown"
    subprocess.run(
        ["gh", "label", "create", wave_label, "--color", "e4e669", "--force"],
        capture_output=True
    )
    # Ensure id label exists (may be long, keep under 50 chars)
    id_label = f"id:{task_id}"
    subprocess.run(
        ["gh", "label", "create", id_label, "--color", "d4c5f9", "--force"],
        capture_output=True
    )

    labels = ["io-task", id_label, f"status:{status}", wave_label]
    body = (
        f"**Unit:** {unit}  \n"
        f"**Wave:** {wave}  \n"
        f"**Priority:** {priority}  \n"
        f"**Task ID:** `{task_id}`\n"
    )

    label_args = []
    for lbl in labels:
        label_args += ["--label", lbl]

    r = subprocess.run(
        ["gh", "issue", "create",
         "--title", title,
         "--body", body] + label_args,
        capture_output=True, text=True
    )
    if r.returncode == 0:
        url = r.stdout.strip()
        print(f"  ✅ {task_id} — {title[:55]}  {url}")
        created += 1
    else:
        print(f"  ❌ {task_id} — {r.stderr.strip()[:80]}")
        errors += 1

print(f"\nDone: {created} created, {skipped} already existed, {errors} error(s)")
import sys as _sys
_sys.exit(1 if errors > 0 else 0)
PYEOF
fi

# ── usage ─────────────────────────────────────────────────────────────────────
echo "Usage:"
echo "  $0 mirror <task_id> <status> [notes]   Post status update to matching GitHub issue"
echo "  $0 bulk-create                          Create issues for all pending/failed tasks"
echo ""
echo "  GH_MIRROR=1 is required for 'mirror' to do anything (default: disabled)"
exit 1
