---
description: Run a deep verification review including full file contents
---

# /deepreview

Run a deep verification review — reads full file contents of modified files (not just diffs) to surface integration concerns and regressions in surrounding code.

## Implementation

```bash
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/run-review.sh "$(cat ${CLAUDE_PROJECT_DIR}/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```

After running, check the latest file in `.claude/reviews/` for results.
