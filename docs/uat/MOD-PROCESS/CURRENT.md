---
unit: MOD-PROCESS
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 16
scenarios_passed: 15
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /process loads real implementation — sidebar with graphics list, view toolbar with zoom/export/print/map, status bar with LOD and zoom percentage.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [MOD-PROCESS-011] Process module renders without error | ✅ pass | Heading "Process", sidebar, canvas, toolbar all visible |
| 2 | Page Load | [MOD-PROCESS-011] data flow: GET /api/v1/graphics | ✅ pass | Sidebar loaded with full graphics list (Air Cooler, Alarm Annunciator, etc.) |
| 3 | Toolbar | [MOD-PROCESS-014] Print button visible in view toolbar | ✅ pass | `button "Print"` present in toolbar |
| 4 | Toolbar | [MOD-PROCESS-014] Export button present in toolbar | ✅ pass | `button "Export"` and split button present |
| 5 | Bookmark | [MOD-PROCESS-021] Bookmark star button opens dialog | ✅ pass | `dialog "Save Viewport Bookmark"` opens with Name and Description fields |
| 6 | Bookmark | [MOD-PROCESS-021] Bookmark dialog blocks empty name | ✅ pass | "Name is required" validation error shown, dialog stays open |
| 7 | Zoom | [MOD-PROCESS-011] Zoom controls in toolbar | ✅ pass | `button "−"` and `button "+"` present |
| 8 | Zoom | [MOD-PROCESS-011] Zoom percentage shown in status bar | ✅ pass | "100%" shown in status bar |
| 9 | Minimap | [MOD-PROCESS-017] Minimap toggle button in view toolbar | ✅ pass | `button "Map"` present in toolbar |
| 10 | Minimap | [MOD-PROCESS-017] Minimap toggle changes state | ✅ pass | Button entered [active] state after click |
| 11 | LOD | [MOD-PROCESS-013] LOD level indicator in status bar | ✅ pass | "LOD 3 – Detail" shown in status bar |
| 12 | Kiosk | [MOD-PROCESS-019] Kiosk mode hides breadcrumb nav bar | ❌ fail | `banner: heading "Process"` still visible at /process?kiosk=true — breadcrumb nav bar NOT hidden |
| 13 | Kiosk | [MOD-PROCESS-022] Kiosk mode hides view toolbar | ✅ pass | No toolbar buttons (zoom/export/print/map) rendered in kiosk mode |
| 14 | Kiosk | [MOD-PROCESS-019] Escape exits kiosk mode | ✅ pass | Full app shell (sidebar, toolbar, banner) restored after Escape |
| 15 | Detached | [MOD-PROCESS-016] Detached route renders component | ✅ pass | /detached/process/test-view-id renders minimal window with connection status, view name, time, zoom controls, map, fullscreen — no main app nav |
| 16 | Tokens | [MOD-PROCESS-018] Connection status indicator visible | ✅ pass | "Disconnected" status indicator present in status bar |

## New Bug Tasks Created

MOD-PROCESS-024 — Kiosk mode: breadcrumb nav bar ("Process" heading) still visible at /process?kiosk=true

## Screenshot Notes

- Seed data status: UNAVAILABLE (psql not accessible) — data flow scenario evaluated on empty-state graceful handling
- Scenario 12 FAIL: /process?kiosk=true shows `banner: heading "Process" [level=1]` in accessibility tree — the Process module-level banner is not hidden in kiosk mode. The app shell sidebar (nav, services) IS correctly hidden. The view toolbar IS correctly hidden. Only the breadcrumb banner persists.
- Kiosk mode correctly hides: app shell sidebar, view toolbar (zoom/live/historical/bookmark/export/print/map/fullscreen), status bar
- Kiosk mode fails to hide: the `<banner>` containing the "Process" h1 heading
- Escape key correctly exits kiosk mode and restores all elements
- Detached route (/detached/process/:viewId) fully implemented: connection dot, view name, current time, zoom±/Fit/Map/⤢ controls, no app chrome
