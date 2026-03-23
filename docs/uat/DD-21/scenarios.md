# UAT Scenarios — DD-21

## API / Backend (limited browser testability)
Scenario 1: [DD-21-002] App loads without API errors — navigate to /console → no error boundary, app functional (rate limit headers don't break anything)
Scenario 2: [DD-21-004] Form validation works — navigate to /settings, attempt to submit invalid data → validation error messages appear
Scenario 3: [DD-21-002] Login validates input — navigate to /login, submit empty form → validation error shown (not server crash)
