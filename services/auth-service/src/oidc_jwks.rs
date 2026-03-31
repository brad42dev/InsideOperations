//! JWKS-based ID token verification for OIDC flows.
//!
//! This module fetches the JWKS document from an OIDC provider and verifies
//! the `id_token` signature using the `jsonwebtoken` crate.  Keys are cached
//! in `AppState` for up to 1 hour to avoid hitting the IdP on every login.

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use jsonwebtoken::{decode_header, Algorithm, DecodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use io_error::{IoError, IoResult};

// ---------------------------------------------------------------------------
// Cache types
// ---------------------------------------------------------------------------

/// A single JSON Web Key from a JWKS document.
#[derive(Debug, Clone, Deserialize)]
pub struct Jwk {
    /// Key type (e.g. "RSA", "EC")
    pub kty: String,
    /// Key ID — used to select the right key from the set.
    pub kid: Option<String>,
    /// Algorithm (e.g. "RS256", "ES256")
    pub alg: Option<String>,
    /// Key use ("sig" for signing keys)
    #[serde(rename = "use")]
    pub key_use: Option<String>,

    // RSA components (base64url-encoded)
    pub n: Option<String>,
    pub e: Option<String>,

    // EC components (base64url-encoded)
    #[allow(dead_code)]
    pub crv: Option<String>,
    pub x: Option<String>,
    pub y: Option<String>,
}

/// The complete JWKS document.
#[derive(Debug, Clone, Deserialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

/// A cached JWKS entry with a 1-hour TTL.
#[derive(Debug, Clone)]
pub struct CachedJwks {
    pub jwks: Jwks,
    pub fetched_at: DateTime<Utc>,
}

impl CachedJwks {
    pub fn is_fresh(&self) -> bool {
        let age = Utc::now().signed_duration_since(self.fetched_at);
        age.num_seconds() < 3600 // 1-hour TTL
    }
}

/// In-memory JWKS cache keyed by issuer URL.
pub type JwksCache = Arc<DashMap<String, CachedJwks>>;

// ---------------------------------------------------------------------------
// Minimal ID token claims (for validation)
// ---------------------------------------------------------------------------

/// The claims we care about when verifying the `id_token`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdTokenClaims {
    /// Subject identifier — the user's unique ID at the IdP.
    pub sub: String,
    /// Issuer URL.
    pub iss: String,
    /// Audience — must include the client_id.
    pub aud: serde_json::Value,
    /// Expiry (Unix timestamp).
    pub exp: i64,
    /// Issued at (Unix timestamp).
    pub iat: i64,
    /// Nonce — must match the one stored in the DB flow record.
    pub nonce: Option<String>,
    // Optional standard claims — populated for convenience by callers.
    pub email: Option<String>,
    pub name: Option<String>,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

// ---------------------------------------------------------------------------
// JWKS fetch (with cache)
// ---------------------------------------------------------------------------

/// Fetch the JWKS for `issuer_url`, returning cached keys when they are fresh.
///
/// The `jwks_uri` is passed in directly (from the discovery metadata already
/// fetched in the callback handler) to avoid a duplicate HTTP round-trip.
pub async fn fetch_jwks(
    http: &reqwest::Client,
    cache: &JwksCache,
    issuer_url: &str,
    jwks_uri: &str,
) -> IoResult<Jwks> {
    // Return cached copy if still fresh.
    if let Some(entry) = cache.get(issuer_url) {
        if entry.is_fresh() {
            return Ok(entry.jwks.clone());
        }
    }

    // Fetch from IdP.
    let resp = http
        .get(jwks_uri)
        .send()
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("JWKS fetch failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(IoError::ServiceUnavailable(format!(
            "JWKS endpoint returned HTTP {}",
            resp.status()
        )));
    }

    let jwks: Jwks = resp
        .json()
        .await
        .map_err(|e| IoError::Internal(format!("JWKS parse error: {e}")))?;

    // Update cache.
    cache.insert(
        issuer_url.to_string(),
        CachedJwks {
            jwks: jwks.clone(),
            fetched_at: Utc::now(),
        },
    );

    Ok(jwks)
}

