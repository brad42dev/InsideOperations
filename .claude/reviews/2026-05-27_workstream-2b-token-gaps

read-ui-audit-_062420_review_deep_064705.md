# Review (deep)

**Generated**: 2026-05-27T06:48:39+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_workstream-2b-token-gaps

read-ui-audit-_062420.md`
**Session**: 9e140892-32fe-421e-b0aa-3f311e999236
**Depth**: deep

---

## Summary

The diff correctly fills 11 of 14 token gaps (A1–A7, A9–A11, A13–A14), skips 2 with documented rationale (A8 consumer-fix preferred, A12 already defined), and updates the plan accurately. However, the z-index changes introduce two stacking-order inversions that weren't present before the diff, the PromoteToShapeWizard.tsx change was made despite the prompt explicitly prohibiting consumer file edits in this pass, and the A8 plan entry remains misleadingly stale about work that was already done.

## Concerns

**1. `--io-z-command` inverted relative to `--io-z-dropdown` — silent regression**

- **What:** Before the diff, `--io-z-command: 400` > `--io-z-dropdown: 200`. After the diff, `--io-z-command: 400` < `--io-z-dropdown: 500`. The command palette is now below dropdowns in the token scale.
- **Where:** `index.css` z-index block in all three theme blocks (dark ~line 209–220, light ~line 422, hphmi ~line 627).
- **Why this matters:** Any future code consuming these tokens for the command palette will render below an open dropdown. The pre-diff scale was consistent (command > dropdown); the new scale is not. The plan's collision note mentions `--io-z-visual-lock` and `--io-z-emergency` but does not mention this inversion.

**2. `--io-z-emergency: 800` is now below `--io-z-toast: 2000` — live stacking inversion**

- **What:** The plan flags this as a concern but commits the tokens anyway. Any code today that renders an emergency overlay alongside a toast will have the toast win. This isn't a future Claim B problem — it takes effect the moment any code uses both tokens.
- **Where:** All three theme z-index blocks; `--io-z-emergency` unchanged at 800, `--io-z-toast` raised from 700 to 2000.
- **Why this diverges from intent:** The plan's stated reasoning for Option B was to align with actual usage (1000–9999 range). Emergency signals by definition should outrank transient notifications. The diff creates a token scale that contradicts this hierarchy without resolving it first.

**3. PromoteToShapeWizard.tsx edited despite explicit prompt prohibition**

- **What:** The initial prompt says "Do not modify any consumer files in this prompt." The diff modifies `PromoteToShapeWizard.tsx:2165` (changing `var(--io-accent-muted, #3b82f6)` to `var(--io-accent-subtle)`).
- **Where:** `frontend/src/pages/designer/components/PromoteToShapeWizard.tsx`, line 2168 in pre-diff numbering.
- **Why this is a concern:** The change was made after a user follow-up exchange, which counts as authorization. But the A8 plan entry was not updated to reflect completion — it still says "**Action required in a consumer-file pass:** update `PromoteToShapeWizard.tsx:2168`..." This makes the plan's A8 status misleading: it's marked `⚠ Skipped — consumer fix preferred` but the consumer fix was already applied.

**4. Section 4 DoD item 2 is stale**

- **What:** DoD item 2 reads "Two new tokens defined. `--io-alarm-inactive` and `--io-text-inverse` exist in `index.css` with documented values." `--io-text-inverse` was pre-existing (A12 skip); the phrasing implies it was added in this workstream.
- **Where:** `ui-audit/06-claim-a-plan.md`, Section 4 item 2.
- **Why this matters:** Not a code bug, but the DoD criterion as written cannot be used to verify whether this workstream's work is complete — it conflates pre-existing state with new additions.

## Verification Notes

- All 11 completed tokens are correctly applied to all three theme blocks (dark/light/hphmi) — no theme was missed.
- `--io-font-sans` is correctly placed only in `:root` (consistent with `--io-font-mono` pattern); theme blocks inherit it.
- `--io-accent-rgb` per-theme values are arithmetically correct: dark `#2dd4bf` → `45 212 191`, light `#0d9488` → `13 148 136`, hphmi `#14b8a6` → `20 184 166`.
- The header comment "CSS Custom Properties (138 tokens)" was not updated after adding ~10 new token names; the count is now stale.
- The `--io-z-visual-lock: 500` collision with `--io-z-dropdown: 500` is correctly flagged in the plan.
