---
description: Close the current work unit (summary + review + doc updates)
---

# /wrapup

Trigger the full work-unit wrap-up sequence: generate a summary, run a shallow review, and update interim documentation for files modified during the work unit.

## Implementation

```bash
!CLAUDE_LOG=$(cat ${CLAUDE_PROJECT_DIR}/.claude/state/current_log.txt)
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```

After running, check `.claude/summaries/`, `.claude/reviews/`, and `.claude/docs/interim/` for results.
