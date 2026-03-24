# UAT Scenarios — DD-15

**Tasks to test:** DD-15-015
**1 task to UAT for DD-15: DD-15-015**

## Groups Page API Fix

Scenario 1: [DD-15-015] Groups page renders without error — navigate to /settings/groups → page loads, no "Failed to parse server response" error, no red error card visible
Scenario 2: [DD-15-015] Groups page shows clean empty state or list — navigate to /settings/groups → either group list items visible or a clean empty state message (not an error)
Scenario 3: [DD-15-015] Settings sidebar has Groups entry — navigate to /settings → sidebar shows "Groups" navigation item
Scenario 4: [DD-15-015] Create Group button visible on groups page — navigate to /settings/groups → "+ Create Group" or "Create Group" button is visible
Scenario 5: [DD-15-015] Create Group dialog opens — click the Create Group button → a dialog opens with a name input form
Scenario 6: [DD-15-015] Create Group workflow — fill in group name and submit → group appears in the list (or success toast), no error shown
