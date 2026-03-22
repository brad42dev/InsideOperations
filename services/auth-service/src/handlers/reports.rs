/// Report Templates, Schedules, and Export Presets CRUD.
///
/// Tables (migration 34):
///   report_templates — system + user-created report templates
///   report_schedules — cron-based scheduled report runs
///   export_presets   — saved parameter combinations per template
///
/// Permission headers injected by the gateway:
///   x-io-user-id      — UUID of the authenticated user
///   x-io-permissions  — comma-separated permission list
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
// Permission helpers
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
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ReportTemplateRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_system_template: bool,
    pub template_config: JsonValue,
    pub default_params: JsonValue,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn map_template_row(r: &sqlx::postgres::PgRow) -> Result<ReportTemplateRow, sqlx::Error> {
    Ok(ReportTemplateRow {
        id: r.try_get("id")?,
        name: r.try_get("name")?,
        description: r.try_get("description")?,
        category: r.try_get("category")?,
        is_system_template: r.try_get("is_system_template")?,
        template_config: r.try_get("template_config")?,
        default_params: r.try_get("default_params")?,
        created_by: r.try_get("created_by")?,
        updated_by: r.try_get("updated_by")?,
        created_at: r.try_get("created_at")?,
        updated_at: r.try_get("updated_at")?,
    })
}

#[derive(Debug, Serialize)]
pub struct ReportScheduleRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub name: String,
    pub cron_expression: String,
    pub format: String,
    pub params: JsonValue,
    pub recipient_user_ids: Vec<Uuid>,
    pub recipient_emails: Vec<String>,
    pub enabled: bool,
    pub last_run_at: Option<DateTime<Utc>>,
    pub next_run_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn map_schedule_row(r: &sqlx::postgres::PgRow) -> Result<ReportScheduleRow, sqlx::Error> {
    Ok(ReportScheduleRow {
        id: r.try_get("id")?,
        template_id: r.try_get("template_id")?,
        name: r.try_get("name")?,
        cron_expression: r.try_get("cron_expression")?,
        format: r.try_get("format")?,
        params: r.try_get("params")?,
        recipient_user_ids: r.try_get::<Vec<Uuid>, _>("recipient_user_ids").unwrap_or_default(),
        recipient_emails: r.try_get::<Vec<String>, _>("recipient_emails").unwrap_or_default(),
        enabled: r.try_get("enabled")?,
        last_run_at: r.try_get("last_run_at")?,
        next_run_at: r.try_get("next_run_at")?,
        created_by: r.try_get("created_by")?,
        created_at: r.try_get("created_at")?,
        updated_at: r.try_get("updated_at")?,
    })
}

#[derive(Debug, Serialize)]
pub struct ExportPresetRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub name: String,
    pub params: JsonValue,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

