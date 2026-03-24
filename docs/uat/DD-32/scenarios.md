# UAT Scenarios — DD-32

## Page Load Check
Scenario 1: [DD-32-014] Console page renders without error — navigate to /console → page loads with workspace list, no error boundary

## Workspace Creation Toast
Scenario 2: [DD-32-014] "+" button is present on /console — navigate to /console → "+" button visible in workspace header/tab area
Scenario 3: [DD-32-014] Click "+" opens workspace creation flow — click "+" button → dialog or inline form appears to configure workspace
Scenario 4: [DD-32-014] Completing workspace creation shows success toast — complete the "+" → Done flow → success toast appears within 3 seconds
Scenario 5: [DD-32-014] Workspace tab count increments on creation — after creating a workspace → workspace tab count increases by 1
Scenario 6: [DD-32-016] Toast fires only after backend confirms (not optimistic) — create workspace → toast appears only after backend responds; no instant premature toast

## Notifications Panel
Scenario 7: [DD-32-014] F8 opens Notifications panel — press F8 → Notifications region/panel opens and shows toast history

## Workspace Duplication Toast
Scenario 8: [DD-32-016] Right-click workspace → Duplicate shows success toast — right-click a workspace tab/row, select Duplicate → success toast appears confirming duplication
