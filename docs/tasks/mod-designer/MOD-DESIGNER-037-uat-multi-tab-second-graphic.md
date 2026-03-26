---
id: MOD-DESIGNER-037
unit: MOD-DESIGNER
title: Opening second graphic via File→New does not create a second file tab
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When a user opens a second graphic (via File → New Graphic or by opening an existing graphic while one is already open), the Designer should add a new tab to the file tab bar so both graphics are accessible. Currently, File→New Graphic navigates to /designer/graphics/new and then returns to the canvas but only one tab is ever visible — the second graphic replaces the view rather than opening in a new tab.

UAT Scenarios 3 and 4 both fail as a consequence: no second tab is created, so tab switching cannot be tested.

Expected behavior per MOD-DESIGNER-023 spec:
- Each open graphic gets its own tab in the file tab bar
- Clicking a tab switches the active canvas to that graphic
- File → New Graphic should open in a new tab, not replace the current tab

Observed behavior (2026-03-25 UAT):
- File → New Graphic flow navigated to /designer/graphics/new form, created a graphic, then returned to canvas with only one tab visible
- No second tab appeared in the tab bar
- Tab close button (×) exists and works — the single-tab case is functional

## Acceptance Criteria

- [ ] Opening a second graphic while one is already open adds a new tab to the file tab bar
- [ ] The previously open graphic remains accessible via its tab (not replaced)
- [ ] Clicking the second tab switches the active canvas to the second graphic
- [ ] File → New Graphic opens the new graphic in a new tab

## Verification Checklist

- [ ] Navigate to /designer, open or create a graphic → one tab visible
- [ ] Use File → New Graphic to create a second graphic → two tabs now visible
- [ ] Click the first tab → first graphic canvas shown
- [ ] Click the second tab → second graphic canvas shown
- [ ] No error boundary, no console errors during tab switching

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the single-tab case — multi-tab is the core feature of MOD-DESIGNER-023

## Dev Notes

UAT failure from 2026-03-25: File→New Graphic creates the graphic successfully but the tab bar only ever shows one tab (the current one). The multi-tab state management in the Designer store appears not to be wiring new graphic creations into the tab array.
Spec reference: MOD-DESIGNER-023, MOD-DESIGNER-029
