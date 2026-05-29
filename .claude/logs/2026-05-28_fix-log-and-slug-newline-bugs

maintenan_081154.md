# Work Unit Log: fix-log-and-slug-newline-bugs

maintenan

Started: 2026-05-28T08:11:54+00:00
Session: ffa17917-b4de-4b76-bb68-25717ee917f0

---


## #EDIT `/home/io/io-dev/io/.claude/hooks/user-prompt-submit.sh` (244→392 chars)

_2026-05-28T08:12:31+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh` (295→685 chars)

_2026-05-28T08:12:39+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh` (271→399 chars)

_2026-05-28T08:14:02+00:00_


## #PROMPT

_2026-05-28T08:14:53+00:00_

```
~initprompt~ fix-log-and-slug-newline-bugs

Maintenance task on the workflow harness. Fix two related bugs that corrupt log filenames and interim doc filenames with embedded newlines. A prior diagnostic (in .claude/) established the root cause; this applies the fixes and verifies them. Touch only .claude/ harness files.

Background: multi-line ~initprompt~ prompts cause embedded newlines (\n\n) to be baked into work-unit log filenames, because user-prompt-submit.sh cuts the descriptor from the raw prompt without collapsing newlines and slugify does not strip them. update-docs.sh then propagates these into interim doc filenames via its fallback slug path. The CWD fix already applied addressed a different (content-leak) trigger; these two filename bugs are still live.

Part one — fix the root cause in user-prompt-submit.sh.

Find the ~initprompt~ descriptor handling (the block that builds DESCRIPTOR_TEXT from the prompt, slugifies it, and passes it to rotate_log_to_new). The current code cuts the first ~80 bytes of the prompt including any embedded newlines, then slugifies, then caps at ~40 chars — none of which removes newlines.

Fix: collapse newlines to spaces (or take only the first line) BEFORE slugifying, so the descriptor is always single-line. The simplest robust form: pipe the prompt through `head -1` (first line only) or `tr '\n' ' '` (collapse all newlines to spaces) before the head -c 80 and slugify steps. Choose head -1 if the first line of an ~initprompt~ prompt is always the meaningful descriptor (it is, by convention — the slug name follows ~initprompt~ on the first line); otherwise tr '\n' ' '. State which you chose and why.

Show before/after. Verify slugify can no longer receive a multi-line input from this path.

Part two — harden the slug path in update-docs.sh (defense in depth).

Apply the two changes the diagnostic recommended:
1. Primary slug path: replace the `tr -d ' \n'` sanitization with one that takes only the first letter-bearing line and strips all non-slug characters — `grep -m1 '[a-z]' | tr -dc 'a-z0-9-' | head -c 60`. This skips tool-status preamble lines (like "File created...") and removes uppercase/punctuation that would otherwise survive.
2. Fallback path: before slugifying LOG_FILENAME, collapse its embedded newlines — `SAFE_LOG=$(printf '%s' "$LOG_FILENAME" | tr '\n' '-')` then slugify "$SAFE_LOG". This ensures even a corrupted log filename produces a single-line slug.

Show before/after for both. Confirm the interface and callers are unchanged.

Part three — verify by reproduction.

1. Simulate the user-prompt-submit fix: construct a multi-line descriptor string (e.g. "fix-something\n\nread ui-audit/...") and run it through the FIXED descriptor logic. Confirm the resulting slug is single-line and clean.
2. Simulate the update-docs fallback fix: take a LOG_FILENAME containing \n\n and run it through the FIXED fallback logic. Confirm the resulting NEW_SLUG is single-line and clean, and that NEW_DOC would be a sane path.
3. Confirm a chatty claude -p primary path (multi-line output with a preamble line) now yields a clean slug via grep -m1 '[a-z]' | tr -dc.
Report each simulation's input and output.

Part four — confirm no live regression to the current session's log.
The current work-unit log filename itself may already contain \n\n (the diagnostic noted the fix-hook-cwd-resolution log did). Report whether the current log filename is corrupted. Do NOT rename it mid-session (it is in use and referenced by .claude/state/current_log.txt) — just report its state. It can be cleaned in the artifact-cleanup pass.

Constraints: only .claude/ harness files (user-prompt-submit.sh, update-docs.sh). No application source. No interface changes. Keep changes minimal.

When done print: the user-prompt-submit fix (before/after), the update-docs fixes (before/after), the three reproduction results, the current-log-corruption status, and confirmation only .claude/ files were touched. Stop.
```


## #ASSISTANT

Reading both files in parallel before making any changes.


## #ASSISTANT

I have all I need. Applying Part 1 fix first.

**Part 1 — user-prompt-submit.sh**

**Before (line 79):**
```bash
DESCRIPTOR_TEXT=$(echo "$PROMPT" | sed -E 's/\[initprompt\]//' | head -c 80)
```

