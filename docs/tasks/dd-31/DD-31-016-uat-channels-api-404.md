---
id: DD-31-016
unit: DD-31
title: Notification channels API endpoint 404 — alert compose only shows WebSocket channel
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The alert compose dialog only shows "WebSocket (browser)" as an available notification channel because the channels endpoint /api/notifications/channels/enabled returns 404. The spec requires Email, SMS, and other configured notification channels to be available in the compose dialog.

## Acceptance Criteria

- [ ] /api/notifications/channels/enabled returns a valid list of enabled channels (not 404)
- [ ] Alert compose dialog shows all configured notification channels (Email, WebSocket, SMS if configured)
- [ ] Selecting a channel type in compose correctly routes the alert

## Verification Checklist

- [ ] Navigate to /alerts, click Create Alert or compose
- [ ] Confirm notification channel selector shows more than just "WebSocket (browser)"
- [ ] curl /api/notifications/channels/enabled returns 200 with channel list

## Do NOT

- Do not hardcode only WebSocket as the channel
- Do not stub the endpoint with empty response

## Dev Notes

UAT failure 2026-03-23: /api/notifications/channels/enabled → 404. Alert compose dialog shows only "WebSocket (browser)". Screenshot at docs/uat/DD-31/channels-websocket-only.png.
Spec reference: DD-31-015
