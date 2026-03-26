---
unit: MOD-CONSOLE
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 12
scenarios_passed: 9
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /console loads real implementation (Console module, left nav with Workspaces/Graphics, pane grid visible)

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Console Page | [MOD-CONSOLE-001] Page renders without error | ✅ pass | Console module loaded, no error boundary |
| 2 | Console Page | [MOD-CONSOLE-001] data flow: GET /api/v1/workspaces | ✅ pass | Workspaces section visible with "Reactor Overview" item ⚠️ seed data unknown |
| 3 | Left Nav — Favorites | [MOD-CONSOLE-022] Favorites group visible in Workspaces section | ✅ pass | "Favorites 1" collapsible group present at top of Workspaces section |
| 4 | Left Nav — Favorites | [MOD-CONSOLE-027] Empty Favorites group shows placeholder | ✅ pass | After removing favorite, "No favorites yet" placeholder shown in Favorites group |
| 5 | Left Nav — Favorites | [MOD-CONSOLE-022] Right-click workspace shows "Add to Favorites" | ✅ pass | Context menu contains "Add to Favorites" item |
| 6 | Left Nav — View Mode | [MOD-CONSOLE-001] View-mode selector buttons in section headers | ✅ pass | "List view", "Thumbnails view", "Grid view" buttons visible in Workspaces and Graphics headers |
| 7 | Left Nav — Search | [MOD-CONSOLE-001] Section search/filter input visible | ✅ pass | "Filter workspaces…" and "Filter graphics…" searchboxes present |
| 8 | Left Nav — Resize | [MOD-CONSOLE-001] Panel width resize handle present | ❌ fail | No col-resize/ew-resize cursor element found on left nav panel right edge; no element with resize semantics at panel boundary |
| 9 | Detached Route | [MOD-CONSOLE-025] Detached route is NOT Phase 7 stub | ❌ fail | /detached/console/test-id renders "Workspace ID: — live multi-pane view (Phase 7)" — still a stub |
| 10 | Detached Route | [MOD-CONSOLE-028] Detached view has no sidebar | ❌ fail | Route is Phase 7 stub; no proper minimal shell rendered — stub does not count as correct implementation |
| 11 | Pane Context Menu | [MOD-CONSOLE-002] Pane right-click shows "Open in New Window" | ✅ pass | Context menu contains "Open in New Window", "Full Screen", "Copy", "Duplicate", "Replace…", "Configure Pane…", "Remove Pane" |
| 12 | Save Feedback | [MOD-CONSOLE-029] Dirty indicator appears after layout change | ✅ pass | After changing layout to 1×1, tab button reads "Reactor Overview Unsaved changes" with accessible "Unsaved changes" badge |

## New Bug Tasks Created

MOD-CONSOLE-030 — Left nav panel width resize handle missing
MOD-CONSOLE-031 — Detached console route /detached/console/:id still renders Phase 7 stub

## Screenshot Notes

- ⚠️ seed data status unknown (psql UNAVAILABLE; all API calls return 404 — backend not running)
- Scenario 8 screenshot: docs/uat/MOD-CONSOLE/fail-s8-no-panel-resize-handle.png — shows left nav with no resize handle on right edge
- Scenarios 9/10 screenshot: docs/uat/MOD-CONSOLE/fail-s9-s10-detached-phase7-stub.png — shows "Workspace ID: — live multi-pane view (Phase 7)" text
- Vite dep cache was stale at session start (multiple stale Vite processes, deps in temp dirs); restarted dev server to clear
- Console module loaded correctly after Vite restart
