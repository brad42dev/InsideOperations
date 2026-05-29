#!/bin/bash
# user-prompt-submit.sh — UserPromptSubmit hook
#
# Fires on every prompt submission. Responsibilities:
#   1. Detect workflow tags in the prompt
#   2. Rotate the work-unit log if this is a new work unit ([initprompt])
#   3. Record turn state so the Stop hook knows what just happened
#   4. Optionally inject context for Claude about which tags it saw
#
# Input (from stdin, JSON):
#   - session_id, transcript_path, cwd, permission_mode, prompt
#
# Output:
#   - exit 0 with no JSON: prompt proceeds normally
#   - exit 0 with hookSpecificOutput.additionalContext: prompt proceeds, context added
#   - We deliberately do NOT block prompts with this hook

set -uo pipefail

# Auto-detect project dir from script location if not set in environment
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
    CLAUDE_PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
    export CLAUDE_PROJECT_DIR
fi

HOOK_NAME="user-prompt-submit"
export HOOK_NAME

# Source the common library (path resolved via CLAUDE_PROJECT_DIR)
LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ ! -f "$LIB_PATH" ]; then
    echo "WORKFLOW HOOK FATAL: lib-common.sh not found at $LIB_PATH" >&2
    exit 1
fi
# shellcheck source=/dev/null
source "$LIB_PATH"

# Read JSON input from stdin
INPUT=$(cat)

# Extract fields
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""')
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""')

export WORKFLOW_SESSION_ID="$SESSION_ID"

# Ensure directory structure exists (idempotent)
ensure_workflow_dirs

# Clean dead or stale workflow-action lock. The lock is written as "PID:TAG:TIMESTAMP".
# Primary cleanup: if the lock-holder PID is no longer alive, the action finished
# or crashed — safe to remove immediately. Fallback: wall-clock TTL of 15 min
# covers PID reuse (rare) and any scenario where the process check fails.
WORKFLOW_LOCK="${WORKFLOW_STATE_DIR}/workflow-action.lock"
if [ -f "$WORKFLOW_LOCK" ]; then
    lock_pid=$(cut -d: -f1 < "$WORKFLOW_LOCK" 2>/dev/null || echo "")
    lock_age=$(( $(date +%s) - $(stat -c %Y "$WORKFLOW_LOCK" 2>/dev/null || echo 0) ))
    if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
        rm -f "$WORKFLOW_LOCK"
        hook_debug "Cleaned dead-process workflow-action.lock (pid=$lock_pid age=${lock_age}s)"
    elif [ "$lock_age" -gt 900 ]; then
        rm -f "$WORKFLOW_LOCK"
        hook_debug "Cleaned stale workflow-action.lock (age: ${lock_age}s)"
    fi
fi

hook_debug "session=$SESSION_ID prompt_length=${#PROMPT}"

# Classify the prompt
TAG_TYPE=$(classify_prompt_tags "$PROMPT")
hook_debug "tag_type=$TAG_TYPE"

# Rotate log if this is a new work unit
case "$TAG_TYPE" in
    init)
        # Extract a descriptor from the prompt (first 50 chars, slugified)
        # User can include something hint-y after [initprompt] to name the work unit.
        # head -1 takes only the first line so that multi-line prompts never embed
        # newlines into the log filename via slugify.
        DESCRIPTOR_TEXT=$(echo "$PROMPT" | head -1 | sed -E 's/\[initprompt\]//' | head -c 80)
        DESCRIPTOR=$(slugify "$DESCRIPTOR_TEXT")
        if [ -z "$DESCRIPTOR" ]; then
            DESCRIPTOR="work-unit"
        fi
        # Cap the descriptor length to keep filenames sane
        DESCRIPTOR=$(echo "$DESCRIPTOR" | head -c 40)
        rotate_log_to_new "$DESCRIPTOR" > /dev/null
        hook_debug "rotated log on initprompt with descriptor=$DESCRIPTOR"
        ;;
    *)
        # No rotation for other tag types; current log continues
        # If no current log exists, get_current_log_path will create one
        get_current_log_path > /dev/null
        ;;
esac

# Record turn state for the Stop hook
record_turn_state "$SESSION_ID" "$PROMPT" "$TRANSCRIPT_PATH"

# Optionally inject context for Claude about what's happening
# This is useful when a tag triggers special behavior, so Claude knows
case "$TAG_TYPE" in
    init)
        CONTEXT="A new work unit was started ([initprompt] detected). A fresh work-unit log was created. Proceed with the task as normal; the workflow infrastructure will capture the work."
        ;;
    wrapup)
        CONTEXT="A work-unit wrap-up was requested ([wrapup] detected). After this turn completes, the workflow infrastructure will automatically generate a summary, run a review of work done since the last [initprompt], and propose documentation updates. Proceed with any final steps for this work unit."
        ;;
    review)
        CONTEXT="A mid-work-unit review was requested ([review] detected). After this turn completes, the workflow infrastructure will run a review of work done since the last [initprompt] and surface any concerns. Proceed with the task; the review runs separately."
        ;;
    deepreview)
        CONTEXT="A deep review was requested ([deepreview] detected). After this turn completes, the workflow infrastructure will run an in-depth review including full file contents of changed code. Proceed with the task; the review runs separately."
        ;;
    docfresh)
        SLUG=$(extract_docfresh_slug "$PROMPT")
        CONTEXT="A targeted documentation refresh was requested ([docfresh:$SLUG] detected). After this turn completes, the workflow infrastructure will update the interim doc for '$SLUG' based on recent work. Proceed with the task."
        ;;
    *)
        # No context injection for plain prompts or phase prompts
        exit 0
        ;;
esac

# Emit context JSON
jq -nc \
    --arg ctx "$CONTEXT" \
    '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'

exit 0
