# UAT Scenarios — DD-31

## Alerts Module

Scenario 1: [DD-31-014] Alert compose shows multiple channels — navigate to /alerts, open compose form → channels beyond "websocket" visible (SMS, email, etc.), not 404 error
Scenario 2: [DD-31-015] Channels API not 404 — open alert compose → available channels loaded from API (no 404 error shown)
Scenario 3: [DD-31-016] Notification channels API working — /alerts page → alert compose form shows real channel list
Scenario 4: [DD-31-003] Template variable definitions — open alert template → variables defined with name, label, default_value, required fields (not just string array)
Scenario 5: [DD-31-005] Available channels from config — alert compose → channels loaded from service config, not hardcoded list
Scenario 6: [DD-31-006] Real-time delivery status — send an alert → delivery status updates via WebSocket (not polling)
Scenario 7: [DD-31-007] Export Unaccounted List — find Muster Dashboard → Export Unaccounted List button visible
Scenario 8: [DD-31-008] Export button in Alert History — navigate to alerts history → Export button present in table toolbar
Scenario 9: [DD-31-010] Loading skeletons present — navigate to /alerts while loading → module-shaped skeleton shown (not generic "Loading...")
