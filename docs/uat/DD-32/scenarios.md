# UAT Scenarios — DD-32

## Console Route Health
Scenario 1: [DD-32-014] Console page renders without error — navigate to /console → workspace list/tabs visible, no error boundary text ("Something went wrong")

## Workspace Creation Toast
Scenario 2: [DD-32-014] Create workspace via "+" shows success toast — click "+" button on console, enter a workspace name, click "Done" → a toast notification appears within 3 seconds confirming success
Scenario 3: [DD-32-014] Workspace tab count increments after creation — before clicking "+": note tab count; after creating workspace and clicking "Done" → tab count is higher by 1

## Notifications Panel (F8)
Scenario 4: [DD-32-014] F8 keypress opens Notifications panel — press F8 on /console → notifications/toast history panel appears (role="dialog" or notifications region visible)

## Workspace Context Menu (Duplicate)
Scenario 5: [DD-32-015] Right-click workspace tab shows Duplicate option — right-click an existing workspace tab → [role="menu"] appears and contains "Duplicate" item
Scenario 6: [DD-32-015] Context menu shows full CRUD actions — right-click workspace tab → menu contains Rename, Delete, and Duplicate items

## Workspace Duplication Toast
Scenario 7: [DD-32-015] Duplicating a workspace shows a toast — right-click workspace tab → click "Duplicate" → a toast notification appears (success or error, but NOT silent)
