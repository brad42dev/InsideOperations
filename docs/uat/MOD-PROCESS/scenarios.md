# UAT Scenarios — MOD-PROCESS

10 tasks to UAT: MOD-PROCESS-011, MOD-PROCESS-012, MOD-PROCESS-013, MOD-PROCESS-014,
MOD-PROCESS-016, MOD-PROCESS-017, MOD-PROCESS-018, MOD-PROCESS-019, MOD-PROCESS-021,
MOD-PROCESS-022

## Page Load & Module Health
Scenario 1: [MOD-PROCESS-011] Process module renders without error — navigate to /process → page loads, no error boundary ("Something went wrong"), sidebar and canvas area visible
Scenario 2: [MOD-PROCESS-011] — data flow: GET /api/v1/graphics — navigate to /process, wait 3s → sidebar shows graphics list or empty state (not a spinner, not error boundary); if seed data exists, at least one graphic item name visible in sidebar

## View Toolbar Elements
Scenario 3: [MOD-PROCESS-014] Print button visible in view toolbar — navigate to /process → toolbar contains a "Print" button (or print icon) positioned near Export button
Scenario 4: [MOD-PROCESS-014] Export button present in toolbar — navigate to /process → an "Export" button or split-button appears in the toolbar
Scenario 5: [MOD-PROCESS-021] Bookmark star button opens dialog — navigate to /process, click the star/bookmark (★) button in the toolbar → [role="dialog"] appears with Name and Description fields
Scenario 6: [MOD-PROCESS-021] Bookmark dialog blocks empty name — with bookmark dialog open, leave Name field empty and click Save/Confirm → validation error shown, dialog remains open (does not close)

## Zoom Controls
Scenario 7: [MOD-PROCESS-011] Zoom controls in toolbar — navigate to /process → zoom-in (+) and zoom-out (-) buttons are present in the view toolbar or canvas overlay controls
Scenario 8: [MOD-PROCESS-011] Zoom percentage shown in status bar — navigate to /process → status bar at bottom shows zoom percentage display (e.g., "100%")

## Minimap Toggle
Scenario 9: [MOD-PROCESS-017] Minimap toggle button in view toolbar — navigate to /process → a minimap toggle button ("Map" label or map icon) is present in the view toolbar
Scenario 10: [MOD-PROCESS-017] Minimap toggle changes state — navigate to /process, click minimap toggle button → minimap overlay on canvas collapses or expands

## LOD Status Bar
Scenario 11: [MOD-PROCESS-013] LOD level indicator in status bar — navigate to /process → status bar shows an LOD level indicator (e.g., "LOD 0", "LOD 1", "LOD 2")

## Kiosk Mode
Scenario 12: [MOD-PROCESS-019] Kiosk mode hides breadcrumb nav bar — navigate to /process?kiosk=true, wait 2s → no breadcrumb / "Process" heading bar visible at top of page
Scenario 13: [MOD-PROCESS-022] Kiosk mode hides view toolbar — navigate to /process?kiosk=true, wait 2s → view toolbar (zoom controls, Export, Print) not rendered
Scenario 14: [MOD-PROCESS-019] Escape exits kiosk mode — while at /process?kiosk=true, press Escape key → breadcrumb nav bar and toolbar become visible again

## Detached Window Route
Scenario 15: [MOD-PROCESS-016] Detached route renders component — navigate to /detached/process/test-view-id → page renders (not 404 / not error boundary); shows a minimal window without main app sidebar or top nav chrome

## Design Tokens
Scenario 16: [MOD-PROCESS-018] Connection status indicator visible — navigate to /process → connection status dot/indicator is visible in toolbar or header with a colored status (green/amber/red), not invisible or unstyled
