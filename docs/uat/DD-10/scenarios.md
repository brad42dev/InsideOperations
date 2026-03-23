# UAT Scenarios — DD-10

## Page Load
Scenario 1: [DD-10-005] Dashboards page renders without error — navigate to /dashboards → page loads, no error boundary

## Point Context Menu
Scenario 2: [DD-10-005] PointContextMenu available on dashboard widget area — navigate to /dashboards, find any point/value display, right-click it → [role="menu"] appears with point-related options
Scenario 3: [DD-10-005] Dashboard page loads real UI — navigate to /dashboards → dashboard list or empty state visible, no stub/placeholder text

## Widget Config Panel
Scenario 4: [DD-10-006] Widget config panel opens — navigate to /dashboards, look for widget settings/config button → config panel opens without error
Scenario 5: [DD-10-006] Aggregation type visible in widget config — open any widget config panel → aggregation type option visible (avg, min, max, sum, last, or similar)
Scenario 6: [DD-10-006] Widget dashboard renders without crash — navigate to /dashboards → no "Something went wrong" error boundary visible
