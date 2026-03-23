---
id: DD-31-014
unit: DD-31
title: Alert compose form shows only "websocket" channel — /notifications/channels/enabled API returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The Alert compose form should load available channels from the Alert Service config via GET /notifications/channels/enabled. This API call returns 404 (Not Found), causing the form to fall back to a hardcoded ["websocket"] list. The compose form shows only a "websocket" checkbox — users cannot select SMS, Email, PA, Radio, or Push channels.

The API endpoint /notifications/channels/enabled needs to be implemented in the alert-service (or api-gateway routing) and return the actually configured channels.

## Acceptance Criteria

- [ ] GET /api/notifications/channels/enabled returns a list of enabled channel configurations
- [ ] Alert compose form shows all enabled channels as selectable checkboxes
- [ ] At minimum: websocket channel appears; additional channels appear if configured

## Verification Checklist

- [ ] Navigate to /alerts → compose form shows channels based on alert service config
- [ ] Response from /api/notifications/channels/enabled is not 404
- [ ] Channel list updates if alert service config changes

## Do NOT

- Do not hardcode channel list in the frontend — it must come from the API
- Do not return all channels always — only return channels that are actually configured and enabled

## Dev Notes

UAT failure from 2026-03-23: Alert compose form shows only "websocket" checkbox. Console error: "Failed to load resource: 404 Not Found @ /api/notifications/channels/enabled". Notification templates in Management tab show websocket/email/sms/pa/push channels — so channels exist in the system but the /enabled endpoint is missing. Spec reference: DD-31-005.
