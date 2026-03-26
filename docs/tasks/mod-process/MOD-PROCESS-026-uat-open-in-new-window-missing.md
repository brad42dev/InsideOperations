---
id: MOD-PROCESS-026
unit: MOD-PROCESS
title: No "Open in New Window" button in Process view toolbar
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-PROCESS/CURRENT.md
---

## What to Build

The Process view toolbar is missing an "Open in New Window" button. The toolbar currently
contains: 100%, −, +, Fit, 100%, ● Live, ◷ Historical, ★, Export, Print, Map,
Toggle fullscreen — but no button to open the current view in a detached window.

Per the task spec title "Add 'Open in New Window' button to Process view toolbar", this
button should open the detached window route (/detached/process/:viewId) in a new browser
window, displaying the currently selected graphic.

The detached route itself (/detached/process/:viewId) is already implemented and working
correctly — it just needs to be wired up from the main toolbar.

## Acceptance Criteria

- [ ] An "Open in New Window" button (or icon equivalent) is present in the main Process view toolbar
- [ ] Clicking the button opens /detached/process/:currentViewId in a new browser window
- [ ] Button is only active / enabled when a graphic is currently loaded (not when showing the empty "Select a graphic from the sidebar" state)
- [ ] Button is styled consistently with other toolbar buttons (Export, Print, Map)

## Verification Checklist

- [ ] Navigate to /process — confirm "Open in New Window" button visible in view toolbar
- [ ] Load a graphic from the sidebar, click the button — new window opens at /detached/process/{viewId}
- [ ] No graphic loaded (empty state) — button is disabled or absent
- [ ] Toolbar button order matches design intent (placed logically near Export/Print)

## Do NOT

- Do not re-implement the detached window route — it already works at /detached/process/:viewId
- Do not use window.open with the full app URL — use the /detached route specifically

## Dev Notes

UAT failure 2026-03-26: Main process view toolbar at /process contains no "Open in New Window"
button. Toolbar observed: 100%, −, +, Fit, 100%, ● Live, ◷ Historical, ★, Export, Print,
Map, Toggle fullscreen. The detached route /detached/process/test-view-id renders correctly
(confirmed in prior UAT session) — only the toolbar button is missing.
Spec references: MOD-PROCESS-025, MOD-PROCESS-016
