#!/bin/bash
# io-run.sh — Orchestrator runner with fresh context per task/unit
#
# Usage:
#   ./io-run.sh implement [N]     Run N implement rounds (default 5), one fresh context each
#   ./io-run.sh audit [N]         Run N audit rounds
#   ./io-run.sh full [N]          Run N full (audit+implement) rounds
#   ./io-run.sh status            Show current task counts from AUDIT_PROGRESS.json
#
# Each round is a fresh claude session. Progress is saved to AUDIT_PROGRESS.json
# after every round. Ctrl+C stops cleanly between rounds.

set -euo pipefail

REPO=/home/io/io-dev/io
cd "$REPO"

MODE=${1:-implement}
COUNT=${2:-5}

# ── status ────────────────────────────────────────────────────────────────────
if [ "$MODE" = "status" ]; then
    echo ""
    python3 - <<'PYEOF'
import json, subprocess, sys

with open("comms/AUDIT_PROGRESS.json") as f:
    data = json.load(f)

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
import glob
ni = glob.glob("comms/needs_input/*.md")
if ni:
    print(f"")
    print(f"  ⏸  {len(ni)} task(s) awaiting your answers:")
    for f in ni:
        print(f"       {f}")
    print(f"     Run: claude --agent audit-orchestrator  (will auto-enter review_input)")
PYEOF
    echo ""
    exit 0
fi

# ── validate mode ─────────────────────────────────────────────────────────────
if [[ "$MODE" != "implement" && "$MODE" != "audit" && "$MODE" != "full" ]]; then
    echo "Usage: $0 [implement|audit|full|status] [count]"
    exit 1
fi

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [ "$COUNT" -lt 1 ]; then
    echo "Count must be a positive integer"
    exit 1
fi

# ── trap Ctrl+C ───────────────────────────────────────────────────────────────
INTERRUPTED=0
trap 'INTERRUPTED=1; echo ""; echo "Stopping after current round..."' INT

# ── main loop ─────────────────────────────────────────────────────────────────
ROUND=0
VERIFIED_THIS_RUN=0
DEFERRED_THIS_RUN=0

echo ""
echo "Starting $MODE — $COUNT round(s)"
echo "Progress saved after every round. Ctrl+C stops between rounds."
echo ""

while [ $ROUND -lt $COUNT ] && [ $INTERRUPTED -eq 0 ]; do
    ROUND=$((ROUND + 1))
    echo "─── $MODE round $ROUND of $COUNT ───────────────────────────────"

    # Run one round with fresh context
    claude --dangerously-skip-permissions --agent audit-orchestrator --print "$MODE 1" || true

    # Check for new needs_input files
    NI_COUNT=$(find comms/needs_input -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$NI_COUNT" -gt 0 ]; then
        DEFERRED_THIS_RUN=$((DEFERRED_THIS_RUN + NI_COUNT))
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
