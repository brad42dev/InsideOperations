# Review (deep)

**Generated**: 2026-05-28T07:26:20+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-4-5c-fp1-hexalpha

read-ui-au_071913.md`
**Session**: 4aa54d94-de4d-4b86-b9f3-6ae89f730e93
**Depth**: deep

---

## Summary

The diff matches intent precisely. Four files had the hex-alpha concatenation bug (`${color}20` / `${color}40` as CSS values); all four were fixed with `color-mix(in srgb, ${color} N%, transparent)` using the specified percentages. The audit document was updated in both locations where FP-1 appeared. No unrelated code was touched.

## Concerns

1. **`MaintenanceTicketsPanel.tsx` has no border fix, but this is correct.** The `StatusPill` component in that file only has a `background` property — there was no `border: 1px solid ${color}40` line to fix. The full file confirms this. The work unit log correctly notes "background only — no border." Not a gap, but worth calling out explicitly since three of the four files fixed both properties while this one only fixed one.

2. **OpcSources.tsx was not the actual source of the percentages.** The initprompt specified the percentages (12% / 25%) and stated they came from the OpcSources fix, but the OpcSources file uses semantic token maps, not `color-mix()`. The percentages are arithmetically correct (0x20/255 ≈ 12.5% → 12%; 0x40/255 ≈ 25.1% → 25%), so there is no bug here — but the audit doc's Section 4 description ("The fix pattern is fully established (OpcSources fix, Claim A)") remains in the retained text and now slightly mischaracterizes the reference. This is a documentation accuracy issue, not a code defect.

3. **Section 4 FP-1 entry was rewritten rather than annotated.** The original rationale paragraph ("This should land before Claim C opens, not because Claim C depends on it…") was removed and replaced with the resolution summary. Section 7's item 1 used a strike-through approach instead. The two approaches are inconsistent. Neither is wrong, but the Section 4 approach deletes historical reasoning that may have value for understanding the sequencing decision. Low severity.

## Verification Notes

The `color-mix()` syntax used (`color-mix(in srgb, ${color} N%, transparent)`) is valid CSS Color Level 5 and correctly produces a semi-transparent tinted background from a hex or CSS variable color. Both the background opacity (12%) and border opacity (25%) are consistent across all three files that have borders. The components are local per-file implementations (not shared), which the fix handled correctly by applying the change independently to each.
