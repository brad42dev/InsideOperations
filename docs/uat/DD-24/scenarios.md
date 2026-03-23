# UAT Scenarios — DD-24

## Universal Import (DD-24)

Note: Most DD-24 tasks are backend ETL/API. Browser-testable aspect is the import UI in settings.

Scenario 1: [DD-24-007] Import page renders — navigate to /settings/imports → import configuration page loads
Scenario 2: [DD-24-002] Connection test button — in import source config → "Test Connection" button visible and clickable
Scenario 3: [DD-24-007] Import connector list visible — navigate to /settings/imports → connector templates list shows connectors
Scenario 4: [DD-24-003] Import pages load without auth error — navigate to /settings/imports as admin → page loads (not 403)
