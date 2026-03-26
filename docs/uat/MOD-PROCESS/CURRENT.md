---
unit: MOD-PROCESS
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 12
scenarios_passed: 11
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /process loads real implementation — sidebar with graphics list, view toolbar with zoom/export/print/map/bookmark, status bar with LOD and zoom percentage.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [MOD-PROCESS-023] Process page renders without error | ✅ pass | Module content visible, no error boundary |
| 2 | Data Flow | [MOD-PROCESS-025] data flow: GET /api/v1/process/views | ✅ pass | Graphics list loaded (Air Cooler / Fin-Fan, Ball Valve, etc. visible in sidebar) |
| 3 | Toolbar | [MOD-PROCESS-023] Minimap toggle button in main toolbar | ✅ pass | `button "Map"` present in view toolbar |
| 4 | Toolbar | [MOD-PROCESS-025] Open in New Window button in main toolbar | ❌ fail | No "Open in New Window" or external-link button found in toolbar; toolbar contains: 100%, −, +, Fit, 100%, ● Live, ◷ Historical, ★, Export, Print, Map, Toggle fullscreen |
| 5 | Bookmark | [MOD-PROCESS-015] Bookmark ★ button visible in toolbar | ✅ pass | `button "★"` present |
| 6 | Bookmark | [MOD-PROCESS-015] Clicking ★ opens Name/Description dialog | ✅ pass | `dialog "Save Viewport Bookmark"` with Name (required) and Description (optional) fields appeared |
| 7 | Bookmark | [MOD-PROCESS-015] Bookmark dialog blocks empty-Name submit | ✅ pass | "Name is required" validation error shown, dialog stayed open |
| 8 | Kiosk | [MOD-PROCESS-024] Kiosk mode hides "Process" heading/banner | ✅ pass | No banner or heading "Process" in accessibility snapshot at /process?kiosk=true |
| 9 | Kiosk | [MOD-PROCESS-019] Kiosk mode hides view toolbar | ✅ pass | Zoom controls, Live/Historical, Export, Print, Map all absent in kiosk snapshot |
| 10 | Kiosk | [MOD-PROCESS-019] Kiosk mode hides breadcrumb nav | ✅ pass | No breadcrumb nav bar visible in kiosk mode |
| 11 | Kiosk | [MOD-PROCESS-024] Escape exits kiosk mode | ✅ pass | heading "Process" and full toolbar restored after Escape |
| 12 | Toast | [MOD-PROCESS-012] Toast container present | ✅ pass | `region "Notifications (F8)"` with aria list present — toast infrastructure wired up |

## New Bug Tasks Created

MOD-PROCESS-026 — No "Open in New Window" button in Process view toolbar

## Screenshot Notes

- Seed data status: UNAVAILABLE (psql not accessible) — data flow scenario evaluated on graceful load of graphics metadata list
- S4 FAIL: Toolbar at /process contains: 100%, −, +, Fit, 100%, ● Live, ◷ Historical, ★, Export, Print, Map, Toggle fullscreen. No "Open in New Window" button anywhere in toolbar or toolbar overflow. Screenshot saved: s4-no-open-in-new-window.png
- Kiosk mode (S8-S11): all kiosk chrome-hiding is now working correctly — banner, toolbar, breadcrumbs all hidden. Escape exits correctly. Fixes confirmed for MOD-PROCESS-019 and MOD-PROCESS-024.
- Bookmark dialog (S6-S7): fully implemented with Name/Description fields and Name required validation.
- MOD-PROCESS-023 (minimap toggle): previously failing — now ✅ Map button present in main toolbar.
