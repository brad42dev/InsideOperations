---
id: hook-loop-fix-and-sanitization
title: Hook Loop Fix and Log Sanitization
status: interim
created: 2026-05-16
last_updated: 2026-05-16
last_synced_with_code: 2026-05-16
work_units:
- 2026-05-16_general_025143
implementation:
- .claude/hooks/stop.sh
- .claude/hooks/user-prompt-submit.sh
- .claude/hooks/scripts/extract-turn.sh
- .claude/hooks/scripts/lib-common.sh
- .claude/WORKFLOW_NOTES.md
related:
- cc-workflow-hooks
topics: []
aliases: []
keywords: []
covers: Hook Loop Fix and Log Sanitization
---

# Hook Loop Fix and Log Sanitization

The Claude Code hook system had a recursion bug where `[review]`, `[wrapup]`, and other hook trigger tags embedded in logged prompt content caused the `UserPromptSubmit` hook to spawn repeated background actions. This doc describes the fix: a file-based lock mechanism plus known-tag sanitization at log-write time.

## Purpose

The hook system automatically generates work-unit logs, summaries, reviews, and interim docs when Claude completes a turn or a user submits certain tags. The bug caused these background `claude -p` sub-sessions to themselves fire `UserPromptSubmit`, which found the original trigger tag buried in the embedded log content and spawned another background action — recursively, up to 5 levels deep before the nesting stopped naturally.

## Behavior

**Lock mechanism** (`stop.sh` + `user-prompt-submit.sh`):
- Before spawning any background workflow action (review, wrapup, summary, docfresh), `stop.sh` creates `.claude/state/workflow-action.lock`
- The lock is removed when the background subshell exits
- Any subsequent hook invocation (from sub-sessions triggered by those background actions) checks for the lock and skips if held
- `user-prompt-submit.sh` cleans stale locks older than 15 minutes on every real user prompt submission, as a safety net for locks that didn't get cleaned up

**Tag sanitization** (`extract-turn.sh`):
- When writing `#PROMPT` and `#ASSISTANT` blocks to the work-unit log, known hook trigger tags are replaced with a visually similar but inert form (e.g., `[review]` → `~review~`)
- Only *known* hook tags are sanitized — arbitrary square brackets (valid Markdown, code references, etc.) are left untouched
- This is defense-in-depth: logs remain readable and don't re-trigger hooks even if a future code path bypasses the lock

**Prompt delivery fix** (`lib-common.sh` / `claude_p_with_timeout`):
- Background `claude -p` calls now deliver the prompt via a temp file piped to stdin rather than as a command-line argument
- This resolves "Argument list too long" errors when the work-unit log grows large enough to exceed OS exec arg limits

## Implementation Notes

The recursion root cause: `UserPromptSubmit` fires for *every* `claude` invocation — including the `claude -p` sub-sessions spawned by the hooks themselves. Those sub-sessions receive a prompt that embeds the full work-unit log, which contains the original user tag. The hook's tag-detection regex matched the tag inside the embedded log and queued another action.

Two fixes were considered before the lock was chosen:
1. **1000-char prefix scan** — rejected because user tags can legitimately appear later in longer prompts
2. **File-based lock** — chosen; simpler, reliable, easy to inspect/debug

The `--bare` flag was briefly tried to skip hook firing in sub-sessions entirely, but it also bypasses OAuth session auth and only works with `ANTHROPIC_API_KEY` — incompatible with the Max subscription used on this machine. It was reverted.

Lock TTL (15 min) is a rough heuristic. Very long reviews could theoretically leave stale locks, which is why the cleanup step exists in `user-prompt-submit.sh`.

## Changelog

### 2026-05-16
Initial creation. Documented the recursive-review bug diagnosis, the file-based lock implementation in `stop.sh` and `user-prompt-submit.sh`, the known-tag sanitization added to `extract-turn.sh`, and the stdin prompt-delivery fix in `lib-common.sh`. Services (`opc-service`, `video-export-service`) were also restarted after machine reboot; stale `/tmp/io-opc-broker.sock` cleared before OPC restart.
