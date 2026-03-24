# UAT Scenarios — MOD-CONSOLE

## Console Module

Scenario 1: [MOD-CONSOLE-014] Console module loads — navigate to /console → module loads without dynamic import error
Scenario 2: [MOD-CONSOLE-001] Left nav panel renders — navigate to /console → left navigation panel visible with workspace list
Scenario 3: [MOD-CONSOLE-001] Favorites group in left nav — left nav panel → Favorites group/section visible
Scenario 4: [MOD-CONSOLE-003] Aspect ratio lock per-workspace — open workspace settings → aspect ratio lock toggle present, persisted per workspace
Scenario 5: [MOD-CONSOLE-004] Historical Playback Bar — open a workspace with historical data → playback bar with speed controls and alarm markers visible
Scenario 6: [MOD-CONSOLE-006] Create Workspace CTA gated — navigate to /console with no workspaces → Create Workspace button visible only with console:write permission
Scenario 7: [MOD-CONSOLE-007] PointDetailPanel resizable/pinnable — open point detail panel → resize handle, pin button, minimize button present
Scenario 8: [MOD-CONSOLE-008] Playback bar speed options — open playback bar → speed options include correct values, loop region and reverse transport controls present
Scenario 9: [MOD-CONSOLE-009] ErrorBoundary button label — any error boundary in Console → reads "Reload Module"
Scenario 10: [MOD-CONSOLE-010] Loading skeleton — navigate to /console while loading → skeleton loading state shown (not plain text "Loading workspaces…")
Scenario 11: [MOD-CONSOLE-011] Kiosk mode URL parameter — navigate to /console?kiosk=true → kiosk mode activates (no navigation, full-screen)
Scenario 12: [MOD-CONSOLE-013] Design token colors — inspect console UI → no hardcoded hex colors, uses CSS variables
