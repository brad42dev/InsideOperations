#!/bin/bash
# lib-common.sh — shared helpers for the workflow suite
# Sourced by other scripts. Do not execute directly.

# ============================================================================
# CONFIGURATION
# ============================================================================

export WORKFLOW_LOGS_DIR="${CLAUDE_PROJECT_DIR}/.claude/logs"
export WORKFLOW_STATE_DIR="${CLAUDE_PROJECT_DIR}/.claude/state"
export WORKFLOW_SUMMARIES_DIR="${CLAUDE_PROJECT_DIR}/.claude/summaries"
export WORKFLOW_ARCHIVE_DIR="${CLAUDE_PROJECT_DIR}/.claude/archive"
export WORKFLOW_REVIEWS_DIR="${CLAUDE_PROJECT_DIR}/.claude/reviews"
export WORKFLOW_INTERIM_DOCS_DIR="${CLAUDE_PROJECT_DIR}/.claude/docs/interim"
export WORKFLOW_SCRIPTS_DIR="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts"

export WORKFLOW_WRAPUP_DO_SUMMARY="${WORKFLOW_WRAPUP_DO_SUMMARY:-1}"
export WORKFLOW_WRAPUP_DO_REVIEW="${WORKFLOW_WRAPUP_DO_REVIEW:-1}"
export WORKFLOW_WRAPUP_DO_DOCS="${WORKFLOW_WRAPUP_DO_DOCS:-1}"

export WORKFLOW_CLAUDE_P_TIMEOUT="${WORKFLOW_CLAUDE_P_TIMEOUT:-180}"

export WORKFLOW_TAGS_INIT='\[initprompt(:[^]]*)?\]'
export WORKFLOW_TAGS_PHASE='\[phaseprompt\]'
export WORKFLOW_TAGS_WRAPUP='\[wrapup\]'
export WORKFLOW_TAGS_REVIEW='\[review\]'
export WORKFLOW_TAGS_DEEPREVIEW='\[deepreview\]'
export WORKFLOW_TAGS_DOCFRESH='\[docfresh:[a-z0-9-]+\]'

# Idle rotation: rotate log after 4 hours of inactivity, but only if the
# current log has content. Empty logs are reused to avoid accumulating stubs.
export WORKFLOW_IDLE_ROTATE_SECONDS="${WORKFLOW_IDLE_ROTATE_SECONDS:-14400}"

# ============================================================================
# DIRECTORY SETUP
# ============================================================================

ensure_workflow_dirs() {
    mkdir -p "$WORKFLOW_LOGS_DIR" \
             "$WORKFLOW_STATE_DIR" \
             "$WORKFLOW_SUMMARIES_DIR" \
             "$WORKFLOW_ARCHIVE_DIR" \
             "$WORKFLOW_REVIEWS_DIR" \
             "$WORKFLOW_INTERIM_DOCS_DIR"
}

# ============================================================================
# LOGGING & ERROR HANDLING
# ============================================================================

hook_debug() {
    local msg="$1"
    local hook_name="${HOOK_NAME:-unknown}"
    echo "$(date -Iseconds) [$hook_name] $msg" >> "$WORKFLOW_STATE_DIR/hook_debug.log" 2>/dev/null || true
}

hook_error_to_claude() {
    local context="$1"
    local detail="$2"
    jq -nc \
        --arg event "${CLAUDE_HOOK_EVENT_NAME:-Unknown}" \
        --arg ctx "WORKFLOW HOOK ERROR [$context]: $detail" \
        '{hookSpecificOutput: {hookEventName: $event, additionalContext: $ctx}}'
}

hook_fatal() {
    local msg="$1"
    echo "WORKFLOW HOOK FATAL: $msg" >&2
    exit 1
}

# ============================================================================
# TAG DETECTION
# ============================================================================

prompt_has_tag() {
    local prompt="$1"
    local tag_pattern="$2"
    echo "$prompt" | grep -qE "$tag_pattern"
}

extract_docfresh_slug() {
    local prompt="$1"
    echo "$prompt" | grep -oE '\[docfresh:[a-z0-9-]+\]' | head -1 | sed 's/\[docfresh://;s/\]//'
}

