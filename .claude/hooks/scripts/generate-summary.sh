#!/bin/bash
# generate-summary.sh — Generate a work-unit summary via claude -p
#
# Usage: generate-summary.sh LOG_PATH SESSION_ID
#
# Reads the work-unit log, invokes claude -p with a focused summary prompt,
# writes the result to .claude/summaries/

set -uo pipefail

# Auto-detect project dir from script location if not set in environment
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
    CLAUDE_PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
    export CLAUDE_PROJECT_DIR
fi

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ -f "$LIB_PATH" ]; then
    # shellcheck source=/dev/null
    source "$LIB_PATH"
fi

LOG_PATH="$1"
SESSION_ID="$2"

if [ ! -f "$LOG_PATH" ]; then
    echo "generate-summary: log not found: $LOG_PATH" >&2
    exit 1
fi

ensure_workflow_dirs

# Derive summary filename from log filename
LOG_FILENAME=$(basename "$LOG_PATH" .md)
SUMMARY_PATH="${WORKFLOW_SUMMARIES_DIR}/${LOG_FILENAME}_summary.md"

# Read the log content
LOG_CONTENT=$(cat "$LOG_PATH")

# Build the summary prompt
PROMPT=$(cat <<EOF
You are producing a work-unit summary from a Claude Code work-unit log.

Below is the log of a single work unit. It contains the initial prompt, tagged
sections showing what tools were used and what files were modified, and the
assistant's responses during the turn(s).

Produce a structured summary covering ONLY what is in the log:

1. **Work unit purpose**: 1-2 sentence statement of what this work unit was about.
   Derive from the initial prompt and the work that was done.

2. **Key decisions made**: bulleted list of significant decisions or approaches
   taken. Only include decisions that are visible in the log. Do not speculate.

3. **What was built or changed**: bulleted list of concrete outcomes — files
   modified, features implemented, bugs fixed, tests added.

4. **What was deliberately not done**: anything the log indicates was explicitly
   out of scope, deferred, or rejected. If nothing was explicitly deferred,
   omit this section.

5. **Open questions or follow-ups**: anything the log indicates needs to be
   revisited or resolved later. If none, omit this section.

6. **Files modified**: a clean list of file paths that were edited/written.

Constraints on your output:
- Be terse. Each section should be a few bullets, not paragraphs.
- Do NOT speculate about intent beyond what's in the log.
- Do NOT comment on code quality or make recommendations.
- Do NOT include preamble like "Here's the summary" — start directly with section 1.
- Output is markdown. Use ## headers for each section.

Here is the log:

---

$LOG_CONTENT

---

Produce the summary now.
EOF
)

# Invoke claude -p with timeout
SUMMARY_OUTPUT=$(claude_p_with_timeout "$PROMPT" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    # Write an error marker so we know the summary didn't complete
    cat > "$SUMMARY_PATH" <<EOF
# Summary Generation Failed

**Generated**: $(date -Iseconds)
**Log**: \`$LOG_PATH\`
**Session**: $SESSION_ID

The \`claude -p\` invocation failed with exit code $EXIT_CODE.

Output:
\`\`\`
$SUMMARY_OUTPUT
\`\`\`

This summary file is a placeholder so you know the run was attempted but
failed. Re-run manually with the /summarize slash command if desired.
EOF
    echo "generate-summary: FAILED (exit $EXIT_CODE)" >&2
    exit $EXIT_CODE
fi

# Write the summary with a header
cat > "$SUMMARY_PATH" <<EOF
# Work Unit Summary

**Generated**: $(date -Iseconds)
**Log**: \`$LOG_PATH\`
**Session**: $SESSION_ID

---

$SUMMARY_OUTPUT
EOF

echo "generate-summary: wrote $SUMMARY_PATH"
exit 0
