---
unit: DD-27
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 5
scenarios_failed: 2
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /alerts loads real implementation — Alerts module with Send Alert composer, Active/History/Management tabs visible, no error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Alerts Module Load | [DD-27-012] Alerts page renders without error | ✅ pass | Full module loaded with heading, tabs, composer |
| 2 | Alerts Module Load | [DD-27-012] No templates.find crash | ✅ pass | Console shows 429 rate-limit errors but no TypeError; module interactive |
| 3 | Alerts Module Load | [DD-27-012] Empty state when no templates | ✅ pass | Template combobox shows "— Ad-hoc notification —" default; 10 system templates populated |
| 4 | Alert Composer | [DD-27-013] Alert composer opens | ✅ pass | Send Alert view is immediately visible with full compose form |
| 5 | Alert Composer | [DD-27-013] Channel options visible in composer | ❌ fail | Only "websocket" checkbox shown; SMS/PA/Radio/Push not present. API /api/notifications/channels/enabled returns 429 (rate limited) |
| 6 | Alert Composer | [DD-27-013] SMS channel checkbox toggleable | ❌ fail | SMS checkbox not visible in composer — cannot test |
| 7 | Templates Section | [DD-27-013] Templates section renders | ✅ pass | Management > Templates shows 10 system templates with correct channel tags (sms, pa, radio, push visible in template cards) |

## New Bug Tasks Created

DD-27-014 — Alert composer channels section only shows websocket; SMS/PA/Radio/Push channels absent

## Screenshot Notes

- Screenshot: .playwright-mcp/page-2026-03-24T18-46-33-011Z.png
  Shows Send Alert composer with "Custom Alert (info)" template selected. Preview pane shows only "websocket" channel badge. The Channels section (below template variables) only renders the websocket checkbox — no SMS, PA, Radio, or Push options despite the Custom Alert template referencing all those channels in the Management view.
- The /api/notifications/channels/enabled endpoint returned HTTP 429 (Too Many Requests), preventing the composer from loading the list of enabled channels. The channel data IS referenced in templates (Management view shows sms, pa, radio, push tags on template cards) but the composer's channel picker depends on this API response to render channel checkboxes.
