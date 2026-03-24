---
id: MOD-DESIGNER-030
unit: MOD-DESIGNER
title: File tab bar missing — no open-file tabs visible in Designer
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

The Designer module is missing a file tab bar that should appear when one or more graphics/dashboards/reports are open. Currently only the mode selector row (◆ Graphic / ▦ Dashboard / 📄 Report) is visible at the top of the editor — there is no per-file tab strip showing the names of open files.

The expected behavior (per MOD-DESIGNER-029 spec) is that when a graphic is open in the editor, a horizontal tab bar appears showing the open file's name as a tab, allowing users to switch between multiple open files.

UAT confirmed this is still missing after MOD-DESIGNER-029 was marked verified: navigating to /designer/graphics/new shows only mode selector buttons, no file tabs.

## Acceptance Criteria

- [ ] When a graphic is open in the designer, a tab bar appears showing the file name as a tab
- [ ] The tab bar is distinct from the mode selector row (◆ Graphic / ▦ Dashboard / 📄 Report)
- [ ] Opening multiple graphics shows multiple tabs in the tab bar
- [ ] The active tab is visually highlighted

## Verification Checklist

- [ ] Navigate to /designer/graphics/new — a tab labeled "New" or the file name appears in a tab bar
- [ ] Tab bar is visible above or below the mode selector row
- [ ] The mode selector (Graphic/Dashboard/Report) remains distinct from the file tabs

## Do NOT

- Do not confuse the mode selector (Graphic/Dashboard/Report) with file tabs — these are different UI elements
- Do not stub this with a TODO comment

## Dev Notes

UAT failure 2026-03-24: /designer/graphics/new loads with mode selector row (◆ Graphic, ▦ Dashboard, 📄 Report) but no file tab bar is visible.
Spec reference: MOD-DESIGNER-029 (prior bug task for this issue, marked verified but still failing in browser)
