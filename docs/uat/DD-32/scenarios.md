# UAT Scenarios — DD-32

## Page Load
Scenario 1: [DD-32-017] Console page renders without error — navigate to /console → no "Something went wrong" error boundary, page content visible

## Data Flow
Scenario 2: [DD-32-017] — data flow: GET /api/v1/workspaces — navigate to /console, page load auto-triggers workspace fetch, wait 3s, UI must show workspace list tabs or "No workspaces" empty state — NOT a stuck loading spinner
  Pass: workspace list or empty-state message visible, no error boundary
  Fail: stuck loading, error boundary, or crash

## Success Toast on Workspace Creation
Scenario 3: [DD-32-020] Success toast fires after + → Done flow — click "+", accept defaults, click "Done", wait 3s → success toast visible in Notifications region with workspace-related message
Scenario 4: [DD-32-017] Success toast auto-dismisses — after success toast appears, wait 6 seconds → toast has auto-dismissed (success variant, not error)

## Error Toast Persistence
Scenario 5: [DD-32-021] Error toast appears on workspace creation failure — click "+", wait for initial backend error → error toast visible in Notifications region with failure message
Scenario 6: [DD-32-021] Error toast does NOT auto-dismiss — error toast is visible, wait 10 seconds → error toast still present in Notifications region (not auto-dismissed)
Scenario 7: [DD-32-018] Error toast manual dismiss — with error toast visible, click the × dismiss button → toast disappears immediately
Scenario 8: [DD-32-018] Success/info toasts still auto-dismiss — trigger a success toast, wait 7 seconds → success toast has auto-dismissed (no regression on non-error variants)

## F8 Notifications Panel
Scenario 9: [DD-32-019] F8 opens Notifications panel — on /console press F8 → a visible panel/drawer/popover renders (actual visible DOM panel, not just keyboard focus shift)
Scenario 10: [DD-32-019] F8 panel empty state — press F8 when no toasts have fired → panel shows "No notifications" or similar empty state (not a crash)
Scenario 11: [DD-32-019] F8 panel shows toast history — trigger a toast, let it auto-dismiss, press F8 → Notifications panel shows the past toast in history
Scenario 12: [DD-32-019] F8 panel closes on Escape — panel is open, press Escape → panel closes
