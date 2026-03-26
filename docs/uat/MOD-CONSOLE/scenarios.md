# UAT Scenarios — MOD-CONSOLE
# Tasks: MOD-CONSOLE-001, 002, 011, 016, 022, 023, 024, 025, 026

## Module Load

Scenario 1: [MOD-CONSOLE-016] Console renders without error — navigate to /console → page loads, workspace list visible, no "Something went wrong" error boundary

Scenario 2: [MOD-CONSOLE-016] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s for workspaces to load → workspace item names visible in left nav (non-empty content, not "Loading...", not error boundary)

## Left Nav — Favorites Group

Scenario 3: [MOD-CONSOLE-022] Favorites group visible in left nav — navigate to /console → "Favorites" collapsible section visible at top of Workspaces panel in left nav

Scenario 4: [MOD-CONSOLE-016] Add to Favorites in context menu — right-click workspace item in left nav → context menu contains "Add to Favorites" or "Favorite" option

Scenario 5: [MOD-CONSOLE-022] Favorites group collapsible — navigate to /console, find Favorites group header → click it → group collapses (items hidden); click again → expands

## Left Nav — View-Mode Selector

Scenario 6: [MOD-CONSOLE-023] View-mode selector buttons visible — navigate to /console → Workspaces section header shows three icon buttons (List / Thumbnails / Grid) at top-right of section header

Scenario 7: [MOD-CONSOLE-023] View-mode switching works — click Thumbnails button in Workspaces section header → workspace items render in thumbnail/visual layout (not just plain text list)

## Left Nav — Search/Filter

Scenario 8: [MOD-CONSOLE-024] Search input in Workspaces section — navigate to /console → text search/filter input visible inside Workspaces section (not just Points section)

Scenario 9: [MOD-CONSOLE-024] Search filters workspace list — type partial name in Workspaces search input → only matching items shown; clear input → all items restored

## Detached Window

Scenario 10: [MOD-CONSOLE-025] Detached route is not a Phase 7 stub — navigate to /detached/console/test-id → page does NOT show "Phase 7" text; shows either minimal workspace shell or workspace-not-found state

Scenario 11: [MOD-CONSOLE-002] Detached window has no sidebar — navigate to /detached/console/test-id → no sidebar navigation, no module switcher, no left nav panel visible

## Kiosk Mode

Scenario 12: [MOD-CONSOLE-011] Kiosk mode activates via ?kiosk=true — navigate to /console?kiosk=true → app chrome hidden (no top bar, no sidebar), kiosk mode active

Scenario 13: [MOD-CONSOLE-026] Kiosk corner dwell exit — navigate to /console?kiosk=true; hover mouse to top-left corner position and hold 2000ms → "Exit Kiosk" button/overlay appears

## Workspace Persistence (Save Feedback)

Scenario 14: [MOD-CONSOLE-001] Dirty indicator visible during pending save — on /console, with a workspace loaded, trigger a workspace change → a dirty indicator (dot, asterisk, or "unsaved" badge) appears while save is pending
