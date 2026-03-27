# UAT Scenarios — DD-32

## Page Load and Data Flow
Scenario 1: [DD-32-022] Console page renders without error — navigate to /console → page loads, no "Something went wrong" error boundary, workspace list or empty state visible
Scenario 2: [DD-32-022] — data flow: GET /api/console/workspaces — navigate to /console, page auto-loads workspace list, wait 3s → workspace list tabs or "No workspaces" empty state visible (not stuck loading, not error boundary)

## Workspace Creation — Success Toast (DD-32-022 core verification)
Scenario 3: [DD-32-022] Success toast fires after + → Done — navigate to /console, click "+", accept default layout, click "Done", wait 3s → success toast appears with workspace-related message ("Workspace created" or similar)
Scenario 4: [DD-32-022] Success toast is success variant — after workspace creation, toast should be green/success variant labeled "SUCCESS" not red/error variant
Scenario 5: [DD-32-022] F8 Notifications history contains success toast — after workspace creation success toast appears, press F8 → Notifications history panel shows the workspace creation toast with timestamp

## Success Toast Auto-Dismiss (DD-32-023 core verification)
Scenario 6: [DD-32-023] Success toast auto-dismisses after ~5s — after workspace creation success toast appears, wait 8 seconds → toast has auto-dismissed without user action (success variant is not persistent)
Scenario 7: [DD-32-023] Error toast remains persistent (regression check) — observe error toast if present or trigger one → error toast (red variant) does NOT auto-dismiss after 10 seconds
Scenario 8: [DD-32-023] Error toast dismisses on × click — with error toast visible, click the × dismiss button → toast disappears immediately
Scenario 9: [DD-32-022] New workspace appears in list after creation — after successful workspace creation (success toast confirmed), new workspace tab or entry is visible in sidebar/list without page reload
