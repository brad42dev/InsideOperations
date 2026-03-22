---
id: DD-28-006
title: Implement AES-256-GCM credential encryption at rest for provider configs
unit: DD-28
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

All provider secrets stored in the `config` JSONB column of `email_providers` — SMTP passwords, OAuth2 client secrets, service account keys, AWS secret keys, API tokens — must be encrypted at rest using AES-256-GCM. The application layer encrypts before writing and decrypts before using. The encryption key is derived from the system master key delivered via systemd `LoadCredentialEncrypted`. The database never stores plaintext secrets.

## Spec Excerpt (verbatim)

> All provider secrets (passwords, client secrets, API keys, service account keys) are encrypted at rest using AES-256-GCM. The encryption key is derived from the system's master key (delivered via systemd `LoadCredentialEncrypted`, see doc 03). Secrets are decrypted in memory only when needed for provider initialization.
>
> The `config` JSONB column in `email_providers` stores encrypted values for sensitive fields. The application layer handles encryption/decryption — the database never sees plaintext secrets.
> — 28_EMAIL_SERVICE.md, §Security / Credential Storage

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/config.rs` — no master key field; no crypto setup
- `services/email-service/src/handlers/email.rs` — `create_provider` (lines 181-232) and `update_provider` (lines 246-301) write config JSONB directly without encryption; `list_providers` (lines 131-167) returns config without masking
- `services/email-service/src/queue_worker.rs` — `process_one` (lines 29-74) reads `provider_config` and passes it raw to `attempt_delivery`

## Verification Checklist

- [ ] `config.rs`: `Config` struct has a `master_key: [u8; 32]` (or similar) field loaded from `CREDENTIALS_DIRECTORY` or env
- [ ] A `crypto.rs` module exists with `encrypt_secret(plaintext: &str, key: &[u8]) -> String` and `decrypt_secret(ciphertext: &str, key: &[u8]) -> Result<String, _>`
- [ ] `create_provider` and `update_provider` handlers identify secret fields by provider type and encrypt them before INSERT/UPDATE
- [ ] `list_providers` and `get_provider` return masked values (`"<masked>"`) for secret fields
- [ ] `queue_worker.rs` decrypts secret fields from `provider_config` before passing credentials to the SMTP/Graph/Gmail adapters

## Assessment

- **Status**: ❌ Missing — no crypto module, no master key in config, providers stored and returned with plaintext secrets

## Fix Instructions

1. Add to workspace `Cargo.toml`:
   ```toml
   aes-gcm = "0.10"   # MIT/Apache-2.0
   rand = "0.8"        # MIT/Apache-2.0
   ```
   Add both to `services/email-service/Cargo.toml`.

2. In `config.rs`, add master key loading:
   ```rust
   pub master_key: [u8; 32],
   ```
   Load it from:
   - `CREDENTIALS_DIRECTORY` env var path + `/email-master-key` (systemd `LoadCredentialEncrypted`)
   - Fallback: `IO_EMAIL_MASTER_KEY` env var (hex-encoded 32 bytes) for dev

3. Create `services/email-service/src/crypto.rs`:
   ```rust
   use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, NewAead, OsRng, rand_core::RngCore}};

   pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> String {
       // Generate random 12-byte nonce, encrypt, return base64(nonce || ciphertext)
   }

   pub fn decrypt(ciphertext_b64: &str, key: &[u8; 32]) -> anyhow::Result<String> {
       // base64-decode, split nonce, decrypt, return plaintext
   }
   ```

4. Define per-provider-type secret field lists:
   ```rust
   fn secret_fields(provider_type: &str) -> &[&str] {
       match provider_type {
           "smtp" => &["password"],
           "smtp_xoauth2" | "smtp" /* with xoauth2 */ => &["password", "client_secret"],
           "msgraph" => &["client_secret"],
           "gmail" => &["service_account_key"],
           "webhook" => &["auth_value"],
           "ses" => &["secret_access_key"],
           _ => &[],
       }
   }
   ```

5. In `create_provider` and `update_provider`: walk the `config` JSONB, encrypt secret fields using the master key before binding to the SQL query.

6. In `list_providers` / `get_provider`: replace secret field values with `"<masked>"` in the returned JSON (do not decrypt for API responses).

7. In `queue_worker.rs` `process_one`: after fetching `provider_config`, call a `decrypt_provider_secrets` helper that decrypts the secret fields in-place before passing `provider_config` to `attempt_delivery`.

Do NOT:
- Log decrypted secrets at any log level
- Return decrypted secrets in any API response
- Use a hardcoded encryption key; always derive from the master key
- Use ECB mode or non-authenticated encryption; AES-256-GCM is required
