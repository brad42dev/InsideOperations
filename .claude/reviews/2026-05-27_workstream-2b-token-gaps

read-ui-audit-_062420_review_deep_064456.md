# Review (deep)

**Generated**: 2026-05-27T06:46:30+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_workstream-2b-token-gaps

read-ui-audit-_062420.md`
**Session**: 
**Depth**: deep

---

## Summary

The diff matches the intent of the initprompt on all token additions in `index.css` and correctly skips A12 (already defined) and A8 (single-use, no shared pattern). All added token values are semantically accurate and consistent across all three theme blocks. However, there are two meaningful divergences: a consumer-file edit that the initprompt explicitly prohibited, and a stale Definition-of-Done entry in the plan file that now contradicts the A8 decision.

## Concerns

1. **Consumer file edited despite explicit prohibition.**
   `PromoteToShapeWizard.tsx:2168` was changed from `"var(--io-accent-muted, #3b82f6)"` to `"var(--io-accent-subtle)"` (diff line for that file, confirmed by the `#EDIT` entry at 06:38:37). The initprompt states: *"Do not modify any consumer files in this prompt; the goal is only to fill the token registry."* The change is mechanically correct, but it violated the stated scope boundary. It was retroactively confirmed by a follow-up user question, not authorized before the fact. This is worth noting because the constraint existed for a reason (to keep the token pass isolated), and the edit landed before user confirmation, not after.

2. **Section 4 DoD still requires `--io-accent-muted` to be defined in `index.css`.**
   `ui-audit/06-claim-a-plan.md` Section 4 item 1 reads: *"Each token in the set {…, `--io-accent-muted`, …} is defined in `index.css`."* The A8 decision resolves the gap via a consumer fix rather than by defining the token, which means this DoD criterion can never be satisfied as written. The A8 row was updated with a ⚠ Skipped status, but the DoD text (`06-claim-a-plan.md` Section 4, item 1) was not edited to reflect the revised resolution path.

3. **`--io-z-emergency: 800` is now below `--io-z-toast: 2000`.**
   After A13, the z-index scale reads: toast=2000, emergency=800. Emergency overlays now render *beneath* toast notifications by default. The plan acknowledges this as a Claim B concern, but unlike the `--io-z-visual-lock` collision (which is between two structural tokens), the emergency/toast inversion has a direct functional implication: if an emergency banner and a toast notification ever coexist, the toast wins. This is more than a naming inconsistency — it changes observable stacking behavior today.

## Verification Notes

- All three theme blocks (dark, light, hphmi) receive the same set of new tokens consistently. No theme-block omissions were detected.
- `--io-accent-rgb` values were computed correctly: dark `45 212 191` (#2dd4bf), light `13 148 136` (#0d9488), hphmi `20 184 166` (#14b8a6). The inline comment in the dark block pointing to the per-theme variants is a useful maintenance aid.
- `--io-font-sans` is correctly placed in the `:root` block only (not repeated in light/hphmi overrides), consistent with how `--io-font-mono` is handled.
- A12 skip is correct: `--io-text-inverse` was already defined with appropriate per-theme values (dark `#09090b`, light `#ffffff`, hphmi `#0f172a`). The plan entry was erroneous.
- The `--io-z-dropdown: 500` / `--io-z-visual-lock: 500` collision is noted in the plan with appropriate deferral to Claim B. The plan accurately characterizes the state.
