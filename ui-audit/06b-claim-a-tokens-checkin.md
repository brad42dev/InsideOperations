# Claim A Token Registry — Workstream 2b Checkin

**Date:** 2026-05-27  
**Source:** `ui-audit/06-claim-a-plan.md` (plan), `index.css` (live state), `tokens.ts`, `CommandPalette.tsx`, workstream-2b summary  
**Purpose:** Verify 2b completeness and confirm 2c (shell drift) is unblocked

---

## Check 1 — Token gaps: all addressed or skipped with reason

| # | Token | Status | Verified in index.css |
|---|---|---|---|
| A1 | `--io-bg` | ✅ Done | All 3 themes (lines 29, 243, 448) |
| A2 | `--io-text` | ✅ Done | All 3 themes (lines 39, 253, 458) |
| A3 | `--io-surface-hover` | ✅ Done | All 3 themes (lines 30, 244, 449) |
| A4 | `--io-font-sans` | ✅ Done | `:root` only (lines 229–231) |
| A5 | `--io-text-on-accent` | ✅ Done | All 3 themes (lines 40, 254, 459) |
| A6 | `--io-error` | ✅ Done | All 3 themes (lines 86, 299, 504) |
| A7 | `--io-surface-raised` | ✅ Done | All 3 themes (lines 31, 245, 450) |
| A8 | `--io-accent-muted` | ✅ Skipped — consumer fix applied | `PromoteToShapeWizard.tsx:2168` updated to `var(--io-accent-subtle)` |
| A9 | `--io-overlay` | ✅ Done | All 3 themes (lines 150, 363, 568) |
| A10 | `--io-accent-rgb` | ✅ Done | Per-theme: dark=`45 212 191`, light=`13 148 136`, hphmi=`20 184 166` |
| A11 | `--io-alarm-inactive` | ✅ Done | All 3 themes (lines 74, 287, 492) |
| A12 | `--io-text-inverse` | ✅ Skipped — already defined | dark=#09090b, light=#ffffff, hphmi=#0f172a; plan claim was wrong |
| A13 | `--io-z-modal` | ✅ Done | Full scale in all 3 themes: dropdown:500, modal:1000, command:1200, visual-lock:1500, kiosk-auth:1800, toast:2000, emergency:3000 |
| A14 | `--io-sidebar-width` | ✅ Done | 220px in all 3 themes (lines 115, 328, 533); no module code changes |

**Result: All 14 items resolved. Zero open token gaps.**

One documentation inconsistency: `Section 4 DoD` in `06-claim-a-plan.md` still lists `--io-accent-muted` as a required token. Stale — noted in the 2b summary as a cleanup item for the complete-review pass.

---

## Check 2 — Downstream readiness for 2c drift items

Each B-item inspected for token references that must exist before the change can land.

| Drift item | Change | Tokens referenced | Status |
|---|---|---|---|
| **B1** — Designer palette background | `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx` | `--io-surface-secondary` | ✅ Defined in all 3 themes (lines 24, 238, 443) |
| **B2** — Settings active nav indicator | `borderLeft: '2px solid var(--io-accent)'` in `Settings/index.tsx` | `--io-accent` | ✅ Defined in all 3 themes (lines 43, 257, 462) |
| **B3** — Sidebar width code | No file changes (220px = A14 token value; all hardcodes already match) | n/a | ✅ Unblocked — 0 files to touch |
| **B4** — Settings nav group letterSpacing | 0.08em → 0.06em in `Settings/index.tsx` | None (literal value change) | ✅ Unblocked |

**Result: All four drift items unblocked. No missing token references.**

---

## Check 3 — Scope creep signals

### Signal found: CommandPalette z-index wiring done in 2b

**What the plan said (A13 note):**
> `--io-z-command: 400` and `--io-z-kiosk-auth: 600` tokens exist only in `tokens.ts`; no component references them. CommandPalette hardcodes `z-index: 3000/3001`. Full token adoption + value reconciliation deferred to Claim B z-index migration.

**What actually happened (confirmed in code):**
- `CommandPalette.tsx:327` now uses `z-index: var(--io-z-command)` and `calc(var(--io-z-command) + 1)`
- `--io-z-command` is set to **1200** in all three themes (not 400 as in the old `tokens.ts`)
- `--io-z-kiosk-auth` is set to **1800** in all three themes (not 600)
- `tokens.ts` synced to these values

**Impact assessment:**
- CommandPalette effective z-index dropped from 3000 → 1200
- At 1200, CommandPalette sits above modals (1000) but below toast (2000)
- This is likely correct behavior (palette shouldn't override toasts), but it is an unreviewed value change for a globally-visible component
- The value change was not gated on a decision — the plan explicitly said "deferred to Claim B"

**Scope verdict:** This is genuine scope creep — work done that the plan explicitly reserved for Claim B. The CommandPalette change is low-risk and directionally correct, but `--io-z-command: 1200` was set without a stated rationale and without the Claim B cross-module z-index audit that was supposed to precede it.

**Action needed before treating 2b as fully clean:** Confirm (or explicitly accept) the CommandPalette z-index change — that z-index 1200 is the intended permanent value, not a placeholder. If accepted, update the A13 plan note to reflect that command and kiosk-auth are now done (not remaining Claim B items). If not accepted, restore CommandPalette to a hardcoded value and keep the Claim B gate.

This does **not** block 2c. The shell drift items (B1–B4) are independent of CommandPalette z-index behavior.

---

## Overall Status

**CLEAR-TO-PROCEED**

All Category A token gaps are addressed. All four 2c drift items reference tokens that are now defined. The one scope creep signal (CommandPalette z-index) is an out-of-band addition that does not touch the B1–B4 files and does not create any token dependency for 2c. The CommandPalette value question should be resolved in the post-2c review, not before starting 2c.
