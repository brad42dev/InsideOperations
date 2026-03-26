# UAT Scenarios — DD-13

## Basic Module Load
Scenario 1: [DD-13-027] Log module renders without error — navigate to /log → page loads with no error boundary, no blank screen, no "Something went wrong"
Scenario 2: [DD-13-028] Navigate to /log/new without browser crash — navigate to /log/new → page loads, LogNew component visible (template dropdown or form present, no crash)

## Templates API & List
Scenario 3: [DD-13-022] — data flow: GET /api/v1/logs/templates — navigate to /log/new, wait 3s → template dropdown shows ≥1 template name (not empty, not "No templates")
Scenario 4: [DD-13-029] /log/templates page shows template rows — navigate to /log/templates, wait 3s → at least one template row visible (not "No templates yet. Create one to get started.")
Scenario 5: [DD-13-029] /log Templates tab shows template rows — navigate to /log, click Templates tab, wait 3s → at least one template row visible

## Log Instance Creation
Scenario 6: [DD-13-025] Create log instance succeeds — navigate to /log/new, select a template, click Start Entry/Create → no error shown, navigates to log instance editor (not a 500 error page)
Scenario 7: [DD-13-026] Save new template succeeds — navigate to /log/templates/new, fill in template name, click Save → no 500 error, template saved (confirmation or redirect to template list)

## PointDataSegment & Context Menu
Scenario 8: [DD-13-030] PointDataSegment shows point rows — navigate to /log/new, select "Test Log with Points" template, create instance → PointDataSegment section shows ≥1 point row (not "No points configured for this segment.")
Scenario 9: [DD-13-021] PointContextMenu on point row — in a log instance with PointDataSegment showing point rows, right-click a point row → [role="menu"] appears with point-specific actions (Point Detail, Trend Point, Copy Tag Name, or similar)

## Data Flow
Scenario 10: [DD-13-022] — data flow: GET /api/v1/logs/instances — navigate to /log, wait 3s → log entries list visible with entries or graceful empty state (no error boundary, no 500 error displayed)