fn map_preset_row(r: &sqlx::postgres::PgRow) -> Result<ExportPresetRow, sqlx::Error> {
    Ok(ExportPresetRow {
        id: r.try_get("id")?,
        template_id: r.try_get("template_id")?,
        name: r.try_get("name")?,
        params: r.try_get("params")?,
        created_by: r.try_get("created_by")?,
        created_at: r.try_get("created_at")?,
    })
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ReportTemplateFilter {
    pub page: Option<u64>,
    pub limit: Option<u64>,
    pub q: Option<String>,
    pub category: Option<String>,
    pub is_system: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub template_config: Option<JsonValue>,
    pub default_params: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReportTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub template_config: Option<JsonValue>,
    pub default_params: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportScheduleRequest {
    pub template_id: Uuid,
    pub name: String,
    pub cron_expression: String,
    pub format: Option<String>,
    pub params: Option<JsonValue>,
    pub recipient_user_ids: Option<Vec<Uuid>>,
    pub recipient_emails: Option<Vec<String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReportScheduleRequest {
    pub name: Option<String>,
    pub cron_expression: Option<String>,
    pub format: Option<String>,
    pub params: Option<JsonValue>,
    pub recipient_user_ids: Option<Vec<Uuid>>,
    pub recipient_emails: Option<Vec<String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExportPresetRequest {
    pub template_id: Uuid,
    pub name: String,
    pub params: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// GET /report-templates
// ---------------------------------------------------------------------------

pub async fn list_report_templates(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<ReportTemplateFilter>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:read") {
        return Err(IoError::Forbidden("reports:read permission required".into()));
    }

    let page = filter.page.unwrap_or(1).max(1) as u32;
    let limit = filter.limit.unwrap_or(50).clamp(1, 100) as u32;
    let offset = ((page - 1) * limit) as i64;
    let q_pattern = filter.q.as_deref().map(|q| format!("%{q}%"));

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM report_templates
         WHERE deleted_at IS NULL
           AND ($1::boolean IS NULL OR is_system_template = $1)
           AND ($2::text IS NULL OR category = $2)
           AND ($3::text IS NULL OR name ILIKE $3 OR description ILIKE $3)",
    )
    .bind(filter.is_system)
    .bind(filter.category.as_deref())
    .bind(q_pattern.as_deref())
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<i64, _>(0))?;

    let rows = sqlx::query(
        "SELECT id, name, description, category, is_system_template, template_config,
                default_params, created_by, updated_by, created_at, updated_at
         FROM report_templates
         WHERE deleted_at IS NULL
           AND ($1::boolean IS NULL OR is_system_template = $1)
           AND ($2::text IS NULL OR category = $2)
           AND ($3::text IS NULL OR name ILIKE $3 OR description ILIKE $3)
         ORDER BY is_system_template DESC, name ASC
         LIMIT $4 OFFSET $5",
    )
    .bind(filter.is_system)
    .bind(filter.category.as_deref())
    .bind(q_pattern.as_deref())
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ReportTemplateRow> = rows
        .iter()
        .filter_map(|r| match map_template_row(r) {
            Ok(t) => Some(t),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed report_template row");
                None
            }
        })
        .collect();

    Ok(Json(PagedResponse::new(items, page, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// GET /report-templates/:id
// ---------------------------------------------------------------------------

pub async fn get_report_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:read") {
        return Err(IoError::Forbidden("reports:read permission required".into()));
    }

    let row = sqlx::query(
        "SELECT id, name, description, category, is_system_template, template_config,
                default_params, created_by, updated_by, created_at, updated_at
         FROM report_templates
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Report template {id} not found")))?;

    let tmpl = map_template_row(&row).map_err(IoError::Database)?;
    Ok(Json(ApiResponse::ok(tmpl)))
}

// ---------------------------------------------------------------------------
// POST /report-templates
// ---------------------------------------------------------------------------

pub async fn create_report_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateReportTemplateRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:create") {
        return Err(IoError::Forbidden("reports:create permission required".into()));
    }

    if req.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".into()));
    }

    let new_id = Uuid::new_v4();
    let template_config = req.template_config.unwrap_or_else(|| serde_json::json!({}));
    let default_params = req.default_params.unwrap_or_else(|| serde_json::json!({
        "time_range": "last_24h",
        "area": "all",
        "priority": "all"
    }));

    sqlx::query(
        "INSERT INTO report_templates
             (id, name, description, category, is_system_template, template_config, default_params, created_by, updated_by)
         VALUES ($1, $2, $3, $4, false, $5, $6, $7, $7)",
    )
    .bind(new_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.category)
    .bind(&template_config)
    .bind(&default_params)
    .bind(caller)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(
        "SELECT id, name, description, category, is_system_template, template_config,
                default_params, created_by, updated_by, created_at, updated_at
         FROM report_templates WHERE id = $1",
    )
    .bind(new_id)
    .fetch_one(&state.db)
    .await?;

    let tmpl = map_template_row(&row).map_err(IoError::Database)?;
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(tmpl))))
}

// ---------------------------------------------------------------------------
// PUT /report-templates/:id
// ---------------------------------------------------------------------------

