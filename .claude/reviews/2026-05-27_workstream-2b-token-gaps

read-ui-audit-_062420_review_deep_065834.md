# Review (deep)

**Generated**: 2026-05-27T06:59:53+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_workstream-2b-token-gaps

read-ui-audit-_062420.md`
**Session**: 9e140892-32fe-421e-b0aa-3f311e999236
**Depth**: deep

---

## Summary

The diff matches the stated intent with two authorized scope expansions. All 14 plan items were processed: 11 tokens added to `index.css` across three themes, A12 correctly skipped (already defined), A8 correctly skipped (consumer fix applied with user authorization), and A13/A14 decisions executed. Beyond the original A13 scope, `--io-z-emergency` (800→3000) and `--io-z-visual-lock` (500→1500) were corrected after a second review pass — both authorized by the user mid-session. The plan doc is comprehensively updated. Two concerns below are not regressions but will create incorrect baseline values for Claim B.

## Concerns

1. **`--io-z-command: 400` is now semantically inverted against `--io-z-dropdown: 500`.**
   - Location: `index.css` lines ~209–222 (dark theme), and equivalents in light/HPHMI blocks.
   - Before: `--io-z-command: 400` was above `--io-z-dropdown: 200`. A command palette above dropdowns is correct behavior.
   - After: `--io-z-command: 400` sits *below* `--io-z-dropdown: 500`. No functional regression now because `CommandPalette` hardcodes `z-index: 3000/3001` and ignores the token. However, when Claim B migrates `CommandPalette` to use the token, it will pick up an incorrect value. The plan note calls this out as a "Remaining Claim B item" but doesn't flag the value as wrong — it should.

2. **`--io-z-kiosk-auth: 600` is now below `--io-z-modal: 1000`.**
   - Same location as above.
   - Kiosk auth is by definition a full-screen blocking overlay; it must render above modals, not below them. The original value (600 vs modal 300) preserved this. After the scale change it is inverted. No component consumes this token today, so no visual regression, but the convention is wrong. Should be ≥1500 (above modal, optionally equal to visual-lock or above it).

3. **Section 4 DoD item 2 is stale.**
   - Location: `ui-audit/06-claim-a-plan.md`, Section 4, item 2.
   - Still reads: "`--io-alarm-inactive` and `--io-text-inverse` exist in `index.css` with documented values." But A12 was skipped because `--io-text-inverse` was already defined — it was not added by this work unit. The DoD should read `--io-alarm-inactive` only as the newly registered token, with a note that `--io-text-inverse` was found already present.

## Verification Notes

- `--io-font-sans` is correctly defined in `:root` only (not per-theme), matching the `--io-font-mono` pattern. The font stack matches the `body` selector declaration exactly.
- `--io-accent-rgb` uses space-separated format (`45 212 191`) for modern CSS `rgba(var(--io-accent-rgb) / 0.1)` syntax. Per-theme values correctly decompose the per-theme `--io-accent` hex: dark `#2dd4bf` → `45 212 191`, light `#0d9488` → `13 148 136`, HPHMI `#14b8a6` → `20 184 166`.
- All per-theme tokens (`--io-bg`, `--io-surface-hover`, `--io-surface-raised`, `--io-text`, `--io-text-on-accent`, `--io-overlay`, `--io-alarm-inactive`, `--io-error`) are applied consistently across all three theme blocks.
- `PromoteToShapeWizard.tsx:2168` change is a single-line substitution from the undefined `var(--io-accent-muted, #3b82f6)` to the defined `var(--io-accent-subtle)`. The fallback `#3b82f6` (info blue) would have been visually incongruous; `--io-accent-subtle` (teal at 10% opacity) is thematically consistent. User-authorized, low-risk.
- `02-comparison.md` and `04-recommendations.md` were not modified, per the prompt constraint.
