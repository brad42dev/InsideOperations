---
id: DD-37-006
title: Implement API key (io_sk_ prefix) auth path in gateway JWT middleware
unit: DD-37
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The API Gateway auth middleware must support three types of Bearer tokens: user JWTs,
the inter-service secret, and API keys (for programmatic access). API keys are prefixed
with `io_sk_` and are stored in the database. Currently the middleware handles only JWT
and service secret — the `io_sk_` branch is entirely absent, meaning all API key auth
attempts are rejected with 401.

## Spec Excerpt (verbatim)

> The `io-auth` crate inspects the token format to determine the validation path:
> - Starts with `eyJ` (base64 JSON) → JWT decode and validate
> - Matches `IO_SERVICE_SECRET` → constant-time comparison, grant full service-level access
> - Starts with `io_sk_` → API key lookup in database
> - Anything else → 401
> — 37_IPC_CONTRACTS.md, §3 Authentication Headers

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/mw.rs:27-101` — `jwt_auth` middleware; service-secret check at line 51, JWT decode at line 66; no `io_sk_` branch
- `migrations/` — check if `api_keys` table exists (likely added in doc 04 schema)
- `services/auth-service/src/handlers/api_keys.rs` — API key CRUD handlers (referenced in git status)

## Verification Checklist

- [ ] After extracting the Bearer token, the middleware checks `if token.starts_with("io_sk_")`
- [ ] The `io_sk_` branch performs a database lookup: `SELECT user_id, permissions, active FROM api_keys WHERE key_hash = hash(token) AND active = true`
- [ ] A valid API key produces a synthetic `Claims` struct with the key owner's user_id and permissions
- [ ] An expired or deactivated API key returns 401
- [ ] The `io_sk_` check occurs BEFORE the JWT decode attempt (starts_with `eyJ` is not a reliable guard for the inverse; both paths should be explicit)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `services/api-gateway/src/mw.rs:45-101` — no `io_sk_` prefix check anywhere. The code goes straight from service-secret check to JWT decode.

## Fix Instructions (if needed)

In `services/api-gateway/src/mw.rs`, modify the `jwt_auth` function body after the
service-secret check (after line 64):

```rust
// API key path: tokens prefixed with io_sk_
if token.starts_with("io_sk_") {
    return handle_api_key_auth(token, &state, req, next).await;
}
```

Then add an `async fn handle_api_key_auth(...)` function (or inline the logic):

1. Hash the incoming token (SHA-256 is typical; check how `api_keys` table stores the hash in migrations)
2. Query: `SELECT user_id, permissions, expires_at, active FROM api_keys WHERE key_hash = $1 AND active = true AND (expires_at IS NULL OR expires_at > NOW())`
3. If no row found or `active = false` → return `unauthorized("Invalid or expired API key")`
4. Build synthetic `Claims`:
   ```rust
   let api_claims = Claims {
       sub: row.user_id.to_string(),
       username: "api_key".to_string(),  // or look up from users table
       permissions: row.permissions,      // stored as text[] in api_keys
       exp: i64::MAX,  // expiry enforced by DB query above
       iat: Utc::now().timestamp(),
   };
   req.extensions_mut().insert(api_claims);
   next.run(req).await
   ```

Check `migrations/` for the exact `api_keys` table DDL to get the right column names and
hash function used. The `services/auth-service/src/handlers/api_keys.rs` handler shows
how keys are created and can reveal the hash approach.

Do NOT:
- Log the raw API key value anywhere (it's a credential)
- Skip hashing — never compare raw token to stored value
- Reorder checks: service-secret must remain first, then `io_sk_`, then JWT decode
