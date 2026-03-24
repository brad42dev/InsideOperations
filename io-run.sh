#!/bin/bash
# io-run.sh — Orchestrator runner and UAT driver
#
# Usage:
#   ./io-run.sh implement [N]      Run N implement rounds (default 5), one fresh context each
#   ./io-run.sh audit [N]          Run N audit rounds
#   ./io-run.sh full [N]           Run N full (audit+implement) rounds
#   ./io-run.sh uat [UNIT]         Automated Playwright UAT — all pending units, or one unit
#   ./io-run.sh human-uat [UNIT]   Human UAT with interactive pass/fail prompts
#   ./io-run.sh status             Show task counts and UAT coverage
#   ./io-run.sh integration-test   Run automated integration journey tests
#
# Each implement/audit round is a fresh claude session.
# Progress is saved to AUDIT_PROGRESS.json after every round.
# Ctrl+C stops cleanly between rounds.

set -euo pipefail

REPO=/home/io/io-dev/io
cd "$REPO"

MODE=${1:-implement}
ARG2=${2:-}

# ── status ────────────────────────────────────────────────────────────────────
if [ "$MODE" = "status" ]; then
    echo ""
    python3 - <<'PYEOF'
import json, subprocess, sys
from collections import defaultdict

try:
    with open("comms/AUDIT_PROGRESS.json") as f:
        data = json.load(f)
except FileNotFoundError:
    print("ERROR: comms/AUDIT_PROGRESS.json not found.")
    sys.exit(1)
except json.JSONDecodeError as e:
    print(f"ERROR: comms/AUDIT_PROGRESS.json is malformed: {e}")
    print("The file may have been partially written. Check it manually.")
    sys.exit(1)

registry = data.get("task_registry", [])
by_status = {}
for t in registry:
    s = t.get("status", "unknown")
    by_status[s] = by_status.get(s, 0) + 1

print("Task Status Summary")
print("=" * 35)
order = ["verified", "implementing", "needs_input", "pending", "failed", "escalated"]
for s in order:
    if s in by_status:
        icon = {"verified":"✅","implementing":"🔄","needs_input":"⏸ ","pending":"·","failed":"❌","escalated":"⛔"}.get(s, " ")
        print(f"  {icon} {s:20s} {by_status[s]:4d}")
other = {k:v for k,v in by_status.items() if k not in order}
for s,n in other.items():
    print(f"    {s:20s} {n:4d}")
print(f"  {'─'*26}")
print(f"    {'total':20s} {len(registry):4d}")

# UAT coverage
uat_counts = defaultdict(int)
for t in registry:
    if t.get("status") == "verified":
        uat = t.get("uat_status")
        if uat == "pass":   uat_counts["pass"] += 1
        elif uat == "fail": uat_counts["fail"] += 1
        elif uat == "partial": uat_counts["partial"] += 1
        else:               uat_counts["pending"] += 1

total_verified = sum(1 for t in registry if t.get("status") == "verified")
if total_verified > 0:
    print(f"")
    print(f"UAT Coverage ({total_verified} verified tasks)")
    print(f"  ✅ pass       {uat_counts['pass']:4d}")
    print(f"  ❌ fail       {uat_counts['fail']:4d}")
    print(f"  ~ partial     {uat_counts['partial']:4d}")
    print(f"  · not run     {uat_counts['pending']:4d}")

# Orphaned completions
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

