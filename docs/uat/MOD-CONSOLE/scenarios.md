# UAT Scenarios — MOD-CONSOLE

Session date: 2026-03-26
Tasks: MOD-CONSOLE-022, MOD-CONSOLE-023, MOD-CONSOLE-024, MOD-CONSOLE-025, MOD-CONSOLE-026,
       MOD-CONSOLE-027, MOD-CONSOLE-028, MOD-CONSOLE-029, MOD-CONSOLE-030, MOD-CONSOLE-031
Seed data status: UNAVAILABLE (psql not accessible)

## Page Load

Scenario 1: [MOD-CONSOLE-022] Console page renders without error — navigate to /console → app shell loads, workspace pane visible, no "Something went wrong" error boundary text

Scenario 2: [MOD-CONSOLE-022] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s, snapshot left nav Workspaces section — workspace name visible OR meaningful empty-state ("No workspaces"); pass if no error boundary or crash

## Left Nav — Favorites Group

Scenario 3: [MOD-CONSOLE-027] Favorites group visible in Workspaces section when empty — navigate to /console → Workspaces accordion section → "Favorites" group label visible at top with "No favorites yet" placeholder
Pass: "Favorites" text visible in Workspaces section even when nothing is favorited
Fail: No Favorites group visible at top of Workspaces section

Scenario 4: [MOD-CONSOLE-022] Favoriting adds workspace to Favorites group — use "Add to Favorites" button on a workspace → workspace appears inside Favorites group
Pass: favorited workspace name appears under Favorites group
Fail: workspace not in Favorites group after favoriting

## Left Nav — View Mode Buttons

Scenario 5: [MOD-CONSOLE-023] View-mode selector buttons in Workspaces section header — navigate to /console → WORKSPACES section header shows three icon buttons (List / Thumbnails / Grid) at top-right
Pass: at least one of List/Thumbnails/Grid icon buttons visible in WORKSPACES header
Fail: no view-mode buttons; only section title and collapse arrow

Scenario 6: [MOD-CONSOLE-023] Clicking view-mode button changes layout — click Thumbnails or Grid button → workspace items re-render in new layout
Pass: visible layout change after clicking button
Fail: no visible change (silent no-op)

## Left Nav — Search/Filter

Scenario 7: [MOD-CONSOLE-024] Search/filter input in Workspaces section — navigate to /console → Workspaces section → text search input visible inside section
Pass: text input present inside Workspaces accordion
Fail: no text input in Workspaces section

Scenario 8: [MOD-CONSOLE-024] Search/filter input in Graphics section — navigate to /console → open Graphics section → text search input visible inside section
Pass: text input present inside Graphics section
Fail: no text input in Graphics section

## Detached Console Route

Scenario 9: [MOD-CONSOLE-031] Detached console route has no Phase 7 stub — navigate to /detached/console/test-id → page does NOT contain "Phase 7" text; shows minimal shell or workspace-not-found
Pass: "Phase 7" absent; some real UI rendered
Fail: "Phase 7" text present (stub still active)

## Kiosk Mode

Scenario 10: [MOD-CONSOLE-026] Kiosk corner dwell exit trigger — navigate to /console?kiosk=true → hover mouse to top-left corner → wait 2s → "Exit Kiosk" button appears near corner
Pass: element with "Exit Kiosk" or "exit" text visible after corner dwell
Fail: no exit button appears after waiting in corner

## Workspace Save Feedback

Scenario 11: [MOD-CONSOLE-029] Dirty indicator on workspace tab after layout change — navigate to /console, modify workspace layout → workspace tab shows dot/asterisk/badge while save pending
Pass: dirty indicator visible on workspace tab
Fail: tab shows only name with no save-state indicator

## Left Nav Resize Handle

Scenario 12: [MOD-CONSOLE-030] Left nav panel resize handle exists — navigate to /console → right edge of Assets panel has draggable resize handle (col-resize cursor or splitter element)
Pass: resize/splitter/drag-handle element visible at panel right edge
Fail: no resize handle found at panel boundary
