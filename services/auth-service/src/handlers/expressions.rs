/// Custom Expression CRUD + server-side Rhai evaluation.
///
/// The `custom_expressions` table schema (migration 12):
///   id, name, description, expression (JSONB), output_type,
///   output_precision, expression_context, created_by, shared,
///   referenced_point_ids, created_at, updated_at
///
/// Permission header injected by the gateway:
///   x-io-user-id  — UUID of the authenticated user
///   x-io-permissions — comma-separated permission list
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
use io_models::{ApiResponse, PagedResponse};

use crate::expression_eval;
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
        .map(|perms| {
            perms
                .split(',')
                .any(|p| p.trim() == "*" || p.trim() == perm)
        })
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ExpressionRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Serialized as `"ast"` to match the frontend `SavedExpression.ast` field.
    #[serde(rename = "ast")]
    pub expression: JsonValue,
    pub output_type: String,
    pub output_precision: Option<i32>,
    /// Serialized as `"context"` to match the frontend `SavedExpression.context` field.
    #[serde(rename = "context")]
    pub expression_context: String,
    pub created_by: Uuid,
    /// Serialized as `"is_shared"` to match the frontend `SavedExpression.is_shared` field.
    #[serde(rename = "is_shared")]
    pub shared: bool,
    pub referenced_point_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn map_row(r: &sqlx::postgres::PgRow) -> Result<ExpressionRow, sqlx::Error> {
    Ok(ExpressionRow {
        id: r.try_get("id")?,
        name: r.try_get("name")?,
        description: r.try_get("description")?,
        expression: r.try_get("expression")?,
        output_type: r.try_get("output_type")?,
        output_precision: r.try_get("output_precision")?,
        expression_context: r.try_get("expression_context")?,
        created_by: r.try_get("created_by")?,
        shared: r.try_get("shared")?,
        referenced_point_ids: r
            .try_get::<Vec<Uuid>, _>("referenced_point_ids")
            .unwrap_or_default(),
        created_at: r.try_get("created_at")?,
        updated_at: r.try_get("updated_at")?,
    })
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateExpressionRequest {
    pub name: String,
    pub description: Option<String>,
    /// Expression context — accepts both backend names (conversion, calculated_value, …)
    /// and frontend ExpressionContext values (point_config, alarm_definition, …).
    #[serde(alias = "context")]
    pub expression_context: Option<String>,
    /// The ExpressionAst JSON stored as JSONB. Frontend sends field name "ast".
    #[serde(alias = "ast")]
    pub expression: JsonValue,
    pub output_type: Option<String>,
    pub output_precision: Option<i32>,
    pub is_shared: Option<bool>,
    pub referenced_point_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExpressionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    /// Frontend sends "ast"; backend column is "expression".
    #[serde(alias = "ast")]
    pub expression: Option<JsonValue>,
    pub output_type: Option<String>,
    pub output_precision: Option<i32>,
    pub is_shared: Option<bool>,
    pub referenced_point_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct ExpressionFilter {
    pub page: Option<u64>,
    pub limit: Option<u64>,
    pub context: Option<String>,
    pub q: Option<String>,
    /// If true, return only the caller's expressions; if false, include shared too.
    pub mine_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EvaluateRequest {
    /// Map of point_id -> current value for substitution.
    pub point_values: std::collections::HashMap<String, f64>,
}

#[derive(Debug, Deserialize)]
pub struct EvaluateInlineRequest {
    /// The ExpressionAst JSON directly.
    pub expression: JsonValue,
    pub point_values: std::collections::HashMap<String, f64>,
}

#[derive(Debug, Serialize)]
pub struct EvaluateResponse {
    pub result: f64,
}

// ---------------------------------------------------------------------------
// GET /expressions
// ---------------------------------------------------------------------------

pub async fn list_expressions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<ExpressionFilter>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let page = filter.page.unwrap_or(1).max(1) as u32;
    let limit = filter.limit.unwrap_or(50).clamp(1, 100) as u32;
    let offset = ((page - 1) * limit) as i64;
    let q_pattern = filter.q.as_deref().map(|q| format!("%{q}%"));
    let mine_only = filter.mine_only.unwrap_or(false);

    // Visible: own expressions OR shared expressions (unless mine_only).
    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM custom_expressions
         WHERE ($1::boolean = true OR created_by = $2 OR shared = true)
           AND ($3::text IS NULL OR expression_context = $3)
           AND ($4::text IS NULL OR name ILIKE $4 OR description ILIKE $4)",
    )
    .bind(mine_only)
    .bind(caller)
    .bind(filter.context.as_deref())
    .bind(q_pattern.as_deref())
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<i64, _>(0))?;

    let rows = sqlx::query(
        "SELECT id, name, description, expression, output_type, output_precision,
                expression_context, created_by, shared, referenced_point_ids,
                created_at, updated_at
         FROM custom_expressions
         WHERE ($1::boolean = true OR created_by = $2 OR shared = true)
           AND ($3::text IS NULL OR expression_context = $3)
           AND ($4::text IS NULL OR name ILIKE $4 OR description ILIKE $4)
         ORDER BY created_at DESC
         LIMIT $5 OFFSET $6",
    )
    .bind(mine_only)
    .bind(caller)
    .bind(filter.context.as_deref())
    .bind(q_pattern.as_deref())
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ExpressionRow> = rows
        .iter()
        .filter_map(|r| match map_row(r) {
            Ok(e) => Some(e),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed expression row");
                None
            }
        })
        .collect();

    Ok(Json(PagedResponse::new(items, page, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// GET /expressions/:id
// ---------------------------------------------------------------------------

pub async fn get_expression(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let row = sqlx::query(
        "SELECT id, name, description, expression, output_type, output_precision,
                expression_context, created_by, shared, referenced_point_ids,
                created_at, updated_at
         FROM custom_expressions
         WHERE id = $1 AND (created_by = $2 OR shared = true)",
    )
    .bind(id)
    .bind(caller)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Expression {id} not found")))?;

    let expr = map_row(&row).map_err(IoError::Database)?;
    Ok(Json(ApiResponse::ok(expr)))
}

// ---------------------------------------------------------------------------
// POST /expressions
// ---------------------------------------------------------------------------

pub async fn create_expression(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateExpressionRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    if !has_permission(&headers, "system:expression_manage") {
        return Err(IoError::Forbidden(
            "system:expression_manage permission required".into(),
        ));
    }

    if req.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".into()));
    }

    let context = req
        .expression_context
        .unwrap_or_else(|| "custom".to_string());
    let valid_contexts = [
        // Legacy backend context names (kept for backwards compatibility)
        "conversion",
        "calculated_value",
        "alarm_condition",
        "custom",
        // Frontend ExpressionContext values
        "point_config",
        "alarm_definition",
        "rounds_checkpoint",
        "log_segment",
        "widget",
        "forensics",
    ];
    if !valid_contexts.contains(&context.as_str()) {
        return Err(IoError::BadRequest(
            "expression_context must be one of: conversion, calculated_value, alarm_condition, custom, point_config, alarm_definition, rounds_checkpoint, log_segment, widget, forensics".into(),
        ));
    }

    let output_type = req.output_type.unwrap_or_else(|| "float".to_string());
    if !["float", "integer"].contains(&output_type.as_str()) {
        return Err(IoError::BadRequest(
            "output_type must be 'float' or 'integer'".into(),
        ));
    }

    let shared = req.is_shared.unwrap_or(false);
    let point_ids: Vec<Uuid> = req.referenced_point_ids.unwrap_or_default();

    let new_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO custom_expressions
             (id, name, description, expression, output_type, output_precision,
              expression_context, created_by, shared, referenced_point_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(new_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.expression)
    .bind(&output_type)
    .bind(req.output_precision)
    .bind(&context)
    .bind(caller)
    .bind(shared)
    .bind(&point_ids)
    .execute(&state.db)
    .await?;

    // Re-fetch so we return the server-assigned timestamps.
    let row = sqlx::query(
        "SELECT id, name, description, expression, output_type, output_precision,
                expression_context, created_by, shared, referenced_point_ids,
                created_at, updated_at
         FROM custom_expressions WHERE id = $1",
    )
    .bind(new_id)
    .fetch_one(&state.db)
    .await?;

    let expr = map_row(&row).map_err(IoError::Database)?;

    // Notify data-broker to reload this expression.
    sqlx::query("SELECT pg_notify('expression_changed', $1)")
        .bind(format!("{new_id}:created"))
        .execute(&state.db)
        .await
        .ok();

    Ok((StatusCode::CREATED, Json(ApiResponse::ok(expr))))
}

// ---------------------------------------------------------------------------
// PUT /expressions/:id
// ---------------------------------------------------------------------------

pub async fn update_expression(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateExpressionRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    // Fetch to verify existence and ownership.
    let row = sqlx::query("SELECT id, created_by FROM custom_expressions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Expression {id} not found")))?;

    let owner: Uuid = row.try_get("created_by").map_err(IoError::Database)?;
    let is_admin = has_permission(&headers, "system:admin");
    if owner != caller && !is_admin {
        return Err(IoError::Forbidden(
            "Only the owner or an admin may update this expression".into(),
        ));
    }

    if let Some(name) = &req.name {
        if name.trim().is_empty() {
            return Err(IoError::BadRequest("name must not be empty".into()));
        }
        sqlx::query("UPDATE custom_expressions SET name = $1, updated_at = NOW() WHERE id = $2")
            .bind(name)
            .bind(id)
            .execute(&state.db)
            .await?;
    }

    if let Some(description) = &req.description {
        sqlx::query(
            "UPDATE custom_expressions SET description = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(description)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(expression) = &req.expression {
        sqlx::query(
            "UPDATE custom_expressions SET expression = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(expression)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(output_type) = &req.output_type {
        if !["float", "integer"].contains(&output_type.as_str()) {
            return Err(IoError::BadRequest(
                "output_type must be 'float' or 'integer'".into(),
            ));
        }
        sqlx::query(
            "UPDATE custom_expressions SET output_type = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(output_type)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(prec) = req.output_precision {
        sqlx::query(
            "UPDATE custom_expressions SET output_precision = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(prec)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    if let Some(shared) = req.is_shared {
        sqlx::query("UPDATE custom_expressions SET shared = $1, updated_at = NOW() WHERE id = $2")
            .bind(shared)
            .bind(id)
            .execute(&state.db)
            .await?;
    }

    if let Some(point_ids) = &req.referenced_point_ids {
        sqlx::query(
            "UPDATE custom_expressions SET referenced_point_ids = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(point_ids)
        .bind(id)
        .execute(&state.db)
        .await?;
    }

    // Notify data-broker to reload this expression.
    sqlx::query("SELECT pg_notify('expression_changed', $1)")
        .bind(format!("{id}:updated"))
        .execute(&state.db)
        .await
        .ok();

    get_expression(State(state), headers, Path(id)).await
}

// ---------------------------------------------------------------------------
// DELETE /expressions/:id
// ---------------------------------------------------------------------------

pub async fn delete_expression(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let row = sqlx::query("SELECT id, created_by FROM custom_expressions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Expression {id} not found")))?;

    let owner: Uuid = row.try_get("created_by").map_err(IoError::Database)?;
    let is_admin = has_permission(&headers, "system:admin");
    if owner != caller && !is_admin {
        return Err(IoError::Forbidden(
            "Only the owner or an admin may delete this expression".into(),
        ));
    }

    // No deleted_at column — hard delete (expression table has no deleted_at).
    let result = sqlx::query("DELETE FROM custom_expressions WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!("Expression {id} not found")));
    }

    // Notify data-broker to remove this expression.
    sqlx::query("SELECT pg_notify('expression_changed', $1)")
        .bind(format!("{id}:deleted"))
        .execute(&state.db)
        .await
        .ok();

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /expressions/by-context/:ctx
// ---------------------------------------------------------------------------

pub async fn list_expressions_by_context(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ctx): Path<String>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let rows = sqlx::query(
        "SELECT id, name, description, expression, output_type, output_precision,
                expression_context, created_by, shared, referenced_point_ids,
                created_at, updated_at
         FROM custom_expressions
         WHERE expression_context = $1
           AND (created_by = $2 OR shared = true)
         ORDER BY name ASC",
    )
    .bind(&ctx)
    .bind(caller)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ExpressionRow> = rows
        .iter()
        .filter_map(|r| match map_row(r) {
            Ok(e) => Some(e),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed expression row");
                None
            }
        })
        .collect();

    Ok(Json(ApiResponse::ok(items)))
}

// ---------------------------------------------------------------------------
// GET /expressions/by-point/:point_id
// ---------------------------------------------------------------------------

pub async fn list_expressions_by_point(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(point_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let rows = sqlx::query(
        "SELECT id, name, description, expression, output_type, output_precision,
                expression_context, created_by, shared, referenced_point_ids,
                created_at, updated_at
         FROM custom_expressions
         WHERE $1::uuid = ANY(referenced_point_ids)
           AND (created_by = $2 OR shared = true)
         ORDER BY name ASC",
    )
    .bind(point_id)
    .bind(caller)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ExpressionRow> = rows
        .iter()
        .filter_map(|r| match map_row(r) {
            Ok(e) => Some(e),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed expression row");
                None
            }
        })
        .collect();

    Ok(Json(ApiResponse::ok(items)))
}

// ---------------------------------------------------------------------------
// POST /expressions/:id/evaluate
// ---------------------------------------------------------------------------

pub async fn evaluate_expression_by_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<EvaluateRequest>,
) -> IoResult<impl IntoResponse> {
    let caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let row = sqlx::query(
        "SELECT expression FROM custom_expressions
         WHERE id = $1 AND (created_by = $2 OR shared = true)",
    )
    .bind(id)
    .bind(caller)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Expression {id} not found")))?;

    let ast: JsonValue = row.try_get("expression").map_err(IoError::Database)?;
    let result = expression_eval::evaluate_expression(&ast, &req.point_values)
        .map_err(|e| IoError::BadRequest(format!("Evaluation error: {e}")))?;

    Ok(Json(ApiResponse::ok(EvaluateResponse { result })))
}

// ---------------------------------------------------------------------------
// POST /expressions/evaluate  (inline / unsaved)
// ---------------------------------------------------------------------------

pub async fn evaluate_expression_inline(
    headers: HeaderMap,
    Json(req): Json<EvaluateInlineRequest>,
) -> IoResult<impl IntoResponse> {
    let _caller = user_id_from_headers(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let result = expression_eval::evaluate_expression(&req.expression, &req.point_values)
        .map_err(|e| IoError::BadRequest(format!("Evaluation error: {e}")))?;

    Ok(Json(ApiResponse::ok(EvaluateResponse { result })))
}