# Needs input
import glob, os
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

    # ── ensure backend is running ─────────────────────────────────────────────
    BACKEND_STARTED=""
    DEV_SERVER_PID=""

    # Set EXIT trap now — before starting any processes — so cleanup fires even
    # if startup fails (e.g. backend timeout or frontend startup error).
    # BACKEND_STARTED and DEV_SERVER_PID must be initialized above first.
    # Use absolute path for dev.sh so cleanup works regardless of CWD at exit time.
    trap 'if [ -n "$DEV_SERVER_PID" ]; then echo "Stopping dev server..."; kill "$DEV_SERVER_PID" 2>/dev/null || true; fi; if [ -n "$BACKEND_STARTED" ]; then echo "Stopping backend services..."; "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi' EXIT

    if ! curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
        echo "Backend not detected on port 3000. Starting services via dev.sh..."
        echo "(Note: first run requires cargo build — may take several minutes)"
        "$REPO/dev.sh" start > /tmp/io-uat-backend.log 2>&1 &
        BACKEND_PID=$!
        BACKEND_STARTED=1

        # Wait up to 15 minutes for api-gateway health (first build can take 10-20 min)
        # Note: dev.sh start backgrounds services and may exit before they are up —
        # the port 3000 health check is the real gate; PID check only catches abnormal exits
        BACKEND_EXITED_EARLY=""
        for i in $(seq 1 900); do
            sleep 1
            # If dev.sh exited non-zero, fail fast (abnormal exit)
            if [ -z "$BACKEND_EXITED_EARLY" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
                wait "$BACKEND_PID" 2>/dev/null
                DEV_EXIT=$?
                if [ "$DEV_EXIT" -ne 0 ]; then
                    echo "ERROR: dev.sh start exited with code $DEV_EXIT."
                    echo "Check /tmp/io-uat-backend.log for details:"
                    tail -20 /tmp/io-uat-backend.log
                    exit 1
                fi
                # dev.sh exited 0 (normal — services backgrounded); continue polling port 3000
                BACKEND_EXITED_EARLY=1
            fi
            if curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
                echo "Backend services ready."
                break
            fi
            # Print progress every 30s
            if [ $((i % 30)) -eq 0 ]; then
                echo "  Still waiting for backend... (${i}s elapsed)"
            fi
            if [ "$i" = "900" ]; then
                echo "ERROR: Backend failed to start after 15 minutes."
                echo "Check /tmp/io-uat-backend.log for details:"
                tail -20 /tmp/io-uat-backend.log
                exit 1
            fi
        done
    else
        echo "Backend already running (port 3000)."
    fi

    # Start frontend dev server if not already running
    if ! curl -s --max-time 5 http://localhost:5173 > /dev/null 2>&1; then
        echo "Starting frontend dev server..."
        ( cd "$REPO/frontend" && exec pnpm dev ) > /tmp/io-uat-devserver.log 2>&1 &
        DEV_SERVER_PID=$!
        for i in $(seq 1 40); do
            sleep 1
            if curl -s --max-time 3 http://localhost:5173 > /dev/null 2>&1; then
                # Vite HTTP server is up but initial TS compilation takes a few more seconds
                echo "Frontend dev server responding, waiting for initial compilation..."
                sleep 4
                echo "Frontend dev server ready (port 5173)."
                break
            fi
            if [ "$i" = "40" ]; then
                echo "ERROR: Frontend dev server failed to start after 40s."
                echo "Check /tmp/io-uat-devserver.log for details."
                exit 1
            fi
        done
    else
        echo "Frontend dev server already running on port 5173."
    fi

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
        claude --dangerously-skip-permissions --agent uat-agent --print "$UAT_MODE $UNIT_ID" < /dev/null || true

        # Read verdict from result file
        RESULT_FILE="docs/uat/$UNIT_ID/CURRENT.md"
        if [ -f "$RESULT_FILE" ]; then
            VERDICT=$(grep "^verdict:" "$RESULT_FILE" 2>/dev/null | awk '{print $2}' || echo "unknown")
            case "$VERDICT" in
                pass)    PASSED=$((PASSED + 1));  echo "  ✅ $UNIT_ID — pass" ;;
                fail)    FAILED=$((FAILED + 1));  echo "  ❌ $UNIT_ID — fail (bug tasks created)" ;;
                partial) FAILED=$((FAILED + 1));  echo "  ~ $UNIT_ID — partial" ;;
                *)       SKIPPED=$((SKIPPED + 1)); echo "  — $UNIT_ID — skipped" ;;
            esac
        else
            SKIPPED=$((SKIPPED + 1))
            echo "  — $UNIT_ID — no result file written"
        fi
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

# ── integration-test mode ─────────────────────────────────────────────────────
if [ "$MODE" = "integration-test" ]; then
    # Reuse the same backend/frontend startup logic as uat mode
    BACKEND_STARTED=""
    DEV_SERVER_PID=""
    trap 'if [ -n "$DEV_SERVER_PID" ]; then kill "$DEV_SERVER_PID" 2>/dev/null || true; fi; if [ -n "$BACKEND_STARTED" ]; then "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi' EXIT

    if ! curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
        echo "Starting backend..."
        "$REPO/dev.sh" start > /tmp/io-integration-backend.log 2>&1 &
        BACKEND_PID=$!
        BACKEND_STARTED=1
        BACKEND_EXITED_EARLY=""
        for i in $(seq 1 900); do
            sleep 1
            if [ -z "$BACKEND_EXITED_EARLY" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
                wait "$BACKEND_PID" 2>/dev/null
                DEV_EXIT=$?
                if [ "$DEV_EXIT" -ne 0 ]; then
                    echo "ERROR: dev.sh start exited with code $DEV_EXIT."
                    echo "Check /tmp/io-integration-backend.log for details:"
                    tail -20 /tmp/io-integration-backend.log
                    exit 1
                fi
                BACKEND_EXITED_EARLY=1
            fi
            if curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
                echo "Backend ready."; break
            fi
            [ "$i" = "900" ] && echo "ERROR: Backend failed to start." && exit 1
        done
    fi

    if ! curl -s --max-time 5 http://localhost:5173 > /dev/null 2>&1; then
        echo "Starting frontend..."
        ( cd "$REPO/frontend" && exec pnpm dev ) > /tmp/io-integration-devserver.log 2>&1 &
        DEV_SERVER_PID=$!
        for i in $(seq 1 40); do
            sleep 1
            if curl -s --max-time 3 http://localhost:5173 > /dev/null 2>&1; then
                sleep 4; echo "Frontend ready."; break
            fi
            [ "$i" = "40" ] && echo "ERROR: Frontend failed to start." && exit 1
        done
    fi

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

COUNT=${ARG2:-5}
if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [ "$COUNT" -lt 1 ]; then
    echo "Count must be a positive integer"
    exit 1
fi

# ── trap Ctrl+C ───────────────────────────────────────────────────────────────
INTERRUPTED=0
trap 'INTERRUPTED=1; echo ""; echo "Stopping after current round..."' INT

# ── main loop ─────────────────────────────────────────────────────────────────
ROUND=0

echo ""
echo "Starting $MODE — $COUNT round(s)"
echo "Progress saved after every round. Ctrl+C stops between rounds."
echo ""

while [ $ROUND -lt $COUNT ] && [ $INTERRUPTED -eq 0 ]; do

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
    echo "─── $MODE round $ROUND of $COUNT ───────────────────────────────"

    # Run one round with fresh context
    claude --dangerously-skip-permissions --agent audit-orchestrator --print "$MODE 1" || true

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
else
    echo "All $COUNT round(s) complete."
fi
echo ""
"$0" status
echo ""
