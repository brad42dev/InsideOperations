---
id: DD-27-014
unit: DD-27
title: Alert composer channels section only shows websocket; SMS/PA/Radio/Push channels absent
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

The alert composer (Send Alert tab at /alerts) renders a "Channels" section that should list all enabled notification channels with toggleable checkboxes. Currently only "websocket" is shown. SMS, PA, Radio, and Push (BrowserPush) channels are not rendered in the composer even when selecting a template that references those channels (e.g., "Custom Alert" which has sms/radio/push in the Management templates view).

Root cause: The `/api/notifications/channels/enabled` endpoint is returning HTTP 429 (Too Many Requests) in the dev environment, so the composer cannot load the channel list. The implementation must either:
1. Fix the rate limit configuration so channel data loads reliably, OR
2. Guard against missing/failed channel data by showing a fallback state (e.g., all channels available or a loading state) rather than silently showing only websocket

## Acceptance Criteria

- [ ] The alert composer Channels section shows all enabled channels: websocket, sms, pa (public address), radio, and push (BrowserPush)
- [ ] Each channel appears as a toggleable checkbox in the composer
- [ ] Toggling a channel checkbox changes its checked state with no error
- [ ] If the channels API fails, the composer shows a sensible fallback (not just websocket)

## Verification Checklist

- [ ] Navigate to /alerts as admin → click Send Alert tab → Channels section shows websocket, sms, pa, radio, push checkboxes
- [ ] Click the SMS checkbox → it toggles on/off, no console error
- [ ] Verify /api/notifications/channels/enabled returns 200 (not 429) for admin user
- [ ] Select "Custom Alert" template → channels section reflects that template's channel list

## Do NOT

- Do not stub this with only websocket hardcoded — all enabled channels must render dynamically
- Do not suppress the 429 error silently — fix the rate limit or show an error state to the user

## Dev Notes

UAT failure from 2026-03-24: Composer renders only "websocket" checkbox under Channels. API /api/notifications/channels/enabled returns 429 (Too Many Requests). Management > Templates view correctly shows channel tags (sms, pa, radio, push) on template cards, confirming channel data exists in the DB.
Spec reference: DD-27-007 (channel adapters), DD-27-013 (module crash fix)
Screenshot: .playwright-mcp/page-2026-03-24T18-46-33-011Z.png
