# UAT Scenarios — DD-06

## App Shell Navigation
Scenario 1: [DD-06-001] Sidebar collapses with keyboard shortcut — press Ctrl+\ → sidebar collapses or expands
Scenario 2: [DD-06-002] Kiosk mode via URL parameter — navigate to /console?kiosk=true → UI enters kiosk mode (nav hidden)
Scenario 3: [DD-06-013] Keyboard shortcut help overlay — press ? key → overlay appears showing keyboard shortcuts
Scenario 4: [DD-06-015] G-key navigation hint — press G key → navigation hint overlay appears

## App Shell State
Scenario 5: [DD-06-004] Lock overlay appears — look for lock/screen lock button or icon → click it → password lock overlay appears
Scenario 6: [DD-06-008] ErrorBoundary button label — find module with error boundary → button reads "[Reload Module]" not "Try again"
Scenario 7: [DD-06-010] Sidebar toggle persists — expand sidebar → reload page → sidebar remains expanded
Scenario 8: [DD-06-012] Popup detection banner — check page for popup blocked banner if popups are blocked

## Kiosk and Overlay
Scenario 9: [DD-06-011] Lock overlay passive state — page renders without lock overlay in normal operation (passive/transparent state)
Scenario 10: [DD-06-014] Kiosk URL parameter format — navigate to /console?mode=kiosk → check if kiosk mode activates (spec uses ?mode=kiosk)
