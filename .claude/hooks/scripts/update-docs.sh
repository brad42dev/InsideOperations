#!/bin/bash
# update-docs.sh — Update interim documentation based on work unit changes
#
# Usage:
#   update-docs.sh LOG_PATH SESSION_ID           # auto-detect affected docs
#   update-docs.sh LOG_PATH SESSION_ID SLUG      # update specific doc by slug
#
# The auto-detect mode:
#   1. Identifies files modified in this work unit
#   2. Finds existing interim docs whose `implementation:` field references
#      any of those files
#   3. Updates those docs to reflect the new behavior
#   4. If no existing doc covers a modified file, creates a new interim doc
#
# The targeted mode (with SLUG):
#   1. Reads the existing doc at .claude/docs/interim/SLUG.md
#   2. Updates it based on recent work unit content

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
TARGET_SLUG="${3:-}"

if [ ! -f "$LOG_PATH" ]; then
    echo "update-docs: log not found: $LOG_PATH" >&2
    exit 1
fi

ensure_workflow_dirs

LOG_FILENAME=$(basename "$LOG_PATH" .md)
LOG_CONTENT=$(cat "$LOG_PATH")
TODAY=$(date +%Y-%m-%d)

# Try to find the corresponding summary
SUMMARY_PATH="${WORKFLOW_SUMMARIES_DIR}/${LOG_FILENAME}_summary.md"
SUMMARY_CONTENT=""
if [ -f "$SUMMARY_PATH" ]; then
    SUMMARY_CONTENT="$(cat "$SUMMARY_PATH")"
fi

# ============================================================================
# Identify modified files
# ============================================================================

FILES_MODIFIED=$(grep -oE '#(WRITE|EDIT|MULTIEDIT) `[^`]+`' "$LOG_PATH" | grep -oE '`[^`]+`' | tr -d '`' | sort -u)

if [ -z "$FILES_MODIFIED" ] && [ -z "$TARGET_SLUG" ]; then
    echo "update-docs: no files modified and no target slug; nothing to do"
    exit 0
fi

# ============================================================================
# Identify affected docs
# ============================================================================

AFFECTED_DOCS=()

if [ -n "$TARGET_SLUG" ]; then
    TARGET_DOC="${WORKFLOW_INTERIM_DOCS_DIR}/${TARGET_SLUG}.md"
    if [ -f "$TARGET_DOC" ]; then
        AFFECTED_DOCS+=("$TARGET_DOC")
    else
        # Doc doesn't exist; we'll create it below
        AFFECTED_DOCS+=("$TARGET_DOC")
    fi
else
    # Auto-detect via deterministic matcher (replaces former grep-based file overlap)
    MATCH_FILES_LIST=$(mktemp)
    printf '%s\n' "$FILES_MODIFIED" > "$MATCH_FILES_LIST"

    # Topics input is empty for this iteration; topic extraction from log
    # content is a future enhancement (see prompt-6+ plan).
    MATCH_TOPICS=""

    MATCH_OUTPUT=$(python3 "${WORKFLOW_SCRIPTS_DIR}/match-docs.py" \
        --files-modified "$MATCH_FILES_LIST" \
        --topics "$MATCH_TOPICS" \
        --interim-dir "$WORKFLOW_INTERIM_DOCS_DIR" \
        --topics-file "${WORKFLOW_DOCS_DIR:-.claude/docs}/topics.txt" \
        2> "$MATCH_FILES_LIST.stderr")
    MATCH_EXIT=$?
    rm -f "$MATCH_FILES_LIST"

    # Log every decision for audit
    MATCH_LOG="${WORKFLOW_STATE_DIR:-.claude/state}/match-docs.log"
    {
        printf '[%s] session=%s\n' "$(date -Is)" "${SESSION_ID:-unknown}"
        printf '  files-modified=%s\n' "$(echo "$FILES_MODIFIED" | tr '\n' ',' | sed 's/,$//')"
        printf '  topics=%s\n' "$MATCH_TOPICS"
        printf '  exit=%s\n' "$MATCH_EXIT"
        printf '  output=%s\n' "$MATCH_OUTPUT"
        if [ -s "$MATCH_FILES_LIST.stderr" ]; then
            printf '  stderr:\n'
            sed 's/^/    /' "$MATCH_FILES_LIST.stderr"
        fi
    } >> "$MATCH_LOG"
    rm -f "$MATCH_FILES_LIST.stderr"

    # Fail-safe: any non-zero exit or unparseable JSON → treat as triage
    if [ "$MATCH_EXIT" -ne 0 ] || ! echo "$MATCH_OUTPUT" | jq empty 2>/dev/null; then
        echo "update-docs: matcher failed (exit=$MATCH_EXIT); falling back to triage" >&2
        MATCH_DECISION="triage"
        MATCH_TARGET=""
        MATCH_CANDIDATES=""
    else
        MATCH_DECISION=$(echo "$MATCH_OUTPUT" | jq -r '.decision')
        MATCH_TARGET=$(echo "$MATCH_OUTPUT" | jq -r '.target_doc // ""')
        MATCH_CANDIDATES=$(echo "$MATCH_OUTPUT" | jq -r '.merge_candidates // [] | join(",")')
    fi

    case "$MATCH_DECISION" in
        update)
            AFFECTED_DOCS+=("$MATCH_TARGET")
            ;;
        create)
            # Fall through to existing new-doc creation path; AFFECTED_DOCS stays empty
            ;;
        triage)
            # Fall through to new-doc creation path, but flag for human review.
            # Export variables consumed by the create path below.
            export NEEDS_TRIAGE="true"
            export MERGE_CANDIDATES="$MATCH_CANDIDATES"
            ;;
        *)
            echo "update-docs: unexpected match decision '$MATCH_DECISION'; treating as create" >&2
            ;;
    esac
