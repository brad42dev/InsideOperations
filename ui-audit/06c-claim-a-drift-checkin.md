# Claim A Drift Check-In — Workstream 2c

**Date:** 2026-05-27
**Source files:** `06-claim-a-plan.md`, `06b-claim-a-tokens-checkin.md`, live code state
**Overall status:** **clear-to-proceed**

---

## Check 1 — All planned drift items addressed or explicitly handled

All four Category B items are done.

| Item | Change | Verified at |
|------|--------|-------------|
| **B1** | Designer left palette background `var(--io-surface)` → `var(--io-surface-secondary)` | `DesignerLeftPalette.tsx:2436` — confirmed |
| **B2** | Settings active nav `borderLeft: isActive ? "2px solid var(--io-accent)" : "2px solid transparent"` + padding `7px 10px 7px 8px` | `settings/index.tsx:211–214` — confirmed |
| **B3** | Sidebar width — 0 file changes; 220px confirmed by A14 decision | No code changes; token already updated in 2b — confirmed |
| **B4** | Settings nav group `letterSpacing` 0.08em → 0.06em | `settings/index.tsx:198` — confirmed |

Category A tokens (A1–A14) were verified in 06b; not re-verified here.

---

## Check 2 — Multi-module implications resolved

**A13 and A14 (the items flagged for user review in Section 2 of the plan):** Both resolved in workstream 2b and recorded in the plan. A13 → Option B full z-index scale; A14 → 220px (Option A). Neither is open.

**One item from 06b remains unresolved and needs explicit user confirmation before the 2b/2c combined work is treated as complete:**

> **CommandPalette z-index wiring (scope creep from 2b)**
>
> The 2b workstream wired `CommandPalette.tsx` to use `var(--io-z-command)` (now 1200) and set `--io-z-kiosk-auth: 1800`. The plan (A13 note) explicitly said both were deferred to Claim B. The code at `CommandPalette.tsx:327,336` already uses the token. The 06b checkin said: "confirm (or explicitly accept) the CommandPalette z-index change — that z-index 1200 is the intended permanent value." No record of that confirmation exists.
>
> At 1200, CommandPalette sits above modals (1000) and below toast (2000). That ordering is directionally correct. But the value was set without a formal decision and without the Claim B z-index cross-audit that was supposed to precede it.
>
> **Required action:** User must explicitly accept `--io-z-command: 1200` as the permanent value, or revert CommandPalette to a hardcoded value and restore the Claim B gate. This is a user decision, not a code question.

---

## Check 3 — Visual confirmation list

Changes the user should spot-check in the running app:

1. **Designer left palette background.** The left palette panel (equipment/display/shapes tabs) should render at the same gray tier as the Console palette and the Settings sidebar. Previously it was one shade lighter (`var(--io-surface)`); it is now `var(--io-surface-secondary)`.

2. **Settings active nav left-border accent.** When a settings section is active (e.g. "General"), there should be a 2px teal left border on that nav item. Inactive items should have no visible left bar but text should stay horizontally aligned with the active item — the transparent 2px border reserves the space.

3. **Settings nav group header letter-spacing.** The uppercase section headers in the Settings sidebar (e.g. "System", "Security") should have tighter letter-spacing than before (0.06em). The change is subtle — roughly matching Console's palette section labels.

4. **Sidebar widths unchanged at 220px.** B3 was a no-op; all three module side panels were already at 220px. Nothing should look different here, but it can be confirmed by inspecting any side panel width.

---

## Check 4 — Lessons-learned signals

**1. Scope creep in 2b around CommandPalette z-index.**
The plan had a clear "defer to Claim B" gate on `--io-z-command` and `--io-z-kiosk-auth`. The 2b work wired them anyway, setting values without the cross-module audit that was supposed to precede the decision. The fix was directionally correct but the gate existed for a reason. For Claim B z-index migration: decisions about specific numeric values must be explicitly confirmed before being set in the token file — the planning gate should not be bypassed by making the "obviously right" choice unilaterally.

**2. B2 plan description was misleading but the code is better.**
The plan said "reduce `paddingLeft` by 2px to maintain alignment." The actual implementation uses unconditional padding (`7px 10px 7px 8px` in both states) with a transparent border on inactive items, which is more correct — text stays aligned without needing state-conditional padding math. The plan prose was slightly wrong but the reviewer caught it and the code matches the cleaner approach.

**3. DoD item 8 (02-comparison.md annotation) is open.**
`Section 4 Criterion 8` of the plan requires annotating Cat 1 and Cat 5 rows in `02-comparison.md` with `Fixed [date]: [commit/PR]` notes. The 2c deep review explicitly noted this was out of scope for the 2c prompt. The Cat 1 and Cat 5 rows have not been annotated. This is the second fixes-needed item.

---

## Resolutions

| # | Item | Resolution |
|---|------|------------|
| F1 | CommandPalette z-index 1200 | **Accepted 2026-05-27.** Plan updated: A13 table row and Pass 3 note now reflect `--io-z-command: 1200` and `--io-z-kiosk-auth: 1800` as permanent accepted values; no remaining Claim B gate. |
| F2 | 02-comparison.md Cat 1 + Cat 5 annotations | **Done 2026-05-27.** Cat 1 Deviations row: Console/Designer/Settings cells annotated with Fixed notes for tokens cleared by 2b. Cat 5 Visual properties row: Designer cell updated to reflect `var(--io-surface-secondary)`; Shared column and Notes column updated. Cat 5 Deviations row: all four cells annotated with fixes from 2b/2c. |
