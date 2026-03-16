use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Response / request types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct PointSourceRow {
    pub id: Uuid,
    pub name: String,
    pub source_type: String,
    pub endpoint_url: String,
    pub security_policy: String,
    pub security_mode: String,
    pub username: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub last_connected_at: Option<DateTime<Utc>>,
    pub last_error_at: Option<DateTime<Utc>>,
    pub last_error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePointSourceRequest {
    pub name: String,
    pub source_type: Option<String>,
    pub endpoint_url: String,
    pub security_policy: Option<String>,
    pub security_mode: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePointSourceRequest {
    pub name: Option<String>,
    pub endpoint_url: Option<String>,
    pub enabled: Option<bool>,
    pub security_policy: Option<String>,
    pub security_mode: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper: extract endpoint_url from connection_config JSONB
// ---------------------------------------------------------------------------

fn endpoint_url_from_config(config: &JsonValue) -> String {
    config
        .get("endpoint_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn str_from_config<'a>(config: &'a JsonValue, key: &str) -> Option<&'a str> {
    config.get(key).and_then(|v| v.as_str())
}

fn row_to_source(r: &sqlx::postgres::PgRow) -> PointSourceRow {
    let config: JsonValue = r.get("connection_config");
    PointSourceRow {
        id: r.get("id"),
        name: r.get("name"),
        source_type: r.get("source_type"),
        endpoint_url: endpoint_url_from_config(&config),
        security_policy: str_from_config(&config, "security_policy")
            .unwrap_or("None")
            .to_string(),
        security_mode: str_from_config(&config, "security_mode")
            .unwrap_or("None")
            .to_string(),
        username: str_from_config(&config, "username")
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
        enabled: r.get("enabled"),
        status: r.get("status"),
        last_connected_at: r.get("last_connected_at"),
        last_error_at: r.get("last_error_at"),
        last_error_message: r.get("last_error_message"),
        created_at: r.get("created_at"),
    }
}

// ---------------------------------------------------------------------------
// GET /api/points/sources
// ---------------------------------------------------------------------------

pub async fn list_sources(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    let rows = match sqlx::query(
        "SELECT id, name, source_type, connection_config, enabled, status, \
         last_connected_at, last_error_at, last_error_message, created_at \
         FROM point_sources ORDER BY name",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let sources: Vec<PointSourceRow> = rows.iter().map(row_to_source).collect();
    Json(ApiResponse::ok(sources)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/points/sources/:id
// ---------------------------------------------------------------------------

pub async fn get_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        "SELECT id, name, source_type, connection_config, enabled, status, \
         last_connected_at, last_error_at, last_error_message, created_at \
         FROM point_sources WHERE id = $1",
    )
    .bind(source_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Point source {} not found", source_id))
                .into_response()
        }
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    Json(ApiResponse::ok(row_to_source(&row))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/points/sources
// ---------------------------------------------------------------------------

pub async fn create_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreatePointSourceRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    if req.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }
    if req.endpoint_url.trim().is_empty() {
        return IoError::BadRequest("endpoint_url is required".into()).into_response();
    }

    let config = serde_json::json!({
        "endpoint_url": req.endpoint_url.trim(),
        "security_policy": req.security_policy.unwrap_or_else(|| "None".to_string()),
        "security_mode": req.security_mode.unwrap_or_else(|| "None".to_string()),
        "username": req.username,
        "password": req.password,
    });

    let source_type = req
        .source_type
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "opc_ua".to_string());

    let id = Uuid::new_v4();
    let row = match sqlx::query(
        "INSERT INTO point_sources (id, name, source_type, connection_config) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, name, source_type, connection_config, enabled, status, \
                   last_connected_at, last_error_at, last_error_message, created_at",
    )
    .bind(id)
    .bind(req.name.trim())
    .bind(&source_type)
    .bind(&config)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = e.to_string();
            return if msg.contains("uq_point_sources_name") {
                IoError::Conflict(format!("A source named '{}' already exists", req.name))
                    .into_response()
            } else {
                IoError::Internal(msg).into_response()
            };
        }
    };

    (StatusCode::CREATED, Json(ApiResponse::ok(row_to_source(&row)))).into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/points/sources/:id
// ---------------------------------------------------------------------------

pub async fn update_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
    Json(req): Json<UpdatePointSourceRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    // Fetch existing config so we can merge fields
    let existing = match sqlx::query(
        "SELECT connection_config FROM point_sources WHERE id = $1",
    )
    .bind(source_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Point source {} not found", source_id))
                .into_response()
        }
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let mut config: serde_json::Map<String, JsonValue> = existing
        .get::<JsonValue, _>("connection_config")
        .as_object()
        .cloned()
        .unwrap_or_default();

    if let Some(url) = &req.endpoint_url {
        config.insert("endpoint_url".to_string(), JsonValue::String(url.clone()));
    }
    if let Some(sp) = &req.security_policy {
        config.insert("security_policy".to_string(), JsonValue::String(sp.clone()));
    }
    if let Some(sm) = &req.security_mode {
        config.insert("security_mode".to_string(), JsonValue::String(sm.clone()));
    }
    if let Some(u) = &req.username {
        config.insert("username".to_string(), JsonValue::String(u.clone()));
    }
    if let Some(p) = &req.password {
        config.insert("password".to_string(), JsonValue::String(p.clone()));
    }

    let config_val = JsonValue::Object(config);

    if let Some(name) = &req.name {
        if let Err(e) = sqlx::query(
            "UPDATE point_sources SET name = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(name.trim())
        .bind(source_id)
        .execute(&state.db)
        .await
        {
            return IoError::Internal(e.to_string()).into_response();
        }
    }
    if let Some(enabled) = req.enabled {
        if let Err(e) = sqlx::query(
            "UPDATE point_sources SET enabled = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(enabled)
        .bind(source_id)
        .execute(&state.db)
        .await
        {
            return IoError::Internal(e.to_string()).into_response();
        }
    }

    let row = match sqlx::query(
        "UPDATE point_sources SET connection_config = $1, updated_at = NOW() WHERE id = $2 \
         RETURNING id, name, source_type, connection_config, enabled, status, \
                   last_connected_at, last_error_at, last_error_message, created_at",
    )
    .bind(&config_val)
    .bind(source_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    Json(ApiResponse::ok(row_to_source(&row))).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/points/sources/:id
// ---------------------------------------------------------------------------

pub async fn delete_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    let result = match sqlx::query("DELETE FROM point_sources WHERE id = $1")
        .bind(source_id)
        .execute(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    if result.rows_affected() == 0 {
        return IoError::NotFound(format!("Point source {} not found", source_id)).into_response();
    }

    StatusCode::NO_CONTENT.into_response()
}

// ---------------------------------------------------------------------------
// POST /api/opc/sources/:id/reconnect
// ---------------------------------------------------------------------------

/// Trigger an immediate reconnect attempt for an OPC UA source.
///
/// Forwards the signal to the opc-service's internal HTTP endpoint, which
/// wakes the driver task out of its backoff sleep.
pub async fn reconnect_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    // Verify the source exists.
    let exists = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM point_sources WHERE id = $1 AND source_type = 'opc_ua')",
    )
    .bind(source_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(v) => v,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    if !exists {
        return IoError::NotFound(format!("OPC UA source {} not found", source_id)).into_response();
    }

    // Forward to opc-service internal endpoint.
    let opc_port = std::env::var("OPC_SERVICE_PORT").unwrap_or_else(|_| "3002".to_string());
    let url = format!("http://127.0.0.1:{}/internal/reconnect/{}", opc_port, source_id);

    let client = reqwest::Client::new();
    match client.post(&url).send().await {
        Ok(resp) if resp.status().is_success() || resp.status() == reqwest::StatusCode::NO_CONTENT => {
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(resp) if resp.status() == reqwest::StatusCode::NOT_FOUND => {
            // Source not yet tracked by opc-service (newly created or disabled) — not an error.
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(resp) => {
            IoError::Internal(format!("opc-service returned {}", resp.status())).into_response()
        }
        Err(e) => {
            // opc-service may not be running; treat as non-fatal.
            tracing::warn!(error = %e, "Failed to reach opc-service for reconnect (non-fatal)");
            StatusCode::NO_CONTENT.into_response()
        }
    }
}
