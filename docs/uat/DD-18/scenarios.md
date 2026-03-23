# UAT Scenarios — DD-18

## Page Load (Backend unit — limited browser testability)
Scenario 1: [DD-18-001] Console/Process page renders without error — navigate to /console → page loads, no error boundary (backend query changes don't break frontend)
Scenario 2: [DD-18-005] History data can be loaded — navigate to /forensics or /dashboards → page loads and renders charts without backend error
Scenario 3: [DD-18-006] Aggregation controls render — navigate to /forensics or /dashboards → aggregation type options visible in UI
