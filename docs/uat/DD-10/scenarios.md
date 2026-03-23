# UAT Scenarios — DD-10

## Dashboard Page Renders
Scenario 1: [DD-10-012] Dashboard page renders without error — navigate to /dashboards → page loads, no error boundary, no "Something went wrong"
Scenario 2: [DD-10-012] Non-alarm dashboard loads without "Unknown widget type" — navigate to /dashboards, open any dashboard → no "Unknown widget type" text visible

## Point Context Menu
Scenario 3: [DD-10-005] PointContextMenu available on widget values — navigate to /dashboards, right-click a numeric value → [role="menu"] appears
Scenario 4: [DD-10-005] Context menu has point actions — after right-click on point value → menu contains "Point Detail" or "Trend Point"

## Widget Config Aggregation
Scenario 5: [DD-10-006] Widget config shows aggregation options — in /dashboards edit mode, open widget config → aggregation type selector visible (avg/min/max/sum/count)
Scenario 6: [DD-10-006] Config panel renders without error — click widget settings → no blank or empty panel
