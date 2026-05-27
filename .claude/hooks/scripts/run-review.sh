#!/bin/bash
# run-review.sh — Run a verification review via claude -p
#
# Usage: run-review.sh LOG_PATH SESSION_ID DEPTH
#   DEPTH: "shallow" or "deep"
#
# Shallow: reads the work-unit log + git diff, asks for verification.
# Deep: reads the work-unit log + full file contents of changed files,
#       asks for verification including surrounding code concerns.

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
DEPTH="${3:-shallow}"

if [ ! -f "$LOG_PATH" ]; then
    echo "run-review: log not found: $LOG_PATH" >&2
    exit 1
fi

ensure_workflow_dirs

LOG_FILENAME=$(basename "$LOG_PATH" .md)
REVIEW_PATH="${WORKFLOW_REVIEWS_DIR}/${LOG_FILENAME}_review_${DEPTH}_$(date +%H%M%S).md"

LOG_CONTENT=$(cat "$LOG_PATH")

# Try to find the corresponding summary if one exists (wrap-up generates it first)
SUMMARY_PATH="${WORKFLOW_SUMMARIES_DIR}/${LOG_FILENAME}_summary.md"
SUMMARY_CONTENT=""
if [ -f "$SUMMARY_PATH" ]; then
    SUMMARY_CONTENT="$(cat "$SUMMARY_PATH")"
fi

# Get a list of files modified in this work unit by scanning the log
# Look for #WRITE, #EDIT, #MULTIEDIT entries
FILES_MODIFIED=$(grep -oE '#(WRITE|EDIT|MULTIEDIT) `[^`]+`' "$LOG_PATH" | grep -oE '`[^`]+`' | tr -d '`' | sort -u)

# Build diff information
DIFF_CONTENT=""
FILE_CONTENTS=""

if [ -n "$FILES_MODIFIED" ]; then
    # Try to get a git diff scoped to these files (best effort)
    if cd "$CLAUDE_PROJECT_DIR" 2>/dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
        # Filter to files that exist and are tracked
        EXISTING_FILES=""
        while IFS= read -r f; do
            if [ -f "$f" ]; then
                EXISTING_FILES="$EXISTING_FILES $f"
            fi
        done <<< "$FILES_MODIFIED"

        if [ -n "$EXISTING_FILES" ]; then
            # shellcheck disable=SC2086
            DIFF_CONTENT=$(git diff HEAD -- $EXISTING_FILES 2>/dev/null | head -c 50000)

            # For deep review, also include full file contents (truncated)
            if [ "$DEPTH" = "deep" ]; then
                FILE_CONTENTS=""
                # shellcheck disable=SC2086
                for f in $EXISTING_FILES; do
                    FILE_CONTENTS+="
--- File: $f ---
$(head -c 30000 "$f")
"
                done
            fi
        fi
    fi
fi

# Build the review prompt based on depth
if [ "$DEPTH" = "deep" ]; then
    PROMPT=$(cat <<EOF
You are performing a DEEP verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt and any work-unit
summary) against what was actually built (the diff and the surrounding code).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff has integration concerns with surrounding code that aren't addressed
- The diff appears to invert architectural decisions (e.g., the prompt asked
  to move from X to Y, but the diff actually reinforces X)

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items with:
- What the concern is
- Specifically where in the code (file and line)
- Why this might be a divergence from intent

If no concerns, write "No concerns identified."

## Verification Notes
Anything else useful to know about what was built.

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate about things outside the diff. Stay grounded in what's there.

WORK UNIT LOG:
---
$LOG_CONTENT
---

${SUMMARY_CONTENT:+WORK UNIT SUMMARY:
---
$SUMMARY_CONTENT
---
}

DIFF OF CHANGES:
---
$DIFF_CONTENT
---

FULL FILE CONTENTS (for surrounding-code analysis):
---
$FILE_CONTENTS
---

Produce the review now.
EOF
)
else
    PROMPT=$(cat <<EOF
You are performing a SHALLOW verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt) against what was
actually built (the diff).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff appears to invert architectural decisions

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items. If none: "No concerns identified."

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate beyond what's in the log and diff.

WORK UNIT LOG:
---
$LOG_CONTENT
---

${SUMMARY_CONTENT:+WORK UNIT SUMMARY:
---
$SUMMARY_CONTENT
---
}

DIFF OF CHANGES:
---
$DIFF_CONTENT
---

Produce the review now.
EOF
)
fi

# Invoke claude -p
REVIEW_OUTPUT=$(claude_p_with_timeout "$PROMPT" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    cat > "$REVIEW_PATH" <<EOF
# Review Failed ($DEPTH)

**Generated**: $(date -Iseconds)
**Log**: \`$LOG_PATH\`
**Session**: $SESSION_ID

The \`claude -p\` invocation failed with exit code $EXIT_CODE.

Output:
\`\`\`
$REVIEW_OUTPUT
\`\`\`
EOF
    echo "run-review: FAILED (exit $EXIT_CODE)" >&2
    exit $EXIT_CODE
fi

cat > "$REVIEW_PATH" <<EOF
# Review ($DEPTH)

**Generated**: $(date -Iseconds)
**Log**: \`$LOG_PATH\`
**Session**: $SESSION_ID
**Depth**: $DEPTH

---

$REVIEW_OUTPUT
EOF

echo "run-review: wrote $REVIEW_PATH"
exit 0