classify_prompt_tags() {
    local prompt="$1"
    if prompt_has_tag "$prompt" "$WORKFLOW_TAGS_WRAPUP"; then echo "wrapup"; return; fi
    if prompt_has_tag "$prompt" "$WORKFLOW_TAGS_DEEPREVIEW"; then echo "deepreview"; return; fi
    if prompt_has_tag "$prompt" "$WORKFLOW_TAGS_REVIEW"; then echo "review"; return; fi
    if prompt_has_tag "$prompt" "$WORKFLOW_TAGS_DOCFRESH"; then echo "docfresh"; return; fi
    if prompt_has_tag "$prompt" "$WORKFLOW_TAGS_INIT"; then echo "init"; return; fi
    if prompt_has_tag "$prompt" "$WORKFLOW_TAGS_PHASE"; then echo "phase"; return; fi
    echo "none"
}

# ============================================================================
# WORK-UNIT LOG MANAGEMENT
# ============================================================================

get_current_log_path() {
    local state_file="$WORKFLOW_STATE_DIR/current_log.txt"

    if [ -f "$state_file" ]; then
        local current_log
        current_log=$(cat "$state_file")
        if [ -f "$current_log" ] && [ "$WORKFLOW_IDLE_ROTATE_SECONDS" -gt 0 ]; then
            local now last_mod
            now=$(date +%s)
            last_mod=$(stat -c %Y "$current_log" 2>/dev/null || echo 0)
            local idle=$((now - last_mod))
            if [ "$idle" -lt "$WORKFLOW_IDLE_ROTATE_SECONDS" ]; then
                echo "$current_log"
                return
            fi
            # Idle threshold exceeded. Only rotate if the log has actual content
            # (at least one ## # section marker). Empty logs are reused rather
            # than accumulating stubs.
            if ! grep -q '^## #' "$current_log" 2>/dev/null; then
                echo "$current_log"
                return
            fi
        elif [ -f "$current_log" ]; then
            echo "$current_log"
            return
        fi
    fi

    rotate_log_to_new "general"
}

rotate_log_to_new() {
    local descriptor="${1:-general}"
    local date_str
    date_str=$(date +%Y-%m-%d)
    local timestamp
    timestamp=$(date +%H%M%S)
    local new_log="$WORKFLOW_LOGS_DIR/${date_str}_${descriptor}_${timestamp}.md"

    cat > "$new_log" <<EOF
# Work Unit Log: $descriptor

Started: $(date -Iseconds)
Session: ${WORKFLOW_SESSION_ID:-unknown}

---

EOF

    echo "$new_log" > "$WORKFLOW_STATE_DIR/current_log.txt"
    hook_debug "Rotated to new log: $new_log"
    echo "$new_log"
}

# ============================================================================
# TURN STATE MANAGEMENT
# ============================================================================

record_turn_state() {
    local session_id="$1"
    local prompt="$2"
    local transcript_path="$3"

    local state_file="$WORKFLOW_STATE_DIR/current_turn_${session_id}.json"

    local transcript_offset=0
    if [ -f "$transcript_path" ]; then
        transcript_offset=$(stat -c %s "$transcript_path" 2>/dev/null || echo 0)
    fi

    local tag_type
    tag_type=$(classify_prompt_tags "$prompt")

    local current_log
    current_log=$(get_current_log_path)

    jq -nc \
        --arg sid "$session_id" \
        --arg ts "$(date -Iseconds)" \
        --arg prompt "$prompt" \
        --arg tag "$tag_type" \
        --arg log "$current_log" \
        --arg tpath "$transcript_path" \
        --argjson offset "$transcript_offset" \
        '{
            session_id: $sid,
            timestamp: $ts,
            prompt: $prompt,
            tag_type: $tag,
            log_path: $log,
            transcript_path: $tpath,
            transcript_offset: $offset
        }' > "$state_file"

    hook_debug "Recorded turn state: tag=$tag_type log=$current_log"
}

read_turn_state() {
    local session_id="$1"
    local state_file="$WORKFLOW_STATE_DIR/current_turn_${session_id}.json"
    if [ ! -f "$state_file" ]; then
        return 1
    fi
    cat "$state_file"
}

clear_turn_state() {
    local session_id="$1"
    local state_file="$WORKFLOW_STATE_DIR/current_turn_${session_id}.json"
    rm -f "$state_file"
}

# ============================================================================
# CLAUDE -P INVOCATION
# ============================================================================

