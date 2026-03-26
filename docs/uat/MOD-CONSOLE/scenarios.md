# UAT Scenarios — MOD-CONSOLE
# Tasks under test: MOD-CONSOLE-001, MOD-CONSOLE-002, MOD-CONSOLE-022, MOD-CONSOLE-025, MOD-CONSOLE-027, MOD-CONSOLE-028, MOD-CONSOLE-029

## Console Page — Basic Render

Scenario 1: [MOD-CONSOLE-001] Page renders without error — navigate to /console → page loads, no error boundary ("Something went wrong") visible, left nav panel present

Scenario 2: [MOD-CONSOLE-001] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s → Workspaces accordion section is visible in left nav; specific DOM evidence: element labeled "Workspaces" present, page is not blank/error-boundary, no infinite "Loading..."

## Left Nav — Favorites Group

Scenario 3: [MOD-CONSOLE-022] Favorites group visible in Workspaces section — navigate to /console → Workspaces accordion section shows a "Favorites" collapsible group/section at the top of that section

Scenario 4: [MOD-CONSOLE-027] Empty Favorites group shows placeholder text — navigate to /console with no favorites set → Favorites group is visible AND shows "No favorites yet" or equivalent placeholder (not simply absent)

Scenario 5: [MOD-CONSOLE-022] Right-click workspace row shows "Add to Favorites" option — navigate to /console, right-click a workspace item → [role="menu"] appears containing "Add to Favorites" or "Favorite" option

## Left Nav — View Mode & Search

Scenario 6: [MOD-CONSOLE-001] View-mode selector buttons in section header — navigate to /console → Workspaces section header contains view-mode icon buttons (list/thumbnails/grid) at top-right of the header area

Scenario 7: [MOD-CONSOLE-001] Section search/filter input visible — navigate to /console → each accordion section contains a text search or filter input field

Scenario 8: [MOD-CONSOLE-001] Panel width resize handle present — navigate to /console → a resize/drag handle is present on the right edge of the left nav panel

## Detached Console Route

Scenario 9: [MOD-CONSOLE-025] Detached route is NOT a Phase 7 stub — navigate to /detached/console/test-id → page does NOT show "Phase 7" or "TODO" text; shows minimal workspace shell or workspace-not-found state

Scenario 10: [MOD-CONSOLE-028] Detached view has no sidebar navigation — navigate to /detached/console/test-id → no sidebar module switcher, no left nav panel, no accordion sections visible (minimal shell only or not-found state)

## Pane Right-Click — Pop Out

Scenario 11: [MOD-CONSOLE-002] Pane right-click context menu shows Pop Out option — navigate to /console, right-click a pane area → [role="menu"] contains "Open in New Window", "Pop Out", or "Detach" option

## Workspace Save Feedback

Scenario 12: [MOD-CONSOLE-029] Dirty indicator visible in workspace tab — navigate to /console, open a workspace; observe workspace tab header for a dot/asterisk/badge indicating unsaved state (may require triggering a layout change)
