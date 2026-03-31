//! AES-256-GCM encryption helpers for import connection credential fields.
//!
//! Only the individual sensitive string fields within an `auth_config` JSONB
//! object are encrypted. Non-sensitive fields (host, port, base_url, etc.)
//! remain in plain text so they are readable for debugging.
//!
//! Encrypted values are stored as `$enc:<base64(nonce||ciphertext)>` so they
//! are distinguishable from plain-text values in the database.

use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{Map, Value as JsonValue};

/// Field names within `auth_config` that contain sensitive credentials.
/// When one of these keys holds a non-empty string it will be encrypted on
/// write and decrypted on read.
const SENSITIVE_FIELDS: &[&str] = &[
    "password",
    "api_key",
    "token",
    "secret",
    "client_secret",
    "key_passphrase",
    "bearer_token",
];

const ENC_PREFIX: &str = "$enc:";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Walk a JSON value and encrypt every sensitive string field.
/// Non-object / non-sensitive values are returned unchanged.
pub fn encrypt_sensitive_fields(value: &JsonValue, key: &[u8; 32]) -> JsonValue {
    match value {
        JsonValue::Object(map) => {
            let mut out = Map::with_capacity(map.len());
            for (k, v) in map {
                let new_v = if is_sensitive(k) {
                    if let JsonValue::String(s) = v {
                        if !s.is_empty() && !s.starts_with(ENC_PREFIX) {
                            // Encrypt
                            match encrypt_string(s, key) {
                                Ok(enc) => JsonValue::String(enc),
                                Err(e) => {
                                    tracing::warn!(field = %k, error = %e, "failed to encrypt field; storing as-is");
                                    v.clone()
                                }
                            }
                        } else {
                            v.clone()
                        }
                    } else {
                        v.clone()
                    }
                } else {
                    // Recurse into nested objects
                    encrypt_sensitive_fields(v, key)
                };
                out.insert(k.clone(), new_v);
            }
            JsonValue::Object(out)
        }
        JsonValue::Array(arr) => JsonValue::Array(
            arr.iter()
                .map(|v| encrypt_sensitive_fields(v, key))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// Walk a JSON value and decrypt every sensitive string field that carries the
/// `$enc:` prefix.
pub fn decrypt_sensitive_fields(value: &JsonValue, key: &[u8; 32]) -> JsonValue {
    match value {
        JsonValue::Object(map) => {
            let mut out = Map::with_capacity(map.len());
            for (k, v) in map {
                let new_v = if is_sensitive(k) {
                    if let JsonValue::String(s) = v {
                        if let Some(encoded) = s.strip_prefix(ENC_PREFIX) {
                            match decrypt_string(encoded, key) {
                                Ok(plain) => JsonValue::String(plain),
                                Err(e) => {
                                    tracing::warn!(field = %k, error = %e, "failed to decrypt field; returning ciphertext");
                                    v.clone()
                                }
                            }
                        } else {
                            v.clone()
                        }
                    } else {
                        v.clone()
                    }
                } else {
                    decrypt_sensitive_fields(v, key)
                };
                out.insert(k.clone(), new_v);
            }
            JsonValue::Object(out)
        }
        JsonValue::Array(arr) => JsonValue::Array(
            arr.iter()
                .map(|v| decrypt_sensitive_fields(v, key))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// Walk a JSON value and replace every sensitive string field with `"****"`.
/// This is used in list/get API responses so that credentials are never
/// returned to callers.
pub fn mask_sensitive_fields(value: &JsonValue) -> JsonValue {
    match value {
        JsonValue::Object(map) => {
            let mut out = Map::with_capacity(map.len());
            for (k, v) in map {
                let new_v = if is_sensitive(k) {
                    if let JsonValue::String(s) = v {
                        if !s.is_empty() {
                            JsonValue::String("****".to_string())
                        } else {
                            v.clone()
                        }
                    } else {
                        v.clone()
                    }
                } else {
                    mask_sensitive_fields(v)
                };
                out.insert(k.clone(), new_v);
            }
            JsonValue::Object(out)
        }
        JsonValue::Array(arr) => JsonValue::Array(arr.iter().map(mask_sensitive_fields).collect()),
        other => other.clone(),
    }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

fn is_sensitive(field_name: &str) -> bool {
    SENSITIVE_FIELDS.contains(&field_name)
}

/// Encrypt a plain-text string with AES-256-GCM.
/// Returns a base64-encoded string of the form `$enc:<base64(nonce||ciphertext)>`.
fn encrypt_string(plain: &str, key: &[u8; 32]) -> anyhow::Result<String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    // Generate a 12-byte random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| anyhow::anyhow!("AES-GCM encrypt error: {e}"))?;

    // Prepend nonce so we can recover it during decryption
    let mut payload = Vec::with_capacity(12 + ciphertext.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);

    Ok(format!("{}{}", ENC_PREFIX, B64.encode(&payload)))
}

/// Decrypt a base64-encoded `nonce||ciphertext` payload produced by [`encrypt_string`].
fn decrypt_string(encoded: &str, key: &[u8; 32]) -> anyhow::Result<String> {
    let payload = B64
        .decode(encoded)
        .map_err(|e| anyhow::anyhow!("base64 decode error: {e}"))?;

    if payload.len() < 12 {
        anyhow::bail!("encrypted payload too short");
    }

    let (nonce_bytes, ciphertext) = payload.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plain = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("AES-GCM decrypt error: {e}"))?;

    String::from_utf8(plain).map_err(|e| anyhow::anyhow!("UTF-8 decode error: {e}"))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_key() -> [u8; 32] {
        [0x42u8; 32]
    }

    #[test]
    fn round_trip_encrypt_decrypt() {
        let key = test_key();
        let value = json!({
            "host": "db.example.com",
            "port": 5432,
            "password": "s3cr3t",
            "api_key": "abc123",
            "username": "admin"
        });

        let encrypted = encrypt_sensitive_fields(&value, &key);

        // Non-sensitive fields unchanged
        assert_eq!(encrypted["host"], json!("db.example.com"));
        assert_eq!(encrypted["port"], json!(5432));
        assert_eq!(encrypted["username"], json!("admin"));

        // Sensitive fields encrypted
        let enc_password = encrypted["password"].as_str().unwrap();
        assert!(
            enc_password.starts_with(ENC_PREFIX),
            "password should be prefixed with $enc:"
        );
        let enc_api_key = encrypted["api_key"].as_str().unwrap();
        assert!(enc_api_key.starts_with(ENC_PREFIX));

        let decrypted = decrypt_sensitive_fields(&encrypted, &key);
        assert_eq!(decrypted["password"], json!("s3cr3t"));
        assert_eq!(decrypted["api_key"], json!("abc123"));
        assert_eq!(decrypted["host"], json!("db.example.com"));
    }

    #[test]
    fn mask_replaces_sensitive_with_stars() {
        let value = json!({
            "host": "db.example.com",
            "password": "s3cr3t",
            "api_key": "",
        });

        let masked = mask_sensitive_fields(&value);
        assert_eq!(masked["host"], json!("db.example.com"));
        assert_eq!(masked["password"], json!("****"));
        // Empty string not masked
        assert_eq!(masked["api_key"], json!(""));
    }

    #[test]
    fn encrypt_skips_already_encrypted_values() {
        let key = test_key();
        let value = json!({ "password": format!("{}abc", ENC_PREFIX) });
        let encrypted = encrypt_sensitive_fields(&value, &key);
        // Should not re-encrypt
        assert_eq!(
            encrypted["password"].as_str().unwrap(),
            format!("{}abc", ENC_PREFIX)
        );
    }

    #[test]
    fn encrypt_skips_empty_string() {
        let key = test_key();
        let value = json!({ "password": "" });
        let encrypted = encrypt_sensitive_fields(&value, &key);
        assert_eq!(encrypted["password"], json!(""));
    }
}
