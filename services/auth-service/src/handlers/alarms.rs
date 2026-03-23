/// Alarm Definition CRUD.
///
/// The `alarm_definitions` table schema (migration 23):
///   id, name, description, point_id, definition_type (threshold|expression),
///   threshold_config (JSONB), expression_id, priority (alarm_priority_enum),
///   enabled, created_by, updated_by, created_at, updated_at, deleted_at
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::{ApiResponse, PageParams, PagedResponse};

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helpers (re-use same pattern as expressions.rs)
// ---------------------------------------------------------------------------

fn user_id_from_headers(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

fn has_permission(headers: &HeaderMap, perm: &str) -> bool {
    headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .map(|perms| perms.split(',').any(|p| p.trim() == "*" || p.trim() == perm))
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct AlarmDefinitionRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub point_id: Option<Uuid>,
    pub definition_type: String,
    pub threshold_config: Option<JsonValue>,
    pub expression_id: Option<Uuid>,
    pub priority: String,
    pub enabled: bool,
    pub created_by: Uuid,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn map_row(r: &sqlx::postgres::PgRow) -> Result<AlarmDefinitionRow, sqlx::Error> {
    Ok(AlarmDefinitionRow {
        id: r.try_get("id")?,
        name: r.try_get("name")?,
        description: r.try_get("description")?,
        point_id: r.try_get("point_id")?,
        definition_type: r.try_get("definition_type")?,
        threshold_config: r.try_get("threshold_config")?,
        expression_id: r.try_get("expression_id")?,
        priority: r.try_get("priority")?,
        enabled: r.try_get("enabled")?,
        created_by: r.try_get("created_by")?,
        updated_by: r.try_get("updated_by")?,
        created_at: r.try_get("created_at")?,
        updated_at: r.try_get("updated_at")?,
    })
}

const SELECT_COLS: &str =
    "id, name, description, point_id, definition_type, threshold_config,
     expression_id, priority::text AS priority, enabled, created_by, updated_by,
     created_at, updated_at";

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateAlarmDefinitionRequest {
    pub name: String,
    pub description: Option<String>,
    pub point_id: Option<Uuid>,
    /// "threshold" or "expression"
    pub definition_type: String,
    /// Required when definition_type = "threshold". Stores hh/h/l/ll config as JSON:
    /// { "hh": { "enabled": true, "threshold": 100.0, "deadband": 1.0 }, ... }
    pub threshold_config: Option<JsonValue>,
    /// Required when definition_type = "expression".
    pub expression_id: Option<Uuid>,
    /// ISA-18.2 priority: urgent | high | medium | low | diagnostic
    pub priority: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAlarmDefinitionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub point_id: Option<Uuid>,
    pub definition_type: Option<String>,
    pub threshold_config: Option<JsonValue>,
    pub expression_id: Option<Uuid>,
    pub priority: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AlarmDefinitionFilter {
    #[serde(flatten)]
    pub page: PageParams,
    pub point_id: Option<Uuid>,
    pub enabled: Option<bool>,
    pub definition_type: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /alarm-definitions
// ---------------------------------------------------------------------------

pub async fn list_alarm_definitions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<AlarmDefinitionFilter>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::Unauthorized)?;

    let page = filter.page.page();
    let limit = filter.page.per_page();
    let offset = filter.page.offset();

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM alarm_definitions
         WHERE deleted_at IS NULL
           AND ($1::uuid IS NULL OR point_id = $1)
           AND ($2::boolean IS NULL OR enabled = $2)
           AND ($3::text IS NULL OR definition_type = $3)",
    )
    .bind(filter.point_id)
    .bind(filter.enabled)
    .bind(filter.definition_type.as_deref())
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<i64, _>(0))?;

    let rows = sqlx::query(&format!(
        "SELECT {SELECT_COLS}
         FROM alarm_definitions
         WHERE deleted_at IS NULL
           AND ($1::uuid IS NULL OR point_id = $1)
           AND ($2::boolean IS NULL OR enabled = $2)
           AND ($3::text IS NULL OR definition_type = $3)
         ORDER BY created_at DESC
         LIMIT $4 OFFSET $5"
    ))
    .bind(filter.point_id)
    .bind(filter.enabled)
    .bind(filter.definition_type.as_deref())
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<AlarmDefinitionRow> = rows
        .iter()
        .filter_map(|r| match map_row(r) {
            Ok(a) => Some(a),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed alarm_definition row");
                None
            }
        })
        .collect();

    Ok(Json(PagedResponse::new(items, page, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// GET /alarm-definitions/:id
// ---------------------------------------------------------------------------

pub async fn get_alarm_definition(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::Unauthorized)?;

    let row = sqlx::query(&format!(
        "SELECT {SELECT_COLS} FROM alarm_definitions WHERE id = $1 AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Alarm definition {id} not found")))?;

    let def = map_row(&row).map_err(IoError::Database)?;
    Ok(Json(ApiResponse::ok(def)))
}

// ---------------------------------------------------------------------------
// POST /alarm-definitions
// ---------------------------------------------------------------------------

pub async fn create_alarm_definition(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateAlarmDefinitionRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::Unauthorized)?;

    if !has_permission(&headers, "alarms:write") {
        return Err(IoError::Forbidden("alarms:write permission required".into()));
    }

    if req.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".into()));
    }

    let valid_types = ["threshold", "expression"];
    if !valid_types.contains(&req.definition_type.as_str()) {
        return Err(IoError::BadRequest(
            "definition_type must be 'threshold' or 'expression'".into(),
        ));
    }

    if req.definition_type == "threshold" && req.threshold_config.is_none() {
        return Err(IoError::BadRequest(
            "threshold_config is required for threshold alarm definitions".into(),
        ));
    }

    if req.definition_type == "expression" && req.expression_id.is_none() {
        return Err(IoError::BadRequest(
            "expression_id is required for expression alarm definitions".into(),
        ));
    }

    let priority = req
        .priority
        .unwrap_or_else(|| "low".to_string());
    let valid_priorities = ["urgent", "high", "medium", "low", "diagnostic"];
    if !valid_priorities.contains(&priority.as_str()) {
        return Err(IoError::BadRequest(
            "priority must be one of: urgent, high, medium, low, diagnostic".into(),
        ));
    }

    let new_id = Uuid::new_v4();
    let enabled = req.enabled.unwrap_or(true);

    sqlx::query(
        "INSERT INTO alarm_definitions
             (id, name, description, point_id, definition_type, threshold_config,
              expression_id, priority, enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::alarm_priority_enum, $9, $10)",
    )
    .bind(new_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(req.point_id)
    .bind(&req.definition_type)
    .bind(&req.threshold_config)
    .bind(req.expression_id)
    .bind(&priority)
    .bind(enabled)
    .bind(caller)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(&format!(
        "SELECT {SELECT_COLS} FROM alarm_definitions WHERE id = $1"
    ))
    .bind(new_id)
    .fetch_one(&state.db)
    .await?;

    let def = map_row(&row).map_err(IoError::Database)?;
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(def))))
}

