---
id: MOD-PROCESS-023
unit: MOD-PROCESS
title: No minimap toggle button in main Process view toolbar
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-PROCESS/CURRENT.md
---

## What to Build

The main Process view toolbar is missing a minimap toggle button. The detached window
route (/detached/process/:viewId) has a "Map" button in its title bar, but the main
Process view toolbar (which has zoom controls, Live/Historical, ★, Export, Print,
Fullscreen) has no minimap/Map toggle.

Additionally, pressing the M key in the main process view produces no visible change,
indicating the keyboard shortcut is also not wired up.

Per spec MOD-PROCESS-017: "Collapsing the minimap (M key or toggle button) persists
the state across page reloads." This requires a toggle button to exist.

## Acceptance Criteria

- [ ] A minimap toggle button (e.g., "Map" or map icon) is present in the main Process view toolbar
- [ ] Clicking the toggle button collapses/expands the minimap overlay on the canvas
- [ ] Pressing the M key toggles the minimap (keyboard shortcut)
- [ ] The collapsed/expanded state persists across page reloads (server-side user preferences)
- [ ] On page load, minimap opens in the same state it was left in

## Verification Checklist

- [ ] Navigate to /process — confirm minimap toggle button visible in view toolbar
- [ ] Click toggle — minimap overlay collapses/expands
- [ ] Press M key — minimap toggles
- [ ] Collapse minimap, reload page — minimap remains collapsed
- [ ] Expand minimap, reload page — minimap remains expanded

## Do NOT

- Do not use localStorage for persistence — spec requires server-side user preferences
- Do not implement minimap toggle only in detached view — main view needs it too

## Dev Notes

UAT failure 2026-03-26: Main process view toolbar contains: 100%, −, +, Fit, 100%,
● Live, ◷ Historical, ★, Export, Print, Toggle fullscreen. No Map/Minimap button.
Pressing M key produced no change. Detached route /detached/process/:viewId DOES have
"Map" button — use that implementation as reference.
Spec references: MOD-PROCESS-017, MOD-PROCESS-011
