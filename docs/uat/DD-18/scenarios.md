# UAT Scenarios — DD-18

## Archive Settings Page — Route and Navigation

Scenario 1: [DD-18-007] Page renders without error — navigate to /settings/archive → page loads, no error boundary, no 404, no "Something went wrong"
Scenario 2: [DD-18-007] Archive appears in Settings sidebar — navigate to /settings → sidebar contains an "Archive" or "Timeseries" navigation entry
Scenario 3: [DD-18-007] Sidebar click navigates to archive settings — click Archive in sidebar → /settings/archive loads with form content

## Archive Settings Form — Data Flow

Scenario 4: [DD-18-008] — data flow: GET /api/archive/settings —
  1. Navigate to /settings/archive
  2. Page load triggers GET /api/archive/settings
  3. Wait for response: browser_wait_for time=3000
  4. Snapshot and check: form fields visible (retention period inputs, compression toggles) — NOT just "content visible"
  Pass: at least one numeric input or toggle element present, no "Loading..." or red error message
  Fail: element missing, still loading, error boundary, red error saying 404/failed to load

## Archive Settings Form — Fields Present

Scenario 5: [DD-18-009] Retention period inputs visible — navigate to /settings/archive and wait → numeric input fields for retention period visible in the form
Scenario 6: [DD-18-010] Compression toggle present — navigate to /settings/archive and wait → compression enable/disable toggle or checkbox visible
Scenario 7: [DD-18-010] Continuous aggregate settings present — navigate to /settings/archive and wait → continuous aggregate section or inputs visible

## Archive Settings Form — Save Action

Scenario 8: [DD-18-011] Save button triggers visible response — navigate to /settings/archive, click Save Settings button → success indicator (toast, alert, confirmation) appears; not a silent no-op
