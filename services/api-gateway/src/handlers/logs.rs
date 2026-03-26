//! Log module handlers — templates, segments, instances, entries, and search.

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

use crate::{file_scan, state::AppState};

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

fn user_id_from_claims(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct LogTemplateRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub version: i32,
    pub segment_ids: Vec<Uuid>,
    pub is_active: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct LogSegmentRow {
    pub id: Uuid,
    pub name: String,
    pub segment_type: String,
    pub content_config: JsonValue,
    pub is_reusable: bool,
}

#[derive(Debug, Serialize)]
pub struct LogInstanceRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub template_name: Option<String>,
    pub status: String,
    pub team_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct LogEntryRow {
    pub id: Uuid,
    pub instance_id: Uuid,
    pub segment_id: Uuid,
    pub content: JsonValue,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct LogInstanceDetail {
    #[serde(flatten)]
    pub instance: LogInstanceRow,
    pub entries: Vec<LogEntryRow>,
}

#[derive(Debug, Serialize)]
pub struct SearchResultRow {
    pub id: Uuid,
    pub instance_id: Uuid,
    pub segment_id: Uuid,
    pub content: JsonValue,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub template_name: Option<String>,
    pub instance_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub segment_ids: Vec<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSegmentRequest {
    pub name: String,
    pub segment_type: String,
    pub content_config: JsonValue,
    pub is_reusable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EntryUpdate {
    pub segment_id: Uuid,
    pub content: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct CreateInstanceRequest {
    pub template_id: Uuid,
    pub team_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInstanceRequest {
    pub status: Option<String>,
    pub content_updates: Option<Vec<EntryUpdate>>,
}

#[derive(Debug, Deserialize)]
pub struct TemplateListParams {
    pub is_active: Option<bool>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct InstanceListParams {
    pub status: Option<String>,
    pub shift_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
    pub shift_id: Option<Uuid>,
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Template handlers
// ---------------------------------------------------------------------------

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TemplateListParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:read") {
        return IoError::Forbidden("log:read permission required".into()).into_response();
    }

    let pg = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM log_templates
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
        r#"
        SELECT id, name, description, version, segment_ids, is_active,
               created_by, created_at, updated_at
        FROM log_templates
        WHERE deleted_at IS NULL
          AND ($1::bool IS NULL OR is_active = $1)
        ORDER BY name
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(params.is_active)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Err(e) => IoError::Database(e).into_response(),
        Ok(rows) => {
            let templates: Vec<LogTemplateRow> = rows
                .iter()
                .map(|r| LogTemplateRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    description: r.get("description"),
                    version: r.get("version"),
                    segment_ids: r.get::<Vec<Uuid>, _>("segment_ids"),
                    is_active: r.get("is_active"),
                    created_by: r.get("created_by"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                })
                .collect();
            Json(PagedResponse::new(templates, pg, limit, total as u64)).into_response()
        }
    }
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:admin") {
        return IoError::Forbidden("log:admin permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    let is_active = body.is_active.unwrap_or(true);
    let segment_ids = body.segment_ids;

    let row = sqlx::query(
        r#"
        INSERT INTO log_templates (name, description, segment_ids, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, version, segment_ids, is_active,
                  created_by, created_at, updated_at
        "#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&segment_ids)
    .bind(is_active)
    .bind(user_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Err(e) => {
            // Check for unique constraint violation on template name
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.message().contains("uq_log_templates_name") {
                    return IoError::Conflict(
                        format!("Template with name '{}' already exists", body.name)
                    ).into_response();
                }
            }
            IoError::Database(e).into_response()
        }
        Ok(r) => {
            let template = LogTemplateRow {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                version: r.get("version"),
                segment_ids: r.get::<Vec<Uuid>, _>("segment_ids"),
                is_active: r.get("is_active"),
                created_by: r.get("created_by"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            (StatusCode::CREATED, Json(ApiResponse::ok(template))).into_response()
        }
    }
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:admin") {
        return IoError::Forbidden("log:admin permission required".into()).into_response();
    }

    let is_active = body.is_active.unwrap_or(true);
    let segment_ids = body.segment_ids;

    let row = sqlx::query(
        r#"
        UPDATE log_templates
        SET name = $1,
            description = $2,
            segment_ids = $3,
            is_active = $4,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $5 AND deleted_at IS NULL
        RETURNING id, name, description, version, segment_ids, is_active,
                  created_by, created_at, updated_at
        "#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&segment_ids)
    .bind(is_active)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Err(e) => IoError::Database(e).into_response(),
        Ok(None) => IoError::NotFound(format!("Template {} not found", id)).into_response(),
        Ok(Some(r)) => {
            let template = LogTemplateRow {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                version: r.get("version"),
                segment_ids: r.get::<Vec<Uuid>, _>("segment_ids"),
                is_active: r.get("is_active"),
                created_by: r.get("created_by"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            Json(ApiResponse::ok(template)).into_response()
        }
    }
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:admin") {
        return IoError::Forbidden("log:admin permission required".into()).into_response();
    }

    let result = sqlx::query(
        r#"
        UPDATE log_templates
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .execute(&state.db)
    .await;

    match result {
        Err(e) => IoError::Database(e).into_response(),
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Template {} not found", id)).into_response()
        }
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
    }
}

// ---------------------------------------------------------------------------
// Segment handlers
// ---------------------------------------------------------------------------

pub async fn list_segments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:read") {
        return IoError::Forbidden("log:read permission required".into()).into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM log_segments")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let rows = sqlx::query(
        r#"
        SELECT id, name, segment_type, content_config, is_reusable
        FROM log_segments
        ORDER BY name
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Err(e) => IoError::Database(e).into_response(),
        Ok(rows) => {
            let segments: Vec<LogSegmentRow> = rows
                .iter()
                .map(|r| LogSegmentRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    segment_type: r.get("segment_type"),
                    content_config: r.get("content_config"),
                    is_reusable: r.get("is_reusable"),
                })
                .collect();
            Json(PagedResponse::new(segments, pg, limit, total as u64)).into_response()
        }
    }
}

pub async fn create_segment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSegmentRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:admin") {
        return IoError::Forbidden("log:admin permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    let is_reusable = body.is_reusable.unwrap_or(true);

    let row = sqlx::query(
        r#"
        INSERT INTO log_segments (name, segment_type, content_config, is_reusable, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, segment_type, content_config, is_reusable
        "#,
    )
    .bind(&body.name)
    .bind(&body.segment_type)
    .bind(&body.content_config)
    .bind(is_reusable)
    .bind(user_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Err(e) => IoError::Database(e).into_response(),
        Ok(r) => {
            let segment = LogSegmentRow {
                id: r.get("id"),
                name: r.get("name"),
                segment_type: r.get("segment_type"),
                content_config: r.get("content_config"),
                is_reusable: r.get("is_reusable"),
            };
            (StatusCode::CREATED, Json(ApiResponse::ok(segment))).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Instance handlers
// ---------------------------------------------------------------------------

pub async fn list_instances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<InstanceListParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:read") {
        return IoError::Forbidden("log:read permission required".into()).into_response();
    }

    let pg = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM log_instances li
         WHERE li.deleted_at IS NULL
           AND ($1::text IS NULL OR li.status = $1)
           AND ($2::uuid IS NULL OR li.shift_id = $2)
           AND ($3::uuid IS NULL OR li.template_id = $3)
           AND ($4::timestamptz IS NULL OR li.created_at >= $4)
           AND ($5::timestamptz IS NULL OR li.created_at <= $5)",
    )
    .bind(&params.status)
    .bind(params.shift_id)
    .bind(params.template_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let rows = sqlx::query(
        r#"
        SELECT li.id, li.template_id, lt.name AS template_name, li.status,
               li.team_name, li.created_at, li.completed_at
        FROM log_instances li
        JOIN log_templates lt ON lt.id = li.template_id
        WHERE li.deleted_at IS NULL
          AND ($1::text IS NULL OR li.status = $1)
          AND ($2::uuid IS NULL OR li.shift_id = $2)
          AND ($3::uuid IS NULL OR li.template_id = $3)
          AND ($4::timestamptz IS NULL OR li.created_at >= $4)
          AND ($5::timestamptz IS NULL OR li.created_at <= $5)
        ORDER BY li.created_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&params.status)
    .bind(params.shift_id)
    .bind(params.template_id)
    .bind(params.from)
    .bind(params.to)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Err(e) => IoError::Database(e).into_response(),
        Ok(rows) => {
            let instances: Vec<LogInstanceRow> = rows
                .iter()
                .map(|r| LogInstanceRow {
                    id: r.get("id"),
                    template_id: r.get("template_id"),
                    template_name: r.get("template_name"),
                    status: r.get("status"),
                    team_name: r.get("team_name"),
                    created_at: r.get("created_at"),
                    completed_at: r.get("completed_at"),
                })
                .collect();
            Json(PagedResponse::new(instances, pg, limit, total as u64)).into_response()
        }
    }
}

pub async fn create_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInstanceRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:write") {
        return IoError::Forbidden("log:write permission required".into()).into_response();
    }

    // Verify that the template exists
    let template_exists: bool = match sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM log_templates WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(body.template_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(exists) => exists,
        Err(e) => return IoError::Database(e).into_response(),
    };

    if !template_exists {
        return IoError::NotFound(format!("Template {} not found", body.template_id)).into_response();
    }

    // Insert the new instance
    let row = sqlx::query(
        r#"
        INSERT INTO log_instances (template_id, team_name, status)
        VALUES ($1, $2, $3)
        RETURNING id, template_id, status, team_name, created_at, completed_at
        "#,
    )
    .bind(body.template_id)
    .bind(&body.team_name)
    .bind("pending")
    .fetch_one(&state.db)
    .await;

    match row {
        Err(e) => IoError::Database(e).into_response(),
        Ok(r) => {
            let instance = LogInstanceRow {
                id: r.get("id"),
                template_id: r.get("template_id"),
                template_name: None,
                status: r.get("status"),
                team_name: r.get("team_name"),
                created_at: r.get("created_at"),
                completed_at: r.get("completed_at"),
            };
            (StatusCode::CREATED, Json(ApiResponse::ok(instance))).into_response()
        }
    }
}

pub async fn get_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:read") {
        return IoError::Forbidden("log:read permission required".into()).into_response();
    }

    let instance_row = sqlx::query(
        r#"
        SELECT li.id, li.template_id, lt.name AS template_name, li.status,
               li.team_name, li.created_at, li.completed_at
        FROM log_instances li
        JOIN log_templates lt ON lt.id = li.template_id
        WHERE li.id = $1 AND li.deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let instance = match instance_row {
        Err(e) => return IoError::Database(e).into_response(),
        Ok(None) => {
            return IoError::NotFound(format!("Instance {} not found", id)).into_response()
        }
        Ok(Some(r)) => LogInstanceRow {
            id: r.get("id"),
            template_id: r.get("template_id"),
            template_name: r.get("template_name"),
            status: r.get("status"),
            team_name: r.get("team_name"),
            created_at: r.get("created_at"),
            completed_at: r.get("completed_at"),
        },
    };

    let entries_rows = sqlx::query(
        r#"
        SELECT id, instance_id, segment_id, content, created_by, created_at, updated_at
        FROM log_entries
        WHERE instance_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    match entries_rows {
        Err(e) => IoError::Database(e).into_response(),
        Ok(rows) => {
            let entries: Vec<LogEntryRow> = rows
                .iter()
                .map(|r| LogEntryRow {
                    id: r.get("id"),
                    instance_id: r.get("instance_id"),
                    segment_id: r.get("segment_id"),
                    content: r.get("content"),
                    created_by: r.get("created_by"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                })
                .collect();
            let detail = LogInstanceDetail { instance, entries };
            Json(ApiResponse::ok(detail)).into_response()
        }
    }
}

pub async fn update_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInstanceRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:write") {
        return IoError::Forbidden("log:write permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    // Update status if provided
    if let Some(ref new_status) = body.status {
        let res = sqlx::query(
            r#"
            UPDATE log_instances
            SET status = $1, updated_at = NOW()
            WHERE id = $2 AND deleted_at IS NULL
            "#,
        )
        .bind(new_status)
        .bind(id)
        .execute(&state.db)
        .await;

        if let Err(e) = res {
            return IoError::Database(e).into_response();
        }
    }

    // Upsert entry content if provided
    if let Some(updates) = body.content_updates {
        for update in updates {
            // Scan entry content (Tiptap HTML/JSON) for malicious payloads
            let content_bytes = update.content.to_string();
            if let Err(e) = file_scan::check_upload(content_bytes.as_bytes(), "log-entry") {
                return e.into_response();
            }

            let res = sqlx::query(
                r#"
                INSERT INTO log_entries (instance_id, segment_id, content, created_by)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (instance_id, segment_id) DO UPDATE
                  SET content = EXCLUDED.content, updated_at = NOW()
                "#,
            )
            .bind(id)
            .bind(update.segment_id)
            .bind(&update.content)
            .bind(user_id)
            .execute(&state.db)
            .await;

            if let Err(e) = res {
                return IoError::Database(e).into_response();
            }
        }
    }

    // Return updated instance with entries
    get_instance(State(state), Extension(claims), Path(id))
        .await
        .into_response()
}

pub async fn submit_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:write") {
        return IoError::Forbidden("log:write permission required".into()).into_response();
    }

    let row = sqlx::query(
        r#"
        UPDATE log_instances
        SET status = 'submitted', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status NOT IN ('submitted', 'reviewed') AND deleted_at IS NULL
        RETURNING id, template_id, status, team_name, created_at, completed_at
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Err(e) => IoError::Database(e).into_response(),
        Ok(None) => {
            IoError::NotFound(format!("Instance {} not found or already submitted", id))
                .into_response()
        }
        Ok(Some(r)) => {
            let instance = LogInstanceRow {
                id: r.get("id"),
                template_id: r.get("template_id"),
                template_name: None,
                status: r.get("status"),
                team_name: r.get("team_name"),
                created_at: r.get("created_at"),
                completed_at: r.get("completed_at"),
            };
            Json(ApiResponse::ok(instance)).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Search handler
// ---------------------------------------------------------------------------

pub async fn search_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "log:read") {
        return IoError::Forbidden("log:read permission required".into()).into_response();
    }

    let rows = if let Some(ref q) = params.q {
        sqlx::query(
            r#"
            SELECT le.id, le.instance_id, le.segment_id, le.content,
                   le.created_by, le.created_at, le.updated_at,
                   lt.name AS template_name, li.status AS instance_status
            FROM log_entries le
            JOIN log_instances li ON li.id = le.instance_id
            JOIN log_templates lt ON lt.id = li.template_id
            WHERE to_tsvector('english', le.content::text) @@ plainto_tsquery('english', $1)
              AND ($2::uuid IS NULL OR li.shift_id = $2)
              AND ($3::text IS NULL OR li.status = $3)
              AND ($4::timestamptz IS NULL OR le.created_at >= $4)
              AND ($5::timestamptz IS NULL OR le.created_at <= $5)
            ORDER BY le.created_at DESC
            LIMIT 100
            "#,
        )
        .bind(q)
        .bind(params.shift_id)
        .bind(&params.status)
        .bind(params.from)
        .bind(params.to)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT le.id, le.instance_id, le.segment_id, le.content,
                   le.created_by, le.created_at, le.updated_at,
                   lt.name AS template_name, li.status AS instance_status
            FROM log_entries le
            JOIN log_instances li ON li.id = le.instance_id
            JOIN log_templates lt ON lt.id = li.template_id
            WHERE ($1::uuid IS NULL OR li.shift_id = $1)
              AND ($2::text IS NULL OR li.status = $2)
              AND ($3::timestamptz IS NULL OR le.created_at >= $3)
              AND ($4::timestamptz IS NULL OR le.created_at <= $4)
            ORDER BY le.created_at DESC
            LIMIT 100
            "#,
        )
        .bind(params.shift_id)
        .bind(&params.status)
        .bind(params.from)
        .bind(params.to)
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Err(e) => IoError::Database(e).into_response(),
        Ok(rows) => {
            let results: Vec<SearchResultRow> = rows
                .iter()
                .map(|r| SearchResultRow {
                    id: r.get("id"),
                    instance_id: r.get("instance_id"),
                    segment_id: r.get("segment_id"),
                    content: r.get("content"),
                    created_by: r.get("created_by"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                    template_name: r.get("template_name"),
                    instance_status: r.get("instance_status"),
                })
                .collect();
            Json(ApiResponse::ok(results)).into_response()
        }
    }
}
