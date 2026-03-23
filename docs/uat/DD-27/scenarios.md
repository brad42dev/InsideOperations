# UAT Scenarios — DD-27

## Alert System
Scenario 1: [DD-27-010] SMS Providers page accessible without Access Denied — navigate to /settings/sms-providers as admin → page renders (not "Access Denied")
Scenario 2: [DD-27-007] Alert channels UI shows multiple channel types — navigate to /alerts, open compose → notification channel selector shows more than just WebSocket
Scenario 3: [DD-27-010] Settings page renders without permission error — /settings/sms-providers shows configuration or empty state, not an RBAC error
