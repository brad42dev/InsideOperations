---
id: DD-31-015
unit: DD-31
title: /api/notifications/channels/enabled still returns 404 — alert compose shows only websocket
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The alert compose form at /alerts still shows only "websocket" as the available channel.
The API endpoint GET /api/notifications/channels/enabled returns 404.
This is the same issue as DD-31-014 which was marked verified but the fix did not work.

Browser console confirms: "Failed to load resource: the server responded with a status of 404... /api/notifications/channels/enabled"

## Acceptance Criteria

- [ ] GET /api/notifications/channels/enabled returns 200 with a list of enabled channel configurations
- [ ] Alert compose form shows all enabled channels as selectable checkboxes (at minimum: websocket)
- [ ] When additional channels are configured in alert service, they appear in the list

## Verification Checklist

- [ ] Navigate to /alerts → compose form shows channels based on actual API response
- [ ] Browser console shows no 404 for /api/notifications/channels/enabled
- [ ] At minimum websocket channel appears; additional channels appear if configured

## Do NOT

- Do not stub with a hardcoded response — the endpoint must actually work
- Do not return 404 for this route

## Dev Notes

UAT failure from 2026-03-23: Console error "404 Not Found" on /api/notifications/channels/enabled.
Alert compose Channels section: only "websocket" checkbox visible.
DD-31-014 was verified as fixed but UAT confirms it is still broken.
Spec reference: DD-31-014, alert service routing
