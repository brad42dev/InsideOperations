//! Forensics module handlers — investigations, stages, evidence, point curation,
//! correlation analysis, threshold search, and alarm search.

use axum::{
    extract::{Path, Query, State},
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
use std::collections::HashMap;
use uuid::Uuid;

use crate::correlation::{self, TimeSeriesPoint};
use crate::state::AppState;

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
pub struct InvestigationRow {
    pub id: Uuid,
    pub name: String,
    pub status: String,
    pub anchor_point_id: Option<Uuid>,
    pub anchor_alarm_id: Option<Uuid>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct InvestigationPointRow {
    pub investigation_id: Uuid,
    pub point_id: Uuid,
    pub status: String,
    pub removal_reason: Option<String>,
    pub added_at: DateTime<Utc>,
    pub removed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct StageRow {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub name: String,
    pub sort_order: i16,
    pub time_range_start: DateTime<Utc>,
    pub time_range_end: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct EvidenceRow {
    pub id: Uuid,
    pub stage_id: Uuid,
    pub evidence_type: String,
    pub config: JsonValue,
    pub sort_order: i16,
}

#[derive(Debug, Serialize)]
pub struct StageWithEvidence {
    #[serde(flatten)]
    pub stage: StageRow,
    pub evidence: Vec<EvidenceRow>,
    pub points: Vec<InvestigationPointRow>,
}

#[derive(Debug, Serialize)]
pub struct InvestigationDetail {
    #[serde(flatten)]
    pub investigation: InvestigationRow,
    pub stages: Vec<StageWithEvidence>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvestigationRequest {
    pub name: String,
    pub anchor_point_id: Option<Uuid>,
    pub anchor_alarm_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInvestigationRequest {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListParams {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStageRequest {
    pub name: String,
    pub time_range_start: DateTime<Utc>,
    pub time_range_end: DateTime<Utc>,
    pub sort_order: Option<i16>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStageRequest {
    pub name: Option<String>,
    pub time_range_start: Option<DateTime<Utc>>,
    pub time_range_end: Option<DateTime<Utc>>,
    pub sort_order: Option<i16>,
}

#[derive(Debug, Deserialize)]
pub struct AddEvidenceRequest {
    pub evidence_type: String,
    pub config: JsonValue,
    pub sort_order: Option<i16>,
}

#[derive(Debug, Deserialize)]
pub struct AddPointsRequest {
    pub point_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemovePointBody {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CorrelateRequest {
    pub point_ids: Vec<String>,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    /// Bucket interval hint, e.g. "1m", "5m", "1h".  Currently informational;
    /// the query always uses points_history_1m.
    #[allow(dead_code)]
    pub bucket_interval: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ThresholdSearchRequest {
    pub point_id: String,
    /// Operator: "gt", "lt", "gte", "lte", "eq"
    pub operator: String,
    pub threshold: f64,
    pub lookback_days: Option<i64>,
    #[allow(dead_code)]
    pub bucket_interval: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AlarmSearchRequest {
    pub point_id: String,
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ExceedanceWindow {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub peak_value: f64,
    pub duration_seconds: i64,
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

fn row_to_investigation(row: &sqlx::postgres::PgRow) -> Result<InvestigationRow, sqlx::Error> {
    Ok(InvestigationRow {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        status: row.try_get("status")?,
        anchor_point_id: row.try_get("anchor_point_id").ok().flatten(),
        anchor_alarm_id: row.try_get("anchor_alarm_id").ok().flatten(),
        created_by: row.try_get("created_by")?,
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
        updated_at: row.try_get("updated_at").unwrap_or_else(|_| Utc::now()),
        closed_at: row.try_get("closed_at").ok().flatten(),
    })
}

fn row_to_stage(row: &sqlx::postgres::PgRow) -> Result<StageRow, sqlx::Error> {
    Ok(StageRow {
        id: row.try_get("id")?,
        investigation_id: row.try_get("investigation_id")?,
        name: row.try_get("name")?,
        sort_order: row.try_get("sort_order").unwrap_or(0),
        time_range_start: row.try_get("time_range_start")?,
        time_range_end: row.try_get("time_range_end")?,
    })
}

fn row_to_evidence(row: &sqlx::postgres::PgRow) -> Result<EvidenceRow, sqlx::Error> {
    Ok(EvidenceRow {
        id: row.try_get("id")?,
        stage_id: row.try_get("stage_id")?,
        evidence_type: row.try_get("evidence_type")?,
        config: row
            .try_get("config")
            .unwrap_or(JsonValue::Object(serde_json::Map::new())),
        sort_order: row.try_get("sort_order").unwrap_or(0),
    })
}

fn row_to_point(row: &sqlx::postgres::PgRow) -> Result<InvestigationPointRow, sqlx::Error> {
    Ok(InvestigationPointRow {
        investigation_id: row.try_get("investigation_id")?,
        point_id: row.try_get("point_id")?,
        status: row.try_get("status")?,
        removal_reason: row.try_get("removal_reason").ok().flatten(),
        added_at: row.try_get("added_at").unwrap_or_else(|_| Utc::now()),
        removed_at: row.try_get("removed_at").ok().flatten(),
    })
}

// ---------------------------------------------------------------------------
// GET /api/forensics/investigations
// ---------------------------------------------------------------------------

pub async fn list_investigations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:read") {
        return IoError::Forbidden("forensics:read permission required".into()).into_response();
    }

    let user_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let is_admin = check_permission(&claims, "forensics:admin");

    // Build query: admins see all; regular users see own + shared.
    let rows = if is_admin {
        match sqlx::query(
            r#"
            SELECT i.id, i.name, i.status, i.anchor_point_id, i.anchor_alarm_id,
                   i.created_by, i.created_at, i.updated_at, i.closed_at
            FROM investigations i
            WHERE i.deleted_at IS NULL
              AND ($1::varchar IS NULL OR i.status = $1)
            ORDER BY i.created_at DESC
            "#,
        )
        .bind(&params.status)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_investigations admin query failed");
                return IoError::Database(e).into_response();
            }
        }
    } else {
        match sqlx::query(
            r#"
            SELECT DISTINCT i.id, i.name, i.status, i.anchor_point_id, i.anchor_alarm_id,
                            i.created_by, i.created_at, i.updated_at, i.closed_at
            FROM investigations i
            LEFT JOIN investigation_shares s ON s.investigation_id = i.id
            WHERE i.deleted_at IS NULL
              AND (i.created_by = $1 OR s.shared_with_user_id = $1)
              AND ($2::varchar IS NULL OR i.status = $2)
            ORDER BY i.created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(&params.status)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_investigations query failed");
                return IoError::Database(e).into_response();
            }
        }
    };

    let mut items = Vec::with_capacity(rows.len());
    for row in &rows {
        match row_to_investigation(row) {
            Ok(inv) => items.push(inv),
            Err(e) => tracing::warn!(error = %e, "skipping malformed investigation row"),
        }
    }

    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/forensics/investigations/:id
// ---------------------------------------------------------------------------

pub async fn get_investigation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:read") {
        return IoError::Forbidden("forensics:read permission required".into()).into_response();
    }

    let user_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let is_admin = check_permission(&claims, "forensics:admin");

    // Fetch the investigation, gating by ownership/share unless admin.
    let inv_row = if is_admin {
        match sqlx::query(
            r#"
            SELECT id, name, status, anchor_point_id, anchor_alarm_id,
                   created_by, created_at, updated_at, closed_at
            FROM investigations
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
        {
            Ok(Some(r)) => r,
            Ok(None) => {
                return IoError::NotFound(format!("Investigation {} not found", id)).into_response()
            }
            Err(e) => {
                tracing::error!(error = %e, "get_investigation admin query failed");
                return IoError::Database(e).into_response();
            }
        }
    } else {
        match sqlx::query(
            r#"
            SELECT DISTINCT i.id, i.name, i.status, i.anchor_point_id, i.anchor_alarm_id,
                            i.created_by, i.created_at, i.updated_at, i.closed_at
            FROM investigations i
            LEFT JOIN investigation_shares s ON s.investigation_id = i.id
            WHERE i.id = $1 AND i.deleted_at IS NULL
              AND (i.created_by = $2 OR s.shared_with_user_id = $2)
            "#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        {
            Ok(Some(r)) => r,
            Ok(None) => {
                return IoError::NotFound(format!("Investigation {} not found", id)).into_response()
            }
            Err(e) => {
                tracing::error!(error = %e, "get_investigation query failed");
                return IoError::Database(e).into_response();
            }
        }
    };

    let investigation = match row_to_investigation(&inv_row) {
        Ok(i) => i,
        Err(e) => {
            tracing::error!(error = %e, "get_investigation row mapping failed");
            return IoError::Internal("Failed to map investigation".into()).into_response();
        }
    };

    // Fetch stages for this investigation.
    let stage_rows = match sqlx::query(
        r#"
        SELECT id, investigation_id, name, sort_order, time_range_start, time_range_end
        FROM investigation_stages
        WHERE investigation_id = $1
        ORDER BY sort_order ASC, created_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "get_investigation stages query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut stages: Vec<StageWithEvidence> = Vec::with_capacity(stage_rows.len());

    for stage_row in &stage_rows {
        let stage = match row_to_stage(stage_row) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed stage row");
                continue;
            }
        };
        let stage_id = stage.id;

        // Fetch evidence for this stage.
        let evidence_rows = match sqlx::query(
            r#"
            SELECT id, stage_id, evidence_type, config, sort_order
            FROM investigation_evidence
            WHERE stage_id = $1
            ORDER BY sort_order ASC, created_at ASC
            "#,
        )
        .bind(stage_id)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(error = %e, stage_id = %stage_id, "evidence query failed");
                vec![]
            }
        };

        let evidence: Vec<EvidenceRow> = evidence_rows
            .iter()
            .filter_map(|r| row_to_evidence(r).ok())
            .collect();

        // Fetch points for this investigation (scoped by investigation_id, not stage).
        // Points are attached to the investigation, not individual stages.
        let point_rows = match sqlx::query(
            r#"
            SELECT investigation_id, point_id, status, removal_reason, added_at, removed_at
            FROM investigation_points
            WHERE investigation_id = $1
            "#,
        )
        .bind(id)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(error = %e, "points query failed");
                vec![]
            }
        };

        let points: Vec<InvestigationPointRow> = point_rows
            .iter()
            .filter_map(|r| row_to_point(r).ok())
            .collect();

        stages.push(StageWithEvidence {
            stage,
            evidence,
            points,
        });
    }

    Json(ApiResponse::ok(InvestigationDetail {
        investigation,
        stages,
    }))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/forensics/investigations
// ---------------------------------------------------------------------------

pub async fn create_investigation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInvestigationRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let user_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        INSERT INTO investigations (name, anchor_point_id, anchor_alarm_id, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, status, anchor_point_id, anchor_alarm_id,
                  created_by, created_at, updated_at, closed_at
        "#,
    )
    .bind(&body.name)
    .bind(body.anchor_point_id)
    .bind(body.anchor_alarm_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_investigation insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let investigation = match row_to_investigation(&row) {
        Ok(i) => i,
        Err(e) => {
            tracing::error!(error = %e, "create_investigation row mapping failed");
            return IoError::Internal("Failed to map created investigation".into()).into_response();
        }
    };

    // If an anchor point was provided, add it to investigation_points automatically.
    if let Some(anchor) = body.anchor_point_id {
        if let Err(e) = sqlx::query(
            r#"
            INSERT INTO investigation_points (investigation_id, point_id, status)
            VALUES ($1, $2, 'included')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(investigation.id)
        .bind(anchor)
        .execute(&state.db)
        .await
        {
            tracing::warn!(error = %e, "failed to insert anchor point into investigation_points");
        }
    }

    (StatusCode::CREATED, Json(ApiResponse::ok(investigation))).into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/forensics/investigations/:id
// ---------------------------------------------------------------------------

pub async fn update_investigation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInvestigationRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let user_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        UPDATE investigations
        SET name = COALESCE($1, name), updated_at = NOW()
        WHERE id = $2
          AND created_by = $3
          AND deleted_at IS NULL
        RETURNING id, name, status, anchor_point_id, anchor_alarm_id,
                  created_by, created_at, updated_at, closed_at
        "#,
    )
    .bind(&body.name)
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Investigation {} not found or not owned by you", id))
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_investigation query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_investigation(&row) {
        Ok(i) => Json(ApiResponse::ok(i)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_investigation row mapping failed");
            IoError::Internal("Failed to map updated investigation".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/forensics/investigations/:id/close
// ---------------------------------------------------------------------------

pub async fn close_investigation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let user_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        UPDATE investigations
        SET status = 'closed', closed_at = NOW(), closed_by = $1, updated_at = NOW()
        WHERE id = $2 AND status = 'active' AND deleted_at IS NULL
        RETURNING id, name, status, anchor_point_id, anchor_alarm_id,
                  created_by, created_at, updated_at, closed_at
        "#,
    )
    .bind(user_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(
                format!("Investigation {} not found or not in active state", id),
            )
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "close_investigation query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_investigation(&row) {
        Ok(i) => Json(ApiResponse::ok(i)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "close_investigation row mapping failed");
            IoError::Internal("Failed to map closed investigation".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/forensics/investigations/:id/cancel
// ---------------------------------------------------------------------------

pub async fn cancel_investigation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        UPDATE investigations
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND status = 'active' AND deleted_at IS NULL
        RETURNING id, name, status, anchor_point_id, anchor_alarm_id,
                  created_by, created_at, updated_at, closed_at
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(
                format!("Investigation {} not found or not in active state", id),
            )
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "cancel_investigation query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_investigation(&row) {
        Ok(i) => Json(ApiResponse::ok(i)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "cancel_investigation row mapping failed");
            IoError::Internal("Failed to map cancelled investigation".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/forensics/investigations/:id  (soft delete)
// ---------------------------------------------------------------------------

pub async fn delete_investigation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let user_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let result = match sqlx::query(
        r#"
        UPDATE investigations
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_investigation query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Investigation {} not found or not owned by you", id))
            .into_response();
    }

    (StatusCode::NO_CONTENT, ()).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/forensics/investigations/:id/stages
// ---------------------------------------------------------------------------

pub async fn add_stage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(investigation_id): Path<Uuid>,
    Json(body): Json<CreateStageRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        INSERT INTO investigation_stages
            (investigation_id, name, sort_order, time_range_start, time_range_end)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, investigation_id, name, sort_order, time_range_start, time_range_end
        "#,
    )
    .bind(investigation_id)
    .bind(&body.name)
    .bind(body.sort_order.unwrap_or(0))
    .bind(body.time_range_start)
    .bind(body.time_range_end)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "add_stage insert failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_stage(&row) {
        Ok(s) => (StatusCode::CREATED, Json(ApiResponse::ok(s))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "add_stage row mapping failed");
            IoError::Internal("Failed to map created stage".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/forensics/investigations/:id/stages/:stage_id
// ---------------------------------------------------------------------------

pub async fn update_stage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((investigation_id, stage_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateStageRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        UPDATE investigation_stages
        SET
            name             = COALESCE($1, name),
            time_range_start = COALESCE($2, time_range_start),
            time_range_end   = COALESCE($3, time_range_end),
            sort_order       = COALESCE($4, sort_order),
            updated_at       = NOW()
        WHERE id = $5 AND investigation_id = $6
        RETURNING id, investigation_id, name, sort_order, time_range_start, time_range_end
        "#,
    )
    .bind(&body.name)
    .bind(body.time_range_start)
    .bind(body.time_range_end)
    .bind(body.sort_order)
    .bind(stage_id)
    .bind(investigation_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Stage {} not found", stage_id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_stage query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_stage(&row) {
        Ok(s) => Json(ApiResponse::ok(s)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_stage row mapping failed");
            IoError::Internal("Failed to map updated stage".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/forensics/investigations/:id/stages/:stage_id
// ---------------------------------------------------------------------------

pub async fn delete_stage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((investigation_id, stage_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "DELETE FROM investigation_stages WHERE id = $1 AND investigation_id = $2 RETURNING id",
    )
    .bind(stage_id)
    .bind(investigation_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_stage query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Stage {} not found", stage_id)).into_response();
    }

    (StatusCode::NO_CONTENT, ()).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/forensics/investigations/:id/stages/:stage_id/evidence
// ---------------------------------------------------------------------------

pub async fn add_evidence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_investigation_id, stage_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<AddEvidenceRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        INSERT INTO investigation_evidence (stage_id, evidence_type, config, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id, stage_id, evidence_type, config, sort_order
        "#,
    )
    .bind(stage_id)
    .bind(&body.evidence_type)
    .bind(&body.config)
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "add_evidence insert failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_evidence(&row) {
        Ok(ev) => (StatusCode::CREATED, Json(ApiResponse::ok(ev))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "add_evidence row mapping failed");
            IoError::Internal("Failed to map created evidence".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/forensics/investigations/:id/stages/:stage_id/evidence/:evidence_id
// ---------------------------------------------------------------------------

pub async fn update_evidence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_investigation_id, stage_id, evidence_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(body): Json<JsonValue>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        UPDATE investigation_evidence
        SET config = $1, updated_at = NOW()
        WHERE id = $2 AND stage_id = $3
        RETURNING id, stage_id, evidence_type, config, sort_order
        "#,
    )
    .bind(&body)
    .bind(evidence_id)
    .bind(stage_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Evidence {} not found", evidence_id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_evidence query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_evidence(&row) {
        Ok(ev) => Json(ApiResponse::ok(ev)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_evidence row mapping failed");
            IoError::Internal("Failed to map updated evidence".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/forensics/investigations/:id/stages/:stage_id/evidence/:evidence_id
// ---------------------------------------------------------------------------

pub async fn delete_evidence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_investigation_id, stage_id, evidence_id)): Path<(Uuid, Uuid, Uuid)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "DELETE FROM investigation_evidence WHERE id = $1 AND stage_id = $2 RETURNING id",
    )
    .bind(evidence_id)
    .bind(stage_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_evidence query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Evidence {} not found", evidence_id)).into_response();
    }

    (StatusCode::NO_CONTENT, ()).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/forensics/investigations/:id/points
// ---------------------------------------------------------------------------

pub async fn add_points(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(investigation_id): Path<Uuid>,
    Json(body): Json<AddPointsRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    if body.point_ids.is_empty() {
        return IoError::BadRequest("point_ids must not be empty".into()).into_response();
    }

    let mut inserted = 0usize;
    for pid_str in &body.point_ids {
        let pid = match Uuid::parse_str(pid_str) {
            Ok(id) => id,
            Err(_) => {
                tracing::warn!(point_id = %pid_str, "skipping invalid point UUID");
                continue;
            }
        };

        match sqlx::query(
            r#"
            INSERT INTO investigation_points (investigation_id, point_id, status)
            VALUES ($1, $2, 'included')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(investigation_id)
        .bind(pid)
        .execute(&state.db)
        .await
        {
            Ok(_) => inserted += 1,
            Err(e) => {
                tracing::warn!(error = %e, point_id = %pid, "failed to insert investigation point");
            }
        }
    }

    Json(ApiResponse::ok(serde_json::json!({ "inserted": inserted }))).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/forensics/investigations/:id/points/:point_id
// ---------------------------------------------------------------------------

pub async fn remove_point(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((investigation_id, point_id_str)): Path<(Uuid, String)>,
    body: Option<Json<RemovePointBody>>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:write") {
        return IoError::Forbidden("forensics:write permission required".into()).into_response();
    }

    let point_id = match Uuid::parse_str(&point_id_str) {
        Ok(id) => id,
        Err(_) => {
            return IoError::BadRequest(format!("Invalid point UUID: {}", point_id_str))
                .into_response()
        }
    };

    let reason = body.and_then(|Json(b)| b.reason);

    let result = match sqlx::query(
        r#"
        UPDATE investigation_points
        SET status = 'removed', removal_reason = $1, removed_at = NOW()
        WHERE investigation_id = $2 AND point_id = $3
        RETURNING investigation_id
        "#,
    )
    .bind(&reason)
    .bind(investigation_id)
    .bind(point_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "remove_point query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!(
            "Point {} not found in investigation {}",
            point_id, investigation_id
        ))
        .into_response();
    }

    Json(ApiResponse::ok(serde_json::json!({ "removed": true }))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/forensics/correlate
// ---------------------------------------------------------------------------

pub async fn run_correlation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CorrelateRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:read") {
        return IoError::Forbidden("forensics:read permission required".into()).into_response();
    }

    if body.point_ids.is_empty() {
        return IoError::BadRequest("point_ids must not be empty".into()).into_response();
    }

    // Determine sample interval in milliseconds from the bucket_interval hint.
    let sample_interval_ms = parse_bucket_interval(body.bucket_interval.as_deref(), 60_000);

    // Parse point_ids as UUIDs for the SQL query.
    let uuids: Vec<Uuid> = body
        .point_ids
        .iter()
        .filter_map(|s| Uuid::parse_str(s).ok())
        .collect();

    if uuids.is_empty() {
        return IoError::BadRequest("No valid point UUIDs provided".into()).into_response();
    }

    // Query time-series data from 1-minute history table.
    let rows = match sqlx::query(
        r#"
        SELECT time, avg_value AS value, point_id
        FROM points_history_1m
        WHERE point_id = ANY($1)
          AND time >= $2
          AND time <= $3
        ORDER BY point_id, time
        "#,
    )
    .bind(&uuids)
    .bind(body.start)
    .bind(body.end)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "run_correlation data query failed");
            return IoError::Database(e).into_response();
        }
    };

    // Group rows by point_id into HashMap<String, Vec<TimeSeriesPoint>>.
    let mut series_map: HashMap<String, Vec<TimeSeriesPoint>> = HashMap::new();

    for row in &rows {
        let point_id: Uuid = match row.try_get("point_id") {
            Ok(id) => id,
            Err(_) => continue,
        };
        let time: DateTime<Utc> = match row.try_get("time") {
            Ok(t) => t,
            Err(_) => continue,
        };
        let value: f64 = row.try_get("value").unwrap_or(f64::NAN);

        if value.is_nan() {
            continue;
        }

        series_map
            .entry(point_id.to_string())
            .or_default()
            .push(TimeSeriesPoint {
                timestamp: time.timestamp_millis(),
                value,
            });
    }

    // Run correlation analysis (CPU-bound — spawn_blocking keeps Tokio healthy).
    let series_clone = series_map.clone();
    let (correlations, change_points) =
        match tokio::task::spawn_blocking(move || {
            correlation::run_correlation_analysis(&series_clone, sample_interval_ms)
        })
        .await
        {
            Ok(result) => result,
            Err(e) => {
                tracing::error!(error = %e, "correlation analysis task failed");
                return IoError::Internal("Correlation analysis failed".into()).into_response();
            }
        };

    // Detect spikes per series.
    let mut all_spikes: Vec<correlation::SpikeResult> = Vec::new();
    for (pid, ts) in &series_map {
        let mut spikes = correlation::detect_spikes(ts, 3.0);
        for spike in &mut spikes {
            spike.point_id = pid.clone();
        }
        all_spikes.extend(spikes);
    }

    Json(ApiResponse::ok(serde_json::json!({
        "correlations": correlations,
        "change_points": change_points,
        "spikes": all_spikes,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/forensics/threshold-search
// ---------------------------------------------------------------------------

pub async fn threshold_search(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ThresholdSearchRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:read") {
        return IoError::Forbidden("forensics:read permission required".into()).into_response();
    }

    let point_id = match Uuid::parse_str(&body.point_id) {
        Ok(id) => id,
        Err(_) => {
            return IoError::BadRequest(format!("Invalid point UUID: {}", body.point_id))
                .into_response()
        }
    };

    let lookback_days = body.lookback_days.unwrap_or(7);
    let end = Utc::now();
    let start = end - chrono::Duration::days(lookback_days);

    // Validate operator.
    let op_sql = match body.operator.as_str() {
        "gt" => ">",
        "lt" => "<",
        "gte" => ">=",
        "lte" => "<=",
        "eq" => "=",
        _ => {
            return IoError::BadRequest(format!("Unknown operator: {}", body.operator))
                .into_response()
        }
    };

    // Fetch rows matching the threshold condition from 5-minute history.
    // We use a dynamic operator — build the query string carefully.
    // sqlx doesn't support dynamic operators natively so we branch on op.
    let rows = match fetch_threshold_rows(
        &state.db,
        point_id,
        op_sql,
        body.threshold,
        start,
        end,
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "threshold_search data query failed");
            return IoError::Database(e).into_response();
        }
    };

    // Build exceedance windows by collapsing consecutive timestamps.
    let windows = build_exceedance_windows(&rows, body.threshold);

    Json(ApiResponse::ok(windows)).into_response()
}

/// Fetch rows from points_history_5m that satisfy the threshold condition.
async fn fetch_threshold_rows(
    db: &sqlx::PgPool,
    point_id: Uuid,
    op: &str,
    threshold: f64,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> Result<Vec<(DateTime<Utc>, f64)>, sqlx::Error> {
    // Build the query dynamically but safely — op is validated above.
    let sql = format!(
        r#"
        SELECT time, avg_value AS value
        FROM points_history_5m
        WHERE point_id = $1
          AND time >= $2
          AND time <= $3
          AND avg_value {op} $4
        ORDER BY time
        "#,
        op = op
    );

    let rows = sqlx::query(&sql)
        .bind(point_id)
        .bind(start)
        .bind(end)
        .bind(threshold)
        .fetch_all(db)
        .await?;

    let mut result = Vec::with_capacity(rows.len());
    for row in &rows {
        let t: DateTime<Utc> = row.try_get("time")?;
        let v: f64 = row.try_get("value").unwrap_or(f64::NAN);
        if !v.is_nan() {
            result.push((t, v));
        }
    }

    Ok(result)
}

/// Collapse a list of (timestamp, value) pairs into exceedance windows.
///
/// Consecutive points within 10 minutes of each other are merged into one window.
fn build_exceedance_windows(
    rows: &[(DateTime<Utc>, f64)],
    _threshold: f64,
) -> Vec<ExceedanceWindow> {
    const MAX_GAP_SECS: i64 = 600; // 10 minutes
    let mut windows: Vec<ExceedanceWindow> = Vec::new();

    if rows.is_empty() {
        return windows;
    }

    let mut window_start = rows[0].0;
    let mut window_end = rows[0].0;
    let mut peak = rows[0].1;

    for (t, v) in rows.iter().skip(1) {
        let gap = (*t - window_end).num_seconds();
        if gap > MAX_GAP_SECS {
            // Flush current window.
            windows.push(ExceedanceWindow {
                start: window_start,
                end: window_end,
                peak_value: peak,
                duration_seconds: (window_end - window_start).num_seconds(),
            });
            window_start = *t;
            peak = *v;
        } else if *v > peak {
            peak = *v;
        }
        window_end = *t;
    }

    // Flush last window.
    windows.push(ExceedanceWindow {
        start: window_start,
        end: window_end,
        peak_value: peak,
        duration_seconds: (window_end - window_start).num_seconds(),
    });

    windows
}

// ---------------------------------------------------------------------------
// POST /api/forensics/alarm-search
// ---------------------------------------------------------------------------

pub async fn alarm_search(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AlarmSearchRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "forensics:read") {
        return IoError::Forbidden("forensics:read permission required".into()).into_response();
    }

    let end = body.end.unwrap_or_else(Utc::now);
    let start = body.start.unwrap_or_else(|| end - chrono::Duration::days(30));

    let rows = match sqlx::query(
        r#"
        SELECT id, event_type::text AS event_type, severity, message, timestamp
        FROM events
        WHERE point_id = $1::uuid
          AND event_type IN ('process_alarm', 'io_alarm', 'io_expression_alarm')
          AND timestamp >= $2
          AND timestamp <= $3
        ORDER BY timestamp DESC
        LIMIT 100
        "#,
    )
    .bind(&body.point_id)
    .bind(start)
    .bind(end)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "alarm_search query failed");
            return IoError::Database(e).into_response();
        }
    };

    #[derive(Serialize)]
    struct AlarmEvent {
        id: Uuid,
        event_type: String,
        severity: i16,
        message: String,
        timestamp: DateTime<Utc>,
    }

    let mut alarms: Vec<AlarmEvent> = Vec::with_capacity(rows.len());
    for row in &rows {
        let id: Uuid = match row.try_get("id") {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed alarm row");
                continue;
            }
        };
        alarms.push(AlarmEvent {
            id,
            event_type: row.try_get("event_type").unwrap_or_default(),
            severity: row.try_get("severity").unwrap_or(500i16),
            message: row.try_get("message").unwrap_or_default(),
            timestamp: row
                .try_get("timestamp")
                .unwrap_or_else(|_| Utc::now()),
        });
    }

    Json(ApiResponse::ok(alarms)).into_response()
}

// ---------------------------------------------------------------------------
// Utility: parse bucket interval string to milliseconds
// ---------------------------------------------------------------------------

fn parse_bucket_interval(s: Option<&str>, default_ms: i64) -> i64 {
    let s = match s {
        Some(v) if !v.is_empty() => v,
        _ => return default_ms,
    };

    // Trim whitespace and lowercase.
    let s = s.trim().to_lowercase();

    // Try to split numeric prefix from unit suffix.
    let split_pos = s.find(|c: char| c.is_alphabetic()).unwrap_or(s.len());
    let (num_str, unit) = s.split_at(split_pos);

    let num: i64 = match num_str.parse() {
        Ok(n) => n,
        Err(_) => return default_ms,
    };

    match unit {
        "s" => num * 1_000,
        "m" => num * 60_000,
        "h" => num * 3_600_000,
        "d" => num * 86_400_000,
        _ => default_ms,
    }
}
