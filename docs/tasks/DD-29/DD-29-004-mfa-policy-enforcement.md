---
id: DD-29-004
title: Implement MFA policy enforcement gate in all login flows
unit: DD-29
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

After primary authentication succeeds (local, LDAP, OIDC, SAML), the auth service must check whether the user's role requires MFA. If MFA is required and the user has an active enrollment, the login must halt and return an `mfa_required` response with a short-lived `mfa_token`. The user must then submit their MFA code to `/api/auth/mfa/verify` to receive final JWT tokens. Without this gate, MFA enrollment is purely cosmetic — users can log in without ever being challenged.

## Spec Excerpt (verbatim)

> 2. I/O checks if user has active MFA enrollment AND if their role's MFA policy requires it
> 3. If MFA required: return `200` with `{ mfa_required: true, mfa_token: "...", allowed_methods: ["totp", "duo"] }`
> 4. `mfa_token` is a short-lived token (5 minutes) that proves primary auth succeeded
> 5. Frontend shows MFA prompt appropriate to allowed methods
> 6. User provides MFA code/response
> 7. Frontend calls `POST /api/auth/mfa/verify` with `mfa_token` + response
> — design-docs/29_AUTHENTICATION.md, §MFA Login Flow

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/auth.rs` — `login` function: no MFA check between password verification (line 123) and JWT issuance (line 173)
- `services/auth-service/src/handlers/ldap_auth.rs` — `ldap_login_inner`: no MFA check between user provisioning (line 297) and JWT issuance (line 304)
- `services/auth-service/src/handlers/mfa.rs` — `mfa_challenge` handler exists (line 340) but is not called from any login path; it uses `user_id` directly without any `mfa_token` validation
- `services/auth-service/src/state.rs` — AppState needs `mfa_pending_tokens: Arc<DashMap<String, MfaPendingEntry>>`

## Verification Checklist

- [ ] Local login for a user with `mfa_enabled = true` and an active MFA policy returns `{"mfa_required": true, "mfa_token": "...", "allowed_methods": [...]}` without issuing JWT tokens or refresh cookie.
- [ ] `mfa_token` is stored in an in-memory DashMap with 5-minute TTL.
- [ ] `POST /api/auth/mfa/verify` with `mfa_token` + valid TOTP code issues JWT access + refresh tokens and removes the pending token.
- [ ] `POST /api/auth/mfa/verify` with an expired or already-used `mfa_token` returns 401.
- [ ] Users whose role has `mfa_required = false` in `mfa_policies` (or no policy entry) log in without MFA challenge.
- [ ] `is_service_account = true` users bypass MFA entirely (they use API keys).
- [ ] LDAP login also applies the MFA gate after user provisioning.

## Assessment

- **Status**: ❌ Missing
- **Current state**: The `mfa_policies` table exists in the schema but is never queried anywhere in the auth-service codebase. `mfa_challenge` (mfa.rs:340) is a standalone handler that accepts a raw `user_id` — it is not integrated into the login flow. Local login in `auth.rs` checks nothing between password verification and JWT issuance. The MFA enrollment system (enroll, verify_enrollment, status) is fully implemented, but the challenge is never triggered.

## Fix Instructions

**Step 1 — Add DashMap to AppState** (`state.rs`):
```rust
pub mfa_pending_tokens: Arc<DashMap<String, MfaPendingEntry>>,

pub struct MfaPendingEntry {
    pub user_id: Uuid,
    pub allowed_methods: Vec<String>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}
```

**Step 2 — Add MFA gate helper function** (add to `auth.rs` or a new `mfa_gate.rs`):
```rust
// Returns Some(mfa_token + allowed_methods) if MFA is required, None if not
async fn check_mfa_required(db: &DbPool, user_id: Uuid) -> IoResult<Option<(String, Vec<String>)>> {
    // 1. Check if user has active MFA enrollment
    let mfa_row = sqlx::query(
        "SELECT mfa_type FROM user_mfa WHERE user_id = $1 AND status = 'active' LIMIT 1"
    ).bind(user_id).fetch_optional(db).await?;

    if mfa_row.is_none() {
        return Ok(None); // No MFA enrolled — no challenge
    }

    // 2. Check mfa_policies for user's role
    let policy_row = sqlx::query(
        "SELECT mp.mfa_required, mp.allowed_methods
         FROM mfa_policies mp
         JOIN user_roles ur ON ur.role_id = mp.role_id
         WHERE ur.user_id = $1 AND mp.mfa_required = true
         LIMIT 1"
    ).bind(user_id).fetch_optional(db).await?;

    match policy_row {
        Some(row) => {
            let allowed: Vec<String> = row.get("allowed_methods");
            Ok(Some((Uuid::new_v4().to_string(), allowed)))
        }
        None => Ok(None),
    }
}
```

**Step 3 — Insert gate into `login`** (auth.rs): Between password verification success (after line 167, before line 170) and JWT issuance:
```rust
if let Some((mfa_token, allowed_methods)) = check_mfa_required(&state.db, user_id).await? {
    state.mfa_pending_tokens.insert(mfa_token.clone(), MfaPendingEntry {
        user_id,
        allowed_methods: allowed_methods.clone(),
        expires_at: Utc::now() + chrono::Duration::minutes(5),
    });
    return Ok((StatusCode::OK, Json(ApiResponse::ok(serde_json::json!({
        "mfa_required": true,
        "mfa_token": mfa_token,
        "allowed_methods": allowed_methods,
    })))).into_response());
}
```

**Step 4 — Replace `mfa_challenge`**: The existing `mfa_challenge` handler accepts raw `user_id` — replace it with a handler that validates `mfa_token` from the DashMap, verifies TOTP against the stored secret, marks the token used, then calls `issue_jwt_for_user`. Same pattern for SMS and email MFA verify endpoints.

**Step 5 — Apply to LDAP login**: Same gate in `ldap_login_inner` after user provisioning (line 297).

**Step 6 — Skip for OIDC/SAML**: Per spec, SSO users (OIDC/SAML) do not get I/O MFA applied. No gate needed in `oidc_callback_inner` or `saml_acs` unless the admin has enabled "Require I/O MFA for SSO users" (a future setting).

Do NOT:
- Apply MFA gate to `is_service_account = true` users
- Issue JWT tokens before the MFA challenge is verified
- Delete the `mfa_pending_tokens` entry until after successful verification
