# Review (deep)

**Generated**: 2026-05-28T03:26:53+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3b-constants-files

read-ui-a_024054.md`
**Session**: 1e0f20f9-2a81-4d6a-8292-8a1b6ef58604
**Depth**: deep

---

## Summary

The diff matches intent cleanly. Four files were created at the exact locations specified in the plan, all properties match the authoritative spec blocks exactly, and the plan status markers were updated correctly. No existing files were modified beyond the plan doc itself, and no consumer migration was attempted — the scope constraint was honored. One stale name in the plan (`buttonHoverClass` → `buttonBaseClass`) was corrected in the same session, which is appropriate.

## Concerns

1. **`btnSmall` missing `fontWeight: 600` — plan internal inconsistency baked into the artifact.** The divergence standardization table in Section 1.1 says "Align all variants: 600" but the `btnSmall` formal spec block omits `fontWeight`. The implementation follows the spec block (`buttons.ts:41–49`), so `btnSmall` renders at 400 weight while every other variant is 600. Future consumers may not notice and will ship visually inconsistent small buttons. The fix belongs in the plan's spec block and then the file; neither was touched.

2. **`accentColor` for checkboxes appears in the converged-values table but not in `inputStyle`.** Section 1.2's "Decisions where modules have converged" table (`inputs.ts` plan) lists `accentColor: "var(--io-accent)"` as something to capture as-is. It is absent from the spec block and from the implementation (`inputs.ts:12–22`). Checkboxes are semantically distinct from the text/select/textarea targets of this style object, so the omission is likely deliberate, but it is undocumented. Consumers migrating checkbox styling will need to apply `accentColor` separately with no guidance from the file.

3. **`inputs.css` focus-visible ring is defeatable by inline `outline: none` at consumer call sites.** The file correctly omits `outline: none` from `inputStyle` to fix the accessibility gap. But `input.io-input:focus-visible { outline: 2px solid ... }` (`inputs.css:5–11`) is a class selector — it loses to any inline style. Existing consumers that add `style={{ ...inputStyle, outline: "none" }}` (a common pattern in the files being targeted for migration, e.g. `PaneConfigModal.tsx` lines 79, 319, 369) will silently suppress the focus ring. The consumer migration instructions don't explicitly call out that `outline: "none"` must be removed from all inline style spreads, not just from the base `inputStyle` object. This is a future migration concern, not a fault in this diff, but it is a real risk for the accessibility intent.

## Verification Notes

- Both CSS companion files are **entirely inert** until a consumer imports them — Vite will not bundle them otherwise. This is by design for this phase, but `buttons.css` has no import anywhere in the codebase, meaning `buttonBaseClass` currently provides the class name with no rules attached. The first consumer migration PR must import both the `.ts` and `.css` files together, or hover/focus-visible will silently do nothing.
- No index.ts barrel was created for `shared/styles/`. This is consistent with the project convention — `shared/components/` also uses direct path imports, no barrel. Not a concern.
- The `shared/styles/` directory is new. TypeScript will resolve the imports fine (no tsconfig changes needed), but no build verification was run. Given the files export plain `CSSProperties` objects with no JSX or exotic syntax, build risk is negligible.
