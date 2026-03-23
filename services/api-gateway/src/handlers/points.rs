use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PageParams, PagedResponse};
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
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM point_sources")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let rows = match sqlx::query(
        "SELECT id, name, source_type, connection_config, enabled, status, \
         last_connected_at, last_error_at, last_error_message, created_at \
         FROM point_sources ORDER BY name \
         LIMIT $1 OFFSET $2",
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let sources: Vec<PointSourceRow> = rows.iter().map(row_to_source).collect();
    Json(PagedResponse::new(sources, pg, limit, total as u64)).into_response()
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

// ---------------------------------------------------------------------------
// History recovery
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateRecoveryJobRequest {
    /// ISO-8601 start of recovery window.
    pub from_time: DateTime<Utc>,
    /// ISO-8601 end of recovery window (defaults to now if omitted).
    pub to_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct RecoveryJobResponse {
    pub id: Uuid,
    pub source_id: Uuid,
    pub from_time: DateTime<Utc>,
    pub to_time: DateTime<Utc>,
    pub status: String,
    pub points_recovered: i64,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// POST /api/opc/sources/:id/history-recovery
///
/// Enqueue a manual history recovery job for an OPC UA source.
/// Requires `settings:admin` permission.
pub async fn create_history_recovery_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
    Json(body): Json<CreateRecoveryJobRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    let to_time = body.to_time.unwrap_or_else(Utc::now);

    if body.from_time >= to_time {
        return IoError::BadRequest("from_time must be before to_time".into()).into_response();
    }

    // Verify source exists.
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

    let job_id = match sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO opc_history_recovery_jobs
            (source_id, requested_by, from_time, to_time)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
    )
    .bind(source_id)
    .bind(claims.sub)
    .bind(body.from_time)
    .bind(to_time)
    .fetch_one(&state.db)
    .await
    {
        Ok(id) => id,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    (
        StatusCode::CREATED,
        Json(ApiResponse::ok(serde_json::json!({ "id": job_id }))),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/opc/sources/stats          — all sources
// GET /api/opc/sources/:id/stats      — single source
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct PointSourceStats {
    pub source_id: Uuid,
    /// Total number of configured points for this source.
    pub point_count: i64,
    /// Points that received a value update in the last 5 minutes.
    pub active_subscriptions: i64,
    /// Points that received a value update in the last 1 minute.
    pub updates_per_minute: i64,
    /// 1 if the source recorded an error in the last 24 h, 0 otherwise.
    pub error_count_24h: i64,
    /// Timestamp of the most recently written point value.
    pub last_value_at: Option<DateTime<Utc>>,
}

/// GET /api/opc/sources/stats
///
/// Returns live statistics for every point source in a single query.
/// Requires `settings:read` permission.
pub async fn list_source_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM point_sources")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let rows = match sqlx::query(
        r#"
        SELECT
            ps.id                                                                              AS source_id,
            COUNT(DISTINCT pm.id)::bigint                                                      AS point_count,
            COUNT(DISTINCT CASE WHEN pc.updated_at > NOW() - INTERVAL '5 minutes'
                                THEN pc.point_id END)::bigint                                  AS active_subscriptions,
            COUNT(DISTINCT CASE WHEN pc.updated_at > NOW() - INTERVAL '1 minute'
                                THEN pc.point_id END)::bigint                                  AS updates_per_minute,
            CASE WHEN ps.last_error_at IS NOT NULL
                  AND ps.last_error_at > NOW() - INTERVAL '24 hours'
                 THEN 1::bigint ELSE 0::bigint END                                             AS error_count_24h,
            MAX(pc.updated_at)                                                                 AS last_value_at
        FROM point_sources ps
        LEFT JOIN points_metadata pm ON pm.source_id = ps.id
        LEFT JOIN points_current  pc ON pc.point_id  = pm.id
        GROUP BY ps.id, ps.last_error_at
        ORDER BY ps.name
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let stats: Vec<PointSourceStats> = rows
        .into_iter()
        .map(|r| PointSourceStats {
            source_id:            r.get("source_id"),
            point_count:          r.get("point_count"),
            active_subscriptions: r.get("active_subscriptions"),
            updates_per_minute:   r.get("updates_per_minute"),
            error_count_24h:      r.get("error_count_24h"),
            last_value_at:        r.get("last_value_at"),
        })
        .collect();

    Json(PagedResponse::new(stats, pg, limit, total as u64)).into_response()
}

/// GET /api/opc/sources/:id/stats
///
/// Returns live statistics for a single point source.
/// Requires `settings:read` permission.
pub async fn get_source_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        WITH pts AS (
            SELECT id FROM points_metadata WHERE source_id = $1
        ),
        curr AS (
            SELECT
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '5 minutes')  AS active_5m,
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '1 minute')   AS updates_1m,
                MAX(updated_at)                                                     AS last_value_at
            FROM points_current
            WHERE point_id IN (SELECT id FROM pts)
        )
        SELECT
            $1::uuid                                              AS source_id,
            (SELECT COUNT(*) FROM pts)::bigint                    AS point_count,
            COALESCE((SELECT active_5m  FROM curr), 0)::bigint   AS active_subscriptions,
            COALESCE((SELECT updates_1m FROM curr), 0)::bigint   AS updates_per_minute,
            CASE
                WHEN ps.last_error_at IS NOT NULL
                 AND ps.last_error_at > NOW() - INTERVAL '24 hours'
                THEN 1::bigint ELSE 0::bigint
            END                                                   AS error_count_24h,
            (SELECT last_value_at FROM curr)                      AS last_value_at
        FROM point_sources ps
        WHERE ps.id = $1
        "#,
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

    let stats = PointSourceStats {
        source_id:            row.get("source_id"),
        point_count:          row.get("point_count"),
        active_subscriptions: row.get("active_subscriptions"),
        updates_per_minute:   row.get("updates_per_minute"),
        error_count_24h:      row.get("error_count_24h"),
        last_value_at:        row.get("last_value_at"),
    };

    Json(ApiResponse::ok(stats)).into_response()
}

/// GET /api/opc/sources/:id/history-recovery/jobs
///
/// List recent history recovery jobs for an OPC UA source (last 50).
/// Requires `settings:admin` permission.
pub async fn list_history_recovery_jobs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(source_id): Path<Uuid>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM opc_history_recovery_jobs WHERE source_id = $1",
    )
    .bind(source_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let rows = match sqlx::query(
        r#"
        SELECT id, source_id, from_time, to_time, status,
               points_recovered, started_at, completed_at,
               error_message, created_at
        FROM   opc_history_recovery_jobs
        WHERE  source_id = $1
        ORDER  BY created_at DESC
        LIMIT  $2 OFFSET $3
        "#,
    )
    .bind(source_id)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => rows,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let jobs: Vec<RecoveryJobResponse> = rows
        .into_iter()
        .map(|r| RecoveryJobResponse {
            id:               r.get("id"),
            source_id:        r.get("source_id"),
            from_time:        r.get("from_time"),
            to_time:          r.get("to_time"),
            status:           r.get("status"),
            points_recovered: r.get("points_recovered"),
            started_at:       r.get("started_at"),
            completed_at:     r.get("completed_at"),
            error_message:    r.get("error_message"),
            created_at:       r.get("created_at"),
        })
        .collect();

    Json(PagedResponse::new(jobs, pg, limit, total as u64)).into_response()
}
