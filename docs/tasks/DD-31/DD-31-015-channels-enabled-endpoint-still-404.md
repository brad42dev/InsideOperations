---
id: DD-31-015
title: "/api/notifications/channels/enabled still returns 404 — alert compose shows only websocket"
unit: DD-31
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

UAT re-test after DD-31-014: The Alerts compose form at `/alerts` still shows only the hardcoded "websocket" channel because `GET /api/notifications/channels/enabled` returns 404 at runtime. DD-31-014 added the handler and route in `notifications.rs`, but the UAT detected a 404 in the browser console when testing after that task completed.

The `get_enabled_channels` handler and route `/api/notifications/channels/enabled` exist in `services/api-gateway/src/handlers/notifications.rs` and are registered in `main.rs`. However, the build artifact may be stale or the route registration may have a conflict. This task must verify the implementation is correct and complete, fix any remaining issues, and confirm the endpoint resolves properly.

## Investigation Steps

1. Verify `get_enabled_channels` handler exists and is syntactically correct in `notifications.rs`
2. Verify the route `/api/notifications/channels/enabled` is registered in `notifications_routes()` and appears BEFORE any wildcard or parameterized routes that could shadow it
3. Verify `notifications_routes()` is merged into the main Axum router in `main.rs`
4. Confirm `cargo build -p io-api-gateway` compiles cleanly
5. Check if the `alert_channels` table DDL is present in migrations

## Acceptance Criteria

- [ ] `GET /api/notifications/channels/enabled` is registered before any `:id` wildcard routes in `notifications_routes()`
- [ ] `cargo build -p io-api-gateway` compiles with no errors
- [ ] The Alerts compose form can show enabled channels (not just "websocket")
- [ ] Response is wrapped in the standard `ApiResponse<T>` envelope: `{ success: true, data: [...] }`
- [ ] Returns empty array (not 404) if no channels are enabled

## Files to Create or Modify

- `services/api-gateway/src/handlers/notifications.rs` — verify route order: ensure `/api/notifications/channels/enabled` is registered before any parameterized sub-paths; fix if needed

## Verification Checklist

- [ ] `cargo build -p io-api-gateway` passes with no errors
- [ ] `GET /api/notifications/channels/enabled` route exists in notifications_routes() before any wildcard routes
- [ ] TypeScript build passes: `cd frontend && npx tsc --noEmit`

## Do NOT

- Do not remove the existing `get_enabled_channels` handler
- Do not change the response format — it must be `ApiResponse<Vec<String>>`
- Do not add authentication beyond the existing JWT middleware

## Dev Notes

UAT failure from 2026-03-23 (after DD-31-014 was implemented): browser console shows "Failed to load resource: the server responded with a status of 404... /api/notifications/channels/enabled". The code for DD-31-014 is present in the file; the likely issue is either route ordering (a parameterized route shadowing the static one) or the build artifact was not refreshed before UAT. Verify route order and rebuild.
