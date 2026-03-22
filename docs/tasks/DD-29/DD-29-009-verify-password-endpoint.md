---
id: DD-29-009
unit: DD-29
title: Add POST /api/auth/verify-password endpoint with two-tier rate limiting
status: pending
priority: high
depends-on: []
source: feature
decision: docs/decisions/visual-lock-overhaul.md
---

## What to Build

Add a dedicated `POST /api/auth/verify-password` handler in auth-service. This endpoint is used
exclusively by the lock screen unlock flow to re-verify a local account user's password without
issuing new tokens.

### Route

```
POST /api/auth/verify-password
Authorization: Bearer <access_token>
Content-Type: application/json

{ "password": "..." }
```

### Behaviour

1. Extract `user_id` from the JWT in the Authorization header. Return `401` if token is invalid
   or expired.
2. Fetch the user record. If the user has no local password (`password_hash IS NULL`) — they are
   an SSO-only account — return `400 Bad Request` with `{ "error": "no_local_password" }`.
3. Verify the submitted password against `password_hash` using Argon2.
4. **Before accepting or rejecting**: check rate limit counters for this `(user_id, ip_address)`:
   - **Soft limit**: 5 failures within a 5-minute rolling window → return `429 Too Many Requests`
     with `{ "error": "rate_limited", "retry_after_seconds": <N> }` without checking the password
   - **Hard limit**: 20 failures since `last_successful_unlock_at` (or since `created_at` if never
     unlocked) → return `401` with `{ "error": "forced_signout" }`. Frontend must sign the user out.
5. On wrong password: increment failure counters, return `401 Unauthorized` with
   `{ "error": "invalid_password", "soft_remaining": <N> }`.
6. On correct password:
   - Reset failure counters for this `(user_id, ip_address)`
   - Update `last_successful_unlock_at` on the session row
   - Clear `locked_since` on the session row (unlock the session)
   - Return `200 OK` with `{ "success": true }`
   - **Do NOT rotate or issue new tokens**

### Rate Limit Storage

Store counters in the `active_sessions` table (add columns) or a new `unlock_attempts` table.
Counters needed per `(user_id, ip_address)`:
- `unlock_fail_count_soft` — count within current 5-minute window
- `unlock_fail_window_start` — start of the current soft window
- `unlock_fail_count_hard` — count since last successful unlock
- `last_successful_unlock_at` — timestamp of last successful unlock

These same counters are shared with `verify-pin` (DD-29-011).

### Migration

Add columns to `active_sessions` (or create `unlock_attempts` table):
```sql
ALTER TABLE active_sessions
  ADD COLUMN locked_since TIMESTAMPTZ NULL,
  ADD COLUMN last_successful_unlock_at TIMESTAMPTZ NULL,
  ADD COLUMN unlock_fail_count_soft SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN unlock_fail_window_start TIMESTAMPTZ NULL,
  ADD COLUMN unlock_fail_count_hard SMALLINT NOT NULL DEFAULT 0;
```

Note: `locked_since` is also required by DD-29-010 — coordinate migration authorship to avoid
duplication. These columns can live in a single migration file.

### Session Check Response

The existing "get current session / verify token" response must be extended to include:
```json
{ "is_locked": true, "auth_provider": "local" | "oidc" | "saml" | "ldap" }
```
`auth_provider` tells the frontend which unlock UI to render. `is_locked` is `true` when
`locked_since IS NOT NULL`.

## Acceptance Criteria

- [ ] `POST /api/auth/verify-password` exists and is reachable (proxied through API gateway if gateway proxies auth)
- [ ] Returns `400` for SSO-only accounts with `error: "no_local_password"`
- [ ] Returns `200` + clears `locked_since` + resets counters on correct password
- [ ] Returns `401` on wrong password; increments both soft and hard counters
- [ ] Returns `429` when soft limit (5 in 5 min) is exceeded; includes `retry_after_seconds`
- [ ] Returns `401` with `error: "forced_signout"` when hard limit (20 since last unlock) is exceeded
- [ ] Successful unlock resets hard counter and updates `last_successful_unlock_at`
- [ ] Does not issue new tokens on success
- [ ] Session check response includes `is_locked` and `auth_provider` fields

## Verification Checklist

- [ ] Unit test: correct password → 200, locked_since cleared
- [ ] Unit test: wrong password × 5 within 5 min → 429 on 6th attempt
- [ ] Unit test: wrong password × 20 (across windows) → forced_signout
- [ ] Unit test: SSO account → 400 no_local_password
- [ ] Integration test: soft limit resets after 5-minute window
- [ ] Migration file exists and applies cleanly

## Do NOT

- Issue new access or refresh tokens on success
- Write to `users.locked_until` (that's the login lockout, not the unlock rate limit)
- Share counters across different IPs for the same user (counters are per user_id + ip)
- Skip the rate limit check when the JWT is from an admin account

## Dev Notes

Decision file: `docs/decisions/visual-lock-overhaul.md`

Auth-service lives at `services/auth-service/`. Key files:
- `src/handlers/auth.rs` — add the new handler here
- `src/main.rs` — register the route
- `src/state.rs` — AppState holds DB pool; use it for counter reads/writes

The endpoint must be proxied by the API gateway. Check `services/api-gateway/src/handlers/mod.rs`
for how auth routes are forwarded.

The `locked_since` column is also written by the lock endpoint in DD-29-010. Write the migration
once and reference it from both tasks if implementing sequentially, or combine into one migration.
