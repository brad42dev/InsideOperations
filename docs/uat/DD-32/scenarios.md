# UAT Scenarios — DD-32

## Toast Notifications
Scenario 1: [DD-32-007] Toast component visible when triggered — navigate to /console, perform an action that triggers a toast → toast notification appears
Scenario 2: [DD-32-007] Error toasts persist — trigger an error toast (e.g., failed action) → error toast stays visible without auto-dismissing
Scenario 3: [DD-32-010] Toast shown on workspace failure — attempt to save/create workspace → if it fails, toast notification appears (not silent fail)

## Point Context Menu
Scenario 4: [DD-32-005] PointContextMenu has correct actions — right-click on a point value in console → menu has "Point Detail", "Trend Point", "Investigate Point", "Report on Point"
Scenario 5: [DD-32-005] Context menu renders — right-click on point value → [role="menu"] appears, not empty

## Point Detail Panel
Scenario 6: [DD-32-004] PointDetailPanel has all sections — open point detail on a point → panel shows sections including alarm data, value, engineering unit

## ECharts Theme
Scenario 7: [DD-32-002] ECharts renders in current theme — navigate to /dashboards or a page with charts → charts visible without theme errors

## PointPicker
Scenario 8: [DD-32-006] PointPicker has Favorites tab — open point picker (e.g., in designer or dashboard config) → "Favorites" tab visible alongside Browse/Search tabs

## Shared Components
Scenario 9: [DD-32-002] Console page renders without error — navigate to /console → no error boundary
