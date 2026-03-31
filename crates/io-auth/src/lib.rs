use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use thiserror::Error;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("password hashing failed: {0}")]
    HashingFailed(String),

    #[error("token generation failed: {0}")]
    TokenGeneration(String),

    #[error("token validation failed: {0}")]
    TokenValidation(String),

    #[error("invalid credentials")]
    InvalidCredentials,
}

// ---------------------------------------------------------------------------
// JWT Claims
// ---------------------------------------------------------------------------

/// JWT claims embedded in every access token.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Claims {
    /// Subject: the user's UUID as a string.
    pub sub: String,
    pub username: String,
    pub permissions: Vec<String>,
    /// Expiration time (Unix timestamp).
    pub exp: i64,
    /// Issued-at time (Unix timestamp).
    pub iat: i64,
}

// ---------------------------------------------------------------------------
// Token pair
// ---------------------------------------------------------------------------

/// Access + refresh token pair returned after a successful login.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    /// Seconds until the access token expires.
    pub expires_in: u64,
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

/// Hash a plain-text password with Argon2id.
pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AuthError::HashingFailed(e.to_string()))
}

/// Verify a plain-text password against an Argon2 PHC string.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AuthError> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| AuthError::HashingFailed(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/// Sign a `Claims` struct and return the compact JWT string.
pub fn generate_access_token(claims: &Claims, secret: &str) -> Result<String, AuthError> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AuthError::TokenGeneration(e.to_string()))
}

/// Decode and validate a JWT, returning the embedded claims.
///
/// Algorithm is explicitly locked to HS256 — this prevents algorithm-confusion
/// attacks (e.g. 'none' or RS256 with the HMAC secret as the public key).
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, AuthError> {
    let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    validation.validate_exp = true;

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| AuthError::TokenValidation(e.to_string()))
}

// ---------------------------------------------------------------------------
// Convenience: build claims for a user
// ---------------------------------------------------------------------------

/// Build a Claims struct with the standard 15-minute access token lifetime.
pub fn build_claims(user_id: &str, username: &str, permissions: Vec<String>) -> Claims {
    let now = chrono::Utc::now().timestamp();
    Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        permissions,
        iat: now,
        exp: now + 900, // 15 minutes
    }
}

// ---------------------------------------------------------------------------
// Recovery codes
// ---------------------------------------------------------------------------

/// Generate `count` cryptographically random recovery codes, each `length` hex
/// characters long.  The returned codes are guaranteed unique within the set.
pub fn generate_recovery_codes(count: usize, length: usize) -> Vec<String> {
    use rand::RngCore;
    let mut rng = rand::rngs::OsRng;
    let mut codes = std::collections::HashSet::with_capacity(count);
    while codes.len() < count {
        // Each byte → 2 hex chars, so we need length/2 bytes (rounded up).
        let byte_len = length.div_ceil(2);
        let mut bytes = vec![0u8; byte_len];
        rng.fill_bytes(&mut bytes);
        let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
        codes.insert(hex[..length].to_string());
    }
    codes.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------
    // build_claims
    // ------------------------------------------------------------------

    #[test]
    fn build_claims_sets_sub_username_and_permissions() {
        let perms = vec!["read".to_string(), "write".to_string()];
        let claims = build_claims("user-123", "alice", perms.clone());

        assert_eq!(claims.sub, "user-123");
        assert_eq!(claims.username, "alice");
        assert_eq!(claims.permissions, perms);
    }

    #[test]
    fn build_claims_exp_is_roughly_15_minutes_from_now() {
        let before = chrono::Utc::now().timestamp();
        let claims = build_claims("u", "u", vec![]);
        let after = chrono::Utc::now().timestamp();

        // exp should be iat + 900; allow ±2 s for clock drift in test runners.
        assert!(claims.exp >= before + 898 && claims.exp <= after + 902);
        assert!(claims.iat >= before && claims.iat <= after);
    }

    // ------------------------------------------------------------------
    // generate_access_token + validate_token (round-trip)
    // ------------------------------------------------------------------

    #[test]
    fn token_round_trip_returns_original_claims() {
        let claims = build_claims("aabbcc", "bob", vec!["alerts.view".to_string()]);
        let secret = "test-secret-key";

        let token =
            generate_access_token(&claims, secret).expect("token generation should succeed");
        let decoded = validate_token(&token, secret).expect("token validation should succeed");

        assert_eq!(decoded.sub, claims.sub);
        assert_eq!(decoded.username, claims.username);
        assert_eq!(decoded.permissions, claims.permissions);
    }

    #[test]
    fn token_wrong_secret_returns_error() {
        let claims = build_claims("u1", "carol", vec![]);
        let token =
            generate_access_token(&claims, "correct-secret").expect("should generate token");

        let result = validate_token(&token, "wrong-secret");
        assert!(result.is_err(), "validation with wrong secret must fail");
    }

    #[test]
    fn expired_token_returns_validation_error() {
        let now = chrono::Utc::now().timestamp();
        // Construct claims already in the past.
        let expired = Claims {
            sub: "u2".to_string(),
            username: "dave".to_string(),
            permissions: vec![],
            iat: now - 200,
            exp: now - 100, // expired 100 s ago
        };
        let secret = "s";
        let token =
            generate_access_token(&expired, secret).expect("should encode even if exp is past");

        let result = validate_token(&token, secret);
        assert!(result.is_err(), "expired token must be rejected");
        matches!(result.unwrap_err(), AuthError::TokenValidation(_));
    }

    // ------------------------------------------------------------------
    // hash_password + verify_password
    // ------------------------------------------------------------------

    #[test]
    fn correct_password_verifies_as_true() {
        let hash = hash_password("S3cret!Pass").expect("hashing should succeed");
        let ok = verify_password("S3cret!Pass", &hash).expect("verify should not error");
        assert!(ok, "correct password must verify as true");
    }

    #[test]
    fn wrong_password_verifies_as_false() {
        let hash = hash_password("S3cret!Pass").expect("hashing should succeed");
        let ok = verify_password("WrongPassword1", &hash).expect("verify should not error");
        assert!(!ok, "wrong password must verify as false");
    }

    #[test]
    fn invalid_phc_string_returns_error() {
        let result = verify_password("any", "not-a-valid-phc-string");
        assert!(result.is_err(), "invalid PHC string must return an error");
    }

    // ------------------------------------------------------------------
    // generate_recovery_codes
    // ------------------------------------------------------------------

    #[test]
    fn recovery_codes_returns_requested_count() {
        let codes = generate_recovery_codes(10, 16);
        assert_eq!(codes.len(), 10, "must return exactly 10 codes");
    }

    #[test]
    fn recovery_codes_each_have_minimum_length() {
        let codes = generate_recovery_codes(10, 16);
        for code in &codes {
            assert!(
                code.len() >= 8,
                "each code must be at least 8 characters, got: {code}"
            );
        }
    }

    #[test]
    fn recovery_codes_are_all_unique() {
        let codes = generate_recovery_codes(10, 16);
        let unique: std::collections::HashSet<_> = codes.iter().collect();
        assert_eq!(
            unique.len(),
            codes.len(),
            "all recovery codes must be unique"
        );
    }
}
