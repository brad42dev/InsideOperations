#!/bin/bash
# stop.sh — Stop hook
#
# Fires when Claude finishes responding to a turn. Responsibilities:
#   1. Extract the turn's content from the transcript into the work-unit log
#   2. If the prompt for this turn had [wrapup], trigger wrap-up sequence
#   3. If [review], trigger review only
#   4. If [deepreview], trigger deepreview
#   5. If [docfresh:slug], trigger targeted doc refresh
#   6. Clean up turn state
#
# Input (from stdin, JSON):
#   - session_id, transcript_path, hook_event_name, stop_hook_active
#
# Output:
#   - exit 0 always; we never block Claude from finishing

set -uo pipefail

# Auto-detect project dir from script location if not set in environment
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
    CLAUDE_PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
    export CLAUDE_PROJECT_DIR
fi

HOOK_NAME="stop"
export HOOK_NAME

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ ! -f "$LIB_PATH" ]; then
    echo "WORKFLOW HOOK ERROR: lib-common.sh not found at $LIB_PATH" >&2
    exit 0
fi
# shellcheck source=/dev/null
source "$LIB_PATH"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
# v2.1.143+: Stop hook input includes the final assistant turn text directly.
# Used as a fallback in extract-turn.sh when the transcript slice is empty.
LAST_ASSISTANT_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""')

export WORKFLOW_SESSION_ID="$SESSION_ID"
ensure_workflow_dirs

# Lock file used to prevent recursive action triggers from claude -p sub-sessions.
# When a review/wrapup/etc. spawns claude -p, that sub-session's Stop hook would
# re-detect tags embedded in the log content and trigger another action. The lock
# blocks that. Stale locks (older than 15 min) are cleaned up by user-prompt-submit.sh.
WORKFLOW_LOCK="${WORKFLOW_STATE_DIR}/workflow-action.lock"

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    hook_debug "stop_hook_active=true, skipping to avoid loop"
    exit 0
fi

# Read turn state recorded by UserPromptSubmit
STATE=$(read_turn_state "$SESSION_ID" 2>/dev/null) || {
    hook_debug "no turn state found for session $SESSION_ID; skipping extraction"
    exit 0
}

TAG_TYPE=$(echo "$STATE" | jq -r '.tag_type // "none"')
LOG_PATH=$(echo "$STATE" | jq -r '.log_path // ""')
ORIG_PROMPT=$(echo "$STATE" | jq -r '.prompt // ""')
TRANSCRIPT_OFFSET=$(echo "$STATE" | jq -r '.transcript_offset // 0')

hook_debug "Stop hook: tag_type=$TAG_TYPE log=$LOG_PATH"

# ============================================================================
# STEP 1: Extract turn from transcript into log
# ============================================================================

