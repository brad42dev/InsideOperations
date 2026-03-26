---
id: DD-31-017
unit: DD-31
title: "Alerts module crashes on load — templates.find is not a function"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The Alerts module crashes immediately on load with "templates.find is not a function". The root cause is a backend/frontend type mismatch: the `GET /api/notifications/templates` handler returns a `PagedResponse<NotificationTemplateRow>` (which serializes as `{ success, data: [...], pagination: {...} }`). The `client.ts` request wrapper detects the `pagination` key and rewraps the response as `{ success: true, data: { data: [...], pagination: {...} } }`. The frontend then treats `result.data` as `NotificationTemplate[]` and calls `.find()` on the paginated object — not an array — causing the crash.

## Root Cause

`services/api-gateway/src/handlers/notifications.rs` — `list_templates` handler (line ~666):
```rust
(StatusCode::OK, Json(PagedResponse::new(templates, pg, limit, total as u64))).into_response()
```

This returns a paginated envelope. The `client.ts` unwrapper (lines 135–140) detects `pagination` in the envelope and returns `{ data: { data: [...], pagination: {...} } }` instead of `{ data: [...] }`.

All three consumers are affected:
- `frontend/src/pages/alerts/index.tsx` — `SendAlertPanel` uses `templatesResult.data` as `NotificationTemplate[]`
- `frontend/src/pages/alerts/AlertComposer.tsx` — uses `result.data` directly from query
- `frontend/src/pages/alerts/AlertTemplates.tsx` — uses `result.data` directly from query

## Fix

Change `list_templates` to return a plain `ApiResponse<Vec<NotificationTemplateRow>>` instead of `PagedResponse`. Notification templates are a small, bounded list (typically < 50) — pagination is unnecessary. Remove the COUNT query and return all templates in a single `ApiResponse::success(templates)`.

## Acceptance Criteria

- [ ] `GET /api/notifications/templates` returns `{ success: true, data: [...] }` (no `pagination` key)
- [ ] Alerts module loads without "templates.find is not a function" crash
- [ ] Alert Compose tab shows template dropdown populated with templates
- [ ] Alert Templates management tab lists templates
- [ ] `cargo build -p io-api-gateway` compiles with no errors
- [ ] `cd frontend && npx tsc --noEmit` passes

## Files to Create or Modify

- `services/api-gateway/src/handlers/notifications.rs` — change `list_templates` to return `ApiResponse::success(templates)` instead of `PagedResponse::new(...)`, remove the COUNT query

## Verification Checklist

- [ ] `cargo build -p io-api-gateway` passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `GET /api/notifications/templates` response body has no `pagination` key
- [ ] `templates.find(...)` no longer throws in the browser console

## Do NOT

- Do not add frontend workarounds to extract `.data.data` — fix the source
- Do not remove the `?enabled=true` filter support from the query
- Do not change the `NotificationTemplateRow` struct or the template schema

## Dev Notes

UAT failure from 2026-03-24: Alerts module crashes on load — "templates.find is not a function". Root cause traced to `PagedResponse` being returned from `list_templates` handler, causing `client.ts` to wrap the response as `{ data: { data: [...], pagination: {...} } }` instead of `{ data: [...] }`.
