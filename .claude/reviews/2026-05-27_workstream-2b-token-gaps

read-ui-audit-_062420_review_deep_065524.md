# Review (deep)

**Generated**: 2026-05-27T06:56:37+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_workstream-2b-token-gaps

read-ui-audit-_062420.md`
**Session**: 
**Depth**: deep

---

## Summary

The diff correctly addresses the stated goal: fills undefined token gaps in `index.css` across all three themes, skips items that were already defined or better resolved via consumer changes, and updates the plan file with per-item status. The `PromoteToShapeWizard.tsx` consumer edit (A8) was explicitly authorized by the user mid-session. The emergency z-index fix (raising `--io-z-emergency` from 800 to 3000) was also explicitly requested. However, the A13 z-index rescaling introduced two silent ordering inversions that were not flagged, and the plan file has a stale inconsistency in the A13 table row.

## Concerns

1. **`--io-z-command` ordering inversion — `index.css` z-index section (all three themes)**
   - Before: `--io-z-command: 400` > `--io-z-dropdown: 200` — command palette above dropdowns.
   - After: `--io-z-dropdown: 500` > `--io-z-command: 400` — dropdowns now above the command layer.
   - Any command palette element using `var(--io-z-command)` will now render *below* open dropdowns. This is a functional regression for command palette UX that was not noted in the plan or flagged to the user.

2. **`--io-z-kiosk-auth` ordering inversion — `index.css` z-index section (all three themes)**
   - Before: `--io-z-kiosk-auth: 600` > `--io-z-modal: 300` — auth screen above modals.
   - After: `--io-z-modal: 1000` > `--io-z-kiosk-auth: 600` — regular modals now above the kiosk authentication overlay.
   - For a security-critical surface (kiosk auth is intended as a lock screen), rendering below ordinary modals is a meaningful regression. Not mentioned in the plan's collision notes.

3. **Stale A13 collision note in the plan table — `ui-audit/06-claim-a-plan.md` A13 row**
   - The A13 table row still reads: "`--io-z-emergency` remains at 800, now below `--io-z-toast: 2000`. Both require resolution in the Claim B z-index audit."
   - But the emergency fix (raising it to 3000) was applied in this same session and is documented correctly in Section 3 Pass 3 item 13.
   - The table row was not updated; it contradicts Section 3 and will mislead anyone reading only the table.

## Verification Notes

- All 12 token additions (A1–A7, A9–A11, A10, A14, A4) are correctly applied to all three theme blocks with values that match the audit's evidence.
- `--io-font-sans` is correctly placed in `:root` only (not per-theme), consistent with `--io-font-mono` placement.
- `--io-accent-rgb` per-theme values are correct: dark=`45 212 191`, light=`13 148 136`, hphmi=`20 184 166` — all consistent with the corresponding `--io-accent` hex values.
- A12 (`--io-text-inverse`) skip is correct: the token was already defined in all three themes. The DoD item 2 still references it as one of "two new tokens," which is technically satisfied (both tokens exist) but the framing is slightly misleading — not a blocking issue.
- The `--io-z-visual-lock: 500` / `--io-z-dropdown: 500` tie is noted in the plan and deferred to Claim B — appropriate.
- The PromoteToShapeWizard change removes the `#3b82f6` fallback (info blue, visually inconsistent with the teal accent palette) in favor of `--io-accent-subtle`, which is a visible behavioral change: completed wizard steps will now render as a muted teal tint rather than blue.
