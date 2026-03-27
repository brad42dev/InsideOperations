# UAT Scenarios — DD-27

Unit: DD-27 (Alert System — Escalation Audit Trail)
Task under test: DD-27-018 — Write escalation steps to alert_escalations table in dispatch_tier_impl
Primary route: /alerts

---

## Module Load

Scenario 1: [DD-27-018] Alerts page renders without error — navigate to /alerts → page loads, no "Something went wrong" error boundary, no "Alerts failed to load" message

## Alert List & Data Flow

Scenario 2: [DD-27-018] — data flow: GET /api/v1/alerts — navigate to /alerts, wait for page load (time=3000), snapshot and check: alert list container or empty-state message visible, NOT "Loading..." indefinitely or error boundary. Specific DOM evidence: list table/container OR "No alerts"/"No active alerts" text present. Pass: container or empty-state present. Fail: spinner still showing, error boundary, blank page.

## Alert Composer

Scenario 3: [DD-27-018] Send Alert tab or button visible — navigate to /alerts → "Send Alert" button or tab present in UI

Scenario 4: [DD-27-018] Alert composer opens on click — click Send Alert button/tab → composer panel or dialog becomes visible (role=dialog or dedicated composer section)

Scenario 5: [DD-27-018] Composer shows title and message fields — inside open composer → title input and message textarea both visible

## Alert Templates Section

Scenario 6: [DD-27-018] Templates section renders without crash — navigate to /alerts, find Templates tab/section → renders without error boundary (empty state is acceptable)

## Console Errors

Scenario 7: [DD-27-018] No TypeError on page load — navigate to /alerts → page content does not contain "templates.find is not a function" or any visible error text indicating a crash
