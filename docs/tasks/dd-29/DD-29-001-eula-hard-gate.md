---
id: DD-29-001
title: Implement EULA hard gate — block JWT issuance until acceptance
unit: DD-29
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

After a user successfully completes primary authentication (password verified, account not locked), the auth service must check whether they have accepted the current active EULA version. If they have not, no JWT tokens may be issued. Instead the service returns a `eula_required` response containing a short-lived `eula_pending_token`. The user must POST that token to `/api/auth/eula/accept` to record acceptance, after which the service issues the real JWT access and refresh tokens.

## Spec Excerpt (verbatim)

> After successful authentication (including MFA) but before issuing JWT tokens, the Auth Service checks whether the user has accepted the current EULA version. This is a hard gate — no tokens are issued until acceptance is recorded.
>
> Backend response when EULA acceptance is needed:
> ```json
> {
>   "status": "eula_required",
>   "eula_pending_token": "<short-lived-opaque-token>",
>   "eula": { "version": "1.0", "title": "End User License Agreement", "content_url": "/api/auth/eula/current" }
> }
> ```
>
> The `eula_pending_token` is a short-lived token (5 minutes, single-use) stored in an in-memory `DashMap` (same pattern as WebSocket tickets). It proves the user passed authentication but cannot access any API endpoint except `POST /api/auth/eula/accept`.
>
> Bypasses: Service accounts and API keys do not require EULA acceptance. Emergency accounts bypass the EULA check.
> — design-docs/29_AUTHENTICATION.md, §EULA Acceptance Gate

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/auth.rs` — login handler; currently checks EULA at line 237 but issues tokens anyway (line 253)
- `services/auth-service/src/handlers/eula.rs` — EULA accept handler; currently requires a JWT to accept (uses `x-io-user-id` header injected by API Gateway), which is the wrong approach when no token has been issued yet
- `services/auth-service/src/handlers/ws_ticket.rs` — shows the DashMap pattern used for WebSocket tickets; replicate this for eula_pending_tokens
- `services/auth-service/src/state.rs` — AppState; add a `eula_pending_tokens: DashMap<String, EulaPendingEntry>` field here
- `services/auth-service/src/main.rs` — register the `/auth/eula/accept` route without JWT middleware (it is gated by pending token, not JWT)

## Verification Checklist

- [ ] Local login with a user who has NOT accepted the EULA returns HTTP 200 with body `{"status": "eula_required", "eula_pending_token": "...", "eula": {...}}` and does NOT set a `refresh_token` cookie.
- [ ] Local login with a user who HAS accepted the current EULA issues JWT access token + refresh cookie as normal.
- [ ] `eula_pending_token` is stored in an in-memory DashMap with a 5-minute TTL, not in the database.
- [ ] `POST /api/auth/eula/accept` with a valid `eula_pending_token` records the acceptance and returns JWT access + refresh tokens (completing the login).
- [ ] `POST /api/auth/eula/accept` with an expired or already-used token returns 401.
- [ ] Users with `is_service_account = true` or `is_emergency_account = true` are exempt from the EULA check.
- [ ] OIDC and SAML callback flows also check EULA before issuing final tokens (or return the `eula_required` response via the OIDC callback redirect mechanism).

## Assessment

- **Status**: ❌ Missing
- **Current state**: `auth.rs` lines 237-258 query EULA acceptance and compute `eula_accepted: bool`, then include it in the login response body (`LoginResponse.user.eula_accepted`). Tokens are always issued. The `eula_pending_token` DashMap does not exist. The eula.rs `accept_eula` handler requires a JWT (`x-io-user-id` header), making it impossible to call without tokens.

## Fix Instructions

**Step 1 — Add DashMap to AppState** (`state.rs`):
```rust
pub struct AppState {
    pub db: io_db::DbPool,
    pub config: config::Config,
    pub http: reqwest::Client,
    pub eula_pending_tokens: Arc<DashMap<String, EulaPendingEntry>>,
}

pub struct EulaPendingEntry {
    pub user_id: Uuid,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub used: bool,
}
```

**Step 2 — Modify `login` in `auth.rs`**: After password verification succeeds and before building `LoginResponse`, check EULA. If not accepted:
1. Generate a random 32-byte hex token
2. Insert into `state.eula_pending_tokens` with `expires_at = now() + 5 minutes`
3. Return `StatusCode::OK` with body `{"status": "eula_required", "eula_pending_token": "...", "eula": {"version": "...", "title": "...", "content_url": "/api/auth/eula/current"}}`
4. Do NOT set any cookie, do NOT issue any JWT

Skip the EULA check for users where `is_service_account = true` or `is_emergency_account = true`.

**Step 3 — Add a new accept endpoint** that validates the pending token instead of requiring JWT:
- Route: `POST /auth/eula/accept-pending`
- Does NOT require `x-io-user-id` header
- Reads `eula_pending_token` from JSON body
- Looks up token in DashMap, verifies not expired, marks used
- Records acceptance in `eula_acceptances` (same logic as current `accept_eula`)
- Issues JWT access + refresh tokens (same logic as the tail of `login`)

**Step 4 — Add background cleanup**: Every 5 minutes, sweep expired entries from `eula_pending_tokens` DashMap (same tokio::spawn pattern as WS ticket cleanup — add this to main.rs).

**Step 5 — OIDC/SAML/LDAP flows**: After provisioning the user and before `issue_saml_jwt` / final JWT issuance in `oidc_callback_inner`, add the same EULA check. For OIDC/SAML the redirect-based flow complicates things; redirect to a frontend page (`/eula-required?pending_token=...`) rather than JSON.

Do NOT:
- Accept the EULA automatically on behalf of the user
- Issue any JWT before recording a `eula_acceptances` row
- Store the pending token in the database (use DashMap, same as ws_ticket)
- Remove the existing `/auth/eula/accept` endpoint (keep it for post-login re-acceptance scenarios)