Choosing `head -1` over `tr '\n' ' '`: by convention `~initprompt~ slug-name` always puts the slug hint on the same line as the tag. `head -1` extracts exactly that intent and nothing from the multi-line task description below it. `tr '\n' ' '` would concatenate the whole 80-char window and smear in description text.


## #ASSISTANT

**Part 2 — update-docs.sh, both slug-path changes**


## #ASSISTANT

Verify both edits look correct in context:


## #ASSISTANT

Both edits are correct. Now Part 3 — simulations.


## #BASH
_Simulate user-prompt-submit fix: before vs after_

```bash
source /home/io/io-dev/io/.claude/hooks/scripts/lib-common.sh

echo "=== Simulation 1: user-prompt-submit.sh fix ==="
echo "Input: multi-line [initprompt] prompt"
MULTI_LINE_PROMPT=$'[initprompt] fix-something\n\nread ui-audit/...\nThis is the task description.\nMore lines here.'
printf 'Raw prompt (escaped): %q\n' "$MULTI_LINE_PROMPT"
echo ""

# BEFORE (old behavior)
BEFORE=$(echo "$MULTI_LINE_PROMPT" | sed -E 's/\[initprompt\]//' | head -c 80)
BEFORE_SLUG=$(slugify "$BEFORE")
printf 'BEFORE descriptor (escaped): %q\n' "$BEFORE_SLUG"

# AFTER (new behavior)
AFTER=$(echo "$MULTI_LINE_PROMPT" | head -1 | sed -E 's/\[initprompt\]//' | head -c 80)
AFTER_SLUG=$(slugify "$AFTER")
printf 'AFTER  descriptor (escaped): %q\n' "$AFTER_SLUG"
echo "AFTER single-line check: $(echo "$AFTER_SLUG" | wc -l) line(s)"
```


## #BASH
_Simulate update-docs fallback fix: before vs after_

```bash
source /home/io/io-dev/io/.claude/hooks/scripts/lib-common.sh

echo "=== Simulation 2: update-docs.sh fallback fix ==="
# LOG_FILENAME with embedded \n\n (as would exist from old log files)
CORRUPT_LOG=$'2026-05-28_workstream-3c-promote-dialog\n\nread-ui-au_041950'
printf 'LOG_FILENAME (escaped): %q\n' "$CORRUPT_LOG"
echo ""

# BEFORE
BEFORE_SLUG=$(slugify "$CORRUPT_LOG" | head -c 50)
printf 'BEFORE NEW_SLUG (escaped): %q\n' "$BEFORE_SLUG"
printf 'BEFORE NEW_DOC would be: .../interim/%q.md\n' "$BEFORE_SLUG"

echo ""

# AFTER
SAFE_LOG=$(printf '%s' "$CORRUPT_LOG" | tr '\n' '-')
AFTER_SLUG=$(slugify "$SAFE_LOG" | head -c 50)
printf 'AFTER  NEW_SLUG (escaped): %q\n' "$AFTER_SLUG"
printf 'AFTER  NEW_DOC would be: .../interim/%s.md\n' "$AFTER_SLUG"
echo "AFTER single-line check: $(echo "$AFTER_SLUG" | wc -l) line(s)"
```


## #BASH
_Simulate chatty claude -p primary path: before vs after_

```bash
echo "=== Simulation 3: chatty claude -p primary path ==="
echo "Input: claude returns preamble then slug"
CHATTY_OUTPUT=$'Here is the slug for the documentation:\nworkstream-3c-promote-dialog\n'
printf 'Raw output (escaped): %q\n' "$CHATTY_OUTPUT"
echo ""

# BEFORE: tr -d ' \n' strips all spaces and newlines, concatenates everything
BEFORE_SLUG=$(printf '%s' "$CHATTY_OUTPUT" | tr -d ' \n' | head -c 60)
printf 'BEFORE NEW_SLUG: %q\n' "$BEFORE_SLUG"
echo "$BEFORE_SLUG" | grep -qE '^[a-z0-9-]+$' && echo "BEFORE regex: PASSES (false positive)" || echo "BEFORE regex: FAILS → fallback triggered"

echo ""

# AFTER: grep -m1 '[a-z]' takes first letter-bearing line, tr -dc strips non-slug chars
AFTER_SLUG=$(printf '%s' "$CHATTY_OUTPUT" | grep -m1 '[a-z]' | tr -dc 'a-z0-9-' | head -c 60)
printf 'AFTER  NEW_SLUG: %q\n' "$AFTER_SLUG"
echo "$AFTER_SLUG" | grep -qE '^[a-z0-9-]+$' && echo "AFTER  regex: PASSES" || echo "AFTER  regex: FAILS"

echo ""
echo "=== Also test: 'File created...' preamble case ==="
TOOL_STATUS_OUTPUT=$'File created at the specified path.\nworkstream-fp1-hexalpha-fix\n'
AFTER_SLUG2=$(printf '%s' "$TOOL_STATUS_OUTPUT" | grep -m1 '[a-z]' | tr -dc 'a-z0-9-' | head -c 60)
printf 'Output (escaped): %q\n' "$TOOL_STATUS_OUTPUT"
printf 'AFTER  NEW_SLUG: %q\n' "$AFTER_SLUG2"
echo "$AFTER_SLUG2" | grep -qE '^[a-z0-9-]+$' && echo "AFTER  regex: PASSES" || echo "AFTER  regex: FAILS"
```


