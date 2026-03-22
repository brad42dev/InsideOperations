---
id: DD-29-011
unit: DD-29
title: Add PIN set/delete/verify endpoints for lock screen unlock
status: pending
priority: high
depends-on: [DD-29-009]
source: feature
decision: docs/decisions/visual-lock-overhaul.md
---

## What to Build

Allow users to set an optional 6-digit numeric PIN as an alternative to password entry on the
lock screen. The PIN is stored hashed (Argon2) and is separate from the account password. PIN
failures share the same rate-limit counters as password failures (defined in DD-29-009).

### Routes

**Set or update PIN:**
```
POST /api/auth/pin
Authorization: Bearer <access_token>
Content-Type: application/json

{ "pin": "123456", "current_password": "..." }
```
- `pin` must be exactly 6 numeric digits. Return `422` with validation error if not.
- `current_password` is required to set or change a PIN (prevents PIN hijacking via a
  stolen session). Verify with Argon2 before proceeding.
- For SSO-only accounts (no local password): accept `current_password` as empty string and
  skip the password check — SSO users can set a PIN without having a local password.
- Hash `pin` with Argon2, store in `users.lock_pin_hash`.
- Return `200 OK` on success.

**Remove PIN:**
```
DELETE /api/auth/pin
Authorization: Bearer <access_token>
Content-Type: application/json

{ "current_password": "..." }
```
- Same `current_password` requirement as above.
- Sets `users.lock_pin_hash = NULL`.
- Return `200 OK`.

**Verify PIN (unlock flow):**
```
POST /api/auth/verify-pin
Authorization: Bearer <access_token>
Content-Type: application/json

{ "pin": "123456" }
```
- Identical behaviour to `verify-password` but checks `lock_pin_hash` instead of `password_hash`.
- Uses the **same rate-limit counters** as `verify-password` — soft and hard limits are shared
  across both endpoints. If the user has 4 password failures then 1 PIN failure they hit the
  soft limit on the next attempt regardless of which field they use.
- Returns `200 OK` + clears `locked_since` + resets counters on correct PIN.
- Returns `401` on wrong PIN with `{ "error": "invalid_pin", "soft_remaining": <N> }`.
- Returns `429` on soft limit exceeded, `401` with `error: "forced_signout"` on hard limit.
- Returns `404` if the user has no PIN set (`lock_pin_hash IS NULL`).

### Migration

```sql
ALTER TABLE users ADD COLUMN lock_pin_hash TEXT NULL;
```

### Session check response

The session check response (extended in DD-29-009 / DD-29-010) must also include:
```json
{ "has_pin": true }
```
The frontend uses `has_pin` to decide whether to show the PIN field or the password field on
the lock card. Do not send the hash itself.

## Acceptance Criteria

- [ ] `POST /api/auth/pin` sets `lock_pin_hash` after verifying current password; rejects non-6-digit input
- [ ] `DELETE /api/auth/pin` clears `lock_pin_hash` after verifying current password
- [ ] `POST /api/auth/verify-pin` returns 200 + clears locked_since on correct PIN
- [ ] `POST /api/auth/verify-pin` returns 404 when no PIN is set
- [ ] PIN failures increment the same counters as password failures
- [ ] Soft and hard rate limits apply to verify-pin identically to verify-password
- [ ] Session check response includes `has_pin: bool`
- [ ] SSO-only accounts can set a PIN without providing a local password

## Verification Checklist

- [ ] Migration adds `lock_pin_hash TEXT NULL` to users table
- [ ] Unit test: set PIN → verify PIN → 200
- [ ] Unit test: wrong PIN × 5 within 5 min → 429 (shared with password failures)
- [ ] Unit test: verify-pin with no PIN set → 404
- [ ] Unit test: SSO account can set PIN with empty current_password
- [ ] Session check includes `has_pin`

## Do NOT

- Store the PIN in plaintext or with a weaker hash than Argon2
- Use a separate rate-limit counter from the password failures
- Allow PINs shorter than 6 digits or containing non-numeric characters
- Require the user to enter their current PIN to change a PIN (current_password is the gate)

## Dev Notes

Decision file: `docs/decisions/visual-lock-overhaul.md`

Auth-service: add handlers in `services/auth-service/src/handlers/auth.rs` (or a new
`pin.rs` handler module if preferred). Register routes in `src/main.rs`.

Argon2 is already used for password hashing in this service — use the same hasher config for
PINs. Do not use a lighter hash just because PINs are short; Argon2 is still correct here.

The `has_pin` field must be included in the session check response alongside `is_locked` and
`auth_provider` introduced in DD-29-009/010. Coordinate with those tasks to avoid conflicting
response schema changes.

Admin path: admins setting a PIN on a kiosk account should use the same `POST /api/auth/pin`
endpoint with the kiosk account's JWT (or an admin-impersonation path if one exists). No
separate admin PIN endpoint is needed.
