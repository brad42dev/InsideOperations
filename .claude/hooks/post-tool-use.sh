#!/bin/bash
# post-tool-use.sh — PostToolUse hook for Edit/Write/MultiEdit
#
# Fires after file writes succeed. Responsibilities:
#   1. Append a structural-tagged entry to the current work-unit log
#      indicating which file was modified.
#
# This is the cheap, mechanical part of the verification system. The expensive
# LLM-based summary/review happens in the Stop hook, and only on [wrapup].
#
# Input (from stdin, JSON):
#   - tool_name, tool_input.{file_path, ...}, tool_response
#
# Output:
#   - exit 0 always; no decision control needed for PostToolUse

set -uo pipefail

HOOK_NAME="post-tool-use"
export HOOK_NAME

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ ! -f "$LIB_PATH" ]; then
    exit 0  # Fail silently rather than disrupt the user's session
fi
# shellcheck source=/dev/null
source "$LIB_PATH"

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')

export WORKFLOW_SESSION_ID="$SESSION_ID"
ensure_workflow_dirs

# Determine the current work-unit log
LOG_PATH=$(get_current_log_path)

# Determine the kind of change
TAG="#FILE"
case "$TOOL_NAME" in
    Write) TAG="#WRITE" ;;
    Edit) TAG="#EDIT" ;;
    MultiEdit) TAG="#MULTIEDIT" ;;
esac

# For Edit/MultiEdit, we can also note approximate change size by looking at
# the old_string/new_string lengths.
SIZE_HINT=""
case "$TOOL_NAME" in
    Edit)
        OLD_LEN=$(echo "$INPUT" | jq -r '.tool_input.old_string // "" | length')
        NEW_LEN=$(echo "$INPUT" | jq -r '.tool_input.new_string // "" | length')
        SIZE_HINT=" (${OLD_LEN}→${NEW_LEN} chars)"
        ;;
    Write)
        NEW_LEN=$(echo "$INPUT" | jq -r '.tool_input.content // "" | length')
        SIZE_HINT=" (${NEW_LEN} chars written)"
        ;;
    MultiEdit)
        EDIT_COUNT=$(echo "$INPUT" | jq -r '.tool_input.edits // [] | length')
        SIZE_HINT=" (${EDIT_COUNT} edits)"
        ;;
esac

# Append to log
{
    echo ""
    echo "## $TAG \`$FILE_PATH\`$SIZE_HINT"
    echo ""
    echo "_$(date -Iseconds)_"
    echo ""
} >> "$LOG_PATH"

hook_debug "Logged $TAG for $FILE_PATH"

exit 0
