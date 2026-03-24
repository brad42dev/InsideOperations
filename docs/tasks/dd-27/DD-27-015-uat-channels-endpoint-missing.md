---
id: DD-27-015
unit: DD-27
title: Channels endpoint missing — /api/notifications/channels/enabled returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

The alert composer's Channels section calls `GET /api/notifications/channels/enabled` to discover which notification channels are configured and enabled (websocket, sms, pa, radio, push). This endpoint returns 404 — it is not implemented or not routed. As a result, the frontend falls back to showing only `websocket`, and SMS, PA, Radio, and Push channel checkboxes never appear.

The Management > Templates view confirms that sms, pa, radio, push are valid channel types (template records in the DB reference them). The channel discovery endpoint needs to be implemented so all enabled channels are returned to the composer.

## Acceptance Criteria

- [ ] `GET /api/notifications/channels/enabled` returns 200 with a list of enabled channels (at minimum: websocket, sms, pa, radio, push)
- [ ] The Send Alert composer Channels section shows checkboxes for all channels returned by the endpoint (not just websocket)
- [ ] Each channel checkbox (SMS, PA, Radio, Push) is toggleable in the composer
- [ ] The websocket channel remains present and checked by default

## Verification Checklist

- [ ] Navigate to /alerts as admin → Send Alert tab → Channels section shows websocket, sms, pa, radio, push checkboxes
- [ ] Click the SMS checkbox → it toggles on/off with no error
- [ ] Click the PA checkbox → it toggles on/off with no error
- [ ] `curl http://localhost:3000/api/notifications/channels/enabled` with admin JWT returns 200 and lists all enabled channels
- [ ] No 404 error for /api/notifications/channels/enabled in browser console

## Do NOT

- Do not stub this with a hardcoded list in the frontend — the endpoint must exist in the backend
- Do not only implement websocket — all five channel types must be discoverable

## Dev Notes

UAT failure from 2026-03-24: Channels section only showed `websocket` checkbox. All other channels (sms, pa, radio, push) were absent. Browser console showed: `Failed to load resource: http://localhost:5173/api/notifications/channels/enabled` (404 Not Found).
Spec reference: DD-27-007 (channel adapters), DD-27-014 (original channels-missing task)
