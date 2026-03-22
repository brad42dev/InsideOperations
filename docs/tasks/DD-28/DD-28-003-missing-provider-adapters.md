---
id: DD-28-003
title: Implement MS Graph, Gmail, SES, and SMTP-XOAUTH2 provider adapters
unit: DD-28
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The queue worker must support all six provider types specified in the design doc. Currently only `smtp` (plain/login auth) and `webhook` are implemented. Missing adapters: Microsoft Graph API (reqwest + OAuth2 client credentials), Gmail API (JWT service account auth), Amazon SES (via `aws-sdk-sesv2` or SES SMTP credentials), and SMTP+XOAUTH2 (existing `lettre` transport but with an OAuth2-acquired token). Each adapter must also implement the `health_check` equivalent (used by `test_provider`).

## Spec Excerpt (verbatim)

> **Shipped Providers**: SMTP Relay (P0), Microsoft Graph API (P1), Gmail API (P2), Webhook (P2), Amazon SES (P3), SMTP Direct (P3)
> — 28_EMAIL_SERVICE.md, §Email Providers / Shipped Providers

> **Microsoft Graph**: `POST https://graph.microsoft.com/v1.0/users/{send_as_user}/sendMail` ... OAuth2 client credentials flow ... `reqwest` + `serde` + `oauth2`. No heavy SDK dependency.
> — 28_EMAIL_SERVICE.md, §Email Providers / Microsoft Graph API

> **Gmail API**: `POST https://gmail.googleapis.com/gmail/v1/users/{send_as_user}/messages/send` with base64url-encoded RFC 2822 message body. `reqwest` + `serde` + `jsonwebtoken` for JWT-based auth.
> — 28_EMAIL_SERVICE.md, §Email Providers / Gmail API

> **XOAUTH2 sub-mode**: token acquired via the `oauth2` crate (MIT/Apache-2.0), cached in memory, refreshes 5 minutes before expiry.
> — 28_EMAIL_SERVICE.md, §Email Providers / SMTP Relay (Authenticated)

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/queue_worker.rs` — `attempt_delivery` at lines 159-187; `match provider_type` only handles `"smtp"` and `"webhook"`
- `services/email-service/Cargo.toml` — needs `oauth2` workspace dependency added
- `Cargo.toml` (workspace root) — needs `oauth2 = { version = "4", ... }` added

## Verification Checklist

- [ ] `attempt_delivery` match arm for `"msgraph"` calls a `send_msgraph` function using `reqwest` to POST to Graph API
- [ ] `attempt_delivery` match arm for `"gmail"` calls a `send_gmail` function using `reqwest` with JWT service-account token
- [ ] `attempt_delivery` match arm for `"ses"` either uses `aws-sdk-sesv2` or routes through SMTP with SES credentials
- [ ] `attempt_delivery` match arm for `"smtp"` with `auth_method = "xoauth2"` acquires an OAuth2 token via the `oauth2` crate
- [ ] Token cache (in-memory, per provider instance) with 5-minute pre-expiry refresh implemented for OAuth2 providers
- [ ] `oauth2` crate added to workspace `Cargo.toml` and `services/email-service/Cargo.toml`

## Assessment

- **Status**: ❌ Missing — `attempt_delivery` at `queue_worker.rs:171` only matches `"smtp"` and `"webhook"`; all other provider types fall through to a no-op warn log

## Fix Instructions

1. Add `oauth2 = { version = "4", features = ["reqwest"] }` to the workspace `Cargo.toml` `[workspace.dependencies]` section and reference it in `services/email-service/Cargo.toml`.

2. Add a token cache to `AppState` (or as a separate `Arc<Mutex<HashMap<Uuid, CachedToken>>>`):
   ```rust
   pub struct CachedToken {
       pub access_token: String,
       pub expires_at: std::time::Instant,
   }
   ```
   Store it in `AppState` and pass `state` into each adapter that needs OAuth2.

3. Implement `send_msgraph` in `queue_worker.rs` or a new `providers/msgraph.rs`:
   - Read `tenant_id`, `client_id`, `client_secret`, `send_as_user`, `save_to_sent` from `config` JSONB
   - POST to `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` with `client_credentials` grant
   - Cache the token; use cached token if not expired
   - POST to `https://graph.microsoft.com/v1.0/users/{send_as_user}/sendMail` with the message JSON
   - For attachments >4MB use the upload session API

4. Implement `send_gmail`:
   - Load service account JSON key from `config["service_account_key"]`
   - Use `jsonwebtoken` (already in workspace) to create a JWT for impersonation
   - Exchange JWT for access token via Google OAuth2 token endpoint
   - Build RFC 2822 message using `lettre::Message::builder` then base64url-encode it
   - POST to `https://gmail.googleapis.com/gmail/v1/users/{send_as_user}/messages/send`

5. Implement XOAUTH2 within the existing `send_smtp` path: when `config["auth_method"] == "xoauth2"`, acquire token from `config["token_endpoint"]` using the `oauth2` crate client-credentials flow, then construct the XOAUTH2 credential string and pass it to `lettre` via `Credentials::new(username, token)` with `Mechanism::Xoauth2`.

6. For SES: the simplest path is to configure the SMTP provider with SES SMTP credentials (`email-smtp.{region}.amazonaws.com`). Add a `"ses"` match arm in `attempt_delivery` that re-uses `send_smtp` by constructing the SES SMTP config from `access_key_id` and `secret_access_key` (SES SMTP passwords are derived from the secret key via HMAC-SHA256). Alternatively, add `aws-sdk-sesv2` as an optional workspace dependency.

Do NOT:
- Leave unknown provider types as silent no-ops in production; return an explicit error
- Store token refresh state globally — it must be per provider instance (keyed by provider UUID)
