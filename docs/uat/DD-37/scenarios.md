# UAT Scenarios — DD-37

## IPC Contracts (WebSocket behavior visible in UI)
Scenario 1: [DD-37-002] Console WebSocket updates visible — navigate to /console → live data updates visible (values change) or connection indicator shows connected
Scenario 2: [DD-37-006] API key auth not rejected — app loads normally → no "Unauthorized" or 401 error when using standard JWT login
Scenario 3: [DD-37-003] Presence updates don't break UI — navigate to /console → no "Something went wrong" from WebSocket message errors
