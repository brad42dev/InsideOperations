//! Rounds module handlers — templates, schedules, instances, responses, and history.

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
// Permission helpers
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

fn user_id_from_claims(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct RoundTemplateRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub version: i32,
    pub checkpoints: JsonValue,
    pub is_active: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RoundScheduleRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub template_name: Option<String>,
    pub recurrence_type: String,
    pub recurrence_config: JsonValue,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct RoundInstanceRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub template_name: Option<String>,
    pub status: String,
    pub locked_to_user: Option<Uuid>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub due_by: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RoundResponseRow {
    pub id: Uuid,
    pub instance_id: Uuid,
    pub checkpoint_index: i32,
    pub response_type: String,
    pub response_value: JsonValue,
    pub calculated_value: Option<f64>,
    pub is_out_of_range: bool,
    pub alarm_triggered: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RoundInstanceDetail {
    #[serde(flatten)]
    pub instance: RoundInstanceRow,
    pub template: Option<RoundTemplateRow>,
    pub responses: Vec<RoundResponseRow>,
}

#[derive(Debug, Serialize)]
pub struct RoundHistoryRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub template_name: String,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub due_by: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub response_count: i64,
    pub out_of_range_count: i64,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub checkpoints: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub template_id: Uuid,
    pub recurrence_type: String,
    pub recurrence_config: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub recurrence_type: Option<String>,
    pub recurrence_config: Option<JsonValue>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListInstancesParams {
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct ListTemplatesParams {
    pub is_active: Option<bool>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct HistoryParams {
    pub template_id: Option<Uuid>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct SaveResponsesRequest {
    pub responses: Vec<ResponseItem>,
}

#[derive(Debug, Deserialize)]
pub struct ResponseItem {
    pub checkpoint_index: i32,
    pub response_type: String,
    pub response_value: JsonValue,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub barcode_scanned: Option<String>,
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

pub(crate) fn row_to_template(row: &sqlx::postgres::PgRow) -> Result<RoundTemplateRow, sqlx::Error> {
    Ok(RoundTemplateRow {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        description: row.try_get("description").ok().flatten(),
        version: row.try_get("version").unwrap_or(1),
        checkpoints: row
            .try_get("checkpoints")
            .unwrap_or(JsonValue::Array(vec![])),
        is_active: row.try_get("is_active").unwrap_or(true),
        created_by: row.try_get("created_by")?,
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_schedule(row: &sqlx::postgres::PgRow) -> Result<RoundScheduleRow, sqlx::Error> {
    Ok(RoundScheduleRow {
        id: row.try_get("id")?,
        template_id: row.try_get("template_id")?,
        template_name: row.try_get("template_name").ok().flatten(),
        recurrence_type: row.try_get("recurrence_type")?,
        recurrence_config: row
            .try_get("recurrence_config")
            .unwrap_or(JsonValue::Object(serde_json::Map::new())),
        is_active: row.try_get("is_active").unwrap_or(true),
    })
}

pub(crate) fn row_to_instance(row: &sqlx::postgres::PgRow) -> Result<RoundInstanceRow, sqlx::Error> {
    Ok(RoundInstanceRow {
        id: row.try_get("id")?,
        template_id: row.try_get("template_id")?,
        template_name: row.try_get("template_name").ok().flatten(),
        status: row.try_get("status")?,
        locked_to_user: row.try_get("locked_to_user").ok().flatten(),
        started_at: row.try_get("started_at").ok().flatten(),
        completed_at: row.try_get("completed_at").ok().flatten(),
        due_by: row.try_get("due_by").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

pub(crate) fn row_to_response(row: &sqlx::postgres::PgRow) -> Result<RoundResponseRow, sqlx::Error> {
    Ok(RoundResponseRow {
        id: row.try_get("id")?,
        instance_id: row.try_get("instance_id")?,
        checkpoint_index: row.try_get("checkpoint_index")?,
        response_type: row.try_get("response_type")?,
        response_value: row.try_get("response_value").unwrap_or(JsonValue::Null),
        calculated_value: row.try_get("calculated_value").ok().flatten(),
        is_out_of_range: row.try_get("is_out_of_range").unwrap_or(false),
        alarm_triggered: row.try_get("alarm_triggered").unwrap_or(false),
        created_by: row.try_get("created_by")?,
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

// ---------------------------------------------------------------------------
// Threshold evaluation helpers
// ---------------------------------------------------------------------------

/// Given a numeric value and a checkpoint's validation JSONB, determine
/// whether the value is out of range or triggers an alarm.
pub(crate) fn evaluate_thresholds(value: f64, validation: &JsonValue) -> (bool, bool) {
    let hh = validation.get("hh").and_then(|v| v.as_f64());
    let h = validation.get("h").and_then(|v| v.as_f64());
    let l = validation.get("l").and_then(|v| v.as_f64());
    let ll = validation.get("ll").and_then(|v| v.as_f64());
    let max = validation.get("max").and_then(|v| v.as_f64());
    let min = validation.get("min").and_then(|v| v.as_f64());

    // alarm_triggered = outside HH/LL bounds
    let alarm_triggered = hh.is_some_and(|v| value >= v) || ll.is_some_and(|v| value <= v);

    // is_out_of_range = outside H/L advisory bounds or min/max hard limits
    let out_of_h = h.is_some_and(|v| value > v);
    let out_of_l = l.is_some_and(|v| value < v);
    let out_of_max = max.is_some_and(|v| value > v);
    let out_of_min = min.is_some_and(|v| value < v);
    let is_out_of_range = alarm_triggered || out_of_h || out_of_l || out_of_max || out_of_min;

    (is_out_of_range, alarm_triggered)
}

// ---------------------------------------------------------------------------
// Template handlers
// ---------------------------------------------------------------------------

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTemplatesParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:read") {
        return IoError::Forbidden("rounds:read permission required".into()).into_response();
    }

    let pg = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM round_templates
         WHERE deleted_at IS NULL AND ($1::bool IS NULL OR is_active = $1)",
    )
    .bind(params.is_active)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let rows = sqlx::query(
        "SELECT id, name, description, version, checkpoints, is_active, created_by, created_at \
         FROM round_templates \
         WHERE deleted_at IS NULL AND ($1::bool IS NULL OR is_active = $1) \
         ORDER BY name \
         LIMIT $2 OFFSET $3",
    )
    .bind(params.is_active)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let templates: Vec<RoundTemplateRow> = rows
                .iter()
                .filter_map(|r| row_to_template(r).ok())
                .collect();
            Json(PagedResponse::new(templates, pg, limit, total as u64)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:read") {
        return IoError::Forbidden("rounds:read permission required".into()).into_response();
    }

    let row = sqlx::query(
        "SELECT id, name, description, version, checkpoints, is_active, created_by, created_at \
         FROM round_templates \
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_template(&row) {
            Ok(t) => Json(ApiResponse::ok(t)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Template {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:create") {
        return IoError::Forbidden("rounds:create permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    let row = sqlx::query(
        "INSERT INTO round_templates (name, description, checkpoints, created_by) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, name, description, version, checkpoints, is_active, created_by, created_at",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.checkpoints)
    .bind(user_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(row) => match row_to_template(&row) {
            Ok(t) => (StatusCode::CREATED, Json(ApiResponse::ok(t))).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:create") {
        return IoError::Forbidden("rounds:create permission required".into()).into_response();
    }

    let row = sqlx::query(
        "UPDATE round_templates \
         SET name = $1, description = $2, checkpoints = $3, version = version + 1, updated_at = NOW() \
         WHERE id = $4 AND deleted_at IS NULL \
         RETURNING id, name, description, version, checkpoints, is_active, created_by, created_at",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.checkpoints)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_template(&row) {
            Ok(t) => Json(ApiResponse::ok(t)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Template {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Schedule handlers
// ---------------------------------------------------------------------------

pub async fn list_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:read") {
        return IoError::Forbidden("rounds:read permission required".into()).into_response();
    }

    let pg = page.page();
    let limit = page.limit();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM round_schedules",
    )
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let rows = sqlx::query(
        "SELECT rs.id, rs.template_id, rt.name as template_name, \
                rs.recurrence_type, rs.recurrence_config, rs.is_active \
         FROM round_schedules rs \
         JOIN round_templates rt ON rt.id = rs.template_id \
         ORDER BY rt.name \
         LIMIT $1 OFFSET $2",
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let schedules: Vec<RoundScheduleRow> = rows
                .iter()
                .filter_map(|r| row_to_schedule(r).ok())
                .collect();
            Json(PagedResponse::new(schedules, pg, limit, total as u64)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn create_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScheduleRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:create") {
        return IoError::Forbidden("rounds:create permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    let row = sqlx::query(
        "INSERT INTO round_schedules (template_id, recurrence_type, recurrence_config, created_by) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, template_id, recurrence_type, recurrence_config, is_active",
    )
    .bind(body.template_id)
    .bind(&body.recurrence_type)
    .bind(&body.recurrence_config)
    .bind(user_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(row) => {
            let schedule = RoundScheduleRow {
                id: row.try_get("id").unwrap(),
                template_id: row.try_get("template_id").unwrap(),
                template_name: None,
                recurrence_type: row.try_get("recurrence_type").unwrap(),
                recurrence_config: row
                    .try_get("recurrence_config")
                    .unwrap_or(JsonValue::Object(serde_json::Map::new())),
                is_active: row.try_get("is_active").unwrap_or(true),
            };
            (StatusCode::CREATED, Json(ApiResponse::ok(schedule))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn update_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScheduleRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:create") {
        return IoError::Forbidden("rounds:create permission required".into()).into_response();
    }

    // Fetch current row and apply updates
    let current = sqlx::query(
        "SELECT id, template_id, recurrence_type, recurrence_config, is_active \
         FROM round_schedules WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let current_row = match current {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Schedule {id} not found")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let recurrence_type: String = body
        .recurrence_type
        .unwrap_or_else(|| current_row.try_get("recurrence_type").unwrap_or_default());
    let recurrence_config: JsonValue = body
        .recurrence_config
        .unwrap_or_else(|| {
            current_row
                .try_get("recurrence_config")
                .unwrap_or(JsonValue::Object(serde_json::Map::new()))
        });
    let is_active: bool = body
        .is_active
        .unwrap_or_else(|| current_row.try_get("is_active").unwrap_or(true));

    let row = sqlx::query(
        "UPDATE round_schedules \
         SET recurrence_type = $1, recurrence_config = $2, is_active = $3, updated_at = NOW() \
         WHERE id = $4 \
         RETURNING id, template_id, recurrence_type, recurrence_config, is_active",
    )
    .bind(&recurrence_type)
    .bind(&recurrence_config)
    .bind(is_active)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => {
            let schedule = RoundScheduleRow {
                id: row.try_get("id").unwrap(),
                template_id: row.try_get("template_id").unwrap(),
                template_name: None,
                recurrence_type: row.try_get("recurrence_type").unwrap(),
                recurrence_config: row
                    .try_get("recurrence_config")
                    .unwrap_or(JsonValue::Object(serde_json::Map::new())),
                is_active: row.try_get("is_active").unwrap_or(true),
            };
            Json(ApiResponse::ok(schedule)).into_response()
        }
        Ok(None) => IoError::NotFound(format!("Schedule {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Instance handlers
// ---------------------------------------------------------------------------

pub async fn list_instances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListInstancesParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:read") {
        return IoError::Forbidden("rounds:read permission required".into()).into_response();
    }

    let pg = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM round_instances ri
         WHERE ($1::text IS NULL OR ri.status = $1)
           AND ($2::timestamptz IS NULL OR ri.created_at >= $2)
           AND ($3::timestamptz IS NULL OR ri.created_at <= $3)",
    )
    .bind(&params.status)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let rows = sqlx::query(
        "SELECT ri.id, ri.template_id, rt.name as template_name, ri.status, \
                ri.locked_to_user, ri.started_at, ri.completed_at, ri.due_by, ri.created_at \
         FROM round_instances ri \
         JOIN round_templates rt ON rt.id = ri.template_id \
         WHERE ($1::text IS NULL OR ri.status = $1) \
           AND ($2::timestamptz IS NULL OR ri.created_at >= $2) \
           AND ($3::timestamptz IS NULL OR ri.created_at <= $3) \
         ORDER BY ri.created_at DESC \
         LIMIT $4 OFFSET $5",
    )
    .bind(&params.status)
    .bind(params.from)
    .bind(params.to)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let instances: Vec<RoundInstanceRow> = rows
                .iter()
                .filter_map(|r| row_to_instance(r).ok())
                .collect();
            Json(PagedResponse::new(instances, pg, limit, total as u64)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn get_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:read") {
        return IoError::Forbidden("rounds:read permission required".into()).into_response();
    }

    // Fetch instance
    let instance_row = sqlx::query(
        "SELECT ri.id, ri.template_id, rt.name as template_name, ri.status, \
                ri.locked_to_user, ri.started_at, ri.completed_at, ri.due_by, ri.created_at \
         FROM round_instances ri \
         JOIN round_templates rt ON rt.id = ri.template_id \
         WHERE ri.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let instance = match instance_row {
        Ok(Some(row)) => match row_to_instance(&row) {
            Ok(i) => i,
            Err(e) => return IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => return IoError::NotFound(format!("Instance {id} not found")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Fetch template
    let template_row = sqlx::query(
        "SELECT id, name, description, version, checkpoints, is_active, created_by, created_at \
         FROM round_templates WHERE id = $1",
    )
    .bind(instance.template_id)
    .fetch_optional(&state.db)
    .await;

    let template = template_row.ok().flatten().and_then(|r| row_to_template(&r).ok());

    // Fetch responses
    let responses_rows = sqlx::query(
        "SELECT id, instance_id, checkpoint_index, response_type, response_value, \
                calculated_value, is_out_of_range, alarm_triggered, created_by, created_at \
         FROM round_responses \
         WHERE instance_id = $1 \
         ORDER BY checkpoint_index",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    let responses = match responses_rows {
        Ok(rows) => rows.iter().filter_map(|r| row_to_response(r).ok()).collect(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let detail = RoundInstanceDetail { instance, template, responses };
    Json(ApiResponse::ok(detail)).into_response()
}

pub async fn start_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:execute") {
        return IoError::Forbidden("rounds:execute permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    // Check current state first to give a useful error message
    let current = sqlx::query(
        "SELECT status, locked_to_user FROM round_instances WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match current {
        Ok(Some(row)) => {
            let status: String = row.try_get("status").unwrap_or_default();
            let locked: Option<Uuid> = row.try_get("locked_to_user").ok().flatten();

            if status == "completed" || status == "missed" {
                return IoError::Conflict(format!("Round is already {status}")).into_response();
            }

            if let Some(other_user) = locked {
                if other_user != user_id {
                    return IoError::Conflict(
                        "Round is already locked by another user".into(),
                    )
                    .into_response();
                }
            }
        }
        Ok(None) => return IoError::NotFound(format!("Instance {id} not found")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    }

    let row = sqlx::query(
        "UPDATE round_instances \
         SET status = 'in_progress', \
             locked_to_user = $1, \
             started_at = COALESCE(started_at, NOW()), \
             updated_at = NOW() \
         WHERE id = $2 \
           AND (status = 'pending' OR (status = 'in_progress' AND locked_to_user = $1)) \
         RETURNING id, template_id, status, locked_to_user, started_at, completed_at, due_by, created_at",
    )
    .bind(user_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => {
            let instance = RoundInstanceRow {
                id: row.try_get("id").unwrap(),
                template_id: row.try_get("template_id").unwrap(),
                template_name: None,
                status: row.try_get("status").unwrap(),
                locked_to_user: row.try_get("locked_to_user").ok().flatten(),
                started_at: row.try_get("started_at").ok().flatten(),
                completed_at: row.try_get("completed_at").ok().flatten(),
                due_by: row.try_get("due_by").ok().flatten(),
                created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
            };
            Json(ApiResponse::ok(instance)).into_response()
        }
        Ok(None) => {
            IoError::Conflict(
                "Could not start round — locked by another user or not in a startable state".into(),
            )
            .into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn save_responses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SaveResponsesRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:execute") {
        return IoError::Forbidden("rounds:execute permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    // Fetch template checkpoints for threshold validation
    let template_row = sqlx::query(
        "SELECT rt.checkpoints \
         FROM round_instances ri \
         JOIN round_templates rt ON rt.id = ri.template_id \
         WHERE ri.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let checkpoints: JsonValue = template_row
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<JsonValue, _>("checkpoints").ok())
        .unwrap_or(JsonValue::Array(vec![]));

    let checkpoint_arr = checkpoints.as_array().cloned().unwrap_or_default();
    let saved_count = body.responses.len();

    for item in &body.responses {
        // Find matching checkpoint by index for threshold validation
        let checkpoint = checkpoint_arr
            .iter()
            .find(|c| {
                c.get("index")
                    .and_then(|v| v.as_i64())
                    .is_some_and(|i| i == item.checkpoint_index as i64)
            });

        let (is_out_of_range, alarm_triggered) = if item.response_type == "numeric" {
            if let Some(val) = item.response_value.as_f64() {
                if let Some(validation) = checkpoint.and_then(|cp| cp.get("validation")) {
                    evaluate_thresholds(val, validation)
                } else {
                    (false, false)
                }
            } else {
                (false, false)
            }
        } else {
            (false, false)
        };

        let calculated_value: Option<f64> = if item.response_type == "numeric" {
            item.response_value.as_f64()
        } else {
            None
        };

        let result = sqlx::query(
            "INSERT INTO round_responses \
             (instance_id, checkpoint_index, response_type, response_value, calculated_value, \
              gps_latitude, gps_longitude, barcode_scanned, is_out_of_range, alarm_triggered, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
             ON CONFLICT ON CONSTRAINT uq_round_responses_instance_checkpoint \
             DO UPDATE SET \
               response_type     = EXCLUDED.response_type, \
               response_value    = EXCLUDED.response_value, \
               calculated_value  = EXCLUDED.calculated_value, \
               gps_latitude      = EXCLUDED.gps_latitude, \
               gps_longitude     = EXCLUDED.gps_longitude, \
               barcode_scanned   = EXCLUDED.barcode_scanned, \
               is_out_of_range   = EXCLUDED.is_out_of_range, \
               alarm_triggered   = EXCLUDED.alarm_triggered",
        )
        .bind(id)
        .bind(item.checkpoint_index)
        .bind(&item.response_type)
        .bind(&item.response_value)
        .bind(calculated_value)
        .bind(item.gps_latitude)
        .bind(item.gps_longitude)
        .bind(&item.barcode_scanned)
        .bind(is_out_of_range)
        .bind(alarm_triggered)
        .bind(user_id)
        .execute(&state.db)
        .await;

        if let Err(e) = result {
            return IoError::Database(e).into_response();
        }
    }

    Json(ApiResponse::ok(serde_json::json!({ "saved": saved_count }))).into_response()
}

pub async fn complete_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:execute") {
        return IoError::Forbidden("rounds:execute permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    let row = sqlx::query(
        "UPDATE round_instances \
         SET status = 'completed', completed_at = NOW(), locked_to_user = NULL, updated_at = NOW() \
         WHERE id = $1 AND locked_to_user = $2 AND status = 'in_progress' \
         RETURNING id, template_id, status, locked_to_user, started_at, completed_at, due_by, created_at",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => {
            let instance = RoundInstanceRow {
                id: row.try_get("id").unwrap(),
                template_id: row.try_get("template_id").unwrap(),
                template_name: None,
                status: row.try_get("status").unwrap(),
                locked_to_user: row.try_get("locked_to_user").ok().flatten(),
                started_at: row.try_get("started_at").ok().flatten(),
                completed_at: row.try_get("completed_at").ok().flatten(),
                due_by: row.try_get("due_by").ok().flatten(),
                created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
            };
            Json(ApiResponse::ok(instance)).into_response()
        }
        Ok(None) => IoError::Conflict(
            "Could not complete round — not in progress, not locked to your user, or not found"
                .into(),
        )
        .into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// History handler
// ---------------------------------------------------------------------------

pub async fn get_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<HistoryParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:read") {
        return IoError::Forbidden("rounds:read permission required".into()).into_response();
    }

    let rows = sqlx::query(
        "SELECT ri.id, ri.template_id, rt.name as template_name, ri.status, \
                ri.started_at, ri.completed_at, ri.due_by, ri.created_at, \
                COUNT(rr.id) as response_count, \
                SUM(CASE WHEN rr.is_out_of_range THEN 1 ELSE 0 END) as out_of_range_count \
         FROM round_instances ri \
         JOIN round_templates rt ON rt.id = ri.template_id \
         LEFT JOIN round_responses rr ON rr.instance_id = ri.id \
         WHERE ri.status = 'completed' \
           AND ($1::uuid IS NULL OR ri.template_id = $1) \
           AND ($2::timestamptz IS NULL OR ri.completed_at >= $2) \
           AND ($3::timestamptz IS NULL OR ri.completed_at <= $3) \
         GROUP BY ri.id, rt.name \
         ORDER BY ri.completed_at DESC \
         LIMIT 200",
    )
    .bind(params.template_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let history: Vec<RoundHistoryRow> = rows
                .iter()
                .filter_map(|r| {
                    Some(RoundHistoryRow {
                        id: r.try_get("id").ok()?,
                        template_id: r.try_get("template_id").ok()?,
                        template_name: r.try_get("template_name").unwrap_or_default(),
                        status: r.try_get("status").unwrap_or_default(),
                        started_at: r.try_get("started_at").ok().flatten(),
                        completed_at: r.try_get("completed_at").ok().flatten(),
                        due_by: r.try_get("due_by").ok().flatten(),
                        created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
                        response_count: r.try_get("response_count").unwrap_or(0),
                        out_of_range_count: r.try_get("out_of_range_count").unwrap_or(0),
                    })
                })
                .collect();
            Json(ApiResponse::ok(history)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}
