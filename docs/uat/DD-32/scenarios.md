# UAT Scenarios — DD-32

## Page Renders Without Error
Scenario 1: [DD-32-010] Console page renders without error — navigate to /console → no error boundary text, page loads successfully

## Workspace Creation Toast (DD-32-010)
Scenario 2: [DD-32-010] Workspace creation shows toast — navigate to /console, click "+" button, configure and confirm → toast notification appears within 3 seconds confirming success or failure
Scenario 3: [DD-32-010] Toast visible in notifications area — after workspace creation, look for toast/notification region visible on screen

## PointContextMenu Actions (DD-32-005)
Scenario 4: [DD-32-005] Console page has interactive elements — navigate to /console → workspace with process graphics or point list visible
Scenario 5: [DD-32-005] Right-click on console element shows context menu — right-click on a point or workspace row → [role="menu"] appears
Scenario 6: [DD-32-005] Context menu contains expected point actions — after right-click → menu items include options like "Trend", "Investigate", or "Report" related to points

## Toast Component Behavior (DD-32-007)
Scenario 7: [DD-32-007] Toast component renders when triggered — perform an action that triggers a toast → toast notification appears with visible message
Scenario 8: [DD-32-007] Toast max enforcement — trigger multiple toasts → at most 3 are visible simultaneously, with count badge if more queued
Scenario 9: [DD-32-007] Toast area location — perform action triggering toast → toast appears in a consistent corner/region of the screen
