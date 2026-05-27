# Review (deep)

**Generated**: 2026-05-16T08:30:33+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-16_you-are-performing-a-deep-verification-r_082849.md`
**Session**: 
**Depth**: deep

---

## Summary

The work unit log records a single edit to `run-review.sh` (86→300 chars), but the diff section is empty — the file is untracked (confirmed by the git status showing `.claude/` as `??`), so `git diff HEAD` produces nothing. This means the review must work entirely from the full file contents. The file itself is a coherent, complete bash script for running `claude -p`-based verification reviews at shallow or deep depth. There is no visible initial prompt in the work unit log to compare intent against, which limits this review to structural and correctness concerns in the file itself.

## Concerns

1. **Heredoc injection risk** — The prompt is constructed via `<<EOF` (unquoted, variable-expanding) heredocs that embed `$LOG_CONTENT`, `$DIFF_CONTENT`, and `$FILE_CONTENTS` directly. If any of those variables contain a bare `EOF` on its own line, the heredoc terminates early and the prompt is silently truncated. Low probability but not zero — diffs of Rust/TS files that contain heredoc-like string literals could trigger this. A `<<'HEREDOC_END'` delimiter with a rarer sentinel (e.g., `REVIEW_PROMPT_END`) would eliminate the risk.

2. **Missing `-e` in `set -uo pipefail`** — The script uses `set -uo pipefail` but omits `-e`. Command failures inside the `for f in $EXISTING_FILES` loop (e.g., `head` failing on a binary file) will silently continue rather than aborting. This is likely intentional (graceful degradation), but the absence is worth noting.

3. **lib-common.sh not found = silent crash** — `lib-common.sh` is sourced only if it exists, but `claude_p_with_timeout` is called unconditionally later. If the lib is missing, the script will fail at line ~140 with `command not found` rather than a clear error, and the exit path won't write a proper failure review file.

4. **`FILES_MODIFIED` includes full paths but `git diff` runs from `$CLAUDE_PROJECT_DIR`** — The grep extracts paths as they appear in the log (absolute paths from Claude's edit entries), but the `git diff HEAD -- $EXISTING_FILES` runs after `cd "$CLAUDE_PROJECT_DIR"`. If the log entries contain absolute paths, `git diff` may fail to match them against repo-relative paths. The file check (`[ -f "$f" ]`) passes because absolute paths resolve on the filesystem, but git may not find them without relative conversion.

5. **`FILE_CONTENTS+=` in bash without `declare`** — The `FILE_CONTENTS+="..."` pattern works in bash 3.1+ but is not portable. Not a concern for this Linux environment, but worth flagging as it's inside a `for` loop that appends large blocks.

## Verification Notes

- The deep-review prompt embedded in this script is the same prompt used by the `/deepreview` skill that generated this review — which is the meta-situation here. The prompt text matches what was injected as the system prompt for this session.
- Because the file is untracked, the 86→300 char delta in the log likely reflects a prior tiny stub being replaced with the full implementation. The final file is ~5.5 KB, consistent with a ground-up rewrite rather than an incremental edit.
- `ensure_workflow_dirs`, `WORKFLOW_REVIEWS_DIR`, and `WORKFLOW_SUMMARIES_DIR` are not defined in this file and must come from `lib-common.sh` — meaning the lib-common dependency is load-bearing, not optional, despite the conditional source.