pub async fn update_report_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateReportTemplateRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:create") {
        return Err(IoError::Forbidden("reports:create permission required".into()));
    }

    let row = sqlx::query(
        "SELECT id, is_system_template, created_by FROM report_templates WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Report template {id} not found")))?;

    let is_system: bool = row.try_get("is_system_template").map_err(IoError::Database)?;
    let is_admin = has_permission(&headers, "system:admin");

    // System templates can only be modified by admins
    if is_system && !is_admin {
        return Err(IoError::Forbidden(
            "System templates can only be modified by administrators".into(),
        ));
    }

    // Non-system templates: only owner or admin
    if !is_system {
        let owner: Uuid = row.try_get("created_by").map_err(IoError::Database)?;
        if owner != caller && !is_admin {
            return Err(IoError::Forbidden(
                "Only the owner or an admin may update this template".into(),
            ));
        }
    }

    if let Some(name) = &req.name {
        if name.trim().is_empty() {
            return Err(IoError::BadRequest("name must not be empty".into()));
        }
        sqlx::query(
            "UPDATE report_templates SET name = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(name)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(description) = &req.description {
        sqlx::query(
            "UPDATE report_templates SET description = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(description)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(category) = &req.category {
        sqlx::query(
            "UPDATE report_templates SET category = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(category)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(template_config) = &req.template_config {
        sqlx::query(
            "UPDATE report_templates SET template_config = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(template_config)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(default_params) = &req.default_params {
        sqlx::query(
            "UPDATE report_templates SET default_params = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(default_params)
        .bind(caller)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    get_report_template(State(state), headers, Path(id)).await
}

// ---------------------------------------------------------------------------
// DELETE /report-templates/:id
// ---------------------------------------------------------------------------

pub async fn delete_report_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:delete") {
        return Err(IoError::Forbidden("reports:delete permission required".into()));
    }

    let row = sqlx::query(
        "SELECT id, is_system_template, created_by FROM report_templates WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Report template {id} not found")))?;

    let is_system: bool = row.try_get("is_system_template").map_err(IoError::Database)?;
    if is_system {
        return Err(IoError::Forbidden("System templates cannot be deleted".into()));
    }

    let owner: Uuid = row.try_get("created_by").map_err(IoError::Database)?;
    let is_admin = has_permission(&headers, "system:admin");
    if owner != caller && !is_admin {
        return Err(IoError::Forbidden(
            "Only the owner or an admin may delete this template".into(),
        ));
    }

    sqlx::query(
        "UPDATE report_templates SET deleted_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /report-schedules
// ---------------------------------------------------------------------------

pub async fn list_report_schedules(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(page): Query<PageParams>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:admin") {
        return Err(IoError::Forbidden("reports:admin permission required".into()));
    }

    let pg = page.page();
    let limit = page.limit();
    let offset = page.offset();

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM report_schedules WHERE deleted_at IS NULL",
    )
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<i64, _>(0))?;

    let rows = sqlx::query(
        "SELECT id, template_id, name, cron_expression, format, params,
                recipient_user_ids, recipient_emails, enabled,
                last_run_at, next_run_at, created_by, created_at, updated_at
         FROM report_schedules
         WHERE deleted_at IS NULL
         ORDER BY name ASC
         LIMIT $1 OFFSET $2",
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ReportScheduleRow> = rows
        .iter()
        .filter_map(|r| match map_schedule_row(r) {
            Ok(s) => Some(s),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed report_schedule row");
                None
            }
        })
        .collect();

    Ok(Json(PagedResponse::new(items, pg, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// POST /report-schedules
// ---------------------------------------------------------------------------

pub async fn create_report_schedule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateReportScheduleRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:admin") {
        return Err(IoError::Forbidden("reports:admin permission required".into()));
    }

    if req.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".into()));
    }
    if req.cron_expression.trim().is_empty() {
        return Err(IoError::BadRequest("cron_expression is required".into()));
    }

    // Validate that the referenced template exists
    let template_exists: bool = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM report_templates WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(req.template_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<bool, _>(0))?;

    if !template_exists {
        return Err(IoError::NotFound(format!(
            "Report template {} not found",
            req.template_id
        )));
    }

    let valid_formats = ["pdf", "csv", "xlsx", "html", "json"];
    let format = req.format.unwrap_or_else(|| "pdf".to_string());
    if !valid_formats.contains(&format.as_str()) {
        return Err(IoError::BadRequest(
            "format must be one of: pdf, csv, xlsx, html, json".into(),
        ));
    }

    let params = req.params.unwrap_or_else(|| serde_json::json!({}));
    let recipient_user_ids: Vec<Uuid> = req.recipient_user_ids.unwrap_or_default();
    let recipient_emails: Vec<String> = req.recipient_emails.unwrap_or_default();
    let enabled = req.enabled.unwrap_or(true);
    let new_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO report_schedules
             (id, template_id, name, cron_expression, format, params,
              recipient_user_ids, recipient_emails, enabled, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(new_id)
    .bind(req.template_id)
    .bind(&req.name)
    .bind(&req.cron_expression)
    .bind(&format)
    .bind(&params)
    .bind(&recipient_user_ids)
    .bind(&recipient_emails)
    .bind(enabled)
    .bind(caller)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(
        "SELECT id, template_id, name, cron_expression, format, params,
                recipient_user_ids, recipient_emails, enabled,
                last_run_at, next_run_at, created_by, created_at, updated_at
         FROM report_schedules WHERE id = $1",
    )
    .bind(new_id)
    .fetch_one(&state.db)
    .await?;

    let schedule = map_schedule_row(&row).map_err(IoError::Database)?;
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(schedule))))
}

