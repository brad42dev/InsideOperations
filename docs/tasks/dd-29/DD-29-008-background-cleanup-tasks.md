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

- [ ] A `tokio::spawn` background task in `main.rs` runs every 5 minutes and DELETEs expired rows from `oidc_state_store`.
- [ ] The same 5-minute task DELETEs expired rows from `saml_request_store`.
- [ ] The same 5-minute task DELETEs expired rows from `sms_mfa_codes` and `email_mfa_codes`.
- [ ] A separate `tokio::spawn` background task runs every 30 seconds and calls `sweep_expired()` (or equivalent) on the WebSocket ticket DashMap.
- [ ] `state.mfa_pending_tokens` is swept (retain entries where `expires_at > Utc::now()`).
- [ ] `state.duo_state_tokens` is swept (retain entries where `expires_at > Utc::now()`).
- [ ] All background tasks are started in `main.rs` after `AppState::new` and before `axum::serve`.

## Assessment

- **Status**: ❌ Missing (partially — EULA token sweep added, rest absent)
- **Current state**: `main.rs` has ONE `tokio::spawn` (lines 53–65) sweeping `eula_pending_tokens` every 5 minutes. Everything else is missing:
  - DB tables `oidc_state_store` and `saml_request_store` are never swept; they accumulate rows indefinitely.
  - `sms_mfa_codes` and `email_mfa_codes` are never swept.
  - `ws_ticket.rs:70–72` has `sweep_expired()` but it is only called lazily from `create_ws_ticket` (line 109), not from a background interval task.
  - `state.mfa_pending_tokens` DashMap (5-min TTL per entry) has no background sweep.
  - `state.duo_state_tokens` DashMap (10-min TTL per entry) has no background sweep.

## Fix Instructions

Add to `main.rs` after `let state = AppState::new(...)`, keeping the existing EULA sweep (lines 53–65) in place:

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

// Background: evict expired in-memory tokens every 30 seconds
{
    let mfa_tokens = state.mfa_pending_tokens.clone();
    let duo_tokens = state.duo_state_tokens.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let now = chrono::Utc::now();
            // ws_ticket DashMap — sweep_expired uses Instant-based TTL
            handlers::ws_ticket::sweep_expired();
            // MFA pending tokens (5-minute TTL)
            mfa_tokens.retain(|_, v| v.expires_at > now);
            // Duo state tokens (10-minute TTL)
            duo_tokens.retain(|_, v| v.expires_at > now);
        }
    });
}
```

Note: `handlers::ws_ticket::sweep_expired()` is currently private (`fn sweep_expired()`). Change it to `pub fn sweep_expired()` in `ws_ticket.rs` so it can be called from `main.rs`.

**Note on table names**: Verify the actual migration-applied table names for OIDC state (`oidc_state_store`) and SAML state (`saml_request_store`) match what the handlers use in their DELETE-on-read queries (saml.rs:199, oidc.rs:199).

Do NOT:
- Use `sleep` in a loop — use `tokio::time::interval`
- Panic if a cleanup query fails — log the error and continue the loop
- Make TICKETS public if it is currently private — check `ws_ticket.rs` visibility and adjust accordingly