fi

# ============================================================================
# Update each affected doc
# ============================================================================

if [ ${#AFFECTED_DOCS[@]} -eq 0 ]; then
    # No existing docs cover the modified files. Create a new interim doc.
    # We'll let claude -p figure out an appropriate slug from the work unit.

    NEW_SLUG_PROMPT=$(cat <<EOF
Based on this work unit summary and log, suggest a short kebab-case slug
(3-6 words, lowercase, hyphen-separated) for an interim documentation file
covering the feature or area this work unit touched.

Output ONLY the slug, nothing else. No quotes, no explanation.

Summary:
$SUMMARY_CONTENT

Log:
$LOG_CONTENT
EOF
)

    RAW_SLUG=$(claude_p_with_timeout "$NEW_SLUG_PROMPT" 2>&1)
    NEW_SLUG=$(printf '%s' "$RAW_SLUG" | sanitize_slug) || NEW_SLUG=$(fallback_slug "doc")
    printf '[%s] slug-gen raw=%q clean=%s\n' "$(date -Is)" "$RAW_SLUG" "$NEW_SLUG" \
        >> "${WORKFLOW_STATE_DIR:-.claude/state}/slug-gen.log"

    NEW_DOC="${WORKFLOW_INTERIM_DOCS_DIR}/${NEW_SLUG}.md"
    AFFECTED_DOCS+=("$NEW_DOC")
fi

for doc_path in "${AFFECTED_DOCS[@]}"; do
    SLUG=$(basename "$doc_path" .md)

    if [ -f "$doc_path" ]; then
        EXISTING_DOC=$(cat "$doc_path")
        MODE="update"
    else
        EXISTING_DOC=""
        MODE="create"
    fi

    PROMPT=$(cat <<EOF
You are maintaining an interim design document for a Claude Code project.

Mode: $MODE
Document slug: $SLUG
Document path: $doc_path

This is an INTERIM doc (status: interim) under .claude/docs/interim/. It will
eventually be merged into a canonical structure. For now, keep it focused on
describing CURRENT REALITY of the code.

Schema for interim docs (frontmatter at top of file, in YAML between --- lines):

  id: $SLUG
  title: <human-readable title>
  status: interim
  created: <YYYY-MM-DD, set once on creation>
  last_updated: <YYYY-MM-DD, today's date when updating>
  last_synced_with_code: <YYYY-MM-DD, today's date>
  work_units:
    - <list of work-unit log filenames that contributed>
  implementation:
    - <list of code file paths this doc describes>
  related:
    - <informal list of related doc slugs>

Body sections (in this order):
  # <Title>
  <1-3 sentence summary>

  ## Purpose
  <what this feature/area does>

  ## Behavior
  <how it behaves, including caveats>

  ## Implementation Notes
  <where the code lives, key design decisions>

  ## Changelog
  <!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
  ### YYYY-MM-DD
  <Description of changes made on this date. Most recent on top.>

YOUR JOB:
$(if [ "$MODE" = "create" ]; then
echo "- This doc does NOT yet exist. Create it fresh based on the work unit log and summary."
echo "- Set 'created' and 'last_updated' and 'last_synced_with_code' all to: $TODAY"
echo "- Populate work_units with: $LOG_FILENAME"
echo "- Populate implementation with the file paths actually modified in this work unit"
echo "- Add an initial changelog entry dated $TODAY describing the creation"
else
echo "- This doc EXISTS. Update it to reflect new behavior from this work unit."
echo "- Preserve the existing 'created' date (do NOT change it)"
echo "- Update 'last_updated' and 'last_synced_with_code' to: $TODAY"
echo "- APPEND the current work-unit log filename to work_units (if not already there): $LOG_FILENAME"
echo "- UPDATE implementation list if new files were touched"
echo "- UPDATE body sections to reflect new behavior (overwrite, don't append, in body sections)"
echo "- ADD a new changelog entry at the TOP of the Changelog section dated $TODAY, describing what changed"
echo "- KEEP previous changelog entries in place beneath the new one"
fi)

OUTPUT RULES:
- Output ONLY the complete file content (frontmatter + body), nothing else
- Start with the opening --- of frontmatter
- Do NOT include preamble, explanation, or markdown code fences around the output
- The output replaces the entire file contents

WORK UNIT LOG:
---
$LOG_CONTENT
---

$([ -n "$SUMMARY_CONTENT" ] && echo "WORK UNIT SUMMARY:
---
$SUMMARY_CONTENT
---
")

$([ "$MODE" = "update" ] && echo "EXISTING DOC CONTENT:
---
$EXISTING_DOC
---
")

Produce the complete file content now.
EOF
)

    NEW_CONTENT=$(claude_p_with_timeout "$PROMPT" 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
        echo "update-docs: failed to update $doc_path (exit $EXIT_CODE)" >&2
        # Write a proposal file so the update isn't lost
        PROPOSAL_PATH="${doc_path}.update-proposal-$(date +%H%M%S)"
        {
            echo "# Doc Update Failed"
            echo ""
            echo "Generated: $(date -Iseconds)"
            echo "Exit code: $EXIT_CODE"
            echo ""
            echo "Output:"
            echo "\`\`\`"
            echo "$NEW_CONTENT"
            echo "\`\`\`"
        } > "$PROPOSAL_PATH"
        continue
    fi

    # Strip any wrapping markdown code fences claude might have added despite our instructions
    NEW_CONTENT=$(echo "$NEW_CONTENT" | sed -E '1s/^```(markdown|md)?$//' | sed -E '$s/^```$//')

    # Sanity check: must start with frontmatter
    if ! echo "$NEW_CONTENT" | head -1 | grep -q '^---'; then
        echo "update-docs: invalid output for $doc_path (no frontmatter); writing as proposal" >&2
        PROPOSAL_PATH="${doc_path}.update-proposal-$(date +%H%M%S)"
        echo "$NEW_CONTENT" > "$PROPOSAL_PATH"
        continue
    fi

    # Auto-apply per the user's preference
    echo "$NEW_CONTENT" > "$doc_path"
    echo "update-docs: wrote $doc_path ($MODE)"

    if [ "${NEEDS_TRIAGE:-false}" = "true" ]; then
        python3 "${WORKFLOW_SCRIPTS_DIR}/lib-frontmatter.py" set \
            "$doc_path" needs_triage 'true'
        if [ -n "${MERGE_CANDIDATES:-}" ]; then
            # Convert comma-separated list to JSON array
            CANDIDATES_JSON=$(echo "$MERGE_CANDIDATES" | \
                jq -R 'split(",") | map(select(length > 0))')
            python3 "${WORKFLOW_SCRIPTS_DIR}/lib-frontmatter.py" set \
                "$doc_path" merge_candidates "$CANDIDATES_JSON"
        fi
    fi
done

# Rebuild index after any doc change (non-fatal — doc write already succeeded)
if ! python3 "${WORKFLOW_SCRIPTS_DIR}/rebuild-index.py" \
      >> "${WORKFLOW_STATE_DIR:-.claude/state}/rebuild-index.log" 2>&1; then
    echo "update-docs: index rebuild failed (non-fatal); see rebuild-index.log" >&2
fi

exit 0
