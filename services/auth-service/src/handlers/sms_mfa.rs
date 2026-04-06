//! SMS MFA handlers — send/verify OTP codes via configured SMS provider,
//! plus admin CRUD for SMS provider configuration.

use axum::{
    extract::{Path, State},
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
pub struct SendSmsResponse {
    pub sent: bool,
    pub phone_masked: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifySmsCodeRequest {
    pub code: String,
    pub pending_user_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSmsProviderBody {
    pub name: String,
    pub provider_type: String,
    pub enabled: Option<bool>,
    pub is_default: Option<bool>,
    pub config: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn sha256_hex(input: &str) -> String {
    format!("{:x}", Sha256::digest(input.as_bytes()))
}

fn mask_phone(phone: &str) -> String {
    if phone.len() <= 4 {
        return "****".to_string();
    }
    let suffix = &phone[phone.len() - 4..];
    format!("****{}", suffix)
}

fn extract_user_id(headers: &HeaderMap) -> Result<Uuid, IoError> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(IoError::Unauthorized)
}

fn has_system_configure(headers: &HeaderMap) -> bool {
    headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .map(|perms| {
            perms
                .split(',')
                .any(|p| p.trim() == "system:configure" || p.trim() == "*")
        })
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/sms/send
// Sends a 6-digit OTP to the user's stored phone number.
// Requires x-io-user-id header (user is partially authenticated).
// ---------------------------------------------------------------------------

pub async fn send_sms_code(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    // Look up user's phone
    let row = sqlx::query(
        "SELECT phone_number FROM users WHERE id = $1 AND deleted_at IS NULL AND enabled = true",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let phone: Option<String> = row.get("phone_number");
    let phone = phone.filter(|p| !p.is_empty()).ok_or_else(|| {
        IoError::BadRequest("No phone number on file. Contact your administrator.".to_string())
    })?;

    // Generate 6-digit code
    let code = format!("{:06}", rand::random::<u32>() % 1_000_000);
    let code_hash = sha256_hex(&code);

    // Expire any existing unused codes for this user
    sqlx::query(
        "UPDATE sms_mfa_codes SET used = true
         WHERE user_id = $1 AND purpose = 'login' AND used = false",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Insert new code
    sqlx::query(
        "INSERT INTO sms_mfa_codes (id, user_id, phone_number, code_hash, purpose, used, expires_at, created_at)
         VALUES ($1, $2, $3, $4, 'login', false, now() + interval '10 minutes', now())",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&phone)
    .bind(&code_hash)
    .execute(&state.db)
    .await?;

    // Load SMS provider and send
    let provider = crate::sms::load_default_provider(&state.db)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "No SMS provider configured");
            IoError::Internal("SMS provider not configured".to_string())
        })?;

    let message = format!("Your I/O login code: {}. Valid for 10 minutes.", code);
    crate::sms::send_sms(&state.http, &provider, &phone, &message)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SMS send failed");
            IoError::Internal("Failed to send SMS".to_string())
        })?;

    Ok(Json(ApiResponse::ok(SendSmsResponse {
        sent: true,
        phone_masked: mask_phone(&phone),
    })))
}

// ---------------------------------------------------------------------------
// POST /auth/mfa/sms/verify
// Verifies the 6-digit code and issues a JWT + refresh token on success.
// ---------------------------------------------------------------------------

pub async fn verify_sms_code(
    State(state): State<AppState>,
    Json(body): Json<VerifySmsCodeRequest>,
) -> IoResult<Response> {
    let user_id = Uuid::parse_str(&body.pending_user_id)
        .map_err(|_| IoError::BadRequest("Invalid pending_user_id".to_string()))?;

    let code_hash = sha256_hex(&body.code);

    // Look up a valid, unused, unexpired code
    let code_row = sqlx::query(
        "SELECT id FROM sms_mfa_codes
         WHERE user_id = $1
           AND code_hash = $2
           AND purpose = 'login'
           AND used = false
           AND expires_at > now()",
    )
    .bind(user_id)
    .bind(&code_hash)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let code_id: Uuid = code_row.get("id");

    // Mark code as used
    sqlx::query("UPDATE sms_mfa_codes SET used = true WHERE id = $1")
        .bind(code_id)
        .execute(&state.db)
        .await?;

    // Fetch user
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

    // Create a refresh session
    let refresh_token = Uuid::new_v4().to_string();
    let refresh_hash = format!("{:x}", sha2::Sha256::digest(refresh_token.as_bytes()));
    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(ttl_secs);

    sqlx::query(
        "INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, '127.0.0.1'::inet, 'sms-mfa')",
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

// ---------------------------------------------------------------------------
// GET /auth/sms-providers  (requires system:configure)
// ---------------------------------------------------------------------------

pub async fn list_sms_providers(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    if !has_system_configure(&headers) {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    let rows = sqlx::query(
        "SELECT id::text, name, provider_type, enabled, is_default,
                config, last_tested_at, last_test_ok, created_at
         FROM sms_providers ORDER BY created_at",
    )
    .fetch_all(&state.db)
    .await?;

    let providers: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let mut config: serde_json::Value = r.try_get("config").unwrap_or_default();
            // Mask auth_token so it is never sent to the browser
            if let Some(obj) = config.as_object_mut() {
                if obj.contains_key("auth_token") {
                    obj.insert(
                        "auth_token".to_string(),
                        serde_json::Value::String("***".to_string()),
                    );
                }
            }
            serde_json::json!({
                "id":            r.try_get::<String, _>("id").unwrap_or_default(),
                "name":          r.try_get::<String, _>("name").unwrap_or_default(),
                "provider_type": r.try_get::<String, _>("provider_type").unwrap_or_default(),
                "enabled":       r.try_get::<bool, _>("enabled").unwrap_or(false),
                "is_default":    r.try_get::<bool, _>("is_default").unwrap_or(false),
                "config":        config,
                "last_tested_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_tested_at").ok().flatten(),
                "last_test_ok":  r.try_get::<Option<bool>, _>("last_test_ok").ok().flatten(),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(providers)))
}

// ---------------------------------------------------------------------------
// POST /auth/sms-providers  (requires system:configure)
// ---------------------------------------------------------------------------

pub async fn create_sms_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateSmsProviderBody>,
) -> IoResult<impl IntoResponse> {
    if !has_system_configure(&headers) {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    let row = sqlx::query(
        "INSERT INTO sms_providers (name, provider_type, enabled, is_default, config)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id::text, name, provider_type, enabled, is_default",
    )
    .bind(&body.name)
    .bind(&body.provider_type)
    .bind(body.enabled.unwrap_or(false))
    .bind(body.is_default.unwrap_or(false))
    .bind(&body.config)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id":            row.try_get::<String, _>("id").unwrap_or_default(),
        "name":          row.try_get::<String, _>("name").unwrap_or_default(),
        "provider_type": row.try_get::<String, _>("provider_type").unwrap_or_default(),
        "enabled":       row.try_get::<bool, _>("enabled").unwrap_or(false),
        "is_default":    row.try_get::<bool, _>("is_default").unwrap_or(false),
    }))))
}

