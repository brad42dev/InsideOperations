#!/bin/bash
# pre-tool-use-edit.sh — PreToolUse hook for Edit/Write/MultiEdit
#
# Fires before file writes. Responsibilities:
#   1. Scan the content being written for common credential/secret patterns
#   2. Block the write if matches are found, with a clear reason
#
# Input (from stdin, JSON):
#   - tool_name, tool_input.{file_path, content, new_string, ...}
#
# Output:
#   - exit 0 with no JSON: write proceeds
#   - exit 0 with hookSpecificOutput.permissionDecision: "deny": write blocked
#
# Note: This is a moderate-aggressiveness scanner. Patterns chosen for low
# false-positive rate. If you find this catching too many false positives,
# adjust SECRET_PATTERNS below. If you find it missing real secrets, ditto.

set -uo pipefail

HOOK_NAME="pre-tool-use-edit"
export HOOK_NAME

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ -f "$LIB_PATH" ]; then
    # shellcheck source=/dev/null
    source "$LIB_PATH"
fi

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Extract content based on which tool fired
CONTENT=""
case "$TOOL_NAME" in
    Write)
        CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""')
        ;;
    Edit)
        CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // ""')
        ;;
    MultiEdit)
        # MultiEdit has an edits array, each with new_string
        CONTENT=$(echo "$INPUT" | jq -r '[.tool_input.edits[]?.new_string // ""] | join("\n")')
        ;;
    *)
        # Unknown tool variant; allow through
        exit 0
        ;;
esac

# Skip empty content
if [ -z "$CONTENT" ]; then
    exit 0
fi

# Skip if the file path looks like a test fixture, documentation, or
# explicitly-marked sample. Reduces false positives for example credentials
# in docs.
case "$FILE_PATH" in
    *test*|*tests*|*spec*|*fixture*|*example*|*sample*|*.md|*.rst|*.txt)
        # These get a lighter scan — only check for very specific real-key prefixes
        SCAN_MODE="light"
        ;;
    *)
        SCAN_MODE="full"
        ;;
esac

# ============================================================================
# SECRET PATTERNS
# ============================================================================
# Each pattern below is a regex matched case-insensitively against content.
# Patterns are designed to catch real-world credentials with low false positives.
#
# To add a new pattern: append a "pattern|description" line to SECRET_PATTERNS.
# To remove a pattern: delete its line.
# To tune sensitivity: edit the regexes themselves (more specific = fewer FPs).

SECRET_PATTERNS=(
    # AWS keys
    'AKIA[0-9A-Z]{16}|AWS Access Key ID'
    'aws_secret_access_key\s*[:=]\s*["'"'"']?[A-Za-z0-9/+=]{40}|AWS Secret Key'

    # GitHub tokens
    'gh[pousr]_[A-Za-z0-9]{36,255}|GitHub token'
    'github_pat_[A-Za-z0-9_]{82}|GitHub fine-grained PAT'

    # OpenAI
    'sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}|OpenAI API key (legacy)'
    'sk-proj-[A-Za-z0-9_-]{40,}|OpenAI project key'

    # Anthropic
    'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{80,}|Anthropic API key'

    # Stripe
    'sk_live_[A-Za-z0-9]{24,}|Stripe live secret key'
    'rk_live_[A-Za-z0-9]{24,}|Stripe live restricted key'

    # Google
    'AIza[0-9A-Za-z_-]{35}|Google API key'

    # Slack
    'xox[baprs]-[A-Za-z0-9-]{10,}|Slack token'

    # Generic high-entropy patterns near credential identifiers
    # Only used in "full" scan mode to reduce false positives in docs/tests
    'private_key\s*[:=]\s*["'"'"']?-----BEGIN[ A-Z]+PRIVATE KEY-----|Private key block'
)

# Light mode patterns: only obvious real keys, skip identifier-based heuristics
LIGHT_PATTERNS=(
    'AKIA[0-9A-Z]{16}|AWS Access Key ID'
    'gh[pousr]_[A-Za-z0-9]{36,255}|GitHub token'
    'sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{80,}|Anthropic API key'
    'sk_live_[A-Za-z0-9]{24,}|Stripe live secret key'
    '-----BEGIN[ A-Z]+PRIVATE KEY-----|Private key block'
)

if [ "$SCAN_MODE" = "light" ]; then
    PATTERNS_TO_USE=("${LIGHT_PATTERNS[@]}")
else
    PATTERNS_TO_USE=("${SECRET_PATTERNS[@]}")
fi

# Scan
MATCHED_PATTERN=""
MATCHED_DESC=""
for entry in "${PATTERNS_TO_USE[@]}"; do
    pattern="${entry%%|*}"
    desc="${entry##*|}"
    if echo "$CONTENT" | grep -qiE "$pattern"; then
        MATCHED_PATTERN="$pattern"
        MATCHED_DESC="$desc"
        break
    fi
done

if [ -n "$MATCHED_PATTERN" ]; then
    # Block the write
    REASON="Secret scanner blocked this write. Detected pattern matching: $MATCHED_DESC. If this is a false positive (example credential, test fixture, etc.), move the file to a path containing 'test', 'example', 'fixture', or 'sample', or modify the secret scanner in .claude/hooks/pre-tool-use-edit.sh to exclude this pattern."

    if [ -n "${HOOK_NAME+x}" ] && command -v hook_debug >/dev/null 2>&1; then
        hook_debug "BLOCKED: $FILE_PATH matched pattern: $MATCHED_DESC"
    fi

    jq -nc \
        --arg reason "$REASON" \
        '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
    exit 0
fi

# No secrets detected; allow
exit 0
