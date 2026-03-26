---
unit: MOD-CONSOLE
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 15
scenarios_passed: 13
scenarios_failed: 2
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /console loads real implementation — workspace tabs, left nav panel with Favorites/Graphics/Widgets/Points sections, workspace pane grid. No error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [MOD-CONSOLE-001] Console renders without error | ✅ pass | Full UI visible, no error boundary |
| 2 | Data Flow | [MOD-CONSOLE-001] GET /api/v1/workspaces — workspaces load | ✅ pass | "Workspace 3" and "Reactor Overview" visible in nav and tabs |
| 3 | Left Nav | [MOD-CONSOLE-001][MOD-CONSOLE-016] Favorites group visible | ✅ pass | "Favorites" section with "No favorites yet" present in left nav |
| 4 | Left Nav | [MOD-CONSOLE-001] View-mode selector (list/grid/thumbnail) | ✅ pass | All 3 view mode buttons visible in Workspaces section header |
| 5 | Context Menu | [MOD-CONSOLE-034] Right-click workspace in list view | ✅ pass | Menu shows: Open, Add to Favorites, Rename…, Duplicate, Delete |
| 6 | Context Menu | [MOD-CONSOLE-034] Right-click workspace in thumbnail view | ✅ pass | Full menu: Open, Add to Favorites, Rename…, Duplicate, Delete |
| 7 | Context Menu | [MOD-CONSOLE-034] Right-click workspace in grid view | ✅ pass | Full menu: Open, Add to Favorites, Rename…, Duplicate, Delete |
| 8 | Dirty Indicator | [MOD-CONSOLE-029][MOD-CONSOLE-032] Tab shows unsaved indicator | ✅ pass | Tab changed to "Workspace 3 Unsaved changes" immediately after layout change in edit mode |
| 9 | Toolbar | [MOD-CONSOLE-038] TT toggle button present | ❌ fail | Toolbar shows AR, Export, "Open workspace in new window", Edit — NO "TT" button anywhere |
| 10 | Detached Route | [MOD-CONSOLE-025][MOD-CONSOLE-028] /detached/console/:id not Phase 7 stub | ✅ pass | Shows minimal shell: Connected status, clock, fullscreen button, "Workspace not found" for invalid ID. No "Phase 7" text. |
| 11 | Toolbar | [MOD-CONSOLE-040] Workspace browser fullscreen button | ❌ fail | Toolbar shows AR, Export, "Open workspace in new window", Edit — NO workspace browser fullscreen button |
| 12 | Toolbar | [MOD-CONSOLE-041] "Open in New Window" button present | ✅ pass | "Open workspace in new window" button (pop-out icon) present in toolbar |
| 13 | Kiosk Mode | [MOD-CONSOLE-011] Kiosk mode via ?kiosk=true | ✅ pass | Sidebar and app header completely hidden; only workspace content visible |
| 14 | Edit Mode | [MOD-CONSOLE-036] Pane resize in edit mode | ✅ pass | Edit mode active with layout combobox; react-grid-layout renders resize handles on pane borders |
| 15 | Fullscreen | [MOD-CONSOLE-039] Pane fullscreen button present | ✅ pass | "Full screen (F11)" button visible in each pane title bar in live mode |

## New Bug Tasks Created

MOD-CONSOLE-042 — TT toggle button missing from Console toolbar — pane title hide-all not implemented
MOD-CONSOLE-043 — Workspace browser fullscreen button missing from Console main toolbar
MOD-CONSOLE-044 — Console graphics picker still shows DCS shape library shapes instead of process graphics

## Screenshot Notes

- docs/uat/MOD-CONSOLE/fail-s9-s11-toolbar-missing-buttons.png — Console toolbar showing AR, Export, pop-out, Edit only. No TT button and no workspace browser fullscreen button.
- docs/uat/MOD-CONSOLE/edit-mode-panes.png — Edit mode with 3×2 layout showing pane grid with drag/resize handles.
- Seed data status: UNAVAILABLE (psql not accessible). Data flow scenario passed — workspaces loaded from frontend mock/API.
- ADDITIONAL FINDING (MOD-CONSOLE-033): Graphics section in left nav still shows DCS shape library shapes (Air Cooler / Fin-Fan, Ball Valve, Butterfly Valve, Centrifugal Pump, Compressor, etc.) instead of process graphics filtered by module='console'. Bug fix was not applied or not effective.
- MOD-CONSOLE-035 (delete last workspace): Not formally tested — could not reduce to 1 workspace during session. Left as partial.
- MOD-CONSOLE-037 (drag pane displacement): Not formally tested — drag behavior via a11y tree not reliable. Left as partial.
