---
id: DD-27-016
unit: DD-27
title: Selecting a template in Send Alert composer does not update Channels section
status: pending
priority: high
depends-on: [DD-27-015]
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

When a user selects a notification template in the Send Alert composer, the Channels section should automatically update to reflect that template's configured channels. Currently, selecting "Custom Alert" (which has channels: websocket, email, sms, radio, push) shows the template variable fields but the Channels section remains showing only `websocket` — it does not populate the template's channels.

Note: This bug partially depends on DD-27-015 (channels endpoint missing). Once the channels endpoint is implemented, the template selection logic must also wire up to pre-populate/pre-check the channels that the selected template uses.

## Acceptance Criteria

- [ ] Selecting a template in the Template (optional) dropdown updates the Channels section to reflect the template's configured channels
- [ ] Selecting "Custom Alert" template pre-selects websocket, email, sms, radio, push in the Channels section
- [ ] Selecting "Safety Bulletin" template pre-selects websocket, email in the Channels section
- [ ] Selecting "— Ad-hoc notification —" resets channels back to the enabled defaults
- [ ] The Preview panel also reflects the correct channels after template selection

## Verification Checklist

- [ ] Navigate to /alerts → Send Alert tab → select "Custom Alert" from template dropdown → Channels section shows websocket, email, sms, radio, push pre-checked
- [ ] Select "Safety Bulletin" template → Channels section updates to websocket, email only
- [ ] Select "— Ad-hoc notification —" → Channels section resets to defaults
- [ ] Preview panel in the composer reflects the current channel selections

## Do NOT

- Do not only update the template variable fields — the channels must also be updated
- Do not hardcode channel lists per template in the frontend — read them from the template object returned by the API

## Dev Notes

UAT failure from 2026-03-24: Selected "Custom Alert" template (configured with websocket/email/sms/radio/push). Template Variables section appeared (title, message fields), but Channels section remained unchanged showing only websocket. Preview panel also only showed websocket.
Screenshot: docs/uat/DD-27/fail-channels-template-no-update.png
Spec reference: DD-27-014 (original channels-missing task), DD-27-005 (alert templates with MiniJinja)
