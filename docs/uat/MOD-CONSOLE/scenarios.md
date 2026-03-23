# UAT Scenarios — MOD-CONSOLE

## Console Module
Scenario 1: [MOD-CONSOLE-014] Console module loads — navigate to /console → module loads (no dynamic import error)
Scenario 2: [MOD-CONSOLE-009] ErrorBoundary button label — console error boundary shows "[Reload Module]" not "Try again"
Scenario 3: [MOD-CONSOLE-010] Loading skeleton state — console shows skeleton while loading (not "Loading workspaces...")
Scenario 4: [MOD-CONSOLE-006] Empty state CTA gated — "Create Workspace" only shown when admin (console:write permission)
Scenario 5: [MOD-CONSOLE-011] Kiosk URL parameter — /console?kiosk=true enters kiosk mode

## Workspace Features
Scenario 6: [MOD-CONSOLE-002] Detach pane to window — right-click pane → option to detach to new window
Scenario 7: [MOD-CONSOLE-003] Aspect ratio lock — workspace has aspect ratio lock toggle
Scenario 8: [MOD-CONSOLE-004] Playback bar controls — playback bar has speed controls, alarm markers, keyboard shortcut support
Scenario 9: [MOD-CONSOLE-005] Pane error boundaries — individual pane crash doesn't crash entire console module
Scenario 10: [MOD-CONSOLE-007] PointDetailPanel resizable — point detail panel can be resized (has resize handle)
Scenario 11: [MOD-CONSOLE-008] Playback bar loop region — playback bar has loop region and step interval controls
Scenario 12: [MOD-CONSOLE-012] Nested error boundaries per-pane — each pane has own error boundary
Scenario 13: [MOD-CONSOLE-013] No hardcoded hex colors — console uses CSS design tokens (consistent theming)
