# UAT Scenarios — DD-31

## Module Load & Crash Prevention
Scenario 1: [DD-31-017] Alerts module loads without error boundary — navigate to /alerts → page loads without "Something went wrong" error boundary, no crash
Scenario 2: [DD-31-017] Alert list or empty state visible — navigate to /alerts → alert list, active alerts, or empty state message is visible (not blank)

## Notification Channels in Compose Form
Scenario 3: [DD-31-014][DD-31-015][DD-31-016][DD-31-005] Compose form opens — click "New Alert" or "Create Alert" button → compose/send dialog appears
Scenario 4: [DD-31-014][DD-31-015][DD-31-016][DD-31-005] Notification channels shown in compose — compose dialog open → notification channel options visible (at minimum websocket/browser channel shown)

## Template Variable Definitions
Scenario 5: [DD-31-003] Alert templates page accessible — navigate to /alerts and find Templates tab or section → template list is visible
Scenario 6: [DD-31-003] Template variable editing shows structured fields — open template edit for a template with variables → variable fields include name/label/default_value or similar structured form fields (not just a simple string list)

## Export Functionality
Scenario 7: [DD-31-008] Alert history Export button visible — navigate to /alerts History tab → Export button visible in the toolbar or table header
Scenario 8: [DD-31-007] Muster dashboard Export Unaccounted List button — navigate to /alerts Muster section → "Export Unaccounted List" button visible

## Loading States
Scenario 9: [DD-31-010] Skeleton loading states on initial load — navigate to /alerts (fresh) → observe any loading state uses skeleton shapes (not just plain "Loading..." text)

## Delivery Status / Real-Time
Scenario 10: [DD-31-006] Alert delivery status visible — navigate to /alerts and view a sent/active alert → delivery status information visible in alert details
