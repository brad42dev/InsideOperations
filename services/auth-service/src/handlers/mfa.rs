use axum::{
    extract::State,
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use io_auth::{build_claims, generate_access_token};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;
use totp_rs::{Algorithm, Secret, TOTP};

use crate::handlers::auth::fetch_user_permissions;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract user_id from the `x-io-user-id` header injected by the API Gateway
/// after JWT validation.
fn extract_user_id(headers: &HeaderMap) -> Result<Uuid, IoError> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(IoError::Unauthorized)
}

fn argon2_hash(plaintext: &str) -> IoResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plaintext.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| IoError::Internal(format!("argon2 hash error: {e}")))
}

fn argon2_verify(plaintext: &str, hash: &str) -> IoResult<bool> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| IoError::Internal(format!("argon2 parse error: {e}")))?;
    Ok(Argon2::default()
        .verify_password(plaintext.as_bytes(), &parsed)
        .is_ok())
}

fn build_totp(secret_base32: &str) -> IoResult<TOTP> {
    let secret_bytes = Secret::Encoded(secret_base32.to_string())
        .to_bytes()
        .map_err(|e| IoError::Internal(format!("totp secret decode: {e}")))?;
    TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some("Inside Operations".to_string()),
        "account".to_string(),
    )
    .map_err(|e| IoError::Internal(format!("totp init: {e}")))
}