// ---------------------------------------------------------------------------
// PUT /auth/sms-providers/:id  (requires system:configure)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct UpdateSmsProviderBody {
    pub name: Option<String>,
    pub provider_type: Option<String>,
    pub enabled: Option<bool>,
    pub is_default: Option<bool>,
    pub config: Option<serde_json::Value>,
}

pub async fn update_sms_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSmsProviderBody>,
) -> IoResult<impl IntoResponse> {
    if !has_system_configure(&headers) {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    // If config contains auth_token = "***", preserve the existing value
    let config_to_save = if let Some(mut config) = body.config.clone() {
        if let Some(obj) = config.as_object_mut() {
            if obj.get("auth_token").and_then(|v| v.as_str()) == Some("***") {
                let existing_row = sqlx::query("SELECT config FROM sms_providers WHERE id = $1")
                    .bind(id)
                    .fetch_optional(&state.db)
                    .await?;
                if let Some(row) = existing_row {
                    if let Ok(ec) = row.try_get::<serde_json::Value, _>("config") {
                        if let Some(existing_token) = ec.get("auth_token") {
                            obj.insert("auth_token".to_string(), existing_token.clone());
                        }
                    }
                }
            }
        }
        Some(config)
    } else {
        None
    };

    sqlx::query(
        "UPDATE sms_providers SET
            name = COALESCE($2, name),
            provider_type = COALESCE($3, provider_type),
            enabled = COALESCE($4, enabled),
            is_default = COALESCE($5, is_default),
            config = COALESCE($6, config),
            updated_at = now()
         WHERE id = $1",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.provider_type)
    .bind(body.enabled)
    .bind(body.is_default)
    .bind(&config_to_save)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(
        "SELECT id::text, name, provider_type, enabled, is_default, config, last_tested_at, last_test_ok
         FROM sms_providers WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let mut config: serde_json::Value = row.try_get("config").unwrap_or_default();
    if let Some(obj) = config.as_object_mut() {
        if obj.contains_key("auth_token") {
            obj.insert("auth_token".to_string(), serde_json::Value::String("***".to_string()));
        }
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id":            row.try_get::<String, _>("id").unwrap_or_default(),
        "name":          row.try_get::<String, _>("name").unwrap_or_default(),
        "provider_type": row.try_get::<String, _>("provider_type").unwrap_or_default(),
        "enabled":       row.try_get::<bool, _>("enabled").unwrap_or(false),
        "is_default":    row.try_get::<bool, _>("is_default").unwrap_or(false),
        "config":        config,
        "last_tested_at": row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_tested_at").ok().flatten(),
        "last_test_ok":  row.try_get::<Option<bool>, _>("last_test_ok").ok().flatten(),
    }))))
}

// ---------------------------------------------------------------------------
// POST /auth/sms-providers/:id/test  (requires system:configure)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct TestSmsProviderBody {
    pub to_number: String,
}

pub async fn test_sms_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<TestSmsProviderBody>,
) -> IoResult<impl IntoResponse> {
    if !has_system_configure(&headers) {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    let row = sqlx::query(
        "SELECT id::text, provider_type, config FROM sms_providers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound("SMS provider not found".to_string()))?;

    let provider = crate::sms::SmsProvider {
        id: row.try_get("id").unwrap_or_default(),
        provider_type: row.try_get("provider_type").unwrap_or_default(),
        config: row.try_get("config").unwrap_or_default(),
    };

    let message = "This is a test message from I/O — SMS provider connectivity confirmed.";
    let result = crate::sms::send_sms(&state.http, &provider, &body.to_number, message).await;
    let ok = result.is_ok();
    let error_msg = result.err().map(|e| e.to_string());

    sqlx::query(
        "UPDATE sms_providers SET last_tested_at = now(), last_test_ok = $2 WHERE id = $1",
    )
    .bind(id)
    .bind(ok)
    .execute(&state.db)
    .await?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "tested": true,
        "ok": ok,
        "error": error_msg,
    }))))
}

// ---------------------------------------------------------------------------
// DELETE /auth/sms-providers/:id  (requires system:configure)
// ---------------------------------------------------------------------------

pub async fn delete_sms_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    if !has_system_configure(&headers) {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    sqlx::query("DELETE FROM sms_providers WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(ApiResponse::ok(serde_json::json!({"deleted": true}))))
}
