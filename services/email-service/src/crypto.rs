//! AES-256-GCM credential encryption for provider configs.
//!
//! Secrets are encrypted before storage and decrypted only in memory when needed.
//! The database never stores plaintext secrets.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use anyhow::Context;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;

/// Encrypt a plaintext string with AES-256-GCM.
///
/// Generates a random 12-byte nonce, encrypts the plaintext, and returns
/// `base64(nonce || ciphertext)`.
pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> anyhow::Result<String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("AES-GCM encrypt failed: {e}"))?;

    // Encode as base64(nonce || ciphertext)
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(B64.encode(&combined))
}

/// Decrypt a ciphertext string produced by [`encrypt`].
///
/// Expects `base64(nonce || ciphertext)` format. Returns the plaintext.
pub fn decrypt(ciphertext_b64: &str, key: &[u8; 32]) -> anyhow::Result<String> {
    let combined = B64
        .decode(ciphertext_b64)
        .context("Failed to base64-decode ciphertext")?;

    if combined.len() < 12 {
        anyhow::bail!("Ciphertext too short to contain a nonce");
    }

    let (nonce_bytes, ct) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    let plaintext_bytes = cipher
        .decrypt(nonce, ct)
        .map_err(|e| anyhow::anyhow!("AES-GCM decrypt failed: {e}"))?;

    String::from_utf8(plaintext_bytes).context("Decrypted bytes are not valid UTF-8")
}

/// Return the list of secret field names for a given provider type.
pub fn secret_fields(provider_type: &str) -> &'static [&'static str] {
    match provider_type {
        "smtp" => &["password"],
        "smtp_xoauth2" => &["password", "client_secret"],
        "msgraph" => &["client_secret"],
        "gmail" => &["service_account_key"],
        "webhook" => &["auth_value"],
        "ses" => &["secret_access_key"],
        _ => &[],
    }
}

/// Encrypt all secret fields in a provider config JSON object in-place.
/// Fields that are not present or are not strings are left unchanged.
pub fn encrypt_provider_secrets(
    config: &mut serde_json::Value,
    provider_type: &str,
    key: &[u8; 32],
) -> anyhow::Result<()> {
    let fields = secret_fields(provider_type);
    if let Some(obj) = config.as_object_mut() {
        for field in fields {
            if let Some(val) = obj.get_mut(*field) {
                if let Some(plaintext) = val.as_str() {
                    // Skip values that are already encrypted (base64 opaque blobs)
                    // or already masked — only encrypt real plaintext.
                    if plaintext != "<masked>" {
                        let encrypted = encrypt(plaintext, key)?;
                        *val = serde_json::Value::String(encrypted);
                    }
                }
            }
        }
    }
    Ok(())
}

/// Decrypt all secret fields in a provider config JSON object in-place.
/// Fields that are not present or are not strings are left unchanged.
pub fn decrypt_provider_secrets(
    config: &mut serde_json::Value,
    provider_type: &str,
    key: &[u8; 32],
) -> anyhow::Result<()> {
    let fields = secret_fields(provider_type);
    if let Some(obj) = config.as_object_mut() {
        for field in fields {
            if let Some(val) = obj.get_mut(*field) {
                if let Some(ciphertext) = val.as_str() {
                    match decrypt(ciphertext, key) {
                        Ok(plaintext) => {
                            *val = serde_json::Value::String(plaintext);
                        }
                        Err(e) => {
                            tracing::warn!(
                                field = *field,
                                provider_type,
                                error = %e,
                                "Failed to decrypt provider secret field — leaving encrypted"
                            );
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

/// Mask all secret fields in a provider config JSON object in-place.
/// Replaces any present string value with `"<masked>"`.
pub fn mask_provider_secrets(config: &mut serde_json::Value, provider_type: &str) {
    let fields = secret_fields(provider_type);
    if let Some(obj) = config.as_object_mut() {
        for field in fields {
            if let Some(val) = obj.get_mut(*field) {
                if val.is_string() {
                    *val = serde_json::Value::String("<masked>".to_string());
                }
            }
        }
    }
}
