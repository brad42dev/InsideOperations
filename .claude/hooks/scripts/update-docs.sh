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
    # Auto-detect: scan existing interim docs for implementation: entries matching files
    if [ -d "$WORKFLOW_INTERIM_DOCS_DIR" ]; then
        while IFS= read -r f; do
            if grep -qF -- "$f" "$WORKFLOW_INTERIM_DOCS_DIR"/*.md 2>/dev/null; then
                while IFS= read -r doc; do
                    # Check if this doc actually references this file in its implementation: section
                    if grep -A 20 'implementation:' "$doc" 2>/dev/null | grep -qF -- "$f"; then
                        AFFECTED_DOCS+=("$doc")
                    fi
                done < <(grep -lF -- "$f" "$WORKFLOW_INTERIM_DOCS_DIR"/*.md 2>/dev/null)
            fi
        done <<< "$FILES_MODIFIED"
    fi

    # Deduplicate
    if [ ${#AFFECTED_DOCS[@]} -gt 0 ]; then
        readarray -t AFFECTED_DOCS < <(printf '%s\n' "${AFFECTED_DOCS[@]}" | sort -u)
    fi
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
done

exit 0
