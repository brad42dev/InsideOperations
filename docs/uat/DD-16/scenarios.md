# UAT Scenarios — DD-16

## WebSocket / Real-time (DD-16)

Note: DD-16 tasks are backend WebSocket protocol improvements. Browser-testable aspects are limited to observing live data indicators.

Scenario 1: [DD-16-001] Console page renders with live data — navigate to /console → page loads, no error boundary, WebSocket connection indicator or live data visible
Scenario 2: [DD-16-005] SharedWorker reconnects — navigate to /console, observe → no continuous spinner or disconnected state
Scenario 3: [DD-16-006] Source offline indication — check console with OPC sources → stale/offline indicator present in UI when source is offline (or no crash)
Scenario 4: [DD-16-003] Live data updates in console — navigate to /console with a workspace → values update in real time (no frozen display after 30s)
