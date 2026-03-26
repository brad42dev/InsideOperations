# UAT Scenarios — DD-18

**Unit:** DD-18 (TimescaleDB / Archive Service)
**Tasks under test:** DD-18-012, DD-18-013, DD-18-014, DD-18-015, DD-18-016

**Note:** DD-18-012 (Gorilla compression migration) and DD-18-013 (continuous aggregate policies migration)
are database-layer changes with no direct browser-visible surface. Their correctness cannot be verified
through the browser. The browser-testable surface for DD-18 is the archive settings page at /settings/archive,
which exercises DD-18-014 (service-secret guard) — if the guard is broken, the page errors.
DD-18-015 and DD-18-016 are API behavioral changes (bitmask enforcement) with no dedicated browser UI;
they are tested indirectly via API calls observable in the settings page load.

## Archive Settings Page

Scenario 1: [DD-18-014] Page renders without error — navigate to /settings/archive → real settings form visible, no error boundary, no 404
Scenario 2: [DD-18-014] Archive section visible in settings sidebar — navigate to /settings → "Archive" item visible in sidebar navigation
Scenario 3: [DD-18-014] Click Archive in sidebar loads /settings/archive — click Archive sidebar item → form loads without error or red error message
Scenario 4: [DD-18-014] — data flow: GET /api/archive/settings — 1. Navigate to /settings/archive, 2. Wait for page load (browser_wait_for time=3000), 3. Snapshot and check: retention period input fields must be visible (e.g. input labeled "Retention" or similar numeric field), compression toggle(s) must be present, continuous aggregate settings must appear. Pass: those specific form elements are present AND page shows no red error message. Fail: 404, error boundary, red error message, or "No data" / loading spinner stuck.
Scenario 5: [DD-18-014] Retention period inputs visible — /settings/archive form contains numeric input fields for retention periods (e.g. raw retention days, 1m retention days, etc.)
Scenario 6: [DD-18-014] Compression toggle visible — /settings/archive form contains a toggle or checkbox for compression enabled/disabled
Scenario 7: [DD-18-014] Save button produces visible change — click Save/Submit button → success toast or visible confirmation appears (not a silent no-op)
Scenario 8: [DD-18-012] Migration evidence indirect — /settings/archive page loads without any compression-related error message (absence of error is indirect evidence the migration ran cleanly)
Scenario 9: [DD-18-013] Continuous aggregate settings section present — /settings/archive form includes a section for continuous aggregate configuration or refresh policy settings
