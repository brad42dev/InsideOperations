# UAT Scenarios — DD-31

## Alerts Module
Scenario 1: [DD-31-015] Alerts module renders without error — navigate to /alerts → page loads, no error boundary
Scenario 2: [DD-31-015] Alert compose shows multiple notification channels — navigate to /alerts, click "Create Alert" or compose → notification channel options shown (not just WebSocket/browser)
Scenario 3: [DD-31-015] Notification channels endpoint not 404 — open alert compose → channel selector populates (does not show "Access Denied" or empty list only)
