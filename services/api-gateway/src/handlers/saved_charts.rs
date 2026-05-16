use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PagedResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

fn is_admin(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*")
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateSavedChartBody {
    pub name: String,
    pub description: Option<String>,
    pub chart_type: i32,
    pub config: JsonValue,
    pub published: Option<bool>,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSavedChartBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub chart_type: Option<i32>,
    pub config: Option<JsonValue>,
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SavedChartSummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub chart_type: i32,
    pub config: JsonValue,
    pub published: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListSavedChartsQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub all_users: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListChartVersionsQuery {
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ChartVersionSummary {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ChartVersionContent {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub config: JsonValue,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChartVersionLabelBody {
    pub label: Option<String>,
}

// ---------------------------------------------------------------------------
// Version metadata + snapshot helpers
// ---------------------------------------------------------------------------

fn compute_chart_version_metadata(config: &JsonValue) -> JsonValue {
    let element_count = config
        .get("points")
        .and_then(|p| p.as_array())
        .map(|arr| arr.len() as i64)
        .unwrap_or(0);

    let binding_count = config
        .get("points")
        .and_then(|p| p.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|slot| {
                    let has_point_id = slot
                        .get("pointId")
                        .and_then(|v| v.as_str())
                        .map(|s| !s.is_empty())
                        .unwrap_or(false);
                    let has_tagname = slot
                        .get("tagname")
                        .and_then(|v| v.as_str())
                        .map(|s| !s.is_empty())
                        .unwrap_or(false);
                    has_point_id || has_tagname
                })
                .count() as i64
        })
        .unwrap_or(0);

    serde_json::json!({
        "element_count": element_count,
        "binding_count": binding_count,
    })
}

async fn create_chart_version_snapshot(
    db: &sqlx::PgPool,
    chart_id: Uuid,
    created_by: Uuid,
    version_type: &str,
    config: &JsonValue,
    metadata: &JsonValue,
    label: Option<String>,
) -> Result<i32, sqlx::Error> {
    let mut tx = db.begin().await?;

    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(chart_id.to_string())
        .execute(&mut *tx)
        .await?;

    let (current_max, parent_version): (i32, Option<i32>) = sqlx::query_as(
        "SELECT COALESCE(MAX(version_number), 0), \
                CASE WHEN MAX(version_number) > 0 THEN MAX(version_number) ELSE NULL END \
         FROM saved_chart_versions \
         WHERE chart_id = $1",
    )
    .bind(chart_id)
    .fetch_one(&mut *tx)
    .await?;

    let next_version = current_max + 1;

    let effective_label = if next_version == 1 && label.is_none() {
        Some("Original".to_string())
    } else {
        label
    };

    sqlx::query(
        r#"
        INSERT INTO saved_chart_versions
            (id, chart_id, version_number, version_type, config,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(chart_id)
    .bind(next_version)
    .bind(version_type)
    .bind(config)
    .bind(metadata)
    .bind(created_by)
    .bind(&effective_label)
    .bind(parent_version)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        chart_id = %chart_id,
        version = next_version,
        version_type = version_type,
        "Chart version snapshot created"
    );

    Ok(next_version)
}

// ---------------------------------------------------------------------------
// POST /api/v1/saved-charts — create
// ---------------------------------------------------------------------------

pub async fn create_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSavedChartBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let can_publish = check_permission(&claims, "console:workspace_publish");
    let published = body.published == Some(true) && can_publish;
    let id = Uuid::new_v4();

    let row = match sqlx::query(
        r#"
        INSERT INTO saved_charts (id, name, description, chart_type, config, published, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, description, chart_type, config, published, created_by, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.chart_type)
    .bind(&body.config)
    .bind(published)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_saved_chart insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let chart = row_to_summary(&row);
    let config_snap = body.config.clone();
    let version_metadata = compute_chart_version_metadata(&config_snap);
    let label = body.label.clone();
    let db = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) =
            create_chart_version_snapshot(&db, id, user_id, "save", &config_snap, &version_metadata, label).await
        {
            tracing::warn!(error = %e, chart_id = %id, "Chart version snapshot creation failed (non-fatal)");
        }
    });

    Json(ApiResponse::ok(chart)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/v1/saved-charts — list
// ---------------------------------------------------------------------------

pub async fn list_saved_charts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListSavedChartsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:read") {
        return IoError::Forbidden("console:read permission required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let page = params.page.unwrap_or(1).max(1) as i64;
    let per_page = params.per_page.unwrap_or(50).clamp(1, 200) as i64;
    let offset = (page - 1) * per_page;

    let all_users = params.all_users.as_deref() == Some("true") && is_admin(&claims);

    let (total, rows) = if all_users {
        let total: i64 = match sqlx::query_scalar(
            "SELECT COUNT(*) FROM saved_charts WHERE deleted_at IS NULL",
        )
        .fetch_one(&state.db)
        .await
        {
            Ok(n) => n,
            Err(e) => return IoError::Database(e).into_response(),
        };

        let rows = match sqlx::query(
            r#"
            SELECT id, name, description, chart_type, config, published, created_by, created_at, updated_at
            FROM saved_charts
            WHERE deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => return IoError::Database(e).into_response(),
        };

        (total, rows)
    } else {
        let total: i64 = match sqlx::query_scalar(
            "SELECT COUNT(*) FROM saved_charts WHERE deleted_at IS NULL AND (created_by = $1 OR published = true)",
        )
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        {
            Ok(n) => n,
            Err(e) => return IoError::Database(e).into_response(),
        };

        let rows = match sqlx::query(
            r#"
            SELECT id, name, description, chart_type, config, published, created_by, created_at, updated_at
            FROM saved_charts
            WHERE deleted_at IS NULL
              AND (created_by = $1 OR published = true)
            ORDER BY updated_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => return IoError::Database(e).into_response(),
        };

        (total, rows)
    };

    let items: Vec<SavedChartSummary> = rows.iter().map(row_to_summary).collect();
    Json(PagedResponse::new(items, page as u32, per_page as u32, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/v1/saved-charts/:id — get single
// ---------------------------------------------------------------------------

pub async fn get_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:read") {
        return IoError::Forbidden("console:read permission required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        SELECT id, name, description, chart_type, config, published, created_by, created_at, updated_at
        FROM saved_charts
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Saved chart {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let created_by: Uuid = row.try_get("created_by").unwrap_or(Uuid::nil());
    let published: bool = row.try_get("published").unwrap_or(false);

    if created_by != user_id && !published && !is_admin(&claims) {
        return IoError::NotFound(format!("Saved chart {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(row_to_summary(&row))).into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/v1/saved-charts/:id — update
// ---------------------------------------------------------------------------

pub async fn update_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSavedChartBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        UPDATE saved_charts
        SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description),
            chart_type  = COALESCE($3, chart_type),
            config      = COALESCE($4, config)
        WHERE id = $5
          AND deleted_at IS NULL
          AND created_by = $6
        RETURNING id, name, description, chart_type, config, published, created_by, created_at, updated_at
        "#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.chart_type)
    .bind(&body.config)
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Saved chart {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Snapshot on update if config was changed
    if body.config.is_some() {
        let config_snap: JsonValue = row.try_get("config").unwrap_or(JsonValue::Null);
        let version_metadata = compute_chart_version_metadata(&config_snap);
        let label = body.label.clone();
        let db = state.db.clone();
        tokio::spawn(async move {
            if let Err(e) =
                create_chart_version_snapshot(&db, id, user_id, "save", &config_snap, &version_metadata, label).await
            {
                tracing::warn!(error = %e, chart_id = %id, "Chart version snapshot creation failed (non-fatal)");
            }
        });
    }

    Json(ApiResponse::ok(row_to_summary(&row))).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/saved-charts/:id — soft delete
// ---------------------------------------------------------------------------

pub async fn delete_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE saved_charts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE saved_charts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND created_by = $2 RETURNING id",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response(),
        Ok(None) => IoError::NotFound(format!("Saved chart {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /api/v1/saved-charts/:id/publish
// ---------------------------------------------------------------------------

pub async fn publish_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:workspace_publish") {
        return IoError::Forbidden("console:workspace_publish permission required".into())
            .into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE saved_charts SET published = true WHERE id = $1 AND deleted_at IS NULL RETURNING id, config",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE saved_charts SET published = true WHERE id = $1 AND deleted_at IS NULL AND created_by = $2 RETURNING id, config",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(row)) => {
            let config: JsonValue = row.try_get("config").unwrap_or(JsonValue::Null);
            let version_metadata = compute_chart_version_metadata(&config);
            match create_chart_version_snapshot(
                &state.db, id, user_id, "publish", &config, &version_metadata, None,
            )
            .await
            {
                Ok(version) => {
                    tracing::info!(chart_id = %id, version = version, "Chart published");
                    Json(ApiResponse::ok(serde_json::json!({
                        "version_number": version,
                        "published": true,
                    })))
                    .into_response()
                }
                Err(e) => {
                    tracing::error!(error = %e, "publish_saved_chart version snapshot failed");
                    IoError::Database(e).into_response()
                }
            }
        }
        Ok(None) => IoError::NotFound(format!("Saved chart {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /api/v1/saved-charts/:id/unpublish
// ---------------------------------------------------------------------------

pub async fn unpublish_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:workspace_publish") {
        return IoError::Forbidden("console:workspace_publish permission required".into())
            .into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE saved_charts SET published = false WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE saved_charts SET published = false WHERE id = $1 AND deleted_at IS NULL AND created_by = $2 RETURNING id",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            Json(ApiResponse::ok(serde_json::json!({ "id": id, "published": false }))).into_response()
        }
        Ok(None) => IoError::NotFound(format!("Saved chart {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// GET /api/v1/saved-charts/:id/versions — list versions
// ---------------------------------------------------------------------------

pub async fn list_chart_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListChartVersionsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:read") {
        return IoError::Forbidden("console:read permission required".into()).into_response();
    }

    let user_id: Uuid = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // Must own the chart or it must be published (or be admin)
    let has_access: bool = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM saved_charts WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR published = true OR $3))",
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
    .fetch_one(&state.db)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "list_chart_versions access check failed");
            return IoError::Database(e).into_response();
        }
    };

    if !has_access {
        return IoError::Forbidden("Not authorized to view this chart".into()).into_response();
    }

    let include_deleted = query.include_deleted.unwrap_or(false) && is_admin(&claims);
    let deleted_filter = if include_deleted {
        ""
    } else {
        "AND v.deleted_at IS NULL"
    };

    let sql = format!(
        r#"
        SELECT v.id, v.version_number, v.version_type, v.label,
               v.parent_version_number, v.metadata, v.created_by,
               v.created_at, v.deleted_at,
               u.display_name AS created_by_name
        FROM saved_chart_versions v
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.chart_id = $1 {deleted_filter}
        ORDER BY v.version_number DESC
        "#,
        deleted_filter = deleted_filter,
    );

    let rows = match sqlx::query(&sql).bind(id).fetch_all(&state.db).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_chart_versions query failed");
            return IoError::Database(e).into_response();
        }
    };

    let versions: Vec<ChartVersionSummary> = rows
        .iter()
        .filter_map(|row| {
            Some(ChartVersionSummary {
                id: row.try_get("id").ok()?,
                version_number: row.try_get("version_number").ok()?,
                version_type: row.try_get("version_type").ok()?,
                label: row.try_get("label").ok().flatten(),
                parent_version_number: row.try_get("parent_version_number").ok().flatten(),
                metadata: row.try_get("metadata").ok().flatten(),
                created_by: row.try_get("created_by").ok()?,
                created_by_name: row.try_get("created_by_name").ok().flatten(),
                created_at: row.try_get("created_at").ok()?,
                deleted_at: row.try_get("deleted_at").ok().flatten(),
            })
        })
        .collect();

    Json(ApiResponse::ok(versions)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/v1/saved-charts/:id/versions/:version_number — get version content
// ---------------------------------------------------------------------------

pub async fn get_chart_version_content(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:read") {
        return IoError::Forbidden("console:read permission required".into()).into_response();
    }

    let user_id: Uuid = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let has_access: bool = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM saved_charts WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR published = true OR $3))",
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
    .fetch_one(&state.db)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "get_chart_version_content access check failed");
            return IoError::Database(e).into_response();
        }
    };

    if !has_access {
        return IoError::Forbidden("Not authorized to view this chart".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, version_number, version_type, label, parent_version_number,
               config, metadata, created_by, created_at
        FROM saved_chart_versions
        WHERE chart_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!(
                "Version {} of chart {} not found",
                version_number, id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_chart_version_content query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content = ChartVersionContent {
        id: row.try_get("id").unwrap_or_default(),
        version_number: row.try_get("version_number").unwrap_or(0),
        version_type: row.try_get("version_type").unwrap_or_default(),
        label: row.try_get("label").ok().flatten(),
        parent_version_number: row.try_get("parent_version_number").ok().flatten(),
        config: row.try_get("config").unwrap_or(serde_json::json!({})),
        metadata: row.try_get("metadata").ok().flatten(),
        created_by: row.try_get("created_by").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(content)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/saved-charts/:id/versions/:version_number/restore
// ---------------------------------------------------------------------------

pub async fn restore_chart_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let ver_row = match sqlx::query(
        r#"
        SELECT config
        FROM saved_chart_versions
        WHERE chart_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!(
                "Version {} of chart {} not found",
                version_number, id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "restore_chart_version fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let config: JsonValue = ver_row.try_get("config").unwrap_or(serde_json::json!({}));

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(error = %e, "restore_chart_version begin transaction failed");
            return IoError::Database(e).into_response();
        }
    };

    if let Err(e) = sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
    {
        tracing::error!(error = %e, "restore_chart_version advisory lock failed");
        return IoError::Database(e).into_response();
    }

    // Update the chart's live config
    let update_result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE saved_charts SET config = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id",
        )
        .bind(&config)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
    } else {
        sqlx::query(
            "UPDATE saved_charts SET config = $1 WHERE id = $2 AND deleted_at IS NULL AND created_by = $3 RETURNING id",
        )
        .bind(&config)
        .bind(id)
        .bind(created_by)
        .fetch_optional(&mut *tx)
        .await
    };

    match update_result {
        Ok(Some(_)) => {}
        Ok(None) => {
            return IoError::NotFound(format!(
                "Chart {} not found or not owned by you",
                id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "restore_chart_version update failed");
            return IoError::Database(e).into_response();
        }
    }

    let next_version: i32 = match sqlx::query_scalar(
        "SELECT COALESCE(MAX(version_number), 0) + 1 FROM saved_chart_versions WHERE chart_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "restore_chart_version next_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    let restore_label = format!("Restored from v{}", version_number);
    let version_metadata = compute_chart_version_metadata(&config);

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO saved_chart_versions
            (id, chart_id, version_number, version_type, config,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, 'save', $4, $5, $6, $7, $8)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(next_version)
    .bind(&config)
    .bind(&version_metadata)
    .bind(created_by)
    .bind(&restore_label)
    .bind(version_number)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, "restore_chart_version insert failed");
        return IoError::Database(e).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "restore_chart_version commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(chart_id = %id, restored_from = version_number, new_version = next_version, "Chart version restored");
    Json(ApiResponse::ok(serde_json::json!({
        "version_number": next_version,
        "restored_from": version_number,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/saved-charts/:id/versions/:version_number — soft-delete
// ---------------------------------------------------------------------------

pub async fn soft_delete_chart_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE saved_chart_versions SET deleted_at = NOW()
            WHERE chart_id = $1 AND version_number = $2 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(version_number)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE saved_chart_versions SET deleted_at = NOW()
            WHERE chart_id = $1 AND version_number = $2
              AND created_by = $3 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(version_number)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(chart_id = %id, version = version_number, "Chart version soft-deleted");
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response()
        }
        Ok(None) => IoError::NotFound(format!(
            "Version {} of chart {} not found or not owned by you",
            version_number, id
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "soft_delete_chart_version query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/v1/saved-charts/:id/versions/:version_number/recover (admin)
// ---------------------------------------------------------------------------

pub async fn recover_chart_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let result = match sqlx::query(
        r#"
        UPDATE saved_chart_versions SET deleted_at = NULL
        WHERE chart_id = $1 AND version_number = $2 AND deleted_at IS NOT NULL
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "recover_chart_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(_) => {
            tracing::info!(chart_id = %id, version = version_number, "Chart version recovered");
            Json(ApiResponse::ok(serde_json::json!({ "recovered": true }))).into_response()
        }
        None => IoError::NotFound(format!(
            "Soft-deleted version {} of chart {} not found",
            version_number, id
        ))
        .into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/saved-charts/:id/versions/:version_number/permanent (admin)
// ---------------------------------------------------------------------------

pub async fn permanent_delete_chart_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = match sqlx::query(
        r#"
        DELETE FROM saved_chart_versions
        WHERE chart_id = $1 AND version_number = $2
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "permanent_delete_chart_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(row) => {
            let version_uuid: Uuid = row.try_get("id").unwrap_or_default();
            let audit_meta = serde_json::json!({
                "chart_id": id.to_string(),
                "version_number": version_number,
                "action": "permanent_delete",
            });
            let db = state.db.clone();
            tokio::spawn(async move {
                let _ = sqlx::query(
                    "INSERT INTO audit_log \
                     (id, table_name, action, record_id, user_id, changes) \
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(Uuid::new_v4())
                .bind("saved_chart_versions")
                .bind("version.permanent_delete")
                .bind(version_uuid)
                .bind(user_id)
                .bind(audit_meta)
                .execute(&db)
                .await;
            });

            tracing::info!(chart_id = %id, version = version_number, "Chart version permanently deleted");
            Json(ApiResponse::ok(
                serde_json::json!({ "permanently_deleted": true }),
            ))
            .into_response()
        }
        None => IoError::NotFound(format!(
            "Version {} of chart {} not found",
            version_number, id
        ))
        .into_response(),
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/saved-charts/:id/versions/:version_number — update label
// ---------------------------------------------------------------------------

pub async fn update_chart_version_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
    Json(body): Json<UpdateChartVersionLabelBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE saved_chart_versions SET label = $1
            WHERE chart_id = $2 AND version_number = $3 AND deleted_at IS NULL
            RETURNING id, label
            "#,
        )
        .bind(&body.label)
        .bind(id)
        .bind(version_number)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE saved_chart_versions SET label = $1
            WHERE chart_id = $2 AND version_number = $3
              AND created_by = $4 AND deleted_at IS NULL
            RETURNING id, label
            "#,
        )
        .bind(&body.label)
        .bind(id)
        .bind(version_number)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(row)) => {
            let label: Option<String> = row.try_get("label").ok().flatten();
            Json(ApiResponse::ok(serde_json::json!({
                "version_number": version_number,
                "label": label,
            })))
            .into_response()
        }
        Ok(None) => IoError::NotFound(format!(
            "Version {} of chart {} not found or not owned by you",
            version_number, id
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_chart_version_label query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Row mapping helper
// ---------------------------------------------------------------------------

fn row_to_summary(row: &sqlx::postgres::PgRow) -> SavedChartSummary {
    SavedChartSummary {
        id: row.try_get("id").unwrap_or_else(|_| Uuid::nil()),
        name: row.try_get("name").unwrap_or_default(),
        description: row.try_get("description").ok().flatten(),
        chart_type: row.try_get("chart_type").unwrap_or(0),
        config: row.try_get("config").unwrap_or(JsonValue::Null),
        published: row.try_get("published").unwrap_or(false),
        created_by: row.try_get("created_by").unwrap_or_else(|_| Uuid::nil()),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
        updated_at: row.try_get("updated_at").unwrap_or_else(|_| Utc::now()),
    }
}
