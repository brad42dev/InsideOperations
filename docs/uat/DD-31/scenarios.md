# UAT Scenarios — DD-31

## Module Stability
Scenario 1: [DD-31-017] Alerts module loads without crash — navigate to /alerts → page renders without error boundary, no "templates.find is not a function" crash visible

## Notifications Channels API
Scenario 2: [DD-31-014][DD-31-015][DD-31-016][DD-31-020] — data flow: GET /api/notifications/channels/enabled — navigate to /alerts, click Compose/New Alert button → Channels section shows checkboxes (at minimum "websocket" checkbox visible, no error boundary from 404)
Scenario 3: [DD-31-005] Channel selector driven by API — in alert compose form, Channels section shows channel checkboxes populated from API (not blank/error state)

## Alert History Export
Scenario 4: [DD-31-008] Export button visible in Alert History toolbar — navigate to /alerts → click History tab → Export button visible in toolbar (not buried in menu)
Scenario 5: [DD-31-008] Export format picker shows all 6 formats — click the Export button in History → dropdown/picker shows CSV, XLSX, PDF, JSON, Parquet, HTML options

## Template Variables
Scenario 6: [DD-31-003] Alert templates list loads without crash — navigate to /alerts → click Management tab → templates list renders with no crash
Scenario 7: [DD-31-003] Template variable inputs use structured labels — in compose form, select a template that has variables → input fields show label text (not raw {{variable_name}} format), required fields marked with asterisk

## Muster Dashboard
Scenario 8: [DD-31-007] Muster dashboard section — navigate to /alerts, Active tab → muster section visible OR absent because no access control integration configured (per DD-31-012 expected hidden without integration)

## RBAC Gates
Scenario 9: [DD-31-021] Templates management visible for admin — navigate to /alerts Management tab → Templates section visible and shows list
Scenario 10: [DD-31-021] Groups management visible for admin — navigate to /alerts Management tab → Groups section visible and shows list
