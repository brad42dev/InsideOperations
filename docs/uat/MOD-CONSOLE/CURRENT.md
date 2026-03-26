---
unit: MOD-CONSOLE
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 12
scenarios_passed: 11
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /console loads real implementation — app shell, left nav, workspace panes visible. No stub or blank page.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [MOD-CONSOLE-022] Console page renders without error | ✅ pass | App shell, nav, panes all visible. No error boundary. |
| 2 | Data Flow | [MOD-CONSOLE-022] data flow: GET /api/v1/workspaces — workspace list renders | ✅ pass | "Workspace 2" and "Reactor Overview" visible in left nav Workspaces section |
| 3 | Favorites | [MOD-CONSOLE-027] Favorites group visible when no favorites set | ✅ pass | "Favorites" group + "No favorites yet" visible in Workspaces section on fresh load |
| 4 | Favorites | [MOD-CONSOLE-022] Favoriting a workspace adds it to Favorites group | ✅ pass | Clicked "Add to Favorites" → "Workspace 2" appeared under Favorites group, count updated to 1 |
| 5 | View Mode | [MOD-CONSOLE-023] View-mode selector buttons in Workspaces section header | ✅ pass | List/Thumbnails/Grid icon buttons present in WORKSPACES section header |
| 6 | View Mode | [MOD-CONSOLE-023] Clicking view-mode button changes layout | ✅ pass | Clicked "Thumbnails view" → button became [active], item layout changed to thumbnail cards |
| 7 | Search | [MOD-CONSOLE-024] Search/filter input in Workspaces section | ✅ pass | "Filter workspaces…" searchbox present inside Workspaces accordion |
| 8 | Search | [MOD-CONSOLE-024] Search/filter input in Graphics section | ✅ pass | "Filter graphics…" searchbox present inside Graphics accordion |
| 9 | Detached | [MOD-CONSOLE-031] Detached console route has no Phase 7 stub | ✅ pass | /detached/console/test-id shows minimal shell (Connected status, clock) + "Workspace not found" for invalid ID. No "Phase 7" text. |
| 10 | Kiosk | [MOD-CONSOLE-026] Kiosk corner dwell exit trigger | ✅ pass | /console?kiosk=true: simulated mousemove to (0,0) → after 2s "Exit Kiosk" button appeared |
| 11 | Save Feedback | [MOD-CONSOLE-029] Dirty indicator on workspace tab after layout change | ❌ fail | After layout change (JS-triggered 2×2→1×1), tab innerHTML = "Workspace 2" only — no dot, asterisk, badge, or child span. No dirty indicator. |
| 12 | Resize | [MOD-CONSOLE-030] Left nav panel resize handle exists | ✅ pass | separator "Resize assets palette width" visible in accessibility tree at panel edge; also section-height separators present |

## New Bug Tasks Created

MOD-CONSOLE-032 — Workspace tab dirty indicator missing after layout change in edit mode

## Screenshot Notes

- Seed data: UNAVAILABLE (psql not accessible — docker container was stopped, restarted during session)
- Thumbnail 404 errors in console are expected — graphics thumbnails not yet generated; does not affect core functionality
- fail-s11-no-dirty-indicator.png: screenshot shows "Workspace 2" tab with no dirty indicator after layout change; edit mode was exited, but the tab showed no indicator during the edit mode layout change either
- S10 (kiosk corner dwell): tested via JS mousemove event dispatch to (0,0); "Exit Kiosk" button confirmed present after 2s dwell
- S9 (detached console): MOD-CONSOLE-025, MOD-CONSOLE-028, MOD-CONSOLE-031 all describe the same underlying bug (Phase 7 stub on /detached/console/:id); the route now works correctly
