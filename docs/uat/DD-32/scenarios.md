# UAT Scenarios — DD-32

## ECharts Theme Switching
Scenario 1: [DD-32-002] Theme switching works on dashboards — navigate to /dashboards → charts render in current theme, no error
Scenario 2: [DD-32-002] Theme change updates charts — toggle app theme in settings/header → charts update to reflect new theme (no white-on-white or invisible charts)

## PointDetailPanel
Scenario 3: [DD-32-004] PointDetailPanel opens — navigate to /console, right-click a point → "Point Detail" option visible; click it → PointDetailPanel opens with sections
Scenario 4: [DD-32-004] PointDetailPanel has resize handle — open PointDetailPanel → resize handle visible

## PointContextMenu
Scenario 5: [DD-32-005] PointContextMenu has Trend option — right-click a point anywhere → "Trend Point" option visible in context menu
Scenario 6: [DD-32-005] PointContextMenu has Investigate option — right-click a point anywhere → "Investigate Point" option visible in context menu

## PointPicker
Scenario 7: [DD-32-006] PointPicker has Favorites tab — open PointPicker (any point binding) → Favorites tab visible
Scenario 8: [DD-32-006] PointPicker has Recent list — open PointPicker → Recent points section visible

## Toast Notifications
Scenario 9: [DD-32-007] Toast appears on actions — trigger any action that shows toast → toast notification visible
Scenario 10: [DD-32-007] Console page loads without error — navigate to /console → page loads, no error boundary
