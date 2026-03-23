# UAT Scenarios — MOD-CONSOLE

## Console Module (MOD-CONSOLE) — /console

Scenario 1: [MOD-CONSOLE-001] Console page renders — navigate to /console → page loads, workspace list or content visible
Scenario 2: [MOD-CONSOLE-001] Left nav has Favorites group — check left navigation panel → Favorites section/group visible
Scenario 3: [MOD-CONSOLE-001] View mode selector in left nav — check left nav panel → view mode selector (list/grid) present
Scenario 4: [MOD-CONSOLE-002] Detached window option — right-click or use menu on a pane → "Open in new window" or "Detach" option visible
Scenario 5: [MOD-CONSOLE-003] Aspect ratio lock per workspace — check workspace settings → aspect ratio lock option visible
Scenario 6: [MOD-CONSOLE-004] Playback bar speed values — check historical playback bar → multiple speed options available (0.5x, 1x, 2x, 4x etc.)
Scenario 7: [MOD-CONSOLE-006] Create workspace CTA — navigate to /console with no workspaces → "Create Workspace" button visible
Scenario 8: [MOD-CONSOLE-007] PointDetailPanel resizable — open point detail panel → resize handle present on panel
Scenario 9: [MOD-CONSOLE-010] Skeleton loading state — check workspace loading → module skeleton visible (not just "Loading workspaces..." text)
Scenario 10: [MOD-CONSOLE-011] Kiosk mode via URL — navigate to /console?kiosk=true → navigation/chrome hidden
Scenario 11: [MOD-CONSOLE-013] CSS design tokens — check console UI → no obvious hardcoded color mismatches vs theme
Scenario 12: [MOD-CONSOLE-005] Pane error boundary — console panes load → no "Something went wrong" on individual panes without cause
Scenario 13: [MOD-CONSOLE-009] ErrorBoundary button label — if error boundary fires → button reads "Reload Module"
