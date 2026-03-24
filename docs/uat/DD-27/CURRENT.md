---
unit: DD-27
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 3
scenarios_failed: 4
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /alerts loads real implementation — Alerts module renders with Send Alert / Active / History / Management tabs, composer form, and template management.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Module Load | [DD-27-014] Alerts module renders without error | ✅ pass | Page loads, heading visible, no error boundary |
| 2 | Send Alert Composer | [DD-27-014] Send Alert tab visible and clickable | ✅ pass | Composer shown by default with form fields |
| 3 | Send Alert Composer | [DD-27-014] Channels section shows all channel types | ❌ fail | Only `websocket` checkbox present; SMS, PA, Radio, Push absent. `/api/notifications/channels/enabled` returns 404 |
| 4 | Send Alert Composer | [DD-27-014] SMS channel checkbox is toggleable | ❌ fail | SMS checkbox does not exist in Channels section |
| 5 | Send Alert Composer | [DD-27-014] PA channel checkbox is toggleable | ❌ fail | PA checkbox does not exist in Channels section |
| 6 | Send Alert Composer | [DD-27-014] Custom Alert template updates channels | ❌ fail | Selecting "Custom Alert" (websocket/email/sms/radio/push) shows template variables but Channels section still shows only websocket — not updated |
| 7 | Templates Section | [DD-27-014] Alert templates section renders | ✅ pass | Management > Templates shows 10 seeded system templates with correct channel tags |

## New Bug Tasks Created

DD-27-015 — Channels endpoint missing: /api/notifications/channels/enabled returns 404
DD-27-016 — Template selection in composer does not update Channels section

## Screenshot Notes

- docs/uat/DD-27/fail-channels-missing.png: Channels section showing only websocket with full composer visible
- docs/uat/DD-27/fail-channels-template-no-update.png: Custom Alert template selected; Channels section still shows only websocket despite template having websocket/email/sms/radio/push; Preview panel also shows only websocket
- /api/notifications/channels/enabled returns 404 — the enabled-channels endpoint is not implemented/routed, causing the frontend to fall back to only websocket
- /api/notifications/templates?enabled=true initially returned 404 but templates were visible in Management tab (management uses a different endpoint); after visiting Management tab the templates cached and became available in the composer dropdown
