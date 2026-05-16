#!/bin/bash
# extract-turn.sh — Pull a single turn out of the transcript JSONL into the
# work-unit log with structural tags.
#
# Usage: extract-turn.sh TRANSCRIPT_PATH START_OFFSET LOG_PATH PROMPT_TMPFILE
#
# Reads entries from TRANSCRIPT_PATH starting at byte offset START_OFFSET,
# parses each JSONL line, filters and tags them, and appends to LOG_PATH.
#
# This is the "extraction" we discussed — converts noisy transcript into
# clean tagged log entries. Structural tags only (no LLM analysis).

set -uo pipefail

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ -f "$LIB_PATH" ]; then
    # shellcheck source=/dev/null
    source "$LIB_PATH"
fi

TRANSCRIPT_PATH="$1"
START_OFFSET="$2"
LOG_PATH="$3"
ORIG_PROMPT=$(cat "$4")         # $4 is a tempfile path written by stop.sh to avoid ARG_MAX
LAST_ASSISTANT_MSG=$(cat "$5" 2>/dev/null || echo "")  # $5 is last_assistant_message from Stop hook input (v2.1.143+)

# Sanitize workflow tags so they don't re-trigger hooks when log content is
# embedded verbatim in claude -p review/summary prompts. Converts [tag] to
# ~tag~ — still readable in the log, but won't match tag detection patterns.
sanitize_tags() {
    sed -E 's/\[(initprompt|phaseprompt|wrapup|review|deepreview|docfresh:[a-z0-9-]+)\]/~\1~/g'
}

if [ ! -f "$TRANSCRIPT_PATH" ]; then
    echo "extract-turn: transcript not found: $TRANSCRIPT_PATH" >&2
    exit 1
fi

if [ ! -f "$LOG_PATH" ]; then
    echo "extract-turn: log file not found: $LOG_PATH" >&2
    exit 1
fi

# Read the transcript content starting at START_OFFSET
# Use tail -c to skip to the byte offset
TRANSCRIPT_SLICE=$(tail -c +"$((START_OFFSET + 1))" "$TRANSCRIPT_PATH" 2>/dev/null)

if [ -z "$TRANSCRIPT_SLICE" ]; then
    # Nothing new in transcript. Two possible reasons:
    # 1. Timing: Stop hook fired before the assistant entry was flushed to JSONL.
    # 2. The turn had no new content (e.g. sub-session with an empty response).
    # Use last_assistant_message from the hook input (v2.1.143+) as a fallback
    # for case 1. If that's also empty, record a stub so the log stays parseable.
    {
        echo ""
        echo "## #PROMPT"
        echo ""
        echo "_$(date -Iseconds)_"
        echo ""
        echo "\`\`\`"
        echo "$ORIG_PROMPT" | sanitize_tags
        echo "\`\`\`"
        echo ""
        if [ -n "$LAST_ASSISTANT_MSG" ]; then
            echo "## #ASSISTANT"
            echo ""
            echo "$LAST_ASSISTANT_MSG" | sanitize_tags
            echo ""
        else
            echo "_(No new transcript entries since prompt submission)_"
            echo ""
        fi
        echo "## #TURN_END"
        echo ""
        echo "_$(date -Iseconds)_"
        echo ""
        echo "---"
        echo ""
    } >> "$LOG_PATH"
    exit 0
fi

# ============================================================================
# Parse JSONL entries and append structural-tagged entries to the log
# ============================================================================

# Append the prompt header
{
    echo ""
    echo "## #PROMPT"
    echo ""
    echo "_$(date -Iseconds)_"
    echo ""
    echo "\`\`\`"
    echo "$ORIG_PROMPT" | sanitize_tags
    echo "\`\`\`"
    echo ""
} >> "$LOG_PATH"

# Process each line of the transcript slice. Each line is a JSON object.
# We're looking for specific entry types and extracting useful content.
#
# The transcript JSONL format from Claude Code contains entries like:
#   { "type": "user", "message": {...} }
#   { "type": "assistant", "message": { "content": [...] } }
#   where content items have types: text, tool_use, tool_result, thinking
#
# We extract:
#   - assistant text → #ASSISTANT
#   - tool_use (Bash) → #BASH
#   - tool_use (Edit/Write/MultiEdit) → already covered by PostToolUse hook
#   - tool_use (Grep) → #GREP
#   - tool_use (Glob) → #GLOB
#   - tool_use (Read) → skipped (too noisy)
#   - tool_use (TodoWrite) → #TODO
#   - tool_use (Task) → #TASK
#   - tool_use (WebSearch/WebFetch) → #WEB
#   - tool_result with is_error=true → #ERROR
#
# We deliberately skip routine tool calls that don't add information.