// ---------------------------------------------------------------------------
// PUT /report-schedules/:id
// ---------------------------------------------------------------------------

pub async fn update_report_schedule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateReportScheduleRequest>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:admin") {
        return Err(IoError::Forbidden("reports:admin permission required".into()));
    }

    // Verify schedule exists
    sqlx::query("SELECT id FROM report_schedules WHERE id = $1 AND deleted_at IS NULL")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Report schedule {id} not found")))?;

    if let Some(name) = &req.name {
        if name.trim().is_empty() {
            return Err(IoError::BadRequest("name must not be empty".into()));
        }
        sqlx::query(
            "UPDATE report_schedules SET name = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(name)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(cron) = &req.cron_expression {
        if cron.trim().is_empty() {
            return Err(IoError::BadRequest("cron_expression must not be empty".into()));
        }
        sqlx::query(
            "UPDATE report_schedules SET cron_expression = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(cron)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(format) = &req.format {
        let valid_formats = ["pdf", "csv", "xlsx", "html", "json"];
        if !valid_formats.contains(&format.as_str()) {
            return Err(IoError::BadRequest(
                "format must be one of: pdf, csv, xlsx, html, json".into(),
            ));
        }
        sqlx::query(
            "UPDATE report_schedules SET format = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(format)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(params) = &req.params {
        sqlx::query(
            "UPDATE report_schedules SET params = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(params)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(user_ids) = &req.recipient_user_ids {
        sqlx::query(
            "UPDATE report_schedules SET recipient_user_ids = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(user_ids)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(emails) = &req.recipient_emails {
        sqlx::query(
            "UPDATE report_schedules SET recipient_emails = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(emails)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(enabled) = req.enabled {
        sqlx::query(
            "UPDATE report_schedules SET enabled = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(enabled)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    let row = sqlx::query(
        "SELECT id, template_id, name, cron_expression, format, params,
                recipient_user_ids, recipient_emails, enabled,
                last_run_at, next_run_at, created_by, created_at, updated_at
         FROM report_schedules WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let schedule = map_schedule_row(&row).map_err(IoError::Database)?;
    Ok(Json(ApiResponse::ok(schedule)))
}

// ---------------------------------------------------------------------------
// DELETE /report-schedules/:id
// ---------------------------------------------------------------------------

pub async fn delete_report_schedule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:admin") {
        return Err(IoError::Forbidden("reports:admin permission required".into()));
    }

    let result = sqlx::query(
        "UPDATE report_schedules SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!("Report schedule {id} not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /report-templates/:id/presets
// ---------------------------------------------------------------------------

pub async fn list_export_presets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(template_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:read") {
        return Err(IoError::Forbidden("reports:read permission required".into()));
    }

    // Verify template exists
    sqlx::query("SELECT id FROM report_templates WHERE id = $1 AND deleted_at IS NULL")
        .bind(template_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Report template {template_id} not found")))?;

    let rows = sqlx::query(
        "SELECT id, template_id, name, params, created_by, created_at
         FROM export_presets
         WHERE template_id = $1 AND created_by = $2
         ORDER BY created_at DESC",
    )
    .bind(template_id)
    .bind(caller)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ExportPresetRow> = rows
        .iter()
        .filter_map(|r| match map_preset_row(r) {
            Ok(p) => Some(p),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed export_preset row");
                None
            }
        })
        .collect();

    Ok(Json(ApiResponse::ok(items)))
}

// ---------------------------------------------------------------------------
// POST /export-presets
// ---------------------------------------------------------------------------

pub async fn create_export_preset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateExportPresetRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:read") {
        return Err(IoError::Forbidden("reports:read permission required".into()));
    }

    if req.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".into()));
    }

    // Verify template exists
    let template_exists: bool = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM report_templates WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(req.template_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<bool, _>(0))?;

    if !template_exists {
        return Err(IoError::NotFound(format!(
            "Report template {} not found",
            req.template_id
        )));
    }

    let params = req.params.unwrap_or_else(|| serde_json::json!({}));
    let new_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO export_presets (id, template_id, name, params, created_by)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(new_id)
    .bind(req.template_id)
    .bind(&req.name)
    .bind(&params)
    .bind(caller)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(
        "SELECT id, template_id, name, params, created_by, created_at
         FROM export_presets WHERE id = $1",
    )
    .bind(new_id)
    .fetch_one(&state.db)
    .await?;

    let preset = map_preset_row(&row).map_err(IoError::Database)?;
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(preset))))
}