// ---------------------------------------------------------------------------
// ID token verification
// ---------------------------------------------------------------------------

/// Verify an OIDC `id_token` signature and validate its claims.
///
/// Checks performed:
/// - Signature against the matching key in the JWKS.
/// - `iss` == `expected_issuer`.
/// - `aud` contains `expected_client_id`.
/// - `exp` not exceeded.
/// - `nonce` == `expected_nonce` (when present in the token).
///
/// Returns the parsed `IdTokenClaims` on success.
pub async fn verify_id_token(
    http: &reqwest::Client,
    jwks_cache: &JwksCache,
    id_token: &str,
    jwks_uri: &str,
    expected_issuer: &str,
    expected_client_id: &str,
    expected_nonce: &str,
) -> IoResult<IdTokenClaims> {
    if id_token.is_empty() {
        return Err(IoError::BadRequest(
            "id_token is missing from token response".into(),
        ));
    }

    // Parse the JWT header to find the key ID and algorithm.
    let header: Header = decode_header(id_token)
        .map_err(|e| IoError::BadRequest(format!("id_token header parse error: {e}")))?;

    let alg = header.alg;
    let kid = header.kid.as_deref();

    // Fetch (or hit cache for) the JWKS.
    let jwks = fetch_jwks(http, jwks_cache, expected_issuer, jwks_uri).await?;

    // Find the matching JWK.  If `kid` is present in the header we match on
    // it; otherwise we fall back to the first signing key whose algorithm
    // matches.
    let jwk = find_matching_key(&jwks, kid, alg)
        .ok_or_else(|| IoError::BadRequest("No matching JWKS key found for id_token".into()))?;

    // Build the decoding key from the JWK.
    let decoding_key = jwk_to_decoding_key(jwk)?;

    // Build the validation options.
    let mut validation = Validation::new(alg);
    // Disable the built-in aud check — we validate it ourselves below to
    // support both string and array aud claim formats.
    validation.validate_aud = false;
    // The iss check is done manually below for clear error messages.
    validation.validate_exp = true;
    // Add the expected issuer so jsonwebtoken also checks it.
    validation.set_issuer(&[expected_issuer]);

    // Decode and verify the token.
    let token_data = jsonwebtoken::decode::<IdTokenClaims>(id_token, &decoding_key, &validation)
        .map_err(|e| IoError::BadRequest(format!("id_token signature validation failed: {e}")))?;

    let claims = token_data.claims;

    // --- Manual claim validation ---

    // Issuer check (belt-and-suspenders — jsonwebtoken also checks this).
    if claims.iss != expected_issuer {
        return Err(IoError::BadRequest(format!(
            "id_token issuer mismatch: got '{}', expected '{}'",
            claims.iss, expected_issuer
        )));
    }

    // Audience check — `aud` can be a JSON string or array.
    let aud_ok = match &claims.aud {
        serde_json::Value::String(s) => s == expected_client_id,
        serde_json::Value::Array(arr) => arr.iter().any(|v| v.as_str() == Some(expected_client_id)),
        _ => false,
    };
    if !aud_ok {
        return Err(IoError::BadRequest(format!(
            "id_token audience does not include client_id '{}'",
            expected_client_id
        )));
    }

    // Expiry check (belt-and-suspenders — jsonwebtoken also checks this when
    // validate_exp = true).
    let now = Utc::now().timestamp();
    if claims.exp < now {
        return Err(IoError::BadRequest("id_token has expired".into()));
    }

    // Nonce validation — MUST be present and must match.
    match &claims.nonce {
        Some(n) if n == expected_nonce => {}
        Some(n) => {
            return Err(IoError::BadRequest(format!(
                "OIDC nonce mismatch: token has '{n}', expected '{expected_nonce}'"
            )));
        }
        None => {
            return Err(IoError::BadRequest(
                "id_token is missing the nonce claim".into(),
            ));
        }
    }

    Ok(claims)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Find a JWK that matches the `kid` from the JWT header (exact match) or,
/// when `kid` is absent, the first signing key whose declared algorithm
/// matches.
/// Public alias used by `handlers::duo` for Duo-specific ID token verification.
pub fn find_matching_key_pub<'a>(
    jwks: &'a Jwks,
    kid: Option<&str>,
    alg: Algorithm,
) -> Option<&'a Jwk> {
    find_matching_key(jwks, kid, alg)
}

