use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row;
use tracing::warn;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct SettingRow {
    pub key: String,
    pub value: Value,
    pub description: Option<String>,
    pub is_public: bool,
    pub requires_restart: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingRequest {
    pub value: Value,
}

// ---------------------------------------------------------------------------
// Service-secret guard
// ---------------------------------------------------------------------------

fn check_service_secret(headers: &HeaderMap, expected: &str) -> IoResult<()> {
    let provided = headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != expected {
        warn!("settings endpoint called with invalid or missing x-io-service-secret");
        return Err(IoError::Forbidden("Invalid service secret".to_string()));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// GET /settings
// Returns all settings ordered by key.
// ---------------------------------------------------------------------------

pub async fn list_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    let rows = sqlx::query(
        "SELECT key, value, description, is_public, requires_restart, updated_at
         FROM settings
         ORDER BY key",
    )
    .fetch_all(&state.db)
    .await?;

    let settings: Vec<SettingRow> = rows
        .into_iter()
        .map(|r| SettingRow {
            key: r.get("key"),
            value: r.get("value"),
            description: r.get("description"),
            is_public: r.get("is_public"),
            requires_restart: r.get("requires_restart"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(settings)))
}

// ---------------------------------------------------------------------------
// PUT /settings/:key
// Updates the value of a single setting.
// ---------------------------------------------------------------------------

pub async fn update_setting(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key): Path<String>,
    Json(body): Json<UpdateSettingRequest>,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    let row = sqlx::query(
        "UPDATE settings
         SET value = $1, updated_at = NOW()
         WHERE key = $2
         RETURNING key, value, description, is_public, requires_restart, updated_at",
    )
    .bind(&body.value)
    .bind(&key)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| IoError::NotFound(format!("Setting '{}' not found", key)))?;

    let setting = SettingRow {
        key: row.get("key"),
        value: row.get("value"),
        description: row.get("description"),
        is_public: row.get("is_public"),
        requires_restart: row.get("requires_restart"),
        updated_at: row.get("updated_at"),
    };

    Ok(Json(ApiResponse::ok(setting)))
}
