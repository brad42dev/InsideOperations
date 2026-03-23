# UAT Scenarios — DD-16

## WebSocket Infrastructure
Scenario 1: [DD-16-002] Console page renders without error — navigate to /console → page loads, no error boundary, WebSocket data indicators visible
Scenario 2: [DD-16-004] Point data indicators present — navigate to /console → service status or live data indicators visible in sidebar
Scenario 3: [DD-16-005] App shell loads with no JS error — navigate to /console → no "Something went wrong" boundary visible
Scenario 4: [DD-16-006] Source offline state — navigate to /console → page renders; service status panel shows services (stale state detection is internal)
