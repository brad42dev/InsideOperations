# UAT Scenarios — DD-16

## WebSocket Live Indicators
Scenario 1: [DD-16-005] Console page loads with live data indicators — navigate to /console → page loads, real-time connection indicator present (no error boundary)
Scenario 2: [DD-16-006] Connection status indicator visible — navigate to /console → WebSocket connection status shown (connected/disconnected icon or badge)
Scenario 3: [DD-16-002] Page renders without error — navigate to /console → no "Something went wrong", no error boundary
Scenario 4: [DD-16-004] Point values display in console — navigate to /console → if workspaces exist, data values shown; otherwise empty state message shown
