# UAT Scenarios — DD-06

## App Shell

Scenario 1: [DD-06-001] Page renders without error — navigate to /console → no error boundary, app shell visible
Scenario 2: [DD-06-001] Sidebar collapse keyboard shortcut — press Ctrl+\ → sidebar collapses/expands
Scenario 3: [DD-06-002] Kiosk mode via URL param — navigate to /console?kiosk=true → navigation/header hidden, kiosk mode active
Scenario 4: [DD-06-004] Lock overlay has password field — activate lock → password input visible (not just click-to-unlock)
Scenario 5: [DD-06-008] ErrorBoundary button label — check error boundary → button reads "Reload Module"
Scenario 6: [DD-06-010] Sidebar state persists — collapse sidebar, reload page → sidebar remains collapsed
Scenario 7: [DD-06-011] Lock overlay present — check lock controls in header → lock button visible in app header
Scenario 8: [DD-06-012] Popup detection banner — app header or body → popup blocked banner component present or absent gracefully