claude_p_with_timeout() {
    local prompt="$1"
    shift
    local tmpfile output exit_code

    # Derive the project root to run claude -p from. We cannot trust the
    # inherited CWD — a prior tool call may have left the shell in a
    # subdirectory (e.g. frontend/), which causes the sub-session to resolve
    # CLAUDE_PROJECT_DIR incorrectly, breaking hook paths inside that session.
    #
    # Prefer CLAUDE_PROJECT_DIR if set and contains .claude/; otherwise derive
    # from this file's own path (lib-common.sh is at .claude/hooks/scripts/,
    # so three levels up is the repo root).
    local project_dir
    if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}/.claude" ]; then
        project_dir="$CLAUDE_PROJECT_DIR"
    else
        project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
        if [ ! -d "$project_dir/.claude" ]; then
            hook_debug "WARNING: claude_p_with_timeout: derived project_dir=$project_dir has no .claude/ — proceeding anyway"
        fi
    fi

    # Write prompt to a temp file and pipe via stdin to avoid ARG_MAX limits
    # when log content is embedded in the prompt (can be hundreds of KB).
    # Recursion from sub-sessions is prevented by the workflow-action.lock in
    # stop.sh — not by any flag here.
    tmpfile=$(mktemp /tmp/workflow-prompt-XXXXXX)
    printf '%s' "$prompt" > "$tmpfile"

    output=$(cd "$project_dir" && timeout --signal=TERM "$WORKFLOW_CLAUDE_P_TIMEOUT" claude -p "$@" < "$tmpfile" 2>&1)
    exit_code=$?
    rm -f "$tmpfile"

    if [ $exit_code -eq 124 ]; then
        echo "WORKFLOW ERROR: claude -p timed out after ${WORKFLOW_CLAUDE_P_TIMEOUT}s. Operation incomplete." >&2
        return 124
    elif [ $exit_code -ne 0 ]; then
        echo "WORKFLOW ERROR: claude -p failed with exit code $exit_code. Output: $output" >&2
        return $exit_code
    fi

    echo "$output"
    return 0
}

# ============================================================================
# UTILITY
# ============================================================================

slugify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g'
}

short_session_id() {
    echo "$1" | head -c 8
}

# sanitize_slug: clean model-generated slug output to a safe filename component.
# Reads from stdin, writes cleaned slug to stdout.
# Behavior:
#   1. Strip ANSI escape codes.
#   2. Drop lines that look like preamble or markdown fencing.
#   3. Take first remaining non-empty line.
#   4. Lowercase; replace whitespace runs with single hyphen.
#   5. Strip any character not in [a-z0-9-].
#   6. Collapse repeated hyphens; trim leading/trailing hyphens.
#   7. Truncate to 64 chars.
#   8. Validate result matches ^[a-z0-9][a-z0-9-]{2,63}$.
#      If valid, print to stdout and exit 0.
#      If invalid, print nothing and exit 1 (caller must use deterministic fallback).
sanitize_slug() {
    local raw cleaned
    raw=$(cat)
    # Strip ANSI escapes
    cleaned=$(printf '%s' "$raw" | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g')
    # Drop common preamble lines and fence lines, take first remaining non-empty line
    cleaned=$(printf '%s\n' "$cleaned" | \
        grep -vE '^(Here is|Here'\''s|Sure|Okay|The slug|Slug:|```)' | \
        awk 'NF { print; exit }')
    # Lowercase
    cleaned=$(printf '%s' "$cleaned" | tr '[:upper:]' '[:lower:]')
    # Whitespace -> hyphen
    cleaned=$(printf '%s' "$cleaned" | tr -s '[:space:]' '-')
    # Strip non-[a-z0-9-]
    cleaned=$(printf '%s' "$cleaned" | tr -cd 'a-z0-9-')
    # Collapse repeated hyphens
    cleaned=$(printf '%s' "$cleaned" | sed -E 's/-+/-/g; s/^-//; s/-$//')
    # Truncate
    cleaned=$(printf '%s' "$cleaned" | cut -c1-64)
    # Validate
    if printf '%s' "$cleaned" | grep -qE '^[a-z0-9][a-z0-9-]{2,63}$'; then
        printf '%s\n' "$cleaned"
        return 0
    fi
    return 1
}

# fallback_slug: deterministic slug from current timestamp.
# Used when sanitize_slug fails. Always succeeds.
fallback_slug() {
    local prefix="${1:-interim}"
    printf '%s-%s\n' "$prefix" "$(date +%Y%m%d-%H%M%S)"
}

# sanitize_body: clean model-generated body content. Reads stdin, writes stdout.
# Strips common preamble lines and ANSI escapes. Empty result returns exit 1.
sanitize_body() {
    local cleaned
    cleaned=$(cat)
    # Strip ANSI escapes
    cleaned=$(printf '%s' "$cleaned" | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g')
    # Drop leading preamble lines (only at the very top, not anywhere)
    cleaned=$(printf '%s\n' "$cleaned" | \
        awk 'BEGIN{in_preamble=1} {
            if (in_preamble && /^(Here is|Here'\''s|Sure|Okay|The summary|The review|```)/) { next }
            in_preamble=0
            print
        }')
    # Strip leading/trailing blank lines
    cleaned=$(printf '%s' "$cleaned" | sed -E '1{/^[[:space:]]*$/d}; ${/^[[:space:]]*$/d}')
    if [ -z "$cleaned" ]; then
        return 1
    fi
    printf '%s\n' "$cleaned"
    return 0
}

