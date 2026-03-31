use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use io_auth::{build_claims, generate_access_token};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::handlers::auth::fetch_user_permissions;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct SendCodeResponse {
    pub sent: bool,
    pub email_masked: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyCodeRequest {
    pub code: String,
    pub pending_user_id: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn sha256_hex(input: &str) -> String {
    format!("{:x}", Sha256::digest(input.as_bytes()))
}

fn mask_email(email: &str) -> String {
    // user@example.com -> u***@example.com
    if let Some(at_pos) = email.find('@') {
        let local = &email[..at_pos];
        let domain = &email[at_pos..];
        if local.is_empty() {
            return email.to_string();
        }
        let first_char = &local[..local
            .char_indices()
            .nth(1)
            .map(|(i, _)| i)
            .unwrap_or(local.len())];
        format!("{}***{}", first_char, domain)
    } else {
        email.to_string()
    }
}

fn extract_user_id(headers: &HeaderMap) -> Result<Uuid, IoError> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(IoError::Unauthorized)
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/email/send
// Sends a 6-digit code to the user's email address.
// Requires x-io-user-id header (user must be partially authenticated).
// ---------------------------------------------------------------------------

pub async fn send_email_code(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    // Fetch user's email
    let row = sqlx::query(
        "SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL AND enabled = true",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let email: Option<String> = row.get("email");
    let email = email.ok_or_else(|| IoError::BadRequest("No email address on file".to_string()))?;

    // Generate 6-digit code
    let code = format!("{:06}", rand::random::<u32>() % 1_000_000);
    let code_hash = sha256_hex(&code);

    // Expire any existing unused codes for this user + purpose
    sqlx::query(
        "UPDATE email_mfa_codes SET used = true
         WHERE user_id = $1 AND purpose = 'login' AND used = false",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Insert new code
    sqlx::query(
        "INSERT INTO email_mfa_codes (id, user_id, code_hash, purpose, used, expires_at, created_at)
         VALUES ($1, $2, $3, 'login', false, now() + interval '10 minutes', now())",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&code_hash)
    .execute(&state.db)
    .await?;

    // Call email-service to send the code
    let email_service_url = &state.config.email_service_url;
    let send_url = format!("{}/internal/send", email_service_url);

    let payload = serde_json::json!({
        "to": email,
        "subject": "Your I/O login code",
        "body": format!("Your Inside/Operations login code is: {}\n\nThis code expires in 10 minutes.", code),
        "html": format!(
            "<p>Your Inside/Operations login code is:</p><h2 style=\"letter-spacing: 4px;\">{}</h2><p>This code expires in 10 minutes.</p>",
            code
        )
    });

    // Best-effort — don't fail the request if email service is down in dev
    let client = reqwest::Client::new();
    let _ = client
        .post(&send_url)
        .header("x-io-service-secret", &state.config.service_secret)
        .json(&payload)
        .send()
        .await;

    Ok(Json(ApiResponse::ok(SendCodeResponse {
        sent: true,
        email_masked: mask_email(&email),
    })))
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/email/verify
// Verifies the 6-digit code and issues a JWT on success.
// ---------------------------------------------------------------------------

pub async fn verify_email_code(
    State(state): State<AppState>,
    Json(body): Json<VerifyCodeRequest>,
) -> IoResult<Response> {
    let user_id: Uuid = Uuid::parse_str(&body.pending_user_id)
        .map_err(|_| IoError::BadRequest("Invalid pending_user_id".to_string()))?;

    let code_hash = sha256_hex(&body.code);

    // Look up valid, unused, unexpired code
    let row = sqlx::query(
        "SELECT id FROM email_mfa_codes
         WHERE user_id = $1
           AND code_hash = $2
           AND purpose = 'login'
           AND used = false
           AND expires_at > now()",
    )
    .bind(user_id)
    .bind(&code_hash)
    .fetch_optional(&state.db)
    .await?;

    let code_row = row.ok_or_else(|| IoError::Unauthorized)?;
    let code_id: Uuid = code_row.get("id");

    // Mark code as used
    sqlx::query("UPDATE email_mfa_codes SET used = true WHERE id = $1")
        .bind(code_id)
        .execute(&state.db)
        .await?;

    // Fetch user and permissions
    let user_row =
        sqlx::query("SELECT username, enabled FROM users WHERE id = $1 AND deleted_at IS NULL")
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

    // Create a refresh token / session (reuse the same pattern as local login)
    let refresh_token = Uuid::new_v4().to_string();
    let refresh_hash = format!("{:x}", Sha256::digest(refresh_token.as_bytes()));
    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(ttl_secs);

    sqlx::query(
        "INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, '127.0.0.1'::inet, 'email-mfa')",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&refresh_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    let body = ApiResponse::ok(serde_json::json!({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 900u64,
    }));

    let cookie = format!(
        "refresh_token={refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .parse()
            .map_err(|_| IoError::Internal("cookie encoding error".to_string()))?,
    );

    Ok(response)
}
