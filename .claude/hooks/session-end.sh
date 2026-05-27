#!/bin/bash
# session-end.sh — SessionEnd hook
#
# Fires when a Claude Code session terminates. Responsibilities:
#   1. Archive the full transcript JSONL to .claude/archive/
#      (Claude Code's own transcripts get cleaned up after 30 days by default;
#       archiving preserves them indefinitely)
#
# Input (from stdin, JSON):
#   - session_id, transcript_path, reason
#
# Output:
#   - exit 0 always; SessionEnd cannot block

set -uo pipefail

HOOK_NAME="session-end"
export HOOK_NAME

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ ! -f "$LIB_PATH" ]; then
    exit 0
fi
# shellcheck source=/dev/null
source "$LIB_PATH"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""')
REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"')

ensure_workflow_dirs

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    hook_debug "No transcript to archive (path=$TRANSCRIPT_PATH)"
    exit 0
fi

# Archive with a name that includes session ID and timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SHORT_SID=$(short_session_id "$SESSION_ID")
ARCHIVE_PATH="${WORKFLOW_ARCHIVE_DIR}/session_${TIMESTAMP}_${SHORT_SID}_${REASON}.jsonl"

if cp "$TRANSCRIPT_PATH" "$ARCHIVE_PATH" 2>/dev/null; then
    hook_debug "Archived transcript to $ARCHIVE_PATH"
else
    hook_debug "Failed to archive transcript from $TRANSCRIPT_PATH to $ARCHIVE_PATH"
fi

# Optionally clean up old turn state files for this session (none should remain
# if Stop hook ran, but defensive)
rm -f "$WORKFLOW_STATE_DIR/current_turn_${SESSION_ID}.json"

exit 0
