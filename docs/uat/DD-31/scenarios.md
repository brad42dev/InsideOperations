# UAT Scenarios — DD-31

## Alerts Module Notification Channels
Scenario 1: [DD-31-016] Alerts page renders without error — navigate to /alerts → page loads, no error boundary
Scenario 2: [DD-31-016] Alert compose shows multiple channels — click Create Alert or Compose → notification channel selector shows Email, SMS, or other channels beyond just "WebSocket (browser)"
Scenario 3: [DD-31-016] Channels API returns data — navigate to /alerts and compose an alert → channel options populated (not just one option)
