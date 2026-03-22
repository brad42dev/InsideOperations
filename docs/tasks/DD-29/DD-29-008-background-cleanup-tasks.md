---
id: DD-29-008
title: Add background cleanup tasks for expired auth flow state and in-memory tokens
unit: DD-29
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The auth service maintains several types of short-lived state that must be cleaned up periodically to prevent unbounded table growth and memory accumulation: OIDC state store rows, SAML request store rows, WebSocket tickets in the DashMap, and (once DD-29-001 and DD-29-004 are done) EULA pending tokens and MFA pending tokens. Background Tokio tasks should sweep expired entries on a fixed schedule.

## Spec Excerpt (verbatim)

> ### Auth Flow State Cleanup
> The `auth_flow_state` table stores transient OIDC/SAML state records with a 5-minute TTL. A background task in the Auth Service runs every 5 minutes:
> ```sql
> DELETE FROM auth_flow_state WHERE expires_at < NOW();
> ```
>
> ### WebSocket Ticket Eviction
> WebSocket tickets are stored in an in-memory `DashMap` with 30-second TTL. A Tokio background task sweeps expired entries every 30 seconds.
>
> ### MFA Code Cleanup
> SMS and Email MFA codes are stored hashed with a 5-minute TTL. Expired codes are cleaned up by the same background task that cleans auth flow state.
> — design-docs/29_AUTHENTICATION.md, §Background Maintenance Tasks

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/main.rs` — no `tokio::spawn` calls present; background tasks go here after `AppState::new`
- `services/auth-service/src/handlers/ws_ticket.rs` — WebSocket ticket cleanup comment at line 31 (`Lazy<DashMap>`); no background task sweeping it currently
- Database tables needing cleanup: `oidc_state_store`, `saml_request_store`

## Verification Checklist

- [ ] A background task runs every 5 minutes and deletes expired rows from `oidc_state_store`.
- [ ] The same or a separate background task deletes expired rows from `saml_request_store`.
- [ ] A background task runs every 30 seconds and removes expired entries from the WebSocket ticket DashMap.
- [ ] SMS MFA codes expired for more than 5 minutes are deleted (check `sms_mfa_codes` table).
- [ ] Email MFA codes expired for more than 5 minutes are deleted (check `email_mfa_codes` or equivalent table).
- [ ] Background tasks are started in `main.rs` after state construction and before serving requests.

## Assessment

- **Status**: ❌ Missing
- **Current state**: `main.rs` has no `tokio::spawn` calls. The `ws_ticket.rs` uses a `Lazy<DashMap>` static (line 31) but no background sweep task is spawned in `main.rs`. Auth flow tables (`oidc_state_store`, `saml_request_store`) accumulate rows indefinitely if the cleanup task is not running.

## Fix Instructions

Add to `main.rs` after `let state = AppState::new(...)`:

```rust
// Background: clean up expired OIDC state, SAML requests, MFA codes every 5 minutes
{
    let db = state.db.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            let _ = sqlx::query("DELETE FROM oidc_state_store WHERE expires_at < NOW()")
                .execute(&db).await;
            let _ = sqlx::query("DELETE FROM saml_request_store WHERE expires_at < NOW()")
                .execute(&db).await;
            let _ = sqlx::query("DELETE FROM sms_mfa_codes WHERE expires_at < NOW()")
                .execute(&db).await;
            let _ = sqlx::query("DELETE FROM email_mfa_codes WHERE expires_at < NOW()")
                .execute(&db).await;
        }
    });
}

// Background: evict expired WebSocket tickets from DashMap every 30 seconds
{
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let now = chrono::Utc::now();
            handlers::ws_ticket::TICKETS.retain(|_, v| v.expires_at > now);
        }
    });
}
```

Once DD-29-001 and DD-29-004 are implemented, add sweeps for `eula_pending_tokens` and `mfa_pending_tokens` DashMaps in the 30-second task.

**Note on table names**: Verify the actual migration-applied table names for OIDC state (`oidc_state_store`) and SAML state (`saml_request_store`) match what the handlers use in their DELETE-on-read queries (saml.rs:199, oidc.rs:199).

Do NOT:
- Use `sleep` in a loop — use `tokio::time::interval`
- Panic if a cleanup query fails — log the error and continue the loop
- Make TICKETS public if it is currently private — check `ws_ticket.rs` visibility and adjust accordingly