echo "$TRANSCRIPT_SLICE" | while IFS= read -r line; do
    # Skip empty lines
    if [ -z "$line" ]; then continue; fi

    # Skip lines that aren't valid JSON
    if ! echo "$line" | jq empty 2>/dev/null; then continue; fi

    ENTRY_TYPE=$(echo "$line" | jq -r '.type // ""')

    case "$ENTRY_TYPE" in
        assistant)
            # Extract content items from the assistant message
            # Iterate through .message.content array
            CONTENT_ITEMS=$(echo "$line" | jq -c '.message.content // [] | .[]' 2>/dev/null)

            echo "$CONTENT_ITEMS" | while IFS= read -r item; do
                if [ -z "$item" ]; then continue; fi
                ITEM_TYPE=$(echo "$item" | jq -r '.type // ""')

                case "$ITEM_TYPE" in
                    text)
                        TEXT=$(echo "$item" | jq -r '.text // ""')
                        if [ -n "$TEXT" ]; then
                            {
                                echo ""
                                echo "## #ASSISTANT"
                                echo ""
                                echo "$TEXT" | sanitize_tags
                                echo ""
                            } >> "$LOG_PATH"
                        fi
                        ;;
                    tool_use)
                        TOOL_NAME=$(echo "$item" | jq -r '.name // ""')
                        case "$TOOL_NAME" in
                            Bash)
                                CMD=$(echo "$item" | jq -r '.input.command // ""')
                                DESC=$(echo "$item" | jq -r '.input.description // ""')
                                {
                                    echo ""
                                    echo "## #BASH"
                                    [ -n "$DESC" ] && echo "_${DESC}_"
                                    echo ""
                                    echo "\`\`\`bash"
                                    echo "$CMD"
                                    echo "\`\`\`"
                                    echo ""
                                } >> "$LOG_PATH"
                                ;;
                            Grep)
                                PATTERN=$(echo "$item" | jq -r '.input.pattern // ""')
                                PATH_ARG=$(echo "$item" | jq -r '.input.path // ""')
                                {
                                    echo ""
                                    echo "## #GREP \`$PATTERN\` in \`$PATH_ARG\`"
                                    echo ""
                                } >> "$LOG_PATH"
                                ;;
                            Glob)
                                PATTERN=$(echo "$item" | jq -r '.input.pattern // ""')
                                {
                                    echo ""
                                    echo "## #GLOB \`$PATTERN\`"
                                    echo ""
                                } >> "$LOG_PATH"
                                ;;
                            TodoWrite)
                                {
                                    echo ""
                                    echo "## #TODO Todo list updated"
                                    echo ""
                                } >> "$LOG_PATH"
                                ;;
                            Task|Agent)
                                SUBAGENT=$(echo "$item" | jq -r '.input.subagent_type // .input.description // ""')
                                {
                                    echo ""
                                    echo "## #TASK Subagent: $SUBAGENT"
                                    echo ""
                                } >> "$LOG_PATH"
                                ;;
                            WebSearch|WebFetch)
                                QUERY=$(echo "$item" | jq -r '.input.query // .input.url // ""')
                                {
                                    echo ""
                                    echo "## #WEB $TOOL_NAME: $QUERY"
                                    echo ""
                                } >> "$LOG_PATH"
                                ;;
                            # Edit, Write, MultiEdit are logged by post-tool-use.sh
                            # Read is intentionally skipped as too noisy
                            *) ;;
                        esac
                        ;;
                    tool_result)
                        IS_ERROR=$(echo "$item" | jq -r '.is_error // false')
                        if [ "$IS_ERROR" = "true" ]; then
                            ERR_CONTENT=$(echo "$item" | jq -r '.content // "" | if type == "string" then . else (tostring) end')
                            # Truncate very long errors
                            ERR_CONTENT=$(echo "$ERR_CONTENT" | head -c 2000)
                            {
                                echo ""
                                echo "## #ERROR"
                                echo ""
                                echo "\`\`\`"
                                echo "$ERR_CONTENT"
                                echo "\`\`\`"
                                echo ""
                            } >> "$LOG_PATH"
                        fi
                        ;;
                    thinking)
                        # Skip thinking blocks — too verbose, not load-bearing for review
                        ;;
                esac
            done
            ;;
        user)
            # The user message is already captured at the top (#PROMPT).
            # Skip subsequent user messages (these are typically tool results being
            # threaded back to the model, not new user input).
            ;;
        system)
            # Skip system messages
            ;;
    esac
done

# Append a turn-end marker
{
    echo ""
    echo "## #TURN_END"
    echo ""
    echo "_$(date -Iseconds)_"
    echo ""
    echo "---"
    echo ""
} >> "$LOG_PATH"

exit 0
