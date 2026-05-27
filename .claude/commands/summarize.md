---
description: Generate an LLM-based summary of the current work unit
---

# /summarize

Generate a structured summary of the current work unit: purpose, key decisions, what was built, what was deferred, open questions.

## Implementation

```bash
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/generate-summary.sh "$(cat ${CLAUDE_PROJECT_DIR}/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID"
```

After running, check `.claude/summaries/` for the result.
