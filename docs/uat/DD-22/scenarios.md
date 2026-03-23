# UAT Scenarios — DD-22

## Deployment / Infrastructure (DD-22)

Note: DD-22 tasks are all deployment/infrastructure (systemd, nginx, ACME, env vars). Not browser-testable. Testing via health/settings page only.

Scenario 1: [DD-22-001] App loads and backend is reachable — navigate to /console → page loads, backend API accessible
Scenario 2: [DD-22-007] System settings page renders — navigate to /settings → settings page loads without crash
Scenario 3: [DD-22-004] HTTPS/HSTS — check app in browser → no immediate HSTS-related errors