if [ -z "$LOG_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    hook_debug "Cannot extract: log=$LOG_PATH transcript=$TRANSCRIPT_PATH"
else
    EXTRACT_SCRIPT="${WORKFLOW_SCRIPTS_DIR}/extract-turn.sh"
    if [ -x "$EXTRACT_SCRIPT" ]; then
        # Write prompt and last_assistant_message to tempfiles to avoid ARG_MAX
        # when content is large (wrapup/deepreview prompts embed log content).
        PROMPT_TMP=$(mktemp)
        ASSISTANT_TMP=$(mktemp)
        printf '%s' "$ORIG_PROMPT" > "$PROMPT_TMP"
        printf '%s' "$LAST_ASSISTANT_MSG" > "$ASSISTANT_TMP"
        "$EXTRACT_SCRIPT" "$TRANSCRIPT_PATH" "$TRANSCRIPT_OFFSET" "$LOG_PATH" "$PROMPT_TMP" "$ASSISTANT_TMP" 2>>"$WORKFLOW_STATE_DIR/hook_debug.log" || {
            hook_debug "extract-turn.sh failed (exit $?)"
        }
        rm -f "$PROMPT_TMP" "$ASSISTANT_TMP"
    else
        hook_debug "extract-turn.sh not found or not executable at $EXTRACT_SCRIPT"
    fi
fi

# ============================================================================
# STEP 2: Tag-driven follow-up actions
#
# Each action case acquires the lock and releases it inside its own subshell.
# Lock acquire and release are co-located per case — adding a new tag type
# requires handling both in the same block, preventing the split-case fragility.
# ============================================================================

# Helper: acquire lock or bail. Atomic noclobber closes the TOCTOU race.
# If the lock is held, this is a claude -p sub-session re-detecting a tag
# embedded in the work-unit log content — skip to prevent recursion.
acquire_workflow_lock() {
    if ! (set -o noclobber; echo "$$:$TAG_TYPE:$(date -Iseconds)" > "$WORKFLOW_LOCK") 2>/dev/null; then
        hook_debug "workflow-action.lock held — skipping $TAG_TYPE (sub-session recursion guard)"
        clear_turn_state "$SESSION_ID"
        exit 0
    fi
}

case "$TAG_TYPE" in
    wrapup)
        acquire_workflow_lock
        # If the same prompt also contains [docfresh:slug], pass the slug to
        # update-docs.sh so the wrapup targets that specific doc rather than
        # running auto-detect. This lets multi-session work converge on one doc:
        #   session A: [wrapup]                      → auto-detect, creates doc
        #   session B: [wrapup] [docfresh:my-slug]   → full wrapup, updates my-slug
        WRAPUP_DOC_SLUG=$(extract_docfresh_slug "$ORIG_PROMPT")
        hook_debug "Triggering wrap-up sequence${WRAPUP_DOC_SLUG:+ (doc slug: $WRAPUP_DOC_SLUG)}"
        (
            "${WORKFLOW_SCRIPTS_DIR}/generate-summary.sh" "$LOG_PATH" "$SESSION_ID"
            if [ "$WORKFLOW_WRAPUP_DO_REVIEW" = "1" ]; then
                "${WORKFLOW_SCRIPTS_DIR}/run-review.sh" "$LOG_PATH" "$SESSION_ID" "shallow"
            fi
            # TEMPORARILY DISABLED during indexing-system rollout — re-enable after prompt 6 smoke test confirms matcher behavior
            # if [ "$WORKFLOW_WRAPUP_DO_DOCS" = "1" ]; then
            #     if [ -n "$WRAPUP_DOC_SLUG" ]; then
            #         "${WORKFLOW_SCRIPTS_DIR}/update-docs.sh" "$LOG_PATH" "$SESSION_ID" "$WRAPUP_DOC_SLUG"
            #     else
            #         "${WORKFLOW_SCRIPTS_DIR}/update-docs.sh" "$LOG_PATH" "$SESSION_ID"
            #     fi
            # fi
            rm -f "$WORKFLOW_LOCK"
        ) >> "$WORKFLOW_STATE_DIR/wrapup.log" 2>&1 &
        hook_debug "wrap-up started in background, pid=$!"
        ;;

    review)
        acquire_workflow_lock
        hook_debug "Triggering shallow review"
        (
            "${WORKFLOW_SCRIPTS_DIR}/run-review.sh" "$LOG_PATH" "$SESSION_ID" "shallow"
            rm -f "$WORKFLOW_LOCK"
        ) >> "$WORKFLOW_STATE_DIR/review.log" 2>&1 &
        hook_debug "review started in background, pid=$!"
        ;;

    deepreview)
        acquire_workflow_lock
        hook_debug "Triggering deep review"
        (
            "${WORKFLOW_SCRIPTS_DIR}/run-review.sh" "$LOG_PATH" "$SESSION_ID" "deep"
            rm -f "$WORKFLOW_LOCK"
        ) >> "$WORKFLOW_STATE_DIR/review.log" 2>&1 &
        hook_debug "deep review started in background, pid=$!"
        ;;

    docfresh)
        acquire_workflow_lock
        SLUG=$(extract_docfresh_slug "$ORIG_PROMPT")
        hook_debug "Triggering docfresh for slug=$SLUG"
        (
            # TEMPORARILY DISABLED during indexing-system rollout — re-enable after prompt 6 smoke test confirms matcher behavior
            # "${WORKFLOW_SCRIPTS_DIR}/update-docs.sh" "$LOG_PATH" "$SESSION_ID" "$SLUG"
            rm -f "$WORKFLOW_LOCK"
        ) >> "$WORKFLOW_STATE_DIR/docfresh.log" 2>&1 &
        hook_debug "docfresh started in background, pid=$!"
        ;;

    *)
        # No follow-up actions for plain prompts, initprompt, or phaseprompt
        ;;
esac

# ============================================================================
# STEP 3: Clean up turn state
# ============================================================================

clear_turn_state "$SESSION_ID"

exit 0