/// Public alias used by `handlers::duo` for Duo-specific ID token verification.
pub fn jwk_to_decoding_key_pub(jwk: &Jwk) -> IoResult<jsonwebtoken::DecodingKey> {
    jwk_to_decoding_key(jwk)
}

fn find_matching_key<'a>(jwks: &'a Jwks, kid: Option<&str>, alg: Algorithm) -> Option<&'a Jwk> {
    if let Some(kid) = kid {
        // Exact kid match — preferred path.
        let found = jwks.keys.iter().find(|k| k.kid.as_deref() == Some(kid));
        if found.is_some() {
            return found;
        }
    }

    // Fallback: first key whose `alg` or `kty` is compatible.
    let alg_str = algorithm_to_str(alg);
    jwks.keys.iter().find(|k| {
        let use_ok = k.key_use.as_deref().map(|u| u == "sig").unwrap_or(true);
        let alg_ok = k
            .alg
            .as_deref()
            .map(|a| a == alg_str)
            .unwrap_or_else(|| kty_compatible(k.kty.as_str(), alg));
        use_ok && alg_ok
    })
}

fn algorithm_to_str(alg: Algorithm) -> &'static str {
    match alg {
        Algorithm::RS256 => "RS256",
        Algorithm::RS384 => "RS384",
        Algorithm::RS512 => "RS512",
        Algorithm::PS256 => "PS256",
        Algorithm::PS384 => "PS384",
        Algorithm::PS512 => "PS512",
        Algorithm::ES256 => "ES256",
        Algorithm::ES384 => "ES384",
        // HS* algorithms should never appear in OIDC id_tokens from a public IdP.
        _ => "unknown",
    }
}

fn kty_compatible(kty: &str, alg: Algorithm) -> bool {
    match kty {
        "RSA" => matches!(
            alg,
            Algorithm::RS256
                | Algorithm::RS384
                | Algorithm::RS512
                | Algorithm::PS256
                | Algorithm::PS384
                | Algorithm::PS512
        ),
        "EC" => matches!(alg, Algorithm::ES256 | Algorithm::ES384),
        _ => false,
    }
}

/// Convert a `Jwk` into a `jsonwebtoken::DecodingKey`.
fn jwk_to_decoding_key(jwk: &Jwk) -> IoResult<DecodingKey> {
    match jwk.kty.as_str() {
        "RSA" => {
            let n = jwk
                .n
                .as_deref()
                .ok_or_else(|| IoError::Internal("RSA JWK missing 'n' parameter".into()))?;
            let e = jwk
                .e
                .as_deref()
                .ok_or_else(|| IoError::Internal("RSA JWK missing 'e' parameter".into()))?;
            DecodingKey::from_rsa_components(n, e)
                .map_err(|e| IoError::Internal(format!("RSA key construction failed: {e}")))
        }
        "EC" => {
            let x = jwk
                .x
                .as_deref()
                .ok_or_else(|| IoError::Internal("EC JWK missing 'x' parameter".into()))?;
            let y = jwk
                .y
                .as_deref()
                .ok_or_else(|| IoError::Internal("EC JWK missing 'y' parameter".into()))?;
            DecodingKey::from_ec_components(x, y)
                .map_err(|e| IoError::Internal(format!("EC key construction failed: {e}")))
        }
        kty => Err(IoError::Internal(format!(
            "Unsupported JWK key type: {kty}"
        ))),
    }
}
