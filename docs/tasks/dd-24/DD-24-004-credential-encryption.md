---
id: DD-24-004
title: Implement AES-256-GCM credential encryption for import connection auth_config
unit: DD-24
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Credentials stored in `import_connections.auth_config` (passwords, API keys, tokens, OAuth secrets) must be encrypted with AES-256-GCM at the application layer before writing to the database. API responses must never return decrypted credentials — masked with `****`. Decryption occurs only inside the import service during connection test and import execution. This mirrors the same pattern used for OPC UA credentials in `point_sources.connection_config`.

## Spec Excerpt (verbatim)

> Credentials are stored in `import_connections.connection_config` JSONB, **encrypted at the application layer** (AES-256-GCM) before writing to the database. This follows the same pattern used by `point_sources.connection_config` for OPC UA credentials.
>
> - **Encryption key**: The application master key (delivered via systemd encrypted credentials, see doc 03) encrypts credential fields. The key is never stored in the database or in plaintext on disk.
> - **API responses**: Never return decrypted credentials (masked with `****`)
> - **Decryption**: Only occurs internally during connection test and import execution
> — 24_UNIVERSAL_IMPORT.md, §4 Credential Storage

## Where to Look in the Codebase

Primary files:
- `services/import-service/src/handlers/import.rs:440–479` — `create_connection`: inserts `auth_config` as-is without encryption
- `services/import-service/src/handlers/import.rs:507–560` — `update_connection`: same issue
- `services/import-service/src/handlers/import.rs:237–252` — `row_to_connection`: returns full `config` (which includes `auth_config`) in serialized form
- `services/import-service/src/config.rs` — check if an `app_master_key` or encryption key config field exists

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `create_connection` encrypts sensitive fields in `auth_config` before passing to `sqlx::query` INSERT
- [ ] `update_connection` re-encrypts `auth_config` before UPDATE
- [ ] `row_to_connection` masks credential fields (password, api_key, token) with `"****"` in the serialized output
- [ ] Decryption only happens inside `test_connection` and the ETL pipeline, never in list/get handlers
- [ ] Encryption key is loaded from environment variable (e.g., `IO_APP_MASTER_KEY`) not hardcoded
- [ ] The `aes-gcm` crate (or equivalent MIT/Apache-2.0 crate) is added to `services/import-service/Cargo.toml`

## Assessment

- **Status**: ❌ Missing
- `handlers/import.rs:449–469` — `auth_config` is bound directly to the INSERT query as raw `JsonValue` with no encryption. No encryption crate present in the import service. `row_to_connection` at line 237 returns full `config` including any stored credentials.

## Fix Instructions

1. Add `aes-gcm = "0.10"` and `base64 = "0.22"` to `services/import-service/Cargo.toml`. Both are MIT/Apache-2.0 licensed.

2. Create `services/import-service/src/crypto.rs` with two functions:
   ```rust
   pub fn encrypt_sensitive_fields(value: &serde_json::Value, key: &[u8; 32]) -> serde_json::Value
   pub fn decrypt_sensitive_fields(value: &serde_json::Value, key: &[u8; 32]) -> serde_json::Value
   pub fn mask_sensitive_fields(value: &serde_json::Value) -> serde_json::Value
   ```
   Sensitive field names: `password`, `api_key`, `token`, `secret`, `client_secret`, `key_passphrase`, `bearer_token`.
   Each sensitive string value is replaced with `aes_gcm::AeadInPlace` encrypted bytes, base64-encoded, with a `$enc:` prefix for detectability.

3. In `create_connection` (line 449): call `crypto::encrypt_sensitive_fields(&auth_config, &state.config.master_key)` before binding.

4. In `update_connection` (line 529): same.

5. In `row_to_connection` (line 237): call `crypto::mask_sensitive_fields(&config)` before returning. Do NOT decrypt here.

6. In `test_connection` (after fix from DD-24-002): decrypt with `crypto::decrypt_sensitive_fields(&auth_config, &state.config.master_key)` before passing to connector.

7. Add `master_key: [u8; 32]` to `AppState` / `Config`. Load from `IO_APP_MASTER_KEY` env var (hex-encoded 32 bytes). If missing, fail startup with a clear error.

Do NOT:
- Use a hardcoded encryption key
- Encrypt the entire JSONB blob — only encrypt individual sensitive string fields within it so that non-sensitive fields (host, port, base_url) remain readable for debugging
- Return decrypted values in any HTTP response
