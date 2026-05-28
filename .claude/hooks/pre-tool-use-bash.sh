#!/bin/bash
# pre-tool-use-bash.sh — PreToolUse hook for Bash
#
# Fires before Bash commands execute. Responsibilities:
#   1. Detect catastrophically dangerous commands (rm -rf root, dd to disk, etc.)
#   2. Block them with a clear reason
#
# Input (from stdin, JSON):
#   - tool_name: "Bash"
#   - tool_input.command: the command string
#
# Output:
#   - exit 0 with no JSON: command proceeds
#   - exit 0 with hookSpecificOutput.permissionDecision: "deny": blocked
#
# Philosophy: this hook only blocks things that are almost certainly destructive
# mistakes. Normal cleanup commands (rm of build artifacts, etc.) are allowed.
# If you find yourself fighting this hook, expand the allowlist patterns below.

set -uo pipefail

# Auto-detect project dir from script location if not set in environment
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
    CLAUDE_PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
    export CLAUDE_PROJECT_DIR
fi

HOOK_NAME="pre-tool-use-bash"
export HOOK_NAME

LIB_PATH="${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/lib-common.sh"
if [ -f "$LIB_PATH" ]; then
    # shellcheck source=/dev/null
    source "$LIB_PATH"
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [ -z "$COMMAND" ]; then
    exit 0
fi

# ============================================================================
# DANGEROUS PATTERNS
# ============================================================================
# Each entry is "pattern|description". Patterns are bash-extended regex,
# matched case-insensitively against the command.

DANGEROUS_PATTERNS=(
    # rm -rf on root or home
    'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-rf|-fr)[[:space:]]+(/$|/[[:space:]]|/\*|\$HOME|~/?$|/home/?$|/root/?$)|rm -rf on root or home directory'

    # dd to a block device
    'dd[[:space:]].*of=/dev/(sd|nvme|hd|vd)|dd to a block device'

    # mkfs on a block device
    'mkfs.*/dev/(sd|nvme|hd|vd)|mkfs on a block device'

    # Fork bomb
    ':\(\)\{[[:space:]]*:\|:&[[:space:]]*\}|Fork bomb pattern'

    # chmod 000 on critical paths
    'chmod[[:space:]]+(0?)?000[[:space:]]+(/$|/etc|/bin|/usr|/var)|chmod 000 on system directory'

    # Pipe curl/wget to shell
    'curl[[:space:]].*\|[[:space:]]*(sh|bash|zsh)([[:space:]]|$)|Piping curl to shell'
    'wget[[:space:]].*\|[[:space:]]*(sh|bash|zsh)([[:space:]]|$)|Piping wget to shell'

    # Force-push to main/master
    'git[[:space:]]+push[[:space:]]+.*--force.*[[:space:]](main|master)([[:space:]]|$)|Force-push to main/master branch'
    'git[[:space:]]+push[[:space:]]+--force.*[[:space:]](main|master)([[:space:]]|$)|Force-push to main/master branch'

    # Disable firewall
    'ufw[[:space:]]+disable|Disabling firewall (ufw)'
    'iptables[[:space:]]+-F|Flushing iptables rules'

    # Modify root authorized_keys
    '(echo|cat).*>>?[[:space:]]*/root/\.ssh/authorized_keys|Modifying root authorized_keys'
)

for entry in "${DANGEROUS_PATTERNS[@]}"; do
    pattern="${entry%%|*}"
    desc="${entry##*|}"
    if echo "$COMMAND" | grep -qiE "$pattern"; then
        REASON="Safety check blocked this command. Detected: $desc. Command was: $COMMAND. If this is intentional, run it manually outside of Claude Code, or modify .claude/hooks/pre-tool-use-bash.sh to remove this pattern."

        if command -v hook_debug >/dev/null 2>&1; then
            hook_debug "BLOCKED: $desc — command: $COMMAND"
        fi

        jq -nc \
            --arg reason "$REASON" \
            '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
        exit 0
    fi
done

# Command is fine; allow
exit 0
