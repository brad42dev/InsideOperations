# UAT Scenarios — DD-32 (Session 2: 2026-03-26)

Tasks under test: DD-32-017, DD-32-018, DD-32-020, DD-32-021
Seed data: UNAVAILABLE (seed data status unknown)

## Page / Shell

Scenario 1: [DD-32-017] [DD-32-020] Page renders without error — navigate to /console → app shell loads, no error boundary visible

## Data Flow

Scenario 2: [DD-32-017] — data flow: GET /api/v1/workspaces — navigate to /console, wait 3s → workspace list or tab bar shows named workspaces OR meaningful empty state ("No workspaces"); NOT "Loading..." or error boundary

## Toast — Success on Workspace Creation

Scenario 3: [DD-32-017] [DD-32-020] Success toast fires on workspace creation — navigate to /console, click "+" button, accept defaults, click "Done" → a success toast appears in the Notifications region within 3 seconds
Scenario 4: [DD-32-017] [DD-32-020] Success toast message is descriptive — toast text contains workspace-related content (e.g., "Workspace created"), not blank or generic "Success"
Scenario 5: [DD-32-020] Success toast auto-dismisses — after workspace creation toast appears, wait 8 seconds → toast has auto-dismissed (success variant, not persistent)
Scenario 6: [DD-32-020] F8 opens notification history — after creating workspace and letting toast dismiss, press F8 → notification history panel or drawer opens (shows past notifications or "No notifications" empty state); NOT a no-op

## Toast — Error Persistence

Scenario 7: [DD-32-018] [DD-32-021] Error toast persists — trigger error toast if possible (observe if creation fails), wait 10 seconds → error toast still visible in Notifications region
Scenario 8: [DD-32-018] [DD-32-021] Error toast manually dismissable — with error toast visible, click "×" dismiss → toast disappears immediately
Scenario 9: [DD-32-018] [DD-32-021] Success/info toast auto-dismisses (regression) — trigger success toast, wait 8 seconds → success toast has auto-dismissed (not persistent like error toasts)