fn generate_recovery_codes() -> Vec<String> {
    (0..8)
        .map(|_| {
            let a: u16 = rand::random();
            let b: u16 = rand::random();
            format!("{:04x}-{:04x}", a, b)
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EnrollResponse {
    pub secret: String,
    pub otpauth_uri: String,
    pub manual_entry_key: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEnrollmentRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyEnrollmentResponse {
    pub recovery_codes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct MfaStatusResponse {
    pub enabled: bool,
    pub methods: Vec<MfaMethodStatus>,
    pub has_recovery_codes: bool,
}

#[derive(Debug, Serialize)]
pub struct MfaMethodStatus {
    pub method_type: String,
    pub status: String,
    pub verified_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct MfaChallengeRequest {
    pub user_id: String,
    pub code: String,
    #[allow(dead_code)]
    pub is_recovery_code: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RecoveryRequest {
    pub user_id: String,
    pub recovery_code: String,
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/enroll
// Generate a TOTP secret and return it for the user to register in their app.
// ---------------------------------------------------------------------------

pub async fn enroll_totp(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    // Look up username for the otpauth URI label
    let user_row = sqlx::query("SELECT username FROM users WHERE id = $1 AND deleted_at IS NULL")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(IoError::NotFound("User not found".to_string()))?;
    let username: String = user_row.get("username");

    // Generate a random 20-byte secret, base32-encode it for authenticator apps
    let raw: [u8; 20] = rand::random();
    let secret_base32 =
        base32::encode(base32::Alphabet::RFC4648 { padding: false }, &raw);

    // Delete any pre-existing pending enrollment for this user
    sqlx::query(
        "DELETE FROM user_mfa WHERE user_id = $1 AND mfa_type = 'totp' AND status = 'pending_verification'",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Insert a new pending row
    sqlx::query(
        "INSERT INTO user_mfa (id, user_id, mfa_type, secret, status, created_at)
         VALUES ($1, $2, 'totp'::mfa_type, $3, 'pending_verification', NOW())",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&secret_base32)
    .execute(&state.db)
    .await?;

    let otpauth_uri = format!(
        "otpauth://totp/Inside%20Operations:{username}?secret={secret_base32}&issuer=Inside%20Operations&algorithm=SHA1&digits=6&period=30",
    );

    Ok(Json(ApiResponse::ok(EnrollResponse {
        secret: secret_base32.clone(),
        otpauth_uri,
        manual_entry_key: secret_base32,
    })))
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/verify  — verify TOTP code during enrollment
// ---------------------------------------------------------------------------

pub async fn verify_totp_enrollment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<VerifyEnrollmentRequest>,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    // Fetch pending enrollment
    let row = sqlx::query(
        "SELECT id, secret FROM user_mfa
         WHERE user_id = $1 AND mfa_type = 'totp' AND status = 'pending_verification'",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound("No pending TOTP enrollment found".to_string()))?;

    let mfa_id: Uuid = row.get("id");
    let secret_base32: String = row.get("secret");

    // Verify the provided TOTP code
    let totp = build_totp(&secret_base32)?;
    let valid = totp
        .check_current(&body.code)
        .map_err(|e| IoError::Internal(format!("totp check error: {e}")))?;

    if !valid {
        return Err(IoError::BadRequest("Invalid TOTP code".to_string()));
    }

    // Activate the MFA record
    sqlx::query(
        "UPDATE user_mfa SET status = 'active', verified_at = NOW() WHERE id = $1",
    )
    .bind(mfa_id)
    .execute(&state.db)
    .await?;

    // Mark user as MFA-enabled
    sqlx::query("UPDATE users SET mfa_enabled = true WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    // Generate and store recovery codes
    let plaintext_codes = generate_recovery_codes();

    // Remove any old recovery codes for this user first
    sqlx::query("DELETE FROM mfa_recovery_codes WHERE user_id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    for code in &plaintext_codes {
        let code_hash = argon2_hash(code)?;
        sqlx::query(
            "INSERT INTO mfa_recovery_codes (id, user_id, code_hash, created_at)
             VALUES ($1, $2, $3, NOW())",
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(&code_hash)
        .execute(&state.db)
        .await?;
    }

    Ok(Json(ApiResponse::ok(VerifyEnrollmentResponse {
        recovery_codes: plaintext_codes,
    })))
}

// ---------------------------------------------------------------------------
// DELETE /auth/mfa/totp  — disable TOTP for the current user
// ---------------------------------------------------------------------------

pub async fn disable_totp(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    sqlx::query(
        "UPDATE user_mfa SET status = 'disabled'
         WHERE user_id = $1 AND mfa_type = 'totp'",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    sqlx::query("UPDATE users SET mfa_enabled = false WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    sqlx::query("DELETE FROM mfa_recovery_codes WHERE user_id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(ApiResponse::ok(
        serde_json::json!({ "message": "TOTP disabled" }),
    )))
}

// ---------------------------------------------------------------------------
// GET /auth/mfa/status
// ---------------------------------------------------------------------------

pub async fn get_mfa_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    let rows = sqlx::query(
        "SELECT mfa_type, status, verified_at FROM user_mfa WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let methods: Vec<MfaMethodStatus> = rows
        .into_iter()
        .map(|r| MfaMethodStatus {
            method_type: r.get("mfa_type"),
            status: r.get("status"),
            verified_at: r.get("verified_at"),
        })
        .collect();

    let enabled = methods.iter().any(|m| m.status == "active");

    let recovery_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mfa_recovery_codes WHERE user_id = $1 AND used_at IS NULL",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(ApiResponse::ok(MfaStatusResponse {
        enabled,
        methods,
        has_recovery_codes: recovery_count > 0,
    })))
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/challenge
// Verify TOTP code and issue a JWT for a user who passed password auth
// but has MFA enabled. Called with {user_id, code}.
// ---------------------------------------------------------------------------

pub async fn mfa_challenge(
    State(state): State<AppState>,
    Json(body): Json<MfaChallengeRequest>,
) -> IoResult<impl IntoResponse> {
    let user_id: Uuid = Uuid::parse_str(&body.user_id)
        .map_err(|_| IoError::BadRequest("Invalid user_id".to_string()))?;

    // Fetch the active TOTP record
    let row = sqlx::query(
        "SELECT secret FROM user_mfa WHERE user_id = $1 AND mfa_type = 'totp' AND status = 'active'",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::BadRequest("MFA not configured".to_string()))?;

    let secret_base32: String = row.get("secret");
    let totp = build_totp(&secret_base32)?;

    let valid = totp
        .check_current(&body.code)
        .map_err(|e| IoError::Internal(format!("totp check: {e}")))?;

    if !valid {
        metrics::counter!(
            "io_mfa_verifications_total",
            "method" => "totp",
            "result" => "failure",
        )
        .increment(1);
        return Err(IoError::BadRequest("Invalid MFA code".to_string()));
    }

    metrics::counter!(
        "io_mfa_verifications_total",
        "method" => "totp",
        "result" => "success",
    )
    .increment(1);

    // Update last_used_at
    sqlx::query(
        "UPDATE user_mfa SET last_used_at = NOW() WHERE user_id = $1 AND mfa_type = 'totp'",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    issue_jwt_for_user(&state, user_id).await
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/recover  — use a recovery code
// ---------------------------------------------------------------------------

pub async fn use_recovery_code(
    State(state): State<AppState>,
    Json(body): Json<RecoveryRequest>,
) -> IoResult<impl IntoResponse> {
    let user_id: Uuid = Uuid::parse_str(&body.user_id)
        .map_err(|_| IoError::BadRequest("Invalid user_id".to_string()))?;

    // Fetch all unused recovery codes for the user
    let rows = sqlx::query(
        "SELECT id, code_hash FROM mfa_recovery_codes
         WHERE user_id = $1 AND used_at IS NULL",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let mut matched_id: Option<Uuid> = None;
    for row in &rows {
        let code_hash: String = row.get("code_hash");
        if argon2_verify(&body.recovery_code, &code_hash)? {
            matched_id = Some(row.get("id"));
            break;
        }
    }

    let matched_id =
        matched_id.ok_or_else(|| IoError::BadRequest("Invalid recovery code".to_string()))?;

    // Mark the code as used
    sqlx::query("UPDATE mfa_recovery_codes SET used_at = NOW() WHERE id = $1")
        .bind(matched_id)
        .execute(&state.db)
        .await?;

    issue_jwt_for_user(&state, user_id).await
}

// ---------------------------------------------------------------------------
// Helper: build and return a JWT for the given user
// ---------------------------------------------------------------------------

async fn issue_jwt_for_user(
    state: &AppState,
    user_id: Uuid,
) -> IoResult<axum::response::Response> {
    let user_row = sqlx::query(
        "SELECT username, enabled FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let enabled: bool = user_row.get("enabled");
    if !enabled {
        return Err(IoError::Forbidden("Account is disabled".to_string()));
    }

    let username: String = user_row.get("username");
    let permissions = fetch_user_permissions(&state.db, user_id).await?;
    let claims = build_claims(&user_id.to_string(), &username, permissions);
    let access_token = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    let body = ApiResponse::ok(serde_json::json!({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 900u64,
    }));

    Ok(Json(body).into_response())
}
