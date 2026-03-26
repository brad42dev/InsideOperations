---
id: DD-31-022
unit: DD-31
title: "/api/notifications/channels/enabled intermittent cold-start 404 — alert compose shows only WebSocket"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

Every fresh browser session (cold start) causes `/api/notifications/channels/enabled` to return 404.
The alert compose form's Channels section then shows only the hardcoded "websocket" fallback instead
of the API-driven channel list. After ~3-4 seconds (backend warms up), subsequent page loads show
all 6 channels (in_app, pa, push, radio, sms, websocket) correctly.

The fix must eliminate the cold-start 404 so the endpoint returns 200 on every request — not just
after warmup. Likely causes: route ordering still incorrect (parameterised route shadows the static
path), or the handler is not registered until after first request.

Prior tasks DD-31-014, DD-31-015, DD-31-016, DD-31-020 all attempted this fix and were marked
verified, but the cold-start 404 persists in UAT.

## Acceptance Criteria

- [ ] `GET /api/notifications/channels/enabled` returns HTTP 200 on the very first request after a fresh browser start (no warmup needed)
- [ ] Response body: `{ success: true, data: ["in_app", "pa", "push", "radio", "sms", "websocket"] }` (or whatever channels are in DB)
- [ ] Alert compose form's Channels section shows all enabled channels on first page load
- [ ] Browser console shows NO 404 for `/api/notifications/channels/enabled` on any `/alerts` page load

## Verification Checklist

- [ ] Kill Chrome (`pkill chrome`), navigate to /alerts fresh — no 404 in console for channels/enabled
- [ ] Channels section in compose form shows multiple checkboxes (not just "websocket") on first load
- [ ] Inspect route registration in `services/api-gateway/src/handlers/notifications.rs` — confirm `/channels/enabled` is registered before any parameterized routes like `/:id`
- [ ] `cargo build -p io-api-gateway` passes

## Do NOT

- Do not mark verified without testing on a cold start (kill Chrome first)
- Do not add a frontend retry/delay workaround — fix the backend route registration

## Dev Notes

UAT failure 2026-03-26: Reproducible cold-start 404. Browser console shows:
`Failed to load resource: Not Found @ http://localhost:5173/api/notifications/channels/enabled`
on every fresh Chrome session. Subsequent loads (same session) return 200 with 6 channels.
Root cause: likely Axum route ordering — `:id` wildcard is shadowing `/channels/enabled` static segment.
Spec reference: DD-31-014, DD-31-015, DD-31-016, DD-31-020
