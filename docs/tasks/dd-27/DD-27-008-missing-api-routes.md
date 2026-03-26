---
id: DD-27-008
title: Add missing alert API routes (active, cancel, webhooks, stats, and correct POST /api/alerts path)
unit: DD-27
status: pending
priority: medium
depends-on: [DD-27-001]
---

## What This Feature Should Do

The spec defines a complete REST API for the alert system. Several required routes are absent from the current `main.rs` routing table. The trigger endpoint uses the wrong path (`/alerts/trigger` instead of `POST /api/alerts`). This task covers the route registration gaps not addressed by the other tasks (templates, rosters, channel config are covered by DD-27-005, DD-27-006, DD-27-007).

## Spec Excerpt (verbatim)

> | Method | Path | Permission | Description |
> |--------|------|------------|-------------|
> | `GET` | `/api/alerts` | `alerts:read` | List alerts |
> | `GET` | `/api/alerts/active` | `alerts:read` | List active (unacknowledged) alerts |
> | `GET` | `/api/alerts/:id` | `alerts:read` | Get alert details |
> | `POST` | `/api/alerts` | `alerts:create` | Trigger a manual alert |
> | `POST` | `/api/alerts/:id/acknowledge` | `alerts:acknowledge` | Acknowledge |
> | `POST` | `/api/alerts/:id/resolve` | `alerts:create` | Resolve |
> | `POST` | `/api/alerts/:id/cancel` | `alerts:create` | Cancel |
> | `GET` | `/api/alerts/stats` | `alerts:read` | Alert statistics |
> | `GET` | `/api/alerts/:id/deliveries` | `alerts:read` | Delivery details |
> | `GET` | `/api/alerts/:id/escalations` | `alerts:read` | Escalation history |
> | `POST` | `/api/alerts/webhooks/twilio/status` | Twilio signature | Twilio delivery status |
> | `POST` | `/api/alerts/webhooks/twilio/voice` | Twilio signature | Twilio voice keypress |
> — design-docs/27_ALERT_SYSTEM.md, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/main.rs:43-77` — current route table; use this as the base to diff against spec
- `services/alert-service/src/handlers/alerts.rs` — existing handlers to extend

## Verification Checklist

- [ ] `POST /alerts` triggers an alert (currently `POST /alerts/trigger` — rename or add alias)
- [ ] `GET /alerts/active` returns only alerts with `status = 'active'`
- [ ] `POST /alerts/:id/cancel` handler exists; sets `status = 'cancelled'`, records `cancelled_by` and `cancelled_at`, cancels escalation token
- [ ] `GET /alerts/stats` returns counts by severity, average response time (time from `triggered_at` to `acknowledged_at`), and channel reliability (ratio of sent to total deliveries per channel type)
- [ ] `GET /alerts/:id/deliveries` returns all rows from `alert_deliveries` for the alert
- [ ] `GET /alerts/:id/escalations` returns all rows from `alert_escalations` for the alert
- [ ] `POST /alerts/webhooks/twilio/status` validates Twilio signature and updates `alert_deliveries.status` based on callback
- [ ] `POST /alerts/webhooks/twilio/voice` validates Twilio signature; keypress `"1"` triggers acknowledgment

## Assessment

- **Status**: ❌ Missing — `cancel`, `active`, `stats`, `deliveries`, `escalations`, and webhook routes all absent; trigger path is non-spec

## Fix Instructions (if needed)

1. In `main.rs`, add the missing routes (note: register static paths before `:id` params):
   ```rust
   .route("/alerts", get(handlers::alerts::list_alerts).post(handlers::alerts::trigger_alert))
   // Remove /alerts/trigger or keep as alias
   .route("/alerts/active", get(handlers::alerts::list_active_alerts))
   .route("/alerts/stats", get(handlers::alerts::get_stats))
   .route("/alerts/:id/cancel", post(handlers::alerts::cancel_alert))
   .route("/alerts/:id/deliveries", get(handlers::alerts::list_deliveries))
   .route("/alerts/:id/escalations", get(handlers::alerts::list_escalations))
   .route("/alerts/webhooks/twilio/status", post(handlers::webhooks::twilio_status))
   .route("/alerts/webhooks/twilio/voice", post(handlers::webhooks::twilio_voice))
   ```

2. Add `list_active_alerts` handler in `alerts.rs`:
   ```rust
   pub async fn list_active_alerts(State(state): State<AppState>) -> impl IntoResponse {
       sqlx::query_as::<_, AlertInstance>(
           "SELECT ... FROM alerts WHERE status = 'active' ORDER BY severity ASC, triggered_at DESC"
       ).fetch_all(&state.db).await
   }
   ```

3. Add `cancel_alert` handler: set `status = 'cancelled'`, `cancelled_by`, `cancelled_at`; cancel the `CancellationToken` (from DD-27-003).

4. Add `get_stats` handler: aggregate query for counts by severity, average `EXTRACT(EPOCH FROM (acknowledged_at - triggered_at))` for acknowledged alerts, and `COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*)` per channel from `alert_deliveries`.

5. Add `list_deliveries` handler: `SELECT * FROM alert_deliveries WHERE alert_id = $1 ORDER BY created_at ASC`.

6. Add `list_escalations` handler: `SELECT * FROM alert_escalations WHERE alert_id = $1 ORDER BY escalated_at ASC`. Note: `alert_escalations` table may need to be created per spec schema (see DD-27-001).

7. Create `services/alert-service/src/handlers/webhooks.rs`:
   - `twilio_status`: validate Twilio webhook signature (HMAC-SHA1 of URL + sorted params using auth token), then update `alert_deliveries` row by `external_id`
   - `twilio_voice`: same validation; if `Digits = "1"` (configured acknowledge key), call acknowledge logic

Do NOT:
- Remove `/alerts/trigger` without checking if any existing callers (API gateway proxy, frontend) use that path — add the new path and keep the old as an alias until callers are updated
- Skip Twilio signature validation on webhook endpoints — unsigned webhooks must return 403
