---
id: DD-28-007
title: Fix status 'dead' vs 'failed', system template delete guard, fallback provider, NOTIFY listener, and cleanup task
unit: DD-28
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Several small but distinct correctness gaps exist in the current implementation:

1. Exhausted queue items should be marked `dead`, not `failed` (these are different statuses in the spec schema)
2. System templates (category = 'system') must not be deletable via the API
3. When the primary provider fails, the service must retry via the fallback provider (if configured)
4. The service must listen for `NOTIFY email_send` PostgreSQL notifications as an alternative trigger to queue insertion via HTTP
5. A scheduled cleanup task must purge queue entries older than the retention period (default 30 days)

## Spec Excerpt (verbatim)

> After max attempts (default: 4): mark as `dead`, log error
> — 28_EMAIL_SERVICE.md, §Queue and Delivery / Queue Processing (retry schedule)

> **Soft bounces**: ... the message is marked `dead` but the address is NOT added to the suppression list
> — 28_EMAIL_SERVICE.md, §Queue and Delivery / Bounce Handling

> Any I/O service can send email by either:
> 2. **PostgreSQL NOTIFY** on `email_send` channel — for services that prefer async fire-and-forget
> — 28_EMAIL_SERVICE.md, §Architecture / Inter-Service Communication

> **Fallback flag** — optional secondary provider if default fails
> — 28_EMAIL_SERVICE.md, §Email Providers / Provider Configuration Model

> Completed queue entries are retained for 30 days (configurable), then archived or purged by a scheduled cleanup task.
> — 28_EMAIL_SERVICE.md, §Queue and Delivery / Queue Cleanup

> System templates show "View/Edit" (can customize content but not delete)
> — 28_EMAIL_SERVICE.md, §Settings UI / Email Templates Section

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/queue_worker.rs` line 105-108: `"failed"` should be `"dead"`; no fallback provider logic
- `services/email-service/src/handlers/email.rs` lines 518-532: `delete_template` has no guard on `category`
- `services/email-service/src/main.rs` lines 20-45: no `pg_notify` listener spawned
- `services/email-service/src/config.rs`: no `queue_retention_days` field (added in DD-28-001)

## Verification Checklist

- [ ] `queue_worker.rs`: exhausted-retry status is `"dead"`, not `"failed"`; the `email_queue.status` schema comment says `-- pending, sending, sent, retry, failed, dead`
- [ ] `handlers/email.rs` `delete_template`: guards `category != 'system'`; returns 403/400 for system templates
- [ ] `queue_worker.rs`: on primary provider send failure, queries `email_providers WHERE is_fallback=true AND enabled=true` and retries via fallback before marking as retry/dead
- [ ] `main.rs` or `queue_worker.rs`: spawns a Tokio task that calls `sqlx::postgres::PgListener::listen("email_send")` and enqueues received notifications
- [ ] A scheduled cleanup task purges `email_queue WHERE status='sent' AND sent_at < now() - interval '$N days'` using `queue_retention_days` from config

## Assessment

- **Status**: ⚠️ Partial — `"failed"` vs `"dead"` is wrong at `queue_worker.rs:105-108`; system template delete unguarded at `handlers/email.rs:518`; fallback, NOTIFY, and cleanup entirely absent

## Fix Instructions

**1. Fix `"failed"` → `"dead"` (`queue_worker.rs:105-108`)**

Change:
```rust
let next_status = if new_attempts >= max_attempts {
    "failed"
} else {
    "retry"
};
```
To:
```rust
let next_status = if new_attempts >= max_attempts {
    "dead"
} else {
    "retry"
};
```

**2. System template delete guard (`handlers/email.rs:518`)**

Before the DELETE query in `delete_template`, add:
```rust
let cat: Option<String> = sqlx::query_scalar(
    "SELECT category FROM email_templates WHERE id = $1"
).bind(id).fetch_optional(&state.db).await?;
if cat.as_deref() == Some("system") {
    return (StatusCode::FORBIDDEN, Json(json!({...}))).into_response();
}
```

**3. Fallback provider logic (`queue_worker.rs`)**

After a failed send attempt, before scheduling retry:
1. Check if fallback provider exists: `SELECT id, ... FROM email_providers WHERE is_fallback=true AND enabled=true LIMIT 1`
2. If found, attempt delivery via fallback provider immediately
3. If fallback succeeds, mark queue item as `sent`
4. If fallback also fails, proceed with normal retry/dead logic

**4. NOTIFY listener**

In `main.rs`, after spawning the queue worker:
```rust
let notify_state = state.clone();
tokio::spawn(async move {
    let mut listener = sqlx::postgres::PgListener::connect_with(&notify_state.db)
        .await
        .expect("NOTIFY listener connect failed");
    listener.listen("email_send").await.unwrap();
    loop {
        match listener.recv().await {
            Ok(notification) => {
                // Parse notification.payload() as SendRequest JSON
                // Insert into email_queue
            }
            Err(e) => tracing::error!(error = %e, "NOTIFY listener error"),
        }
    }
});
```

**5. Cleanup task**

In `main.rs`, spawn a third Tokio task:
```rust
tokio::spawn(async move {
    loop {
        tokio::time::sleep(Duration::from_secs(3600)).await; // run hourly
        let _ = sqlx::query(
            "DELETE FROM email_queue WHERE status IN ('sent','dead') AND created_at < now() - ($1 || ' days')::interval"
        )
        .bind(state.config.queue_retention_days.to_string())
        .execute(&state.db).await;
    }
});
```

Do NOT:
- Change status to `"dead"` for soft-bounce retries that still have attempts remaining; only use `"dead"` for exhausted items
- Allow deleting system templates even if the caller has `email:manage_templates` permission
