---
description: Run a verification review of work done since the last [initprompt]
---

# /review

Run a shallow verification review on the current work-unit log. Compares what was asked against what was built (diff of changed files) and surfaces concerns.

## Implementation

```bash
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/run-review.sh "$(cat ${CLAUDE_PROJECT_DIR}/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "shallow"
```

After running, check the latest file in `.claude/reviews/` for results.
