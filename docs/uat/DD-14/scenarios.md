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