// ---------------------------------------------------------------------------
// DELETE /export-presets/:id
// ---------------------------------------------------------------------------

pub async fn delete_export_preset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or(IoError::Unauthorized)?;

    if !has_permission(&headers, "reports:read") {
        return Err(IoError::Forbidden("reports:read permission required".into()));
    }

    let row = sqlx::query("SELECT id, created_by FROM export_presets WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Export preset {id} not found")))?;

    let owner: Uuid = row.try_get("created_by").map_err(IoError::Database)?;
    let is_admin = has_permission(&headers, "system:admin");
    if owner != caller && !is_admin {
        return Err(IoError::Forbidden(
            "Only the owner or an admin may delete this preset".into(),
        ));
    }

    sqlx::query("DELETE FROM export_presets WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Seed: 20 Phase 1 canned report templates
// ---------------------------------------------------------------------------

/// Seeds the 20 Phase 1 system report templates if they do not already exist.
/// Called from main() after the DB pool is created.
pub async fn seed_report_templates(db: &sqlx::PgPool) {
    let templates: &[(&str, &str, &str)] = &[
        // (name, category, description)
        // Alarm Management (7)
        (
            "Alarm Rate Summary",
            "Alarm Management",
            "Average and peak alarm rates per operator position with EEMUA 191 benchmark comparison",
        ),
        (
            "Top N Bad Actor Alarms",
            "Alarm Management",
            "Most frequently occurring alarms ranked by count",
        ),
        (
            "Standing/Stale Alarms",
            "Alarm Management",
            "Alarms continuously active beyond configurable threshold",
        ),
        (
            "Chattering Alarms",
            "Alarm Management",
            "Alarms rapidly cycling between alarm and normal states",
        ),
        (
            "Alarm Flood Analysis",
            "Alarm Management",
            "Periods exceeding flood threshold (EEMUA 191: >10 alarms/10 min)",
        ),
        (
            "Alarm Priority Distribution",
            "Alarm Management",
            "Actual priority distribution vs recommended ISA-18.2 pyramid",
        ),
        (
            "Alarm System Health Summary",
            "Alarm Management",
            "One-page executive summary with EEMUA classification",
        ),
        // Process Data (2)
        (
            "Point Value Trend",
            "Process Data",
            "Select points + time range, get trend chart with tabular data",
        ),
        (
            "Statistical Summary",
            "Process Data",
            "Min, max, average, standard deviation for selected points",
        ),
        // Operational Logs (2)
        (
            "Shift Handover Report",
            "Operational Logs",
            "Complete summary of all log entries during a shift",
        ),
        (
            "Log Compliance Report",
            "Operational Logs",
            "Scheduled vs. completed log instances, completion rate",
        ),
        // Rounds & Inspections (3)
        (
            "Round Completion Rate",
            "Rounds & Inspections",
            "Percentage of scheduled rounds completed on time",
        ),
        (
            "Overdue Rounds",
            "Rounds & Inspections",
            "Rounds past their due time and not yet completed",
        ),
        (
            "Exception Report",
            "Rounds & Inspections",
            "Checkpoint readings outside expected ranges",
        ),
        // Environmental & Compliance (1)
        (
            "Environmental Exceedance Summary",
            "Environmental & Compliance",
            "Points that exceeded regulatory thresholds",
        ),
        // Security & Access (2)
        (
            "Shift Coverage Report",
            "Security & Access",
            "Scheduled vs actual shift attendance",
        ),
        (
            "Muster Event Report",
            "Security & Access",
            "Full accounting of each emergency muster",
        ),
        // Executive & Management (2)
        (
            "Alarm System Health Executive",
            "Executive & Management",
            "Monthly management summary with EEMUA classification",
        ),
        (
            "Shift Schedule Report",
            "Executive & Management",
            "Calendar view of shift assignments for a date range",
        ),
        // Shift Operations (1)
        (
            "Shift Handover Packet",
            "Shift Operations",
            "Comprehensive end-of-shift bundle: active alarms, shelved alarms, recent log entries, shift roster, critical point summary",
        ),
        // Phase 2 — Alarm Management (2)
        (
            "Time to Acknowledge",
            "Alarm Management",
            "Distribution of alarm acknowledgment times with percentile markers (median, p90, p95). Breakdown by priority.",
        ),
        (
            "Shelved & Suppressed Alarms",
            "Alarm Management",
            "Currently shelved alarms with auto-unshelve countdown, shelving frequency, compliance with ISA-18.2 shelving time limits.",
        ),
        // Phase 2 — Process Data (3)
        (
            "Exceedance Report",
            "Process Data",
            "Time duration and percentage a value was above/below a configured threshold. Critical for environmental compliance.",
        ),
        (
            "Data Quality Report",
            "Process Data",
            "Data gaps, bad OPC quality periods, stale data, points with persistent quality issues. Worst offenders ranked.",
        ),
        (
            "Period Comparison",
            "Process Data",
            "Side-by-side comparison of same points across two time ranges (this week vs. last week, this month vs. same month last year).",
        ),
        // Phase 2 — Operational Logs (2)
        (
            "Log Entry Search",
            "Operational Logs",
            "Full-text search results across log entries for a date range, formatted for investigation/audit documentation.",
        ),
        (
            "Operator Activity Report",
            "Operational Logs",
            "All log entries by a specific operator across all templates in a time range. Grouped by log instance/template.",
        ),
        // Phase 2 — Rounds & Inspections (1)
        (
            "Equipment Health Trend",
            "Rounds & Inspections",
            "Historical readings for a specific checkpoint/equipment over time. Shows degradation trends with alarm thresholds and statistical summary.",
        ),
        // Phase 2 — Equipment & Maintenance (4)
        (
            "Alarm Rationalization Status",
            "Equipment & Maintenance",
            "How many alarms are documented/rationalized/approved per ISA-18.2 lifecycle. Unrationalized alarms ranked by annunciation frequency.",
        ),
        (
            "Disabled Alarms Audit",
            "Equipment & Maintenance",
            "Permanently suppressed alarms with reason, review date. Alarms disabled >90 days without review flagged. MOC compliance.",
        ),
        (
            "OPC Connection Health",
            "Equipment & Maintenance",
            "OPC UA connection uptime, reconnection events, downtime per source, point quality summary per source.",
        ),
        (
            "Missed Readings Report",
            "Equipment & Maintenance",
            "Checkpoints skipped within otherwise-completed rounds. Partial completion tracking by template over time.",
        ),
        // Phase 2 — Environmental & Compliance (2)
        (
            "Alert Channel Delivery",
            "Environmental & Compliance",
            "Delivery success rates across alert channels (WebSocket, email, SMS, voice, radio, PA, push). Failed delivery details.",
        ),
        (
            "Escalation Report",
            "Environmental & Compliance",
            "Alert escalation frequency beyond Level 0. Indicates inadequate initial routing or insufficient staffing.",
        ),
        // Phase 2 — Security & Access (2)
        (
            "Attendance Report",
            "Security & Access",
            "Badge-in/badge-out history per person, hours on site per day/week.",
        ),
        (
            "Audit Trail Report",
            "Security & Access",
            "Complete audit trail for configurable entity or time range. Chronological, filterable, searchable.",
        ),
        // Phase 2 — Executive & Management (2)
        (
            "Safety Metrics Summary",
            "Executive & Management",
            "Safety event count, emergency alerts, critical alarms, round exceptions, safety-tagged log entries. Trend vs. prior period.",
        ),
        (
            "Operational Summary",
            "Executive & Management",
            "Configurable executive KPI report combining selected widgets. Template customizable per site.",
        ),
    ];

    let default_params = serde_json::json!({
        "time_range": "last_24h",
        "area": "all",
        "priority": "all"
    });

    for (name, category, description) in templates {
        // Check if this system template already exists by name
        let exists: bool = match sqlx::query(
            "SELECT EXISTS(SELECT 1 FROM report_templates WHERE is_system_template = true AND name = $1)",
        )
        .bind(name)
        .fetch_one(db)
        .await
        {
            Ok(r) => r.get::<bool, _>(0),
            Err(e) => {
                tracing::error!(error = %e, template = %name, "Failed to check report template existence");
                continue;
            }
        };

        if exists {
            continue;
        }

        let new_id = Uuid::new_v4();
        if let Err(e) = sqlx::query(
            "INSERT INTO report_templates
                 (id, name, description, category, is_system_template, template_config, default_params)
             VALUES ($1, $2, $3, $4, true, '{}'::jsonb, $5)",
        )
        .bind(new_id)
        .bind(name)
        .bind(description)
        .bind(category)
        .bind(&default_params)
        .execute(db)
        .await
        {
            tracing::error!(error = %e, template = %name, "Failed to seed report template");
        } else {
            tracing::info!(template = %name, id = %new_id, "Seeded system report template");
        }
    }
}
