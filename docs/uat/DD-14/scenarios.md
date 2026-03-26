# UAT Scenarios — DD-14

## Page Load / Error Boundary

Scenario 1: [DD-14-009] Rounds page loads without error boundary — navigate to /rounds → no "Something went wrong" error boundary, page content visible
Scenario 2: [DD-14-009] Rounds page tabs visible — navigate to /rounds → tabs "Available", "In Progress", "History", "Templates", "Schedules" are all present in snapshot

## Tab Navigation

Scenario 3: [DD-14-009] Available tab accessible — click "Available" tab → tab content renders without crash, empty state or data shown
Scenario 4: [DD-14-009] In Progress tab accessible — click "In Progress" tab → tab content renders without crash, empty state or data shown
Scenario 5: [DD-14-009] History tab accessible — click "History" tab → tab content renders without crash, empty state or data shown
Scenario 6: [DD-14-009] Templates tab accessible — click "Templates" tab → tab content renders without crash, empty state or data shown
Scenario 7: [DD-14-009] Schedules tab accessible — click "Schedules" tab → tab content renders without crash, empty state or data shown

## Empty State Handling

Scenario 8: [DD-14-009] Empty state shown instead of crash — with no rounds data, each tab shows empty state message rather than JavaScript error or blank white screen

## Export Button — 6-format ExportButton (DD-14-011)

Scenario 9: [DD-14-011] History tab has Export button (not CSV-only) — navigate to /rounds → click History tab → header contains an "Export" button (split button with chevron), not an "Export CSV" text button that directly downloads; the DataTable toolbar should have no "Export CSV" button

Scenario 10: [DD-14-011] History Export button opens format dialog — navigate to /rounds → click History tab → click "Export" button → a dialog appears with format options (CSV, Excel, PDF, JSON, Parquet, HTML) and a column selector; no direct file download occurs on click

Scenario 11: [DD-14-011] Templates tab has Export button — navigate to /rounds → click Templates tab → header contains an "Export" button adjacent to "+ New Template" button; button is visible in the header area

Scenario 12: [DD-14-011] Schedules tab has Export button — navigate to /rounds → click Schedules tab → header contains an "Export" button; button is visible in the header area

Scenario 13: [DD-14-011] Export button respects rounds:export permission — navigate to /rounds → if user lacks rounds:export permission, Export buttons are hidden across History, Templates, and Schedules tabs
