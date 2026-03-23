# UAT Scenarios — MOD-PROCESS

## Process Module (MOD-PROCESS) — /process

Scenario 1: [MOD-PROCESS-001] Process page renders — navigate to /process → page loads, no error boundary
Scenario 2: [MOD-PROCESS-001] Auto zoom-to-fit on load — open a process graphic → view auto-zooms to fit graphic in viewport
Scenario 3: [MOD-PROCESS-003] Zoom control max 800% — check zoom controls → maximum zoom is 800% (not 1000%)
Scenario 4: [MOD-PROCESS-004] Point context menu on right-click — right-click a point value in process view → shared PointContextMenu appears
Scenario 5: [MOD-PROCESS-005] Export button in toolbar — check process view toolbar → export button (6-format) visible
Scenario 6: [MOD-PROCESS-006] Navigation sidebar — check process sidebar → navigation hierarchy tree visible
Scenario 7: [MOD-PROCESS-007] Kiosk mode — navigate to /process?kiosk=true → navigation chrome hidden
Scenario 8: [MOD-PROCESS-008] Skeleton loading state — process page loading → skeleton placeholder visible (not plain spinner)
