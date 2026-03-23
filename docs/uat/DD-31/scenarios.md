# UAT Scenarios — DD-31

## Alerts Module
Scenario 1: [DD-31-011] Alerts page renders without error — navigate to /alerts → page loads, no error boundary
Scenario 2: [DD-31-011] Alerts page shows UI content (not stub) — navigate to /alerts → alert list, compose button, or empty state visible
Scenario 3: [DD-31-002] Emergency alert requires permission — navigate to /alerts → compose alert UI does not show EMERGENCY unless user has permission (admin should see it)
Scenario 4: [DD-31-005] Available channels shown in compose — navigate to /alerts, compose new alert → channel selection shows available channels
Scenario 5: [DD-31-007] Muster dashboard Export Unaccounted List button — navigate to /alerts, open muster dashboard → "Export Unaccounted List" button visible
Scenario 6: [DD-31-006] Alert status updates visible — navigate to /alerts → real-time status indicators present
Scenario 7: [DD-31-012] Muster dashboard visible for admin — navigate to /alerts → muster section visible (admin has access control)
