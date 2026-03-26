# UAT Scenarios — DD-32

## Page Renders / Shell
Scenario 1: [DD-32-007] Console renders without error — navigate to /console → page loads with workspace UI, no "Something went wrong" error boundary visible

## Notifications Region
Scenario 2: [DD-32-019] Notifications (F8) label visible in shell — navigate to /console, take snapshot → "Notifications" text or "F8" hint visible in header/notification region
Scenario 3: [DD-32-019] F8 key opens Notifications history panel — navigate to /console, press F8 keyboard key → a drawer/panel/popover appears showing notification history or "No notifications" empty state
Scenario 4: [DD-32-019] Notifications panel can be dismissed — after F8 opens panel, press Escape → panel closes

## Workspace Creation — Success Toast
Scenario 5: [DD-32-017] Success toast appears on workspace creation — navigate to /console, click "+" button, complete creation dialog, wait 3s → success toast with workspace-related message visible in notifications region
Scenario 6: [DD-32-017] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s → workspace list or tab bar shows at least one named workspace entry (not "Loading...", not error boundary)

## Toast Behaviour — Error Persistence and Auto-dismiss
Scenario 7: [DD-32-018] Success/info toasts auto-dismiss — after creating a workspace, observe the success toast → it disappears automatically within ~8 seconds
Scenario 8: [DD-32-007] Toast area present and functional — navigate to /console, take snapshot → Notifications/toast region exists in accessibility tree (role=region or aria-label containing "notification")

## Toast Max Limit
Scenario 9: [DD-32-007] Toast stack does not exceed 3 visible toasts — navigate to /console, create 2 workspaces in quick succession → no more than 3 individual toast items visible simultaneously (overflow shows "+N more" badge if applicable)

## Workspace Creation — Error Toast (F8 path)
Scenario 10: [DD-32-010] F8 history panel shows past toasts — navigate to /console, create a workspace (triggers toast), then press F8 → notification history panel shows the past workspace toast or "No notifications" if toast already dismissed
