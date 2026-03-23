# UAT Scenarios — DD-21

## API Pagination (DD-21)

Note: DD-21 tasks are backend API changes (pagination envelope, rate limit headers). Not directly browser-testable from the UI. Testing observable behavior only.

Scenario 1: [DD-21-001] Paginated list renders — navigate to /settings/users → user list renders with pagination controls visible
Scenario 2: [DD-21-002] API rate limit — navigate to any data-heavy page → page loads without rate limit error messages
Scenario 3: [DD-21-001] List pages load without crash — navigate to /reports → list loads, no error about missing pagination fields
