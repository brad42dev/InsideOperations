---
id: DD-29-018
title: Implement LDAP hourly background group-membership sync
unit: DD-29
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When LDAP authentication is enabled, I/O must periodically re-sync each LDAP user's group memberships (and therefore their role assignments) in the background — not only at login time. The spec requires an hourly sync (configurable between 30 min and 24 hr). If the LDAP query fails, existing role assignments are preserved unchanged (errors treated as "no change", never as "empty result").

## Spec Excerpt (verbatim)

> **LDAP background sync:** In addition to on-login sync, a background task syncs LDAP group memberships every 1 hour (configurable, 30min–24hr). On LDAP query failure, existing role assignments are preserved (errors treated as "no change", never as "empty result").
> — design-docs/29_AUTHENTICATION.md, §LDAP

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/main.rs` — background tasks are spawned here after `AppState::new`; no LDAP sync task exists
- `services/auth-service/src/handlers/ldap_auth.rs` — on-login LDAP auth logic; the group lookup code to reuse lives here (`ldap_login_inner`)
- `services/auth-service/src/config.rs` — add `ldap_sync_interval_secs` config field (default 3600)
- Database tables: `auth_provider_configs` (find enabled LDAP providers), `user_roles` (update role assignments)

## Verification Checklist

- [ ] A `tokio::spawn` background task is present in `main.rs` after state construction.
- [ ] The task runs on a configurable interval (default 3600 s, read from env or config).
- [ ] The task iterates all enabled LDAP provider configs and re-syncs group memberships for users whose `role_source = 'idp'` under that provider.
- [ ] On LDAP connection or query failure, the task logs an error and continues — it does NOT clear or modify existing role assignments.
- [ ] The sync uses the same group-to-role mapping logic as the on-login flow (`apply_group_role_mappings` in `oidc.rs` or equivalent).

## Assessment

- **Status**: ❌ Missing
- **Current state**: `main.rs` has one `tokio::spawn` (EULA token sweep, line 53–65). No LDAP background sync task. `ldap_auth.rs` only syncs on login. Users whose LDAP group memberships change will not see updated permissions until their next login.

## Fix Instructions

**Step 1 — Add config field** (`services/auth-service/src/config.rs`):
```rust
pub ldap_sync_interval_secs: u64,  // default 3600
```
Read from env var `AUTH_LDAP_SYNC_INTERVAL_SEC` with fallback to `3600`.

**Step 2 — Extract group sync logic** from `ldap_auth.rs` into a pub function:
```rust
pub async fn sync_ldap_user_groups(
    db: &io_db::DbPool,
    ldap_url: &str,
    bind_dn: &str,
    bind_password: &str,
    base_dn: &str,
    provider_config_id: Uuid,
    user_id: Uuid,
    username: &str,
) -> Result<(), IoError>
```
This should connect as the service account, search for `(sAMAccountName={username})`, extract group DNs, and call `apply_group_role_mappings` (already in `oidc.rs:644`). Refactor on-login code to call this function.

**Step 3 — Spawn background task** in `main.rs` after `let state = AppState::new(...)`:
```rust
{
    let db = state.db.clone();
    let interval_secs = cfg.ldap_sync_interval_secs;
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(
            std::time::Duration::from_secs(interval_secs)
        );
        interval.tick().await; // skip immediate first tick — let startup finish
        loop {
            interval.tick().await;
            // fetch all enabled LDAP providers
            let providers = sqlx::query!(
                "SELECT id, server_url, bind_dn, bind_password_enc, base_dn
                 FROM auth_provider_configs
                 WHERE provider_type = 'ldap' AND is_enabled = true"
            )
            .fetch_all(&db)
            .await;
            let providers = match providers {
                Ok(p) => p,
                Err(e) => {
                    tracing::error!(error = %e, "LDAP sync: failed to fetch providers");
                    continue;
                }
            };
            // for each provider, fetch users with role_source = 'idp' and re-sync
            for provider in &providers {
                // query users linked to this provider ...
                // call sync_ldap_user_groups for each, log errors, preserve existing on failure
            }
            tracing::debug!("LDAP background sync complete");
        }
    });
}
```

Do NOT:
- Clear existing `user_roles` rows before confirming LDAP returned data — on query failure, preserve what's there.
- Panic if any individual user sync fails — log and continue to the next user.
- Use a `sleep` loop — use `tokio::time::interval`.
- Run the sync at startup time (tick first, then loop) — avoid hammering LDAP on service restart.