// ---------------------------------------------------------------------------
// PUT /alarm-definitions/:id
// ---------------------------------------------------------------------------

pub async fn update_alarm_definition(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAlarmDefinitionRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::Unauthorized)?;

    if !has_permission(&headers, "alarms:write") {
        return Err(IoError::Forbidden("alarms:write permission required".into()));
    }

    // Verify exists
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM alarm_definitions WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    if !exists {
        return Err(IoError::NotFound(format!("Alarm definition {id} not found")));
    }

    if let Some(name) = &req.name {
        if name.trim().is_empty() {
            return Err(IoError::BadRequest("name must not be empty".into()));
        }
        sqlx::query(
            "UPDATE alarm_definitions SET name = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(name)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(description) = &req.description {
        sqlx::query(
            "UPDATE alarm_definitions SET description = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(description)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(point_id) = req.point_id {
        sqlx::query(
            "UPDATE alarm_definitions SET point_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(point_id)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(def_type) = &req.definition_type {
        let valid_types = ["threshold", "expression"];
        if !valid_types.contains(&def_type.as_str()) {
            return Err(IoError::BadRequest(
                "definition_type must be 'threshold' or 'expression'".into(),
            ));
        }
        sqlx::query(
            "UPDATE alarm_definitions SET definition_type = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(def_type)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(tc) = &req.threshold_config {
        sqlx::query(
            "UPDATE alarm_definitions SET threshold_config = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(tc)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(expr_id) = req.expression_id {
        sqlx::query(
            "UPDATE alarm_definitions SET expression_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(expr_id)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(priority) = &req.priority {
        let valid_priorities = ["urgent", "high", "medium", "low", "diagnostic"];
        if !valid_priorities.contains(&priority.as_str()) {
            return Err(IoError::BadRequest(
                "priority must be one of: urgent, high, medium, low, diagnostic".into(),
            ));
        }
        sqlx::query(
            "UPDATE alarm_definitions SET priority = $1::alarm_priority_enum, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(priority)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(enabled) = req.enabled {
        sqlx::query(
            "UPDATE alarm_definitions SET enabled = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(enabled)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    get_alarm_definition(State(state), headers, Path(id)).await
}

// ---------------------------------------------------------------------------
// DELETE /alarm-definitions/:id  (soft delete)
// ---------------------------------------------------------------------------

pub async fn delete_alarm_definition(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::Unauthorized)?;

    if !has_permission(&headers, "alarms:write") {
        return Err(IoError::Forbidden("alarms:write permission required".into()));
    }

    let result = sqlx::query(
        "UPDATE alarm_definitions
         SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL",
    )
    .bind(caller)
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!("Alarm definition {id} not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}
