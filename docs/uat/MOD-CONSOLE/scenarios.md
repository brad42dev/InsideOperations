# UAT Scenarios — MOD-CONSOLE

## Page Renders
Scenario 1: [MOD-CONSOLE-018] Console page renders without error — navigate to /console → page loads with no error boundary ("Something went wrong"), workspace list or empty state visible

## Kiosk Mode (MOD-CONSOLE-020)
Scenario 2: [MOD-CONSOLE-020] Kiosk mode hides ASSETS panel — navigate to /console?kiosk=true → ASSETS/left panel not visible (no "Workspaces", "Graphics", "Widgets", "Points" tab buttons in snapshot)
Scenario 3: [MOD-CONSOLE-020] Normal mode shows ASSETS panel — navigate to /console (no kiosk param) → ASSETS panel visible with Workspaces/Graphics/Widgets/Points tabs
Scenario 4: [MOD-CONSOLE-020] Kiosk mode expands pane content — navigate to /console?kiosk=true → pane content area fills screen (no left sidebar consuming space)

## Workspace Left Nav Right-Click Context Menu (MOD-CONSOLE-019)
Scenario 5: [MOD-CONSOLE-019] Right-click workspace row in left nav shows context menu — navigate to /console, find workspace row in left nav/Workspaces panel, right-click → [role="menu"] appears
Scenario 6: [MOD-CONSOLE-019] Context menu contains "Add to Favorites" — after right-click on workspace row → menu item "Add to Favorites" visible
Scenario 7: [MOD-CONSOLE-019] Context menu contains workspace actions — after right-click on workspace row → menu has relevant actions (Rename, Open, or similar items)

## Workspace Panel Right-Click Context Menu (MOD-CONSOLE-021)
Scenario 8: [MOD-CONSOLE-021] Right-click workspace row in Workspaces panel shows menu — navigate to /console, open Assets panel → Workspaces tab, right-click a workspace row → [role="menu"] appears
Scenario 9: [MOD-CONSOLE-021] Context menu has "Add to Favorites" for non-favorited workspace — right-click a non-favorited workspace → menu shows "Add to Favorites"
Scenario 10: [MOD-CONSOLE-021] Context menu closes on Escape — after right-click opens menu, press Escape → menu disappears

## Pane Context Menu - Open in New Window (MOD-CONSOLE-018)
Scenario 11: [MOD-CONSOLE-018] Pane context menu contains "Open in New Window" — navigate to /console with a workspace open, right-click on a pane → context menu includes "Open in New Window"
Scenario 12: [MOD-CONSOLE-018] Pane context menu appears on right-click — right-click on any pane in the console workspace → [role="menu"] appears
