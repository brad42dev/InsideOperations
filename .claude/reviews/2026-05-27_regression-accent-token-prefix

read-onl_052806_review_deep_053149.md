# Review (deep)

**Generated**: 2026-05-27T05:32:36+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_regression-accent-token-prefix

read-onl_052806.md`
**Session**: 7b3e9adb-0cfd-40e4-8d10-41a20da9a984
**Depth**: deep

---

## Summary

The diff matches the stated intent precisely: four `var(--accent)` / hardcoded-blue references in the two source files are replaced with the correct `--io-` prefixed tokens, and the audit markdown files are updated to mark the regression resolved. The code changes are minimal and surgical — no behavioral logic was touched, no out-of-scope files modified, and no new tokens were invented. One documentation inconsistency is present but minor.

## Concerns

1. **Stale "Visual properties actually applied" field in `02-comparison.md` (Category 5 Shared Infrastructure, line ~72)**
   The "Deviations from app shell" and "Notes" fields were updated to record the fix, but the "Visual properties actually applied" field still describes the pre-fix broken state: `outline: 2px solid var(--accent)`, `0 0 12px 2px var(--accent)`, `background: rgba(80,180,255,0.08)`, `border: 1px dashed var(--accent)`. A reader of the audit document now sees a table row where "what's applied" contradicts "what the deviation was." The prompt said to update "deviations and notes fields," so this was arguably in-scope to not touch — but the current state leaves a documentation inconsistency that will confuse future readers.

2. **Same stale field in Category 10 secondary entry (`02-comparison.md`, line ~161)**
   The "Visual properties actually applied" field there still reads `selection-box outline and soft-glow via var(--accent) (broken prefix); marquee rect rgba(80,180,255,0.08) bg + 1px dashed var(--accent) border`. Same issue as concern 1, same cause.

3. **`Source-of-truth files` still annotates `:101` as "(token deviation)" in the Category 5 entry**
   After the fix, line 101 of `MarqueeLayer.tsx` is no longer a deviation — it's the corrected token reference. This is a stale annotation and could mislead someone reading the audit. Minor, but a future reader doing a targeted review of `:101` will find the fix and be confused by the parenthetical.

## Verification Notes

The four code substitutions are exactly correct and confirmed against the full file contents:
- `selection.css` lines 2 and 9: `var(--accent)` → `var(--io-accent)` ✓
- `MarqueeLayer.tsx` line 100: `rgba(80, 180, 255, 0.08)` → `var(--io-accent-subtle)` ✓
- `MarqueeLayer.tsx` line 101: `var(--accent)` → `var(--io-accent)` ✓

Both `--io-accent` and `--io-accent-subtle` are confirmed defined tokens in `index.css` (the agent grepped and verified before making changes). The audit markdown updates consistently use the date `2026-05-27` and accurate line references. No Claim A/B/C-scoped files were touched.