# ============================================================================
# INITPROMPT LABEL / DESCRIPTOR HELPERS
# ============================================================================

# normalize_slug: convert arbitrary user input to a valid slug.
# $1 = raw string. Prints normalized slug to stdout, or nothing if invalid.
normalize_slug() {
    local raw="$1"
    local cleaned
    cleaned=$(printf '%s' "$raw" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g')
    cleaned=$(printf '%s' "$cleaned" | sed -E 's/([A-Z]+)([A-Z][a-z])/\1-\2/g')
    cleaned=$(printf '%s' "$cleaned" | tr '[:upper:]' '[:lower:]')
    cleaned=$(printf '%s' "$cleaned" | tr -c 'a-z0-9' '-')
    cleaned=$(printf '%s' "$cleaned" | sed -E 's/-+/-/g; s/^-//; s/-$//')
    if printf '%s' "$cleaned" | grep -qE '^[a-z0-9][a-z0-9-]+$'; then
        printf '%s\n' "$cleaned"
    fi
}

# extract_initprompt_label: if the prompt contains [initprompt:label], normalize
# and return the label. Prints nothing if no colon-form tag is present or the
# label normalizes to an invalid slug.
extract_initprompt_label() {
    local prompt="$1"
    local raw_label
    raw_label=$(echo "$prompt" | grep -oE '\[initprompt:[^]]*\]' | head -1 \
        | sed -E 's/\[initprompt://; s/\]//')
    if [ -n "$raw_label" ]; then
        normalize_slug "$raw_label"
    fi
}

# derive_initprompt_descriptor: extract 3-5 meaningful keywords from prompt
# content (after stripping the tag) to use as a log filename descriptor.
# Falls back to "work-unit" if no valid slug can be derived.
derive_initprompt_descriptor() {
    local prompt="$1"
    local stopwords='\b(a|an|and|are|as|at|be|but|by|can|do|does|for|from|has|have|i|if|in|is|it|its|me|my|of|on|or|please|so|that|the|then|there|this|to|us|was|we|were|what|where|which|will|with|you|your)\b'
    local cleaned
    cleaned=$(printf '%s' "$prompt" | sed -E 's/\[initprompt(:[^]]*)?\]//g')
    cleaned=$(printf '%s' "$cleaned" | tr '[:upper:]' '[:lower:]')
    cleaned=$(printf '%s' "$cleaned" | sed -E 's|https?://[^ ]+||g; s/`[^`]*`//g')
    cleaned=$(printf '%s' "$cleaned" | sed -E "s/$stopwords//g")
    cleaned=$(printf '%s' "$cleaned" | tr -c 'a-z0-9' ' ' | tr -s ' ')
    cleaned=$(printf '%s' "$cleaned" | awk '{
        n = (NF < 5) ? NF : 5
        for (i = 1; i <= n; i++) {
            printf "%s", $i
            if (i < n) printf "-"
        }
        print ""
    }')
    cleaned=$(printf '%s' "$cleaned" | sed -E 's/-+/-/g; s/^-//; s/-$//')
    cleaned=$(printf '%s' "$cleaned" | cut -c1-50 | sed -E 's/-[^-]*$//')
    if [ -z "$cleaned" ] || ! printf '%s' "$cleaned" | grep -qE '^[a-z0-9][a-z0-9-]{2,}$'; then
        printf 'work-unit\n'
    else
        printf '%s\n' "$cleaned"
    fi
}
