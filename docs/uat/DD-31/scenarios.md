# UAT Scenarios — DD-31

## Management Tab Crash Fix
Scenario 1: [DD-31-018] Alerts page renders without error — navigate to /alerts → page loads with no error boundary ("Something went wrong")
Scenario 2: [DD-31-018] Management tab loads without crash — click "Management" tab on /alerts → tab content visible, no "templates.map is not a function" error boundary
Scenario 3: [DD-31-018] Management tab shows templates list or empty state — after clicking Management tab → template list or "No templates" empty state visible (not a crash screen)
Scenario 4: [DD-31-018] Muster section reachable in Management tab — after clicking Management tab → muster dashboard section or muster-related UI is present without crash

## Alert History Export Button
Scenario 5: [DD-31-019] History tab loads without error — click "History" tab on /alerts → tab content visible, no error boundary
Scenario 6: [DD-31-019] Export button visible on History tab — navigate to /alerts → click "History" tab → Export button visible in toolbar or table header area
Scenario 7: [DD-31-019] Export button produces action on click — click Export button on History tab → download starts, dialog opens, or format picker appears (some visible action occurs)
Scenario 8: [DD-31-019] Export button visible even when table is empty — History tab has no data → Export button still visible (not conditionally hidden)
