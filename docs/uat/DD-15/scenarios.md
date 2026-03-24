# UAT Scenarios — DD-15

## Group Management API

Scenario 1: [DD-15-013] Settings/groups page renders without error — navigate to /settings/groups → page loads, no "Failed to parse server response" error, no red error card
Scenario 2: [DD-15-013] Groups page shows group list or clean empty state — navigate to /settings/groups → either a list of groups or a clean empty state (not an API error message) is displayed
Scenario 3: [DD-15-013] Create Group button is visible — look for a create/add group button on the groups page → button is present
Scenario 4: [DD-15-013] Create Group dialog opens — click the create group button → a dialog or form appears for entering group details
Scenario 5: [DD-15-013] Create a group and it appears in the list — fill in group name and submit → new group appears in the list without error
