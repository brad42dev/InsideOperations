# Work Unit Log: diagnose-interim-slug-corruption

read-o

Started: 2026-05-28T08:03:41+00:00
Session: ffa17917-b4de-4b76-bb68-25717ee917f0

---


## #PROMPT

_2026-05-28T08:09:41+00:00_

```
~initprompt~ diagnose-interim-slug-corruption

Read-only diagnostic. Do not modify or rename anything. The FP-1 interim doc had a malformed filename with embedded newlines and a "read-ui-a" junk suffix; seven other interim docs share the pattern. Characterize the corruption and find its source.

Step one, inventory all malformed interim docs. List .claude/docs/interim/ with byte-accurate names (printf '%q' or ls -b). For each file whose name contains a newline, control character, or a "read-" / "read-ui-a" style junk suffix, report: the full escaped name, the date prefix, the intended slug (the clean part before the corruption), and the file size.

Step two, check internal consistency. For each malformed file, read its frontmatter id field. Report whether the id is clean (correct slug) or also corrupted. This tells us whether the corruption is filename-only or also in the content.

Step three, find the slug-generation source. Read .claude/hooks/scripts/update-docs.sh, specifically the NEW_SLUG generation block (where it calls claude -p to suggest a kebab-case slug when no existing doc covers the modified files). Analyze: if that claude -p call returned multi-line output, or output with a preamble/suffix instead of a bare slug, how would the filename be constructed? Trace exactly how NEW_SLUG flows into the filename. Identify whether the current sanitation (the grep -qE '^[a-z0-9-]+$' check and the head -c 60) would catch or pass through a multi-line or junk-suffixed slug.

Step four, determine if the bug is still live. Based on step three, state whether the slug-generation path would still produce a corrupted filename today, AFTER the CLAUDE_PROJECT_DIR sub-session fix that was just applied. The CWD fix addressed hook-error text leaking into content; it did NOT necessarily address chatty claude -p slug output. State clearly: is the filename-corruption bug fixed, partially fixed, or still live?

Step five, recommend. If still live, propose the minimal hardening to update-docs.sh's slug handling (e.g. take only the first line, strip non-slug characters, enforce the regex as a hard gate with a deterministic fallback). Do not apply it. If already fixed by the CWD change, explain why.

When done print: count of malformed interim docs, filename-only vs content-corrupted breakdown, slug-bug status (fixed/partial/live), and a one-line fix recommendation. Stop.
```


## #ASSISTANT

Starting with a byte-accurate inventory and reading `update-docs.sh` in parallel.


## #BASH
_List all malformed filenames with sizes_

```bash
for f in /home/io/io-dev/io/.claude/docs/interim/*; do printf '%q\t%s\n' "$f" "$(wc -c < "$f")"; done | grep "\\$'" 
```


## #ASSISTANT

Good. Now reading the frontmatter of each malformed doc simultaneously:


## #BASH
_Check frontmatter id in each malformed doc_

```bash
# Read frontmatter id from each malformed file safely
for f in /home/io/io-dev/io/.claude/docs/interim/*; do
    escaped=$(printf '%q' "$f")
    if [[ "$escaped" == \$\'* ]]; then
        # Has embedded control chars — extract id line
        id_line=$(head -10 "$f" 2>/dev/null | grep '^id:')
        echo "FILE: $escaped"
        echo "  ID: ${id_line:-<not found>}"
        echo "  SIZE: $(wc -c < "$f" 2>/dev/null)"
    fi
done
```


## #ASSISTANT

Now I have everything needed for the full analysis. Let me verify the exact mechanism by checking how `LOG_FILENAME` flows from a malformed log path:


## #BASH
_Simulate the slug fallback path with malformed LOG_FILENAME_

```bash
# Demonstrate slugify behavior on a LOG_FILENAME with embedded newlines
# This simulates what update-docs.sh does with the fallback path

# Source slugify from lib-common.sh
source /home/io/io-dev/io/.claude/hooks/scripts/lib-common.sh 2>/dev/null

# Simulate LOG_FILENAME for the FP-1 work unit (with embedded \n\n as actual bytes)
LOG_FILENAME=$'2026-05-28_workstream-4-5c-fp1-hexalpha\n\nread-ui-au_071913'

echo "=== LOG_FILENAME (escaped) ==="
printf '%q\n' "$LOG_FILENAME"

echo ""
echo "=== slugify output (escaped) ==="
SLUG_OUT=$(slugify "$LOG_FILENAME")
printf '%q\n' "$SLUG_OUT"

echo ""
echo "=== head -c 50 of slugify output (escaped) ==="
TRUNCATED=$(slugify "$LOG_FILENAME" | head -c 50)
printf '%q\n' "$TRUNCATED"

echo ""
echo "=== Does the regex check pass on this? ==="
echo "$TRUNCATED" | grep -qE '^[a-z0-9-]+$' && echo "PASSES (bug: fallback bypassed)" || echo "FAILS (fallback triggered)"
```


## #ASSISTANT

That confirms the exact mechanism. The regex check passes on the corrupted slug because grep checks per-line — the first line is clean, so the check reports no problem. One more verification:


## #BASH
_Confirm id field corruption breakdown_

```bash
# Verify: confirmdialog has the junk suffix '-re' in its id (content-corrupted)
# vs. others where claude truncated at the newline (clean id)

echo "=== confirmdialog id (content-corrupted case) ==="
find /home/io/io-dev/io/.claude/docs/interim/ -name "2026-05-28-workstream-3c-promote-confirmdialog*" ! -name "*.update-proposal-*" -print0 | xargs -0 head -12

echo ""
echo "=== statusbadge id (filename-only corruption) ==="
find /home/io/io-dev/io/.claude/docs/interim/ -name "2026-05-28-workstream-3c-promote-statusbadge*" ! -name "*.update-proposal-*" -print0 | xargs -0 head -4
```


## #ASSISTANT

The `statusbadge` id field also has an embedded newline in the file — the earlier `grep '^id:'` only captured the first line. Let me check all malformed docs' full frontmatter:


## #BASH
_Read first 15 lines of each malformed doc to expose embedded newlines in frontmatter_

```bash
for f in /home/io/io-dev/io/.claude/docs/interim/*; do
    escaped=$(printf '%q' "$f")
    if [[ "$escaped" == \$\'* ]] && [[ "$f" != *.update-proposal-* ]]; then
        echo "=== $(basename "$f") ==="
        head -15 "$f"
        echo ""
    fi
done
```


## #TURN_END

_2026-05-28T08:09:42+00:00_

---

