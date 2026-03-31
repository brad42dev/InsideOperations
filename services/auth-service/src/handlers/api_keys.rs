use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_user_id(headers: &HeaderMap) -> Result<Uuid, IoError> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(IoError::Unauthorized)
}

/// Generate a random API key of the form `io_<64 hex chars>`.
fn generate_api_key() -> String {
    let bytes: [u8; 32] = rand::random();
    let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
    format!("io_{}", hex)
}

/// Argon2id hash of a string (used for storing the full API key hash).
fn hash_key(key: &str) -> IoResult<String> {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(key.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| IoError::Internal(format!("argon2 hash: {e}")))
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ApiKeyRow {
    pub id: Uuid,
    pub name: String,
    pub key_prefix: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CreateApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub key: String,
    pub key_prefix: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Option<Vec<String>>,
    pub expires_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// GET /api-keys  — list caller's API keys (no hashes returned)
// ---------------------------------------------------------------------------

pub async fn list_api_keys(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    let rows = sqlx::query(
        "SELECT id, name, key_prefix, scopes, expires_at, last_used_at, created_at
         FROM api_keys
         WHERE user_id = $1
         ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let keys: Vec<ApiKeyRow> = rows
        .into_iter()
        .map(|r| {
            // scopes is TEXT[] in the database
            let scopes: Vec<String> = r
                .get::<Option<Vec<String>>, _>("scopes")
                .unwrap_or_default();

            ApiKeyRow {
                id: r.get("id"),
                name: r.get("name"),
                key_prefix: r.get("key_prefix"),
                scopes,
                expires_at: r.get("expires_at"),
                last_used_at: r.get("last_used_at"),
                created_at: r.get("created_at"),
            }
        })
        .collect();

    Ok(Json(ApiResponse::ok(keys)))
}

// ---------------------------------------------------------------------------
// POST /api-keys  — create a new API key
// Returns the plaintext key ONCE — not stored, not repeatable.
// ---------------------------------------------------------------------------

pub async fn create_api_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateApiKeyRequest>,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    if body.name.trim().is_empty() {
        return Err(IoError::BadRequest("API key name is required".to_string()));
    }

    let key = generate_api_key();
    // key_prefix: first 8 chars — "io_xxxxx" (io_ + 5 hex chars)
    let key_prefix = key.chars().take(8).collect::<String>();
    let key_hash = hash_key(&key)?;
    let scopes = body.scopes.unwrap_or_default();
    let new_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes, expires_at, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7, NOW(), $2)",
    )
    .bind(new_id)
    .bind(user_id)
    .bind(&body.name)
    .bind(&key_hash)
    .bind(&key_prefix)
    .bind(&scopes)
    .bind(body.expires_at)
    .execute(&state.db)
    .await?;

    Ok(Json(ApiResponse::ok(CreateApiKeyResponse {
        id: new_id,
        name: body.name,
        key,
        key_prefix,
        scopes,
        expires_at: body.expires_at,
    })))
}

// ---------------------------------------------------------------------------
// DELETE /api-keys/:id  — revoke an API key (only the owner's own keys)
// ---------------------------------------------------------------------------

pub async fn delete_api_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    let result = sqlx::query("DELETE FROM api_keys WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound("API key not found".to_string()));
    }

    Ok(Json(ApiResponse::ok(
        serde_json::json!({ "message": "API key deleted" }),
    )))
}
