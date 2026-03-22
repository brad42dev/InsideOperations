---
id: DD-28-008
title: Implement real test_provider send and spec-compliant health endpoint
unit: DD-28
status: pending
priority: medium
depends-on: [DD-28-003]
---

## What This Feature Should Do

The `POST /api/email/providers/:id/test` endpoint must send a real test email through the specified provider to the requesting user's address, then record the actual test result. Currently it is a stub that unconditionally marks `last_test_ok = true` without sending. The health endpoint should return the detailed JSON shape specified in the deployment section (queue counts and per-provider status), not the generic health registry response.

## Spec Excerpt (verbatim)

> **"Test Connection" button** sends a test email to the current user's address
> Test result displayed inline (success with delivery time, or error message)
> — 28_EMAIL_SERVICE.md, §Settings UI / Email Providers Section

> `GET /api/email/health` returns:
> ```json
> {
>   "status": "healthy",
>   "queue": { "pending": 0, "retry": 1, "dead": 0 },
>   "providers": [
>     { "id": "plant-exchange", "type": "smtp", "enabled": true, "default": true, "last_test_ok": true }
>   ]
> }
> ```
> — 28_EMAIL_SERVICE.md, §Deployment / Health Check

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/handlers/email.rs` lines 351-370: `test_provider` stub
- `services/email-service/src/main.rs` lines 39-40: `io_health::HealthRegistry` used for health; no custom `/api/email/health` route

## Verification Checklist

- [ ] `test_provider` fetches provider config from DB, instantiates the correct adapter, sends a real test email using the `test_email` template (or a hardcoded test message)
- [ ] `test_provider` records `last_test_ok = true/false` and `last_test_error = <error message or NULL>` based on actual delivery result
- [ ] `test_provider` accepts the requesting user's email address (from JWT claims or from a request body field) as the recipient
- [ ] A `GET /api/email/health` route returns the spec JSON shape with `queue` counts and `providers` array
- [ ] Health endpoint queries `email_queue` for pending/retry/dead counts and `email_providers` for provider list

## Assessment

- **Status**: ❌ Partial for test_provider (stub), ❌ Missing for detailed health endpoint

## Fix Instructions

**1. Real test_provider implementation (`handlers/email.rs:351`)**

The handler needs access to the queue worker's delivery logic. The simplest correct approach:

1. Fetch the provider row from DB (including its config)
2. Determine recipient: extract user email from JWT claims (requires passing auth user context into the handler — the service secret middleware doesn't parse JWTs, so either add a `to_address` field to the request body, or require the caller to pass a `test_recipient` param)
3. Build a test `RenderedEmail` (or equivalent) with subject "Test from Inside/Operations" and body using the `test_email` template variables
4. Call the appropriate send function (same as queue worker `attempt_delivery`) with the provider config
5. On success: `UPDATE email_providers SET last_tested_at=now(), last_test_ok=true, last_test_error=NULL`
6. On failure: `UPDATE email_providers SET last_tested_at=now(), last_test_ok=false, last_test_error=$error`
7. Return `{ "ok": true/false, "error": "..." or null, "delivery_ms": 1234 }`

For recipient: add an optional `to_address: Option<String>` field to the test request body; if absent, return a 400 asking the caller to supply it.

**2. Detailed health endpoint**

Add a new route handler `email_health(State)`:
```rust
pub async fn email_health(State(state): State<AppState>) -> impl IntoResponse {
    let queue_counts: (i64, i64, i64) = sqlx::query_as(
        "SELECT
            COUNT(*) FILTER (WHERE status = 'pending'),
            COUNT(*) FILTER (WHERE status = 'retry'),
            COUNT(*) FILTER (WHERE status = 'dead')
         FROM email_queue"
    ).fetch_one(&state.db).await.unwrap_or((0, 0, 0));

    let providers = sqlx::query(
        "SELECT name, provider_type, enabled, is_default, last_test_ok FROM email_providers ORDER BY name"
    ).fetch_all(&state.db).await.unwrap_or_default();

    Json(json!({
        "status": "healthy",
        "queue": { "pending": queue_counts.0, "retry": queue_counts.1, "dead": queue_counts.2 },
        "providers": providers.iter().map(|r| json!({
            "id": r.get::<String, _>("name"),
            "type": r.get::<String, _>("provider_type"),
            "enabled": r.get::<bool, _>("enabled"),
            "default": r.get::<bool, _>("is_default"),
            "last_test_ok": r.get::<Option<bool>, _>("last_test_ok"),
        })).collect::<Vec<_>>()
    }))
}
```

Add to router in `main.rs`:
```rust
.route("/health", get(handlers::email::email_health))
```
(Note: the `io_health` registry also exposes a health route — keep both; the spec health is at `/api/email/health` while the registry's may be at `/health`)

Do NOT:
- Hardcode `last_test_ok = true` in `test_provider` — this is the exact false-DONE pattern the spec warns against
- Use the generic `io_health` registry response as the spec health response; they serve different purposes
