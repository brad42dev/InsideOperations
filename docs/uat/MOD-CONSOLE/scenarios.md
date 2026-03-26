# UAT Scenarios — MOD-CONSOLE
# Tasks under test (this session): MOD-CONSOLE-001, MOD-CONSOLE-025, MOD-CONSOLE-028, MOD-CONSOLE-030, MOD-CONSOLE-031

## Console Page — Basic Render

Scenario 1: [MOD-CONSOLE-001] Console page renders without error — navigate to /console, wait 3s → page loads with left nav panel present, no error boundary ("Something went wrong")

Scenario 2: [MOD-CONSOLE-001] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s → Workspaces accordion section visible in left nav; specific DOM evidence: element labeled "Workspaces" present with at least one workspace item or meaningful empty-state; page not blank/error-boundary, not stuck "Loading..."

## Left Nav Panel Features (MOD-CONSOLE-001)

Scenario 3: [MOD-CONSOLE-001] Favorites group in left nav — navigate to /console → Workspaces section shows a "Favorites" collapsible group at the top of the section

Scenario 4: [MOD-CONSOLE-001] View-mode selector buttons visible — navigate to /console → Workspaces section header shows 3 view-mode icon buttons (list/thumbnails/grid) at top-right

Scenario 5: [MOD-CONSOLE-001] Section search/filter input present — navigate to /console → Workspaces section contains a search or filter input field

## Left Nav Panel Width Resize (MOD-CONSOLE-030)

Scenario 6: [MOD-CONSOLE-030] Left nav panel width resize handle present — navigate to /console → a draggable resize handle is visible on the right edge of the left nav panel (look for element with col-resize cursor, ew-resize cursor, or data-testid containing "resize" or "handle")

Scenario 7: [MOD-CONSOLE-030] Section height resize handle present — navigate to /console → at least one accordion section (Workspaces or Graphics) has a drag handle at its bottom edge for height resizing

## Detached Console Route (MOD-CONSOLE-025, MOD-CONSOLE-028, MOD-CONSOLE-031)

Scenario 8: [MOD-CONSOLE-031] Detached route does NOT show Phase 7 text — navigate to /detached/console/test-id → page does NOT contain "Phase 7" or "Phase 7" placeholder text; shows either a minimal workspace shell or workspace-not-found message

Scenario 9: [MOD-CONSOLE-031] Detached route minimal shell — navigate to /detached/console/test-id → no full sidebar nav, no module switcher, no left nav accordion visible (minimal chrome only)

Scenario 10: [MOD-CONSOLE-031] Detached route handles nonexistent ID gracefully — navigate to /detached/console/nonexistent-xyz → shows workspace-not-found message or similar (not a crash, not blank page, not "Phase 7")
