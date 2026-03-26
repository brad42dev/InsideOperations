---
id: DD-29-005
title: Implement Duo Security MFA (Universal Prompt via OIDC Auth API)
unit: DD-29
status: pending
priority: medium
depends-on: [DD-29-004]
---

## What This Feature Should Do

Duo Security is a P1 MFA method. When a user's MFA policy allows Duo and they select it, the auth service must redirect the user to Duo's Universal Prompt. After Duo verifies the user (push, TOTP, phone call), it redirects back to I/O with an authorization code that the auth service exchanges for a Duo ID token to complete the MFA step.

## Spec Excerpt (verbatim)

> **Priority**: P1 — many enterprises already have Duo.
>
> **Integration**: Duo Web SDK v4 / Universal Prompt via OIDC Auth API. No Rust SDK — direct HTTP calls with `reqwest`.
>
> **Flow**:
> 1. Primary auth succeeds, MFA required, Duo selected
> 2. I/O generates JWT signed with Duo client secret containing user info
> 3. Redirect to `https://api-{host}.duosecurity.com/oauth/v1/authorize`
> 4. Duo displays Universal Prompt (hosted by Duo)
> 5. User completes Duo challenge
> 6. Duo redirects to I/O callback with authorization code
> 7. I/O exchanges code for Duo ID token at Duo token endpoint
> 8. I/O validates Duo response, completes login
> — design-docs/29_AUTHENTICATION.md, §2. Duo Security

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/` — no `duo.rs` file exists; needs to be created
- `services/auth-service/src/main.rs` — lines 161-166: MFA routes; Duo routes not registered
- `services/auth-service/src/state.rs` — AppState needs Duo configuration and DashMap for Duo state tokens

## Verification Checklist

- [ ] `GET /api/auth/mfa/duo/:config_id/login` handler exists and returns a Duo authorization redirect URL.
- [ ] Duo state token (CSRF protection) is stored server-side before redirecting.
- [ ] `GET /api/auth/mfa/duo/callback` handler exists, validates state, exchanges code for Duo ID token.
- [ ] Duo ID token is validated (Duo-specific validation — not standard OIDC, no JWKS/UserInfo).
- [ ] On successful Duo validation, the user's MFA pending token is consumed and JWT issued.
- [ ] Duo health check is called before redirecting; if Duo is unreachable, fall back per policy.
- [ ] Duo provider configuration is stored in a new table or in `auth_provider_configs` with `provider_type = 'duo'`.

## Assessment

- **Status**: ❌ Missing
- **No Duo-related code exists** anywhere in the auth-service codebase. No handler, no route, no configuration model.

## Fix Instructions

**Step 1 — Configuration**: Store Duo config in `auth_provider_configs` with `provider_type = 'duo'`, config JSONB fields: `api_hostname`, `client_id`, `client_secret`, `redirect_uri`.

**Step 2 — Create `handlers/duo.rs`**:

Health check endpoint (call before redirecting):
```
GET https://api-{hostname}.duosecurity.com/oauth/v1/health_check
Authorization: Basic base64(client_id:client_secret)
```

Login initiation (`GET /auth/mfa/duo/:config_id/login`):
1. Generate `state` token (32 random bytes, hex) and `nonce`
2. Store in DashMap: `{state: state_token, mfa_pending_token: ..., expires_at: +10min}`
3. Build authorization URL:
   ```
   https://api-{hostname}.duosecurity.com/oauth/v1/authorize
     ?response_type=code
     &client_id={duo_client_id}
     &redirect_uri={redirect_uri}
     &scope=openid
     &state={state_token}
     &nonce={nonce}
     &duo_uname={username}
   ```
4. Return redirect URL to frontend

Callback (`GET /auth/mfa/duo/callback`):
1. Validate `state` from query param against DashMap
2. Exchange `code` for tokens at `POST https://api-{hostname}.duosecurity.com/oauth/v1/token`
   - Use Basic auth with `client_id:client_secret`
   - Form body: `grant_type=authorization_code&code=...&redirect_uri=...`
3. Validate returned ID token:
   - Verify signature using Duo's JWKS: `GET https://api-{hostname}.duosecurity.com/.well-known/keys`
   - Validate `iss = api-{hostname}.duosecurity.com`, `aud = client_id`, `nonce`, `exp`
   - Check `preferred_username` matches expected user
4. Consume the MFA pending token, issue final JWT

**Step 3 — Register routes** in `main.rs`:
```rust
.route("/auth/mfa/duo/:config_id/login", get(handlers::duo::duo_login))
.route("/auth/mfa/duo/callback", get(handlers::duo::duo_callback))
```

**Note**: Duo's OIDC implementation is non-standard — no Discovery endpoint, no UserInfo. Handle these deviations explicitly as noted in the spec.

Do NOT:
- Use a Duo-specific SDK or native binary
- Use `openidconnect` crate's standard discovery for Duo (it won't work)
- Skip the Duo health check before redirecting