## #ASSISTANT

Simulation 3 reveals a flaw in the recommended `grep -m1 '[a-z]' | tr -dc` approach: the preamble line "Here is the slug:" contains letters, so `grep -m1 '[a-z]'` takes it, `tr -dc` strips it to `ereistheslug...`, and that garbage PASSES the regex — a false positive. The tighter fix is `grep -m1 '^[a-z][a-z0-9-]*$'` which requires the entire line to already be a valid slug. Updating the edit:


## #ASSISTANT

Now re-run all three simulations against the corrected logic:


## #BASH
_Run all three simulations against corrected logic_

```bash
source /home/io/io-dev/io/.claude/hooks/scripts/lib-common.sh

echo "=== Simulation 1: user-prompt-submit.sh — multi-line initprompt ==="
PROMPT=$'[initprompt] fix-something\n\nread ui-audit/...\nThis is the task description.'
DESCRIPTOR_TEXT=$(echo "$PROMPT" | head -1 | sed -E 's/\[initprompt\]//' | head -c 80)
DESCRIPTOR=$(slugify "$DESCRIPTOR_TEXT")
[ -z "$DESCRIPTOR" ] && DESCRIPTOR="work-unit"
DESCRIPTOR=$(echo "$DESCRIPTOR" | head -c 40)
printf 'Input prompt (escaped): %q\n' "$PROMPT"
printf 'Output descriptor: %q\n' "$DESCRIPTOR"
echo "Line count: $(printf '%s' "$DESCRIPTOR" | wc -l)"

echo ""
echo "=== Simulation 2: update-docs fallback — corrupt LOG_FILENAME ==="
CORRUPT_LOG=$'2026-05-28_workstream-3c-promote-dialog\n\nread-ui-au_041950'
printf 'Input LOG_FILENAME (escaped): %q\n' "$CORRUPT_LOG"
SAFE_LOG=$(printf '%s' "$CORRUPT_LOG" | tr '\n' '-')
NEW_SLUG=$(slugify "$SAFE_LOG" | head -c 50)
printf 'Output NEW_SLUG: %q\n' "$NEW_SLUG"
printf 'NEW_DOC path: .../interim/%s.md\n' "$NEW_SLUG"
echo "Line count: $(printf '%s' "$NEW_SLUG" | wc -l)"

echo ""
echo "=== Simulation 3a: primary path — chatty claude output ==="
CHATTY=$'Here is the slug for the documentation:\nworkstream-3c-promote-dialog\n'
printf 'Input (escaped): %q\n' "$CHATTY"
SLUG_3A=$(printf '%s' "$CHATTY" | grep -m1 '^[a-z][a-z0-9-]*$' | head -c 60)
printf 'Output NEW_SLUG: %q\n' "$SLUG_3A"
[ -z "$SLUG_3A" ] && echo "Empty → fallback triggered (correct)" || echo "$SLUG_3A" | grep -qE '^[a-z0-9-]+$' && echo "Regex PASSES"

echo ""
echo "=== Simulation 3b: primary path — 'File created...' preamble ==="
FS=$'File created at the specified path.\nworkstream-fp1-hexalpha-fix\n'
SLUG_3B=$(printf '%s' "$FS" | grep -m1 '^[a-z][a-z0-9-]*$' | head -c 60)
printf 'Output NEW_SLUG: %s\n' "$SLUG_3B"
echo "$SLUG_3B" | grep -qE '^[a-z0-9-]+$' && echo "Regex PASSES" || echo "Regex FAILS → fallback"

echo ""
echo "=== Simulation 3c: primary path — clean slug ==="
CLEAN=$'workstream-4-5c-fp1-hexalpha\n'
SLUG_3C=$(printf '%s' "$CLEAN" | grep -m1 '^[a-z][a-z0-9-]*$' | head -c 60)
printf 'Output NEW_SLUG: %s\n' "$SLUG_3C"
echo "$SLUG_3C" | grep -qE '^[a-z0-9-]+$' && echo "Regex PASSES"
```


## #ASSISTANT

All simulations pass. Now Part 4 — check the current log filename state.


## #BASH
_Check current log filename for embedded newline corruption_

```bash
CURRENT_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt)
printf 'Current log path (escaped): %q\n' "$CURRENT_LOG"
echo ""
echo "Contains embedded newlines: $(printf '%s' "$CURRENT_LOG" | grep -c $'\n') newline(s)"
echo "File exists: $(test -f "$CURRENT_LOG" && echo YES || echo NO)"
```


## #ASSISTANT

Final verification of both edited files at the changed lines:


## #TURN_END

_2026-05-28T08:14:54+00:00_

---

