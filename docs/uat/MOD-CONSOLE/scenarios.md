# UAT Scenarios — MOD-CONSOLE

17 tasks to UAT: MOD-CONSOLE-001, MOD-CONSOLE-002, MOD-CONSOLE-011, MOD-CONSOLE-016,
MOD-CONSOLE-025, MOD-CONSOLE-028, MOD-CONSOLE-029, MOD-CONSOLE-032, MOD-CONSOLE-033,
MOD-CONSOLE-034, MOD-CONSOLE-035, MOD-CONSOLE-036, MOD-CONSOLE-037, MOD-CONSOLE-038,
MOD-CONSOLE-039, MOD-CONSOLE-040, MOD-CONSOLE-041

Seed data status: UNAVAILABLE (psql not accessible)

## Page Load

Scenario 1: [MOD-CONSOLE-001] Console page renders without error — navigate to /console → page loads with workspace list or empty-state visible, no error boundary ("Something went wrong")

## Data Flow

Scenario 2: [MOD-CONSOLE-001] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s, check that workspace name(s) appear in left nav OR empty-state "Create workspace" CTA is shown; NOT stuck "Loading..."; NOT error boundary. Pass: named workspace OR empty-state CTA visible. Fail: blank/error/stuck loading. ⚠️ seed data status unknown.

## Left Nav Panel

Scenario 3: [MOD-CONSOLE-001][MOD-CONSOLE-016] Favorites group visible in left nav — navigate to /console → left nav panel shows "Favorites" section/group header

Scenario 4: [MOD-CONSOLE-001] View-mode selector present in left nav — navigate to /console → left nav shows list/grid/thumbnail toggle buttons or a view-mode dropdown with at least 2 modes

Scenario 5: [MOD-CONSOLE-034] Right-click workspace in list view shows full context menu — right-click workspace row → [role="menu"] with Rename, Duplicate, Delete items (not just Open)

## Context Menu in Alternate Views

Scenario 6: [MOD-CONSOLE-034] Right-click workspace in thumbnail view shows full context menu — switch to thumbnails view, right-click workspace card → [role="menu"] with Rename, Duplicate, Delete items

Scenario 7: [MOD-CONSOLE-034] Right-click workspace in grid view shows full context menu — switch to grid view, right-click workspace card → [role="menu"] with Rename, Duplicate, Delete items

## Dirty Indicator

Scenario 8: [MOD-CONSOLE-029][MOD-CONSOLE-032] Workspace tab dirty indicator appears on layout change — enter edit mode, change layout → workspace tab shows dot/asterisk/badge within 2s

## Pane Title TT Toggle

Scenario 9: [MOD-CONSOLE-038] TT toggle button present in Console toolbar — navigate to /console → toolbar contains "TT" button (hide-all-titles toggle)

## Detached Route

Scenario 10: [MOD-CONSOLE-025][MOD-CONSOLE-028] Detached console route not a Phase 7 stub — navigate to /detached/console/test-id → NO "Phase 7" text visible; shows minimal shell or workspace-not-found state

## Toolbar Buttons

Scenario 11: [MOD-CONSOLE-040] Workspace browser fullscreen button in Console toolbar — navigate to /console → toolbar shows a fullscreen button for the workspace browser

Scenario 12: [MOD-CONSOLE-041] "Open in New Window" button in Console toolbar — navigate to /console → toolbar shows "Open in New Window" or pop-out icon button

## Kiosk Mode

Scenario 13: [MOD-CONSOLE-011] Kiosk mode via ?kiosk=true — navigate to /console?kiosk=true → app chrome hidden (sidebar, top nav not visible); full-screen workspace active

## Edit Mode

Scenario 14: [MOD-CONSOLE-036] Pane resize handles visible in edit mode — enter edit mode with 2+ panes → resize handle visible on pane borders (hover shows resize cursor)

Scenario 15: [MOD-CONSOLE-039] Pane fullscreen overlay button appears on hover — navigate to /console in live mode, hover over a pane → fullscreen/expand button visible as overlay in top-right corner of pane
