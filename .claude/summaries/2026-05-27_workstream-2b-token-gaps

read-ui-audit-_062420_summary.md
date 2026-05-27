# Work Unit Summary

**Generated**: 2026-05-27T07:11:56+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_workstream-2b-token-gaps

read-ui-audit-_062420.md`
**Session**: 9e140892-32fe-421e-b0aa-3f311e999236

---

## Work unit purpose

Workstream 2B: implement all Category A token registry gaps from the Claim A plan — adding missing CSS custom properties to `index.css` across all three themes, correcting two existing token values, and updating the plan file with completion status.

## Key decisions made

- **A8 (`--io-accent-muted`)**: declined to define a new token; single usage in `PromoteToShapeWizard.tsx` replaced with existing `var(--io-accent-subtle)` directly
- **A12 (`--io-text-inverse`)**: skipped — audit plan was wrong, token was already defined in all three themes
- **A13 z-index scale**: Option B selected — full scale (`--io-z-dropdown: 500`, `--io-z-modal: 1000`, `--io-z-toast: 2000`); subsequently corrected `--io-z-emergency` from 800 to 3000 after identifying live stacking regression
- **A14 sidebar width**: Option A selected — token updated to 220px (matching all existing hardcodes), no component file changes
- **`--io-z-visual-lock`** raised to 1500 (above modal, below toast) after identifying it was colliding with `--io-z-dropdown` at 500
- **CommandPalette** wired to `var(--io-z-command)` to replace hardcoded 3000/3001
- Full z-index scale: `dropdown:500 modal:1000 command:1200 visual-lock:1500 kiosk-auth:1800 toast:2000 emergency:3000`

## What was built or changed

- Added 11 missing tokens to all three theme blocks in `index.css`: `--io-bg`, `--io-text`, `--io-surface-hover`, `--io-surface-raised`, `--io-text-on-accent`, `--io-error`, `--io-overlay`, `--io-accent-rgb` (per-theme RGB triplets), `--io-alarm-inactive`
- Added `--io-font-sans` to `:root` only (static, matches body font stack)
- Corrected `--io-sidebar-width` from 240px to 220px in all three themes
- Replaced full z-index band in all three theme blocks with the new scale
- Synced `tokens.ts` z-index values to match new scale
- Replaced `var(--io-accent-muted, #3b82f6)` with `var(--io-accent-subtle)` in `PromoteToShapeWizard.tsx:2168`
- Wired `CommandPalette.tsx` to use `var(--io-z-command)` / `calc(var(--io-z-command) + 1)`
- Updated `ui-audit/06-claim-a-plan.md` with per-item completion status, skip reasons, and collision notes

## What was deliberately not done

- No shell drift items touched (B1–B4 deferred to a later pass)
- No canvas-layer file edits (Claim C deferral respected)
- `--io-accent-muted` token not defined — single-use case resolved at the consumer instead
- `02-comparison.md` and `04-recommendations.md` not updated (deferred to the Claim A complete-review prompt)

## Open questions or follow-ups

- `--io-z-visual-lock` and `--io-z-kiosk-auth` are defined but no component currently consumes them — full z-index reconciliation required in Claim B
- Section 4 DoD in the plan still references `--io-accent-muted` as a required token (stale); needs cleanup in the complete-review pass
- Claim B must reconcile z-index scale against all hardcoded `zIndex` values in the codebase before the scale is treated as stable

## Files modified

- `frontend/src/index.css`
- `frontend/src/pages/designer/components/PromoteToShapeWizard.tsx`
- `frontend/src/shared/components/CommandPalette.tsx`
- `frontend/src/shared/theme/tokens.ts`
- `ui-audit/06-claim-a-plan.md`
