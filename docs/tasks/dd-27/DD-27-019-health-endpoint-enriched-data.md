---
id: DD-27-019
title: Enrich health endpoint with active_alerts, pending_escalations, and channels status
unit: DD-27
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

`GET /api/alerts/health` (or `/health`) should return a custom JSON payload showing the number of active alerts, number of pending escalations, and per-channel enabled/test status. Currently the endpoint returns only the standard DB-ping response from `io_health::HealthRegistry`.

## Spec Excerpt (verbatim)

> ### Health Check
>
> `GET /api/alerts/health` returns:
> ```json
> {
>   "status": "healthy",
>   "active_alerts": 0,
>   "pending_escalations": 0,
>   "channels": [
>     { "type": "websocket", "enabled": true, "last_test_ok": true },
>     { "type": "email", "enabled": true, "last_test_ok": true },
>     { "type": "sms", "enabled": true, "last_test_ok": true },
>     { "type": "radio", "enabled": false },
>     { "type": "pa", "enabled": false },
>     { "type": "browser_push", "enabled": true, "last_test_ok": true }
>   ]
> }
> ```
> — design-docs/27_ALERT_SYSTEM.md, §Deployment / Health Check

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/main.rs:40-42` — `io_health::HealthRegistry` registered; DB check only
- `services/alert-service/src/handlers/` — no custom health handler exists

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A custom `GET /health` (or `/api/alerts/health`) handler exists that queries DB for active alert count
- [ ] Response includes `active_alerts: i64` (count of alerts with status = 'active')
- [ ] Response includes `pending_escalations: i64` (count of entries in `escalation_tokens` map, or count of active alerts with escalation_policy set)
- [ ] Response includes `channels` array with per-channel `type`, `enabled`, and `last_test_ok`
- [ ] Handler returns HTTP 503 if the DB query fails

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Current health endpoint via `io_health::HealthRegistry` does a PostgreSQL connectivity ping only. It does not return `active_alerts`, `pending_escalations`, or channel statuses.

## Fix Instructions (if needed)

Add a custom health handler in `services/alert-service/src/main.rs` or a new `handlers/health.rs`:

```rust
pub async fn custom_health(State(state): State<AppState>) -> impl IntoResponse {
    // Count active alerts
    let active_alerts: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM alerts WHERE status = 'active'",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // Pending escalations = number of in-memory escalation tokens
    let pending_escalations = state.escalation_tokens.len() as i64;

    // Per-channel status
    let channel_rows = sqlx::query(
        "SELECT channel_type, enabled, last_test_ok FROM alert_channels ORDER BY channel_type",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let channels: Vec<_> = channel_rows.iter().map(|r| {
        use sqlx::Row;
        serde_json::json!({
            "type": r.get::<String, _>("channel_type"),
            "enabled": r.get::<bool, _>("enabled"),
            "last_test_ok": r.try_get::<Option<bool>, _>("last_test_ok").unwrap_or(None),
        })
    }).collect();

    let status = if active_alerts >= 0 { "healthy" } else { "degraded" };

    (StatusCode::OK, Json(serde_json::json!({
        "status": status,
        "active_alerts": active_alerts,
        "pending_escalations": pending_escalations,
        "channels": channels,
    }))).into_response()
}
```

Register this route at `/health` (merging with or replacing `health.into_router()`), or add it as an additional route at `/health/extended`.

Do NOT:
- Remove the existing `io_health::HealthRegistry` DB check — keep it for the standard `/health` path used by load balancers
- Return HTTP 500 or 503 if only the channel query fails — treat it as optional data
