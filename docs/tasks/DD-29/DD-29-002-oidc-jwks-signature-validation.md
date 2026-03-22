---
id: DD-29-002
title: Validate OIDC ID token signature against JWKS endpoint
unit: DD-29
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

After exchanging the authorization code for tokens at the OIDC token endpoint, the auth service receives an `id_token` (a signed JWT). Before trusting any claims from this token, the service must validate the token's signature using the IdP's public keys fetched from the JWKS endpoint advertised in the IdP's discovery metadata. Without this validation, a malicious actor could forge an `id_token` with arbitrary claims and gain unauthorized access.

## Spec Excerpt (verbatim)

> 8. I/O validates `id_token`: signature via JWKS, issuer, audience, nonce, expiry
> — design-docs/29_AUTHENTICATION.md, §2. OIDC

> **Crate**: `openidconnect` v4 (MIT/Apache-2.0) — built on `oauth2` crate already in the stack.
> — design-docs/29_AUTHENTICATION.md, §2. OIDC

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/oidc.rs` — `oidc_callback_inner` function; lines 296-305 contain a comment "In production, full JWT verification against JWKS is required" followed by `decode_jwt_payload` which only base64-decodes the payload with no signature check
- `services/auth-service/Cargo.toml` — check if `openidconnect` crate is already a dependency

## Verification Checklist

- [ ] `Cargo.toml` for auth-service includes `openidconnect = "4"` (or later) dependency.
- [ ] The JWKS URI is fetched from OIDC discovery metadata (`jwks_uri` field).
- [ ] The `id_token` signature is verified against the public keys from the JWKS endpoint.
- [ ] Issuer (`iss`) claim is validated against the configured `issuer_url`.
- [ ] Audience (`aud`) claim is validated against the configured `client_id`.
- [ ] Nonce claim is still validated against the stored nonce (this is already done at oidc.rs:301-305 but should be part of the full OIDC verification pipeline).
- [ ] Token expiry (`exp`) is validated.
- [ ] A forged `id_token` with an invalid signature is rejected with a 400/401 error, not accepted.

## Assessment

- **Status**: ❌ Missing
- **Current state**: `oidc.rs:298` calls `decode_jwt_payload(id_token_str)` which is a hand-rolled function (lines 509-526) that splits the JWT on `.` and base64-decodes the middle segment. It reads the payload claims but never fetches JWKS, never calls a signature verification library, and never validates issuer, audience, or expiry. A comment at line 296 explicitly acknowledges this: "In production, full JWT verification against JWKS is required."

## Fix Instructions

**Option A — Use the `openidconnect` crate (spec-recommended)**:

Add to `Cargo.toml`:
```toml
openidconnect = { version = "4", features = ["reqwest"] }
```

In `oidc_callback_inner`, after fetching discovery metadata, use the `openidconnect` crate's `CoreClient` to:
1. Build a `CoreProviderMetadata` from the discovered endpoints
2. Construct a `CoreClient` with `client_id` and `client_secret`
3. Call `client.exchange_code(code)` with the PKCE verifier to exchange the authorization code
4. Validate the returned `id_token` using `token_response.id_token().unwrap().claims(&id_token_verifier, &nonce)` — this checks signature, issuer, audience, nonce, and expiry in one call

**Option B — Manual JWKS validation (acceptable if openidconnect crate causes complexity)**:

1. Fetch `jwks_uri` from discovery metadata
2. Download JWKS JSON from that URI (cache with 1-hour TTL to avoid hitting the IdP on every login)
3. For the `kid` (key ID) in the JWT header, find the matching key in the JWKS
4. Use the `jsonwebtoken` crate (already in the stack via `io-auth`) to verify the signature with that public key
5. Also validate `iss`, `aud`, `nonce`, `exp` claims manually

**Caching note**: JWKS documents should be cached in the AppState (e.g., `Arc<Mutex<HashMap<String, CachedJwks>>>`) keyed by issuer URL, with a max-age of 1 hour. Do not fetch JWKS on every login attempt.

Do NOT:
- Continue using `decode_jwt_payload` which skips signature verification entirely
- Accept the `id_token` claims as trusted before signature validation
- Disable nonce validation (it's already implemented and must remain)
