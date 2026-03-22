---
id: DD-28-005
title: Add nine missing API endpoints to email service router
unit: DD-28
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The email service spec defines a complete REST API. Nine endpoints from the spec are absent from the current router, and two existing routes use non-canonical paths. All missing endpoints must be implemented and the misnamed routes corrected.

## Spec Excerpt (verbatim)

> | `GET` | `/api/email/providers/:id` | `email:configure` | Get provider details (secrets masked) |
> | `PUT` | `/api/email/providers/:id/default` | `email:configure` | Set as default provider |
> | `PUT` | `/api/email/providers/:id/fallback` | `email:configure` | Set as fallback provider |
> | `PUT` | `/api/email/providers/:id/enabled` | `email:configure` | Enable/disable provider |
> | `POST` | `/api/email/queue/:id/retry` | `email:configure` | Retry a dead message |
> | `DELETE` | `/api/email/queue/:id` | `email:configure` | Cancel a pending/retry message |
> | `GET` | `/api/email/logs` | `email:view_logs` | Paginated delivery log (filterable) |
> | `GET` | `/api/email/logs/:id` | `email:view_logs` | Delivery details for a specific email |
> | `GET` | `/api/email/stats` | `email:view_logs` | Delivery statistics |
> | `POST` | `/api/email/templates/:id/preview` | `email:manage_templates` | Preview rendered template |
> — 28_EMAIL_SERVICE.md, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/main.rs` — router definition lines 45-70
- `services/email-service/src/handlers/email.rs` — all handler functions; missing handlers need to be added here

## Verification Checklist

- [ ] `GET /providers/:id` is routed and returns a single provider row (with secrets masked)
- [ ] `PUT /providers/:id/default` is routed; handler clears existing default and sets new one atomically
- [ ] `PUT /providers/:id/fallback` is routed; handler sets/clears fallback flag
- [ ] `PUT /providers/:id/enabled` is routed; handler toggles `enabled` flag
- [ ] `POST /queue/:id/retry` is routed; resets `status='pending'`, `next_attempt=now()`, `attempts=0` for a dead item
- [ ] `DELETE /queue/:id` is routed; cancels a `pending` or `retry` item (refuses if `sent`/`dead`)
- [ ] `GET /logs` route exists (renamed from `/delivery-log`)
- [ ] `GET /logs/:id` is routed; returns single delivery log record with full attempt history
- [ ] `GET /stats` is routed; returns aggregate counts (sent/failed/dead) by provider and date range
- [ ] `/templates/:id/preview` route used (not `/templates/:id/render`)

## Assessment

- **Status**: ❌ Missing — `main.rs:45-70` has no routes for providers/:id GET, providers/:id/default, providers/:id/fallback, providers/:id/enabled, queue/:id/retry, queue/:id DELETE, logs, logs/:id, stats; `/delivery-log` should be `/logs`; `/templates/:id/render` should be `/templates/:id/preview`

## Fix Instructions

1. In `handlers/email.rs`, add the following handler functions:

   - `get_provider(State, Path<Uuid>)` — SELECT single row; mask secrets in the `config` JSONB by replacing secret field values with `"<masked>"`
   - `set_default_provider(State, Path<Uuid>)` — transactional UPDATE: `UPDATE email_providers SET is_default=false WHERE is_default=true`, then `UPDATE email_providers SET is_default=true WHERE id=$1`
   - `set_fallback_provider(State, Path<Uuid>)` — similar pattern for `is_fallback`
   - `set_provider_enabled(State, Path<Uuid>, Json<{enabled: bool}>)` — UPDATE single column
   - `retry_queue_item(State, Path<Uuid>)` — `UPDATE email_queue SET status='pending', attempts=0, next_attempt=now(), last_error=NULL WHERE id=$1 AND status='dead'`
   - `cancel_queue_item(State, Path<Uuid>)` — `DELETE FROM email_queue WHERE id=$1 AND status IN ('pending','retry')`; error if sent/dead
   - `get_delivery_log_item(State, Path<Uuid>)` — SELECT from `email_delivery_log` by id
   - `get_email_stats(State, Query<{from: Option<DateTime>, to: Option<DateTime>}>)` — aggregate counts per provider, per status

2. Rename in `handlers/email.rs`:
   - `list_delivery_log` → `list_logs` (or add a `list_logs` alias)
   - `render_template_preview` keep the function name but change the route

3. Update `main.rs` router:
   ```rust
   .route("/providers/:id", get(handlers::email::get_provider)
       .put(handlers::email::update_provider)
       .delete(handlers::email::delete_provider))
   .route("/providers/:id/default", put(handlers::email::set_default_provider))
   .route("/providers/:id/fallback", put(handlers::email::set_fallback_provider))
   .route("/providers/:id/enabled", put(handlers::email::set_provider_enabled))
   .route("/queue/:id/retry", post(handlers::email::retry_queue_item))
   .route("/queue/:id", delete(handlers::email::cancel_queue_item))
   .route("/logs", get(handlers::email::list_logs))
   .route("/logs/:id", get(handlers::email::get_delivery_log_item))
   .route("/stats", get(handlers::email::get_email_stats))
   .route("/templates/:id/preview", post(handlers::email::render_template_preview))
   ```

4. For `set_default_provider`: the entire operation (clear old default, set new) must be in a single DB transaction to preserve the partial index constraint `idx_email_providers_default`.

Do NOT:
- Return plaintext secrets from `get_provider`; identify sensitive fields by provider type and replace values with `"<masked>"`
- Allow retry of a non-dead item; check `status = 'dead'` before resetting
- Remove the existing `/delivery-log` route immediately if frontend still calls it — add the new `/logs` route alongside and deprecate `/delivery-log`
