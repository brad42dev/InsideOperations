# UAT Scenarios — DD-16

## Page Load
Scenario 1: [DD-16-002] Console page renders without error — navigate to /console → page loads, no error boundary

## WebSocket / Live Data
Scenario 2: [DD-16-005] Console shows live data indicators — navigate to /console → real-time data or connection status indicators visible
Scenario 3: [DD-16-006] Console loads real UI — navigate to /console → workspace list or graphics pane visible, not a stub
Scenario 4: [DD-16-004] No stale point indicators on initial load — navigate to /console → no stale/disconnected indicators visible on fresh load (or indicators clear within 5s)
Scenario 5: [DD-16-002] WebSocket connection indicator present — navigate to /console → connection status indicator (online/offline icon) visible in header or sidebar
