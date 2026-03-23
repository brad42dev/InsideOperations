# UAT Scenarios — DD-10

## Dashboard Rendering
Scenario 1: [DD-10-013] Dashboards page renders without error — navigate to /dashboards → page loads, no error boundary, dashboard list or empty state visible
Scenario 2: [DD-10-013] Widget content not badge labels — open any dashboard → widgets show real UI content or loading/empty state, NOT raw type strings like "alarm-kpi" or "opc-status"
Scenario 3: [DD-10-005] PointContextMenu on widget value — navigate to /dashboards, open a dashboard → right-click a widget point value → [role="menu"] appears with context menu items
Scenario 4: [DD-10-006] Widget config has aggregation selector — open dashboard editor, click widget config → panel shows aggregation type dropdown (Last/Average/Min/Max)
Scenario 5: [DD-10-014] Aggregation type field alongside Title/Metric/Unit — in widget config panel, confirm aggregation type field exists
