---
id: DD-31-020
unit: DD-31
title: "/api/notifications/channels/enabled still 404 — alert compose shows only websocket"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

`GET /api/notifications/channels/enabled` returns 404 in the current build. Tasks DD-31-014, DD-31-015, and DD-31-016 all claimed to fix this endpoint but all three have been marked verified without the fix actually being live.

The Alert compose form's Channels section shows only a single "websocket" checkbox because the frontend falls back to this default when the API call fails. Any other configured channels (email, SMS, push, PA) are invisible to the user.

The endpoint must return HTTP 200 with a JSON array wrapped in the standard `ApiResponse<T>` envelope: `{ success: true, data: ["websocket", "email"] }`. If no channels are configured beyond websocket, it should return `{ success: true, data: ["websocket"] }` — never 404.

## Acceptance Criteria

- [ ] `GET /api/notifications/channels/enabled` returns 200 (not 404)
- [ ] Response body follows `ApiResponse<string[]>` envelope: `{ success: true, data: [...] }`
- [ ] Alert compose form's Channels section renders checkboxes driven by the API response
- [ ] At minimum "websocket" channel appears; additional channels appear if configured
- [ ] Browser console shows no 404 error for this endpoint on /alerts page load

## Verification Checklist

- [ ] Navigate to /alerts → browser console shows no 404 for /api/notifications/channels/enabled
- [ ] Compose form Channels section shows channel checkboxes matching API response
- [ ] `cargo build -p io-api-gateway` passes with no errors
- [ ] `cd frontend && npx tsc --noEmit` passes

## Do NOT

- Do not stub this with a hardcoded response — the endpoint must be wired to real Alert Service config
- Do not silently suppress the 404 in the frontend — the API itself must be fixed

## Dev Notes

UAT failure 2026-03-25: console error `Failed to load resource: Not Found @ http://localhost:5173/api/notifications/channels/enabled` confirmed on every /alerts page load. Only "websocket" channel visible in compose form.
Prior tasks attempting this fix: DD-31-014, DD-31-015, DD-31-016 (all verified but ineffective).
