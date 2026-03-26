# UAT Scenarios — DD-23

1 task to UAT: DD-23-025

## Expression Builder Dialog — Crash Fix

Scenario 1: [DD-23-025] Page renders without error — navigate to /settings/expressions → Expression Library page loads, no error boundary, no "Settings failed to load" text

Scenario 2: [DD-23-025] Expression builder dialog opens — click Edit on any expression row → [role="dialog"] appears, NO "Settings failed to load" error boundary, NO "Invalid hook call" text on screen

Scenario 3: [DD-23-025] Dialog renders workspace and palette — after dialog opens → workspace area and palette panel are visible inside the dialog (tiles, palette buttons, or canvas area present)

Scenario 4: [DD-23-025] No React errors in browser console — open dialog → browser_console_messages shows no "Invalid hook call" or "Cannot read properties of null" errors

Scenario 5: [DD-23-025] Escape key closes dialog — press Escape while dialog is open → dialog disappears, Expression Library list is visible again

Scenario 6: [DD-23-025] Focus trap: ArrowLeft captured within dialog — click a tile inside dialog, press ArrowLeft keyboard key → URL remains /settings/expressions (navigation not triggered), focus stays inside dialog

Scenario 7: [DD-23-025] — data flow: GET /api/v1/expressions —
  1. Navigate to /settings/expressions
  2. Page load triggers fetch of expression library list
  3. Wait for response: browser_wait_for time=3000
  4. Snapshot and check: UI must show at least one expression row in the library table (expression name visible)
  Pass: expression row(s) visible, no "Loading..." spinner, no error boundary
  Fail: error boundary, still loading, or "No data" with no graceful empty state
