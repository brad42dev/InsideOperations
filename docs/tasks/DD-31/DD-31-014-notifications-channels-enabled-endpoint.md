---
id: DD-31-014
title: "Alert compose form shows only 'websocket' channel — /notifications/channels/enabled API returns 404"
unit: DD-31
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

UAT Scenario [DD-31-005]: The Alerts compose form at `/alerts` shows only the hardcoded "websocket" channel because `GET /api/notifications/channels/enabled` returns 404. The `AlertComposer.tsx` calls `notificationsApi.getEnabledChannels()` which hits this endpoint, then falls back to `['websocket']` on failure.

The endpoint is missing from the API Gateway's `notifications_routes()` in `services/api-gateway/src/handlers/notifications.rs`. It needs to be added so that the compose form shows all enabled notification channels (email, sms, pa, radio, push, websocket) as configured in the `alert_channels` table.

## Acceptance Criteria

- [ ] `GET /api/notifications/channels/enabled` returns HTTP 200 with a JSON array of enabled channel type strings
- [ ] The Alerts compose form shows all configured/enabled channels (not just "websocket")
- [ ] Response is wrapped in the standard `ApiResponse<T>` envelope: `{ success: true, data: ["websocket", "email"] }`
- [ ] Returns empty array (not 404) if no channels are enabled

## Files to Create or Modify

- `services/api-gateway/src/handlers/notifications.rs` — add `get_enabled_channels` handler and register route
  - Route: `GET /api/notifications/channels/enabled`
  - Query: `SELECT channel_type FROM alert_channels WHERE enabled = true ORDER BY channel_type`
  - Return: `ApiResponse::ok(channel_types: Vec<String>)`

## Verification Checklist

- [ ] `cargo build -p io-api-gateway` passes with no errors
- [ ] `GET /api/notifications/channels/enabled` returns 200 with JSON array
- [ ] Navigate to `/alerts` — compose form shows multiple channel checkboxes (not just websocket)
- [ ] TypeScript build passes: `pnpm --filter frontend tsc --noEmit`

## Do NOT

- Do not modify the frontend `AlertComposer.tsx` — the fallback logic and API call are already correct
- Do not proxy to the alert service — query the `alert_channels` DB table directly from API Gateway
- Do not require authentication headers beyond normal JWT (existing middleware handles this)

## Dev Notes

UAT failure from 2026-03-23: `/api/notifications/channels/enabled` returns 404. Frontend at `frontend/src/api/notifications.ts:257` calls this endpoint. Alert service has `/alerts/channels` (different prefix) which lists all channels including disabled. DB table `alert_channels` has `channel_type` (varchar) and `enabled` (bool) columns. API Gateway pattern for DB queries: see `services/api-gateway/src/handlers/notifications.rs` (existing handlers use `State(state): State<AppState>` and `sqlx::query_as`).
