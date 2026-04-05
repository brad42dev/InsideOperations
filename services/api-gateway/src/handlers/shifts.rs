//! Shifts / Access Control handlers (Phase 15).
//!
//! Covers: shift scheduling, crew management, badge-driven presence status,
//! and emergency muster accountability.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use io_auth::Claims;
use io_models::{PageParams, PagedResponse};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == permission)
}

fn user_id_from_claims(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

fn error_response(status: StatusCode, code: &str, message: &str) -> impl IntoResponse {
    (
        status,
        Json(json!({ "success": false, "error": { "code": code, "message": message } })),
    )
}

fn ok(data: impl serde::Serialize) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({ "success": true, "data": data })),
    )
}

fn created(data: impl serde::Serialize) -> impl IntoResponse {
    (
        StatusCode::CREATED,
        Json(json!({ "success": true, "data": data })),
    )
}

// ---------------------------------------------------------------------------
// Row structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ShiftPatternRow {
    pub id: Uuid,
    pub name: String,
    pub pattern_type: String,
    pub description: Option<String>,
    pub config: JsonValue,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ShiftCrewRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub member_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ShiftCrewMemberRow {
    pub id: Uuid,
    pub crew_id: Uuid,
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub role_label: Option<String>,
    pub added_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ShiftRow {
    pub id: Uuid,
    pub name: String,
    pub crew_id: Option<Uuid>,
    pub crew_name: Option<String>,
    pub pattern_id: Option<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub handover_minutes: i32,
    pub notes: Option<String>,
    pub status: String,
    pub source: String,
    pub source_system: Option<String>,
    pub external_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ShiftAssignmentRow {
    pub id: Uuid,
    pub shift_id: Uuid,
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub role_label: Option<String>,
    pub source: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CurrentPersonnelRow {
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub role_label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PresenceStatusRow {
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub employee_id: Option<String>,
    pub on_site: bool,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub last_area: Option<String>,
    pub last_door: Option<String>,
    pub stale_at: Option<DateTime<Utc>>,
    pub on_shift: bool,
    pub current_shift_id: Option<Uuid>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct MusterPointRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub area: Option<String>,
    pub capacity: Option<i32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub door_ids: Vec<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MusterEventRow {
    pub id: Uuid,
    pub trigger_type: String,
    pub trigger_ref_id: Option<Uuid>,
    pub declared_by: Uuid,
    pub declared_by_name: Option<String>,
    pub declared_at: DateTime<Utc>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub total_on_site: Option<i32>,
    pub notes: Option<String>,
    pub status: String,
    pub accounting_total: Option<i64>,
    pub accounting_accounted: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct MusterAccountingRow {
    pub id: Uuid,
    pub muster_event_id: Uuid,
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub muster_point_id: Option<Uuid>,
    pub muster_point_name: Option<String>,
    pub status: String,
    pub accounted_at: Option<DateTime<Utc>>,
    pub accounted_by: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BadgeSourceRow {
    pub id: Uuid,
    pub name: String,
    pub adapter_type: String,
    pub enabled: bool,
    pub config: JsonValue,
    pub poll_interval_s: i32,
    pub last_poll_at: Option<DateTime<Utc>>,
    pub last_poll_ok: Option<bool>,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ShiftsQuery {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub status: Option<String>,
    pub crew_id: Option<Uuid>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct MusterEventsQuery {
    pub status: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct PresenceQuery {
    pub on_site: Option<bool>,
    pub on_shift: Option<bool>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateShiftBody {
    pub name: String,
    pub crew_id: Option<Uuid>,
    pub pattern_id: Option<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub handover_minutes: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateShiftBody {
    pub name: Option<String>,
    pub crew_id: Option<Uuid>,
    pub pattern_id: Option<Uuid>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub handover_minutes: Option<i32>,
    pub notes: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCrewBody {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCrewBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddCrewMemberBody {
    pub user_id: Uuid,
    pub role_label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMusterPointBody {
    pub name: String,
    pub description: Option<String>,
    pub area: Option<String>,
    pub capacity: Option<i32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub door_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct DeclareMusterBody {
    pub notes: Option<String>,
    pub trigger_type: Option<String>,
    pub trigger_ref_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveMusterBody {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AccountPersonBody {
    pub user_id: Uuid,
    pub status: String,
    pub muster_point_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBadgeSourceBody {
    pub name: String,
    pub adapter_type: String,
    pub enabled: Option<bool>,
    pub config: Option<JsonValue>,
    pub poll_interval_s: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBadgeSourceBody {
    pub name: Option<String>,
    pub adapter_type: Option<String>,
    pub enabled: Option<bool>,
    pub config: Option<JsonValue>,
    pub poll_interval_s: Option<i32>,
}

// ---------------------------------------------------------------------------
// Pattern request bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreatePatternBody {
    pub name: String,
    pub pattern_type: String,
    pub description: Option<String>,
    pub pattern_config: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePatternBody {
    pub name: Option<String>,
    pub pattern_type: Option<String>,
    pub description: Option<String>,
    pub pattern_config: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateFromPatternBody {
    pub start_date: DateTime<Utc>,
    pub weeks: u32,
    pub crew_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// GET /api/shifts/patterns — list shift patterns
// ---------------------------------------------------------------------------

pub async fn list_patterns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM shift_patterns")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_patterns count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count shift patterns",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"SELECT id, name, pattern_type, description, config, created_at, created_by
           FROM shift_patterns ORDER BY name
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<ShiftPatternRow> = rows
                .iter()
                .map(|r| ShiftPatternRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    pattern_type: r.get("pattern_type"),
                    description: r.get("description"),
                    config: r.get("config"),
                    created_at: r.get("created_at"),
                    created_by: r.get("created_by"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_patterns query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch shift patterns",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/shifts/patterns — create shift pattern
// ---------------------------------------------------------------------------

pub async fn create_pattern(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePatternBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);
    let config = body.pattern_config.unwrap_or(json!({}));

    let row = sqlx::query(
        r#"INSERT INTO shift_patterns (name, pattern_type, description, config, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, pattern_type, description, config, created_at, created_by"#,
    )
    .bind(&body.name)
    .bind(&body.pattern_type)
    .bind(&body.description)
    .bind(config)
    .bind(actor_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => created(ShiftPatternRow {
            id: r.get("id"),
            name: r.get("name"),
            pattern_type: r.get("pattern_type"),
            description: r.get("description"),
            config: r.get("config"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_pattern failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to create shift pattern",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/shifts/patterns/:id — get single shift pattern
// ---------------------------------------------------------------------------

pub async fn get_pattern(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"SELECT id, name, pattern_type, description, config, created_at, created_by
           FROM shift_patterns WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(ShiftPatternRow {
            id: r.get("id"),
            name: r.get("name"),
            pattern_type: r.get("pattern_type"),
            description: r.get("description"),
            config: r.get("config"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Ok(None) => error_response(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Shift pattern not found",
        )
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_pattern query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch shift pattern",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/shifts/patterns/:id — update shift pattern
// ---------------------------------------------------------------------------

pub async fn update_pattern(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePatternBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"UPDATE shift_patterns
           SET name         = COALESCE($2, name),
               pattern_type = COALESCE($3, pattern_type),
               description  = COALESCE($4, description),
               config       = COALESCE($5, config)
           WHERE id = $1
           RETURNING id, name, pattern_type, description, config, created_at, created_by"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.pattern_type)
    .bind(&body.description)
    .bind(body.pattern_config.as_ref())
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(ShiftPatternRow {
            id: r.get("id"),
            name: r.get("name"),
            pattern_type: r.get("pattern_type"),
            description: r.get("description"),
            config: r.get("config"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Ok(None) => error_response(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Shift pattern not found",
        )
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_pattern failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to update shift pattern",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/shifts/patterns/:id — delete shift pattern
// ---------------------------------------------------------------------------

pub async fn delete_pattern(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let result = sqlx::query("DELETE FROM shift_patterns WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => ok(json!({ "deleted": true })).into_response(),
        Ok(_) => error_response(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Shift pattern not found",
        )
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_pattern failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to delete shift pattern",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/shifts/patterns/:id/generate — generate shifts from pattern
// ---------------------------------------------------------------------------

pub async fn generate_from_pattern(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<GenerateFromPatternBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);

    // Fetch the pattern
    let pattern_row =
        sqlx::query("SELECT id, name, pattern_type, config FROM shift_patterns WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await;

    let pattern = match pattern_row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                "Shift pattern not found",
            )
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "generate_from_pattern fetch pattern failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch shift pattern",
            )
            .into_response();
        }
    };

    let pattern_type: String = pattern.get("pattern_type");

    // Determine shift slots based on pattern type
    // Each slot: (name, start_hour, start_min, end_hour, end_min, next_day_end)
    struct ShiftSlot {
        name: &'static str,
        start_hour: u32,
        start_min: u32,
        end_hour: u32,
        end_min: u32,
        /// true if end time crosses midnight (next calendar day)
        crosses_midnight: bool,
    }

    let slots: Vec<ShiftSlot> = match pattern_type.as_str() {
        "8x3" => vec![
            ShiftSlot {
                name: "Day",
                start_hour: 6,
                start_min: 0,
                end_hour: 14,
                end_min: 0,
                crosses_midnight: false,
            },
            ShiftSlot {
                name: "Swing",
                start_hour: 14,
                start_min: 0,
                end_hour: 22,
                end_min: 0,
                crosses_midnight: false,
            },
            ShiftSlot {
                name: "Night",
                start_hour: 22,
                start_min: 0,
                end_hour: 6,
                end_min: 0,
                crosses_midnight: true,
            },
        ],
        "12x2" => vec![
            ShiftSlot {
                name: "Day",
                start_hour: 6,
                start_min: 0,
                end_hour: 18,
                end_min: 0,
                crosses_midnight: false,
            },
            ShiftSlot {
                name: "Night",
                start_hour: 18,
                start_min: 0,
                end_hour: 6,
                end_min: 0,
                crosses_midnight: true,
            },
        ],
        "dupont" | "pitman" => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "error": {
                        "code": "NOT_IMPLEMENTED",
                        "message": "Not implemented for this pattern type"
                    }
                })),
            )
                .into_response();
        }
        _ => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "UNSUPPORTED_PATTERN",
                "Unsupported pattern type. Supported: 8x3, 12x2",
            )
            .into_response();
        }
    };

    let weeks = body.weeks.min(52) as i64; // cap at 1 year
    let total_days = weeks * 7;
    let mut shifts_created: i64 = 0;

    for day_offset in 0..total_days {
        let day_offset_duration = Duration::days(day_offset);
        let day_base = body.start_date + day_offset_duration;

        for slot in &slots {
            let start_time = Utc
                .with_ymd_and_hms(
                    day_base.year(),
                    day_base.month(),
                    day_base.day(),
                    slot.start_hour,
                    slot.start_min,
                    0,
                )
                .single();

            let end_base = if slot.crosses_midnight {
                day_base + Duration::days(1)
            } else {
                day_base
            };

            let end_time = Utc
                .with_ymd_and_hms(
                    end_base.year(),
                    end_base.month(),
                    end_base.day(),
                    slot.end_hour,
                    slot.end_min,
                    0,
                )
                .single();

            let (Some(start_time), Some(end_time)) = (start_time, end_time) else {
                continue;
            };

            let shift_name = format!(
                "{} {} {}",
                slot.name,
                day_base.format("%Y-%m-%d"),
                pattern_type
            );

            let shift_row = sqlx::query(
                r#"INSERT INTO shifts (name, crew_id, pattern_id, start_time, end_time, created_by)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING id"#,
            )
            .bind(&shift_name)
            .bind(body.crew_id)
            .bind(id)
            .bind(start_time)
            .bind(end_time)
            .bind(actor_id)
            .fetch_one(&state.db)
            .await;

            let shift_id = match shift_row {
                Ok(r) => {
                    shifts_created += 1;
                    r.get::<Uuid, _>("id")
                }
                Err(e) => {
                    tracing::error!(error = %e, "generate_from_pattern shift insert failed");
                    continue;
                }
            };

            // If crew_id provided, also insert shift_assignments for all crew members
            if let Some(cid) = body.crew_id {
                let _ = sqlx::query(
                    r#"INSERT INTO shift_assignments (shift_id, user_id, role_label, source)
                       SELECT $1, scm.user_id, scm.role_label, 'generated'
                       FROM shift_crew_members scm
                       WHERE scm.crew_id = $2
                       ON CONFLICT (shift_id, user_id) DO NOTHING"#,
                )
                .bind(shift_id)
                .bind(cid)
                .execute(&state.db)
                .await;
            }
        }
    }

    ok(json!({ "shifts_created": shifts_created })).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/shifts/crews — list crews with member count
// ---------------------------------------------------------------------------

pub async fn list_crews(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM shift_crews")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_crews count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count crews",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT sc.id, sc.name, sc.description, sc.color, sc.created_at, sc.created_by,
               COUNT(scm.id) AS member_count
        FROM shift_crews sc
        LEFT JOIN shift_crew_members scm ON scm.crew_id = sc.id
        GROUP BY sc.id, sc.name, sc.description, sc.color, sc.created_at, sc.created_by
        ORDER BY sc.name
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<ShiftCrewRow> = rows
                .iter()
                .map(|r| ShiftCrewRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    description: r.get("description"),
                    color: r.get("color"),
                    created_at: r.get("created_at"),
                    created_by: r.get("created_by"),
                    member_count: r.get("member_count"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_crews query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch crews",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/shifts/crews — create crew
// ---------------------------------------------------------------------------

pub async fn create_crew(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCrewBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);
    let color = body.color.unwrap_or_else(|| "#6366f1".to_string());

    let row = sqlx::query(
        r#"INSERT INTO shift_crews (name, description, color, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, description, color, created_at, created_by"#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&color)
    .bind(actor_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => created(ShiftCrewRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            color: r.get("color"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
            member_count: Some(0),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_crew failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to create crew",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/shifts/crews/:id — get crew with members
// ---------------------------------------------------------------------------

pub async fn get_crew(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let crew_row = sqlx::query(
        r#"SELECT sc.id, sc.name, sc.description, sc.color, sc.created_at, sc.created_by,
                  COUNT(scm.id) AS member_count
           FROM shift_crews sc
           LEFT JOIN shift_crew_members scm ON scm.crew_id = sc.id
           WHERE sc.id = $1
           GROUP BY sc.id, sc.name, sc.description, sc.color, sc.created_at, sc.created_by"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let crew = match crew_row {
        Ok(Some(r)) => ShiftCrewRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            color: r.get("color"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
            member_count: r.get("member_count"),
        },
        Ok(None) => {
            return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Crew not found")
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_crew query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch crew",
            )
            .into_response();
        }
    };

    let members = sqlx::query(
        r#"SELECT scm.id, scm.crew_id, scm.user_id, u.display_name, u.email,
                  scm.role_label, scm.added_at
           FROM shift_crew_members scm
           LEFT JOIN users u ON u.id = scm.user_id
           WHERE scm.crew_id = $1
           ORDER BY u.display_name"#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    match members {
        Ok(rows) => {
            let member_list: Vec<ShiftCrewMemberRow> = rows
                .iter()
                .map(|r| ShiftCrewMemberRow {
                    id: r.get("id"),
                    crew_id: r.get("crew_id"),
                    user_id: r.get("user_id"),
                    display_name: r.get("display_name"),
                    email: r.get("email"),
                    role_label: r.get("role_label"),
                    added_at: r.get("added_at"),
                })
                .collect();
            ok(json!({ "crew": crew, "members": member_list })).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_crew members query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch crew members",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/shifts/crews/:id — update crew
// ---------------------------------------------------------------------------

pub async fn update_crew(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCrewBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"UPDATE shift_crews
           SET name        = COALESCE($2, name),
               description = COALESCE($3, description),
               color       = COALESCE($4, color)
           WHERE id = $1
           RETURNING id, name, description, color, created_at, created_by"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.color)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(ShiftCrewRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            color: r.get("color"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
            member_count: None,
        })
        .into_response(),
        Ok(None) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Crew not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_crew failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to update crew",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/shifts/crews/:id — delete crew
// ---------------------------------------------------------------------------

pub async fn delete_crew(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let result = sqlx::query("DELETE FROM shift_crews WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => ok(json!({ "deleted": true })).into_response(),
        Ok(_) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Crew not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "delete_crew failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to delete crew",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/shifts/crews/:id/members — add member
// ---------------------------------------------------------------------------

pub async fn add_crew_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AddCrewMemberBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"INSERT INTO shift_crew_members (crew_id, user_id, role_label)
           VALUES ($1, $2, $3)
           ON CONFLICT (crew_id, user_id) DO UPDATE SET role_label = EXCLUDED.role_label
           RETURNING id, crew_id, user_id, role_label, added_at"#,
    )
    .bind(id)
    .bind(body.user_id)
    .bind(&body.role_label)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => {
            let member = sqlx::query(
                r#"SELECT scm.id, scm.crew_id, scm.user_id, u.display_name, u.email,
                          scm.role_label, scm.added_at
                   FROM shift_crew_members scm
                   LEFT JOIN users u ON u.id = scm.user_id
                   WHERE scm.id = $1"#,
            )
            .bind::<Uuid>(r.get("id"))
            .fetch_optional(&state.db)
            .await;

            match member {
                Ok(Some(mr)) => created(ShiftCrewMemberRow {
                    id: mr.get("id"),
                    crew_id: mr.get("crew_id"),
                    user_id: mr.get("user_id"),
                    display_name: mr.get("display_name"),
                    email: mr.get("email"),
                    role_label: mr.get("role_label"),
                    added_at: mr.get("added_at"),
                })
                .into_response(),
                _ => created(json!({ "crew_id": id, "user_id": body.user_id })).into_response(),
            }
        }
        Err(e) => {
            tracing::error!(error = %e, "add_crew_member failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to add crew member",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/shifts/crews/:id/members/:user_id — remove member
// ---------------------------------------------------------------------------

pub async fn remove_crew_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((crew_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let result = sqlx::query("DELETE FROM shift_crew_members WHERE crew_id = $1 AND user_id = $2")
        .bind(crew_id)
        .bind(user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => ok(json!({ "deleted": true })).into_response(),
        Ok(_) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Member not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "remove_crew_member failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to remove crew member",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/shifts — list shifts
// ---------------------------------------------------------------------------

pub async fn list_shifts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ShiftsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let pg = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM shifts s
         WHERE ($1::TIMESTAMPTZ IS NULL OR s.start_time >= $1)
           AND ($2::TIMESTAMPTZ IS NULL OR s.end_time   <= $2)
           AND ($3::TEXT IS NULL OR s.status = $3)
           AND ($4::UUID IS NULL OR s.crew_id = $4)",
    )
    .bind(q.from)
    .bind(q.to)
    .bind(q.status.as_deref())
    .bind(q.crew_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_shifts count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count shifts",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT s.id, s.name, s.crew_id, sc.name AS crew_name, s.pattern_id,
               s.start_time, s.end_time, s.handover_minutes, s.notes, s.status,
               s.source, s.source_system, s.external_id,
               s.created_at, s.created_by
        FROM shifts s
        LEFT JOIN shift_crews sc ON sc.id = s.crew_id
        WHERE ($1::TIMESTAMPTZ IS NULL OR s.start_time >= $1)
          AND ($2::TIMESTAMPTZ IS NULL OR s.end_time   <= $2)
          AND ($3::TEXT IS NULL OR s.status = $3)
          AND ($4::UUID IS NULL OR s.crew_id = $4)
        ORDER BY s.start_time DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(q.from)
    .bind(q.to)
    .bind(q.status.as_deref())
    .bind(q.crew_id)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<ShiftRow> = rows
                .iter()
                .map(|r| ShiftRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    crew_id: r.get("crew_id"),
                    crew_name: r.get("crew_name"),
                    pattern_id: r.get("pattern_id"),
                    start_time: r.get("start_time"),
                    end_time: r.get("end_time"),
                    handover_minutes: r.get("handover_minutes"),
                    notes: r.get("notes"),
                    status: r.get("status"),
                    source: r.get("source"),
                    source_system: r.get("source_system"),
                    external_id: r.get("external_id"),
                    created_at: r.get("created_at"),
                    created_by: r.get("created_by"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_shifts query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch shifts",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/shifts — create shift
// ---------------------------------------------------------------------------

pub async fn create_shift(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateShiftBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);
    let handover = body.handover_minutes.unwrap_or(30);

    let row = sqlx::query(
        r#"INSERT INTO shifts (name, crew_id, pattern_id, start_time, end_time, handover_minutes, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, name, crew_id, pattern_id, start_time, end_time,
                     handover_minutes, notes, status, source, source_system, external_id,
                     created_at, created_by"#,
    )
    .bind(&body.name)
    .bind(body.crew_id)
    .bind(body.pattern_id)
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(handover)
    .bind(&body.notes)
    .bind(actor_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => {
            // Auto-expand crew assignments if crew_id provided
            if let Some(cid) = body.crew_id {
                let shift_id: Uuid = r.get("id");
                let _ = sqlx::query(
                    r#"INSERT INTO shift_assignments (shift_id, user_id, role_label, source)
                       SELECT $1, scm.user_id, scm.role_label, 'crew'
                       FROM shift_crew_members scm
                       WHERE scm.crew_id = $2
                       ON CONFLICT (shift_id, user_id) DO NOTHING"#,
                )
                .bind(shift_id)
                .bind(cid)
                .execute(&state.db)
                .await;
            }

            created(ShiftRow {
                id: r.get("id"),
                name: r.get("name"),
                crew_id: r.get("crew_id"),
                crew_name: None,
                pattern_id: r.get("pattern_id"),
                start_time: r.get("start_time"),
                end_time: r.get("end_time"),
                handover_minutes: r.get("handover_minutes"),
                notes: r.get("notes"),
                status: r.get("status"),
                source: r.get("source"),
                source_system: r.get("source_system"),
                external_id: r.get("external_id"),
                created_at: r.get("created_at"),
                created_by: r.get("created_by"),
            })
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "create_shift failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to create shift",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/shifts/:id — get shift with assignments
// ---------------------------------------------------------------------------

pub async fn get_shift(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let shift_row = sqlx::query(
        r#"SELECT s.id, s.name, s.crew_id, sc.name AS crew_name, s.pattern_id,
                  s.start_time, s.end_time, s.handover_minutes, s.notes, s.status,
                  s.source, s.source_system, s.external_id,
                  s.created_at, s.created_by
           FROM shifts s
           LEFT JOIN shift_crews sc ON sc.id = s.crew_id
           WHERE s.id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let shift = match shift_row {
        Ok(Some(r)) => ShiftRow {
            id: r.get("id"),
            name: r.get("name"),
            crew_id: r.get("crew_id"),
            crew_name: r.get("crew_name"),
            pattern_id: r.get("pattern_id"),
            start_time: r.get("start_time"),
            end_time: r.get("end_time"),
            handover_minutes: r.get("handover_minutes"),
            notes: r.get("notes"),
            status: r.get("status"),
            source: r.get("source"),
            source_system: r.get("source_system"),
            external_id: r.get("external_id"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
        },
        Ok(None) => {
            return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Shift not found")
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_shift query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch shift",
            )
            .into_response();
        }
    };

    let assignments = sqlx::query(
        r#"SELECT sa.id, sa.shift_id, sa.user_id, u.display_name, u.email,
                  sa.role_label, sa.source, sa.created_at
           FROM shift_assignments sa
           LEFT JOIN users u ON u.id = sa.user_id
           WHERE sa.shift_id = $1
           ORDER BY u.display_name"#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    match assignments {
        Ok(rows) => {
            let assignment_list: Vec<ShiftAssignmentRow> = rows
                .iter()
                .map(|r| ShiftAssignmentRow {
                    id: r.get("id"),
                    shift_id: r.get("shift_id"),
                    user_id: r.get("user_id"),
                    display_name: r.get("display_name"),
                    email: r.get("email"),
                    role_label: r.get("role_label"),
                    source: r.get("source"),
                    created_at: r.get("created_at"),
                })
                .collect();
            ok(json!({ "shift": shift, "assignments": assignment_list })).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_shift assignments query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch shift assignments",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/shifts/:id — update shift
// ---------------------------------------------------------------------------

pub async fn update_shift(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateShiftBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"UPDATE shifts
           SET name             = COALESCE($2, name),
               crew_id          = COALESCE($3, crew_id),
               pattern_id       = COALESCE($4, pattern_id),
               start_time       = COALESCE($5, start_time),
               end_time         = COALESCE($6, end_time),
               handover_minutes = COALESCE($7, handover_minutes),
               notes            = COALESCE($8, notes),
               status           = COALESCE($9, status)
           WHERE id = $1
           RETURNING id, name, crew_id, pattern_id, start_time, end_time,
                     handover_minutes, notes, status, source, source_system, external_id,
                     created_at, created_by"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.crew_id)
    .bind(body.pattern_id)
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(body.handover_minutes)
    .bind(&body.notes)
    .bind(&body.status)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(ShiftRow {
            id: r.get("id"),
            name: r.get("name"),
            crew_id: r.get("crew_id"),
            crew_name: None,
            pattern_id: r.get("pattern_id"),
            start_time: r.get("start_time"),
            end_time: r.get("end_time"),
            handover_minutes: r.get("handover_minutes"),
            notes: r.get("notes"),
            status: r.get("status"),
            source: r.get("source"),
            source_system: r.get("source_system"),
            external_id: r.get("external_id"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Ok(None) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Shift not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_shift failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to update shift",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/shifts/:id — delete shift
// ---------------------------------------------------------------------------

pub async fn delete_shift(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let result = sqlx::query("DELETE FROM shifts WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => ok(json!({ "deleted": true })).into_response(),
        Ok(_) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Shift not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "delete_shift failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to delete shift",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/presence — current presence (on_site or on_shift)
// ---------------------------------------------------------------------------

pub async fn list_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PresenceQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let pg = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM presence_status WHERE on_site = true OR on_shift = true",
    )
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_presence count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count presence",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT ps.user_id, u.display_name, u.email, u.employee_id,
               ps.on_site, ps.last_seen_at, ps.last_area, ps.last_door,
               ps.stale_at, ps.on_shift, ps.current_shift_id, ps.updated_at
        FROM presence_status ps
        LEFT JOIN users u ON u.id = ps.user_id
        WHERE ps.on_site = true OR ps.on_shift = true
        ORDER BY u.display_name
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<PresenceStatusRow> = rows
                .iter()
                .map(|r| PresenceStatusRow {
                    user_id: r.get("user_id"),
                    display_name: r.get("display_name"),
                    email: r.get("email"),
                    employee_id: r.get("employee_id"),
                    on_site: r.get("on_site"),
                    last_seen_at: r.get("last_seen_at"),
                    last_area: r.get("last_area"),
                    last_door: r.get("last_door"),
                    stale_at: r.get("stale_at"),
                    on_shift: r.get("on_shift"),
                    current_shift_id: r.get("current_shift_id"),
                    updated_at: r.get("updated_at"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_presence query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch presence",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/presence/:user_id — single user presence
// ---------------------------------------------------------------------------

pub async fn get_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(uid): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"SELECT ps.user_id, u.display_name, u.email, u.employee_id,
                  ps.on_site, ps.last_seen_at, ps.last_area, ps.last_door,
                  ps.stale_at, ps.on_shift, ps.current_shift_id, ps.updated_at
           FROM presence_status ps
           LEFT JOIN users u ON u.id = ps.user_id
           WHERE ps.user_id = $1"#,
    )
    .bind(uid)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(PresenceStatusRow {
            user_id: r.get("user_id"),
            display_name: r.get("display_name"),
            email: r.get("email"),
            employee_id: r.get("employee_id"),
            on_site: r.get("on_site"),
            last_seen_at: r.get("last_seen_at"),
            last_area: r.get("last_area"),
            last_door: r.get("last_door"),
            stale_at: r.get("stale_at"),
            on_shift: r.get("on_shift"),
            current_shift_id: r.get("current_shift_id"),
            updated_at: r.get("updated_at"),
        })
        .into_response(),
        Ok(None) => error_response(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Presence record not found",
        )
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_presence query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch presence",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/presence/clear/:badge_id — manually clear stale on-site status
// ---------------------------------------------------------------------------

pub async fn clear_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(badge_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "presence:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "presence:manage required",
        )
        .into_response();
    }

    let result = sqlx::query(
        r#"UPDATE presence_status
           SET on_site = false,
               stale_at = NULL,
               updated_at = now()
           WHERE user_id = $1
           RETURNING user_id"#,
    )
    .bind(badge_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(_)) => ok(json!({ "cleared": true, "badge_id": badge_id })).into_response(),
        Ok(None) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Badge ID not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "clear_presence failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to clear presence",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/muster/points — list muster points
// ---------------------------------------------------------------------------

pub async fn list_muster_points(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM muster_points")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_muster_points count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count muster points",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"SELECT id, name, description, area, capacity, latitude, longitude,
                  door_ids, enabled, created_at, created_by
           FROM muster_points
           ORDER BY name
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<MusterPointRow> = rows
                .iter()
                .map(|r| MusterPointRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    description: r.get("description"),
                    area: r.get("area"),
                    capacity: r.get("capacity"),
                    latitude: r.get("latitude"),
                    longitude: r.get("longitude"),
                    door_ids: r.get("door_ids"),
                    enabled: r.get("enabled"),
                    created_at: r.get("created_at"),
                    created_by: r.get("created_by"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_muster_points query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch muster points",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/muster/points — create muster point
// ---------------------------------------------------------------------------

pub async fn create_muster_point(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMusterPointBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:write") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:write permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);
    let door_ids: Vec<String> = body.door_ids.unwrap_or_default();

    let row = sqlx::query(
        r#"INSERT INTO muster_points (name, description, area, capacity, latitude, longitude, door_ids, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, name, description, area, capacity, latitude, longitude,
                     door_ids, enabled, created_at, created_by"#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.area)
    .bind(body.capacity)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(&door_ids)
    .bind(actor_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => created(MusterPointRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            area: r.get("area"),
            capacity: r.get("capacity"),
            latitude: r.get("latitude"),
            longitude: r.get("longitude"),
            door_ids: r.get("door_ids"),
            enabled: r.get("enabled"),
            created_at: r.get("created_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_muster_point failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to create muster point",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/muster/events — list muster events
// ---------------------------------------------------------------------------

pub async fn list_muster_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<MusterEventsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let pg = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM muster_events WHERE ($1::TEXT IS NULL OR status = $1)",
    )
    .bind(q.status.as_deref())
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_muster_events count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count muster events",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT me.id, me.trigger_type, me.trigger_ref_id,
               me.declared_by, u.display_name AS declared_by_name,
               me.declared_at, me.resolved_by, me.resolved_at,
               me.total_on_site, me.notes, me.status,
               COUNT(ma.id)                                              AS accounting_total,
               COUNT(ma.id) FILTER (WHERE ma.status <> 'unaccounted')   AS accounting_accounted
        FROM muster_events me
        LEFT JOIN users u ON u.id = me.declared_by
        LEFT JOIN muster_accounting ma ON ma.muster_event_id = me.id
        WHERE ($1::TEXT IS NULL OR me.status = $1)
        GROUP BY me.id, me.trigger_type, me.trigger_ref_id,
                 me.declared_by, u.display_name,
                 me.declared_at, me.resolved_by, me.resolved_at,
                 me.total_on_site, me.notes, me.status
        ORDER BY me.declared_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(q.status.as_deref())
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<MusterEventRow> = rows
                .iter()
                .map(|r| MusterEventRow {
                    id: r.get("id"),
                    trigger_type: r.get("trigger_type"),
                    trigger_ref_id: r.get("trigger_ref_id"),
                    declared_by: r.get("declared_by"),
                    declared_by_name: r.get("declared_by_name"),
                    declared_at: r.get("declared_at"),
                    resolved_by: r.get("resolved_by"),
                    resolved_at: r.get("resolved_at"),
                    total_on_site: r.get("total_on_site"),
                    notes: r.get("notes"),
                    status: r.get("status"),
                    accounting_total: r.get("accounting_total"),
                    accounting_accounted: r.get("accounting_accounted"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_muster_events query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch muster events",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/muster/events — declare muster event
// ---------------------------------------------------------------------------

pub async fn declare_muster_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DeclareMusterBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "muster:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "muster:manage permission required",
        )
        .into_response();
    }

    let actor_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => {
            return error_response(StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "Invalid claims")
                .into_response()
        }
    };

    let trigger_type = body.trigger_type.unwrap_or_else(|| "manual".to_string());

    // Count on-site personnel
    let on_site_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM presence_status WHERE on_site = true")
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);

    // Insert muster event
    let event_row = sqlx::query(
        r#"INSERT INTO muster_events (trigger_type, trigger_ref_id, declared_by, total_on_site, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, trigger_type, trigger_ref_id, declared_by, declared_at,
                     resolved_by, resolved_at, total_on_site, notes, status"#,
    )
    .bind(&trigger_type)
    .bind(body.trigger_ref_id)
    .bind(actor_id)
    .bind(on_site_count as i32)
    .bind(&body.notes)
    .fetch_one(&state.db)
    .await;

    let event = match event_row {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "declare_muster_event insert failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to create muster event",
            )
            .into_response();
        }
    };

    let event_id: Uuid = event.get("id");

    // Insert accounting rows for all on-site users
    let _ = sqlx::query(
        r#"INSERT INTO muster_accounting (muster_event_id, user_id, status)
           SELECT $1, user_id, 'unaccounted'
           FROM presence_status
           WHERE on_site = true
           ON CONFLICT (muster_event_id, user_id) DO NOTHING"#,
    )
    .bind(event_id)
    .execute(&state.db)
    .await;

    // Also insert for on-shift users not already covered
    let _ = sqlx::query(
        r#"INSERT INTO muster_accounting (muster_event_id, user_id, status)
           SELECT $1, user_id, 'unaccounted'
           FROM presence_status
           WHERE on_shift = true
           ON CONFLICT (muster_event_id, user_id) DO NOTHING"#,
    )
    .bind(event_id)
    .execute(&state.db)
    .await;

    // Publish muster:status after DB inserts are committed
    {
        let http = state.http_client.clone();
        let broker_url = state.config.broker_url.clone();
        let secret = state.config.service_secret.clone();
        let event_id_str = event_id.to_string();
        let total = on_site_count;
        tokio::spawn(async move {
            crate::broker::broadcast(
                &http,
                &broker_url,
                &secret,
                "muster_status",
                serde_json::json!({
                    "muster_event_id": event_id_str,
                    "accounted": 0,
                    "unaccounted": total,
                    "total": total,
                }),
            )
            .await;
        });
    }

    created(MusterEventRow {
        id: event.get("id"),
        trigger_type: event.get("trigger_type"),
        trigger_ref_id: event.get("trigger_ref_id"),
        declared_by: event.get("declared_by"),
        declared_by_name: None,
        declared_at: event.get("declared_at"),
        resolved_by: event.get("resolved_by"),
        resolved_at: event.get("resolved_at"),
        total_on_site: event.get("total_on_site"),
        notes: event.get("notes"),
        status: event.get("status"),
        accounting_total: Some(on_site_count),
        accounting_accounted: Some(0),
    })
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/muster/events/:id — get event with accounting
// ---------------------------------------------------------------------------

pub async fn get_muster_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let event_row = sqlx::query(
        r#"SELECT me.id, me.trigger_type, me.trigger_ref_id,
                  me.declared_by, u.display_name AS declared_by_name,
                  me.declared_at, me.resolved_by, me.resolved_at,
                  me.total_on_site, me.notes, me.status,
                  COUNT(ma.id)                                              AS accounting_total,
                  COUNT(ma.id) FILTER (WHERE ma.status <> 'unaccounted')   AS accounting_accounted
           FROM muster_events me
           LEFT JOIN users u ON u.id = me.declared_by
           LEFT JOIN muster_accounting ma ON ma.muster_event_id = me.id
           WHERE me.id = $1
           GROUP BY me.id, me.trigger_type, me.trigger_ref_id,
                    me.declared_by, u.display_name,
                    me.declared_at, me.resolved_by, me.resolved_at,
                    me.total_on_site, me.notes, me.status"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let event = match event_row {
        Ok(Some(r)) => MusterEventRow {
            id: r.get("id"),
            trigger_type: r.get("trigger_type"),
            trigger_ref_id: r.get("trigger_ref_id"),
            declared_by: r.get("declared_by"),
            declared_by_name: r.get("declared_by_name"),
            declared_at: r.get("declared_at"),
            resolved_by: r.get("resolved_by"),
            resolved_at: r.get("resolved_at"),
            total_on_site: r.get("total_on_site"),
            notes: r.get("notes"),
            status: r.get("status"),
            accounting_total: r.get("accounting_total"),
            accounting_accounted: r.get("accounting_accounted"),
        },
        Ok(None) => {
            return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Muster event not found")
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_muster_event query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch muster event",
            )
            .into_response();
        }
    };

    let accounting = sqlx::query(
        r#"SELECT ma.id, ma.muster_event_id, ma.user_id,
                  u.display_name, u.email,
                  ma.muster_point_id, mp.name AS muster_point_name,
                  ma.status, ma.accounted_at, ma.accounted_by, ma.notes
           FROM muster_accounting ma
           LEFT JOIN users u ON u.id = ma.user_id
           LEFT JOIN muster_points mp ON mp.id = ma.muster_point_id
           WHERE ma.muster_event_id = $1
           ORDER BY u.display_name"#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    match accounting {
        Ok(rows) => {
            let accounting_list: Vec<MusterAccountingRow> = rows
                .iter()
                .map(|r| MusterAccountingRow {
                    id: r.get("id"),
                    muster_event_id: r.get("muster_event_id"),
                    user_id: r.get("user_id"),
                    display_name: r.get("display_name"),
                    email: r.get("email"),
                    muster_point_id: r.get("muster_point_id"),
                    muster_point_name: r.get("muster_point_name"),
                    status: r.get("status"),
                    accounted_at: r.get("accounted_at"),
                    accounted_by: r.get("accounted_by"),
                    notes: r.get("notes"),
                })
                .collect();
            ok(json!({ "event": event, "accounting": accounting_list })).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_muster_event accounting query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch muster accounting",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/muster/events/:id/resolve — resolve event
// ---------------------------------------------------------------------------

pub async fn resolve_muster_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveMusterBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "muster:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "muster:manage permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);

    let row = sqlx::query(
        r#"UPDATE muster_events
           SET status      = 'resolved',
               resolved_by = $2,
               resolved_at = now(),
               notes       = COALESCE($3, notes)
           WHERE id = $1 AND status = 'active'
           RETURNING id, status, resolved_by, resolved_at, notes"#,
    )
    .bind(id)
    .bind(actor_id)
    .bind(&body.notes)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            // Query final accounting totals for the publish payload
            let resolved_id: Uuid = r.get("id");
            let totals = sqlx::query(
                r#"SELECT
                       COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status <> 'unaccounted') AS accounted
                   FROM muster_accounting
                   WHERE muster_event_id = $1"#,
            )
            .bind(resolved_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

            let (total, accounted) = totals
                .as_ref()
                .map(|t| {
                    let total: i64 = t.get("total");
                    let accounted: i64 = t.get("accounted");
                    (total, accounted)
                })
                .unwrap_or((0, 0));

            // Publish muster:status with final counts and "resolved" status
            {
                let http = state.http_client.clone();
                let broker_url = state.config.broker_url.clone();
                let secret = state.config.service_secret.clone();
                let event_id_str = resolved_id.to_string();
                tokio::spawn(async move {
                    crate::broker::broadcast(
                        &http,
                        &broker_url,
                        &secret,
                        "muster_status",
                        serde_json::json!({
                            "muster_event_id": event_id_str,
                            "accounted": accounted,
                            "unaccounted": total - accounted,
                            "total": total,
                            "status": "resolved",
                        }),
                    )
                    .await;
                });
            }

            ok(json!({
                "id": r.get::<Uuid, _>("id"),
                "status": r.get::<String, _>("status"),
                "resolved_by": r.get::<Option<Uuid>, _>("resolved_by"),
                "resolved_at": r.get::<Option<DateTime<Utc>>, _>("resolved_at"),
                "notes": r.get::<Option<String>, _>("notes"),
            }))
            .into_response()
        }
        Ok(None) => error_response(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "Muster event not found or already resolved",
        )
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "resolve_muster_event failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to resolve muster event",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/muster/events/:id/account — account for person
// ---------------------------------------------------------------------------

pub async fn account_person(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AccountPersonBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "muster:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "muster:manage permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);

    let row = sqlx::query(
        r#"INSERT INTO muster_accounting (muster_event_id, user_id, status, muster_point_id, accounted_at, accounted_by, notes)
           VALUES ($1, $2, $3, $4, now(), $5, $6)
           ON CONFLICT (muster_event_id, user_id) DO UPDATE
               SET status          = EXCLUDED.status,
                   muster_point_id = EXCLUDED.muster_point_id,
                   accounted_at    = now(),
                   accounted_by    = EXCLUDED.accounted_by,
                   notes           = COALESCE(EXCLUDED.notes, muster_accounting.notes)
           RETURNING id, muster_event_id, user_id, muster_point_id, status,
                     accounted_at, accounted_by, notes"#,
    )
    .bind(id)
    .bind(body.user_id)
    .bind(&body.status)
    .bind(body.muster_point_id)
    .bind(actor_id)
    .bind(&body.notes)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => {
            let user_id: Uuid = r.get("user_id");
            let muster_event_id: Uuid = r.get("muster_event_id");
            let accounting_status: String = r.get("status");
            let muster_point_id: Option<Uuid> = r.get("muster_point_id");

            // Fetch user details for the response and for the WS publish payload
            let user_row = sqlx::query("SELECT full_name, email FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(&state.db)
                .await
                .unwrap_or(None);

            let person_name: String = user_row
                .as_ref()
                .and_then(|u| u.get::<Option<String>, _>("full_name"))
                .unwrap_or_default();

            // Fetch muster point name (if assigned)
            let muster_point_name: String = if let Some(mp_id) = muster_point_id {
                sqlx::query_scalar("SELECT name FROM muster_points WHERE id = $1")
                    .bind(mp_id)
                    .fetch_optional(&state.db)
                    .await
                    .unwrap_or(None)
                    .unwrap_or_default()
            } else {
                String::new()
            };

            // Re-query accounting totals
            let totals = sqlx::query(
                r#"SELECT
                       COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status <> 'unaccounted') AS accounted
                   FROM muster_accounting
                   WHERE muster_event_id = $1"#,
            )
            .bind(muster_event_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

            let (total, accounted) = totals
                .as_ref()
                .map(|t| {
                    let total: i64 = t.get("total");
                    let accounted: i64 = t.get("accounted");
                    (total, accounted)
                })
                .unwrap_or((0, 0));

            // Publish muster:status and muster:person_accounted
            {
                let http = state.http_client.clone();
                let broker_url = state.config.broker_url.clone();
                let secret = state.config.service_secret.clone();
                let event_id_str = muster_event_id.to_string();
                let person_name_clone = person_name.clone();
                let muster_point_name_clone = muster_point_name.clone();
                let method = if accounting_status == "accounted_badge" {
                    "badge"
                } else {
                    "manual"
                };
                let method_str = method.to_string();
                tokio::spawn(async move {
                    crate::broker::broadcast(
                        &http,
                        &broker_url,
                        &secret,
                        "muster_status",
                        serde_json::json!({
                            "muster_event_id": event_id_str,
                            "accounted": accounted,
                            "unaccounted": total - accounted,
                            "total": total,
                        }),
                    )
                    .await;
                    crate::broker::broadcast(
                        &http,
                        &broker_url,
                        &secret,
                        "muster_person_accounted",
                        serde_json::json!({
                            "person_name": person_name_clone,
                            "muster_point": muster_point_name_clone,
                            "method": method_str,
                        }),
                    )
                    .await;
                });
            }

            ok(MusterAccountingRow {
                id: r.get("id"),
                muster_event_id,
                user_id,
                display_name: user_row.as_ref().and_then(|u| u.get("full_name")),
                email: user_row.as_ref().and_then(|u| u.get("email")),
                muster_point_id,
                muster_point_name: None,
                status: accounting_status,
                accounted_at: r.get("accounted_at"),
                accounted_by: r.get("accounted_by"),
                notes: r.get("notes"),
            })
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "account_person failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to account for person",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/badge-sources — list sources
// ---------------------------------------------------------------------------

pub async fn list_badge_sources(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "badge_config:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "badge_config:manage permission required",
        )
        .into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM access_control_sources")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_badge_sources count query failed");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to count badge sources",
            )
            .into_response();
        }
    };

    let rows = sqlx::query(
        r#"SELECT id, name, adapter_type, enabled, config, poll_interval_s,
                  last_poll_at, last_poll_ok, last_error, created_at, updated_at, created_by
           FROM access_control_sources
           ORDER BY name
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<BadgeSourceRow> = rows
                .iter()
                .map(|r| BadgeSourceRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    adapter_type: r.get("adapter_type"),
                    enabled: r.get("enabled"),
                    config: r.get("config"),
                    poll_interval_s: r.get("poll_interval_s"),
                    last_poll_at: r.get("last_poll_at"),
                    last_poll_ok: r.get("last_poll_ok"),
                    last_error: r.get("last_error"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                    created_by: r.get("created_by"),
                })
                .collect();
            (
                StatusCode::OK,
                Json(PagedResponse::new(data, pg, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_badge_sources query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch badge sources",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/badge-sources — create source
// ---------------------------------------------------------------------------

pub async fn create_badge_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBadgeSourceBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "badge_config:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "badge_config:manage permission required",
        )
        .into_response();
    }

    let actor_id = user_id_from_claims(&claims);
    let enabled = body.enabled.unwrap_or(true);
    let config = body.config.unwrap_or(json!({}));
    let poll_interval = body.poll_interval_s.unwrap_or(30);

    let row = sqlx::query(
        r#"INSERT INTO access_control_sources (name, adapter_type, enabled, config, poll_interval_s, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, name, adapter_type, enabled, config, poll_interval_s,
                     last_poll_at, last_poll_ok, last_error, created_at, updated_at, created_by"#,
    )
    .bind(&body.name)
    .bind(&body.adapter_type)
    .bind(enabled)
    .bind(config)
    .bind(poll_interval)
    .bind(actor_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => created(BadgeSourceRow {
            id: r.get("id"),
            name: r.get("name"),
            adapter_type: r.get("adapter_type"),
            enabled: r.get("enabled"),
            config: r.get("config"),
            poll_interval_s: r.get("poll_interval_s"),
            last_poll_at: r.get("last_poll_at"),
            last_poll_ok: r.get("last_poll_ok"),
            last_error: r.get("last_error"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_badge_source failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to create badge source",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/badge-sources/:id — update source
// ---------------------------------------------------------------------------

pub async fn update_badge_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBadgeSourceBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "badge_config:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "badge_config:manage permission required",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"UPDATE access_control_sources
           SET name            = COALESCE($2, name),
               adapter_type    = COALESCE($3, adapter_type),
               enabled         = COALESCE($4, enabled),
               config          = COALESCE($5, config),
               poll_interval_s = COALESCE($6, poll_interval_s)
           WHERE id = $1
           RETURNING id, name, adapter_type, enabled, config, poll_interval_s,
                     last_poll_at, last_poll_ok, last_error, created_at, updated_at, created_by"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.adapter_type)
    .bind(body.enabled)
    .bind(body.config.as_ref())
    .bind(body.poll_interval_s)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(BadgeSourceRow {
            id: r.get("id"),
            name: r.get("name"),
            adapter_type: r.get("adapter_type"),
            enabled: r.get("enabled"),
            config: r.get("config"),
            poll_interval_s: r.get("poll_interval_s"),
            last_poll_at: r.get("last_poll_at"),
            last_poll_ok: r.get("last_poll_ok"),
            last_error: r.get("last_error"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Badge source not found")
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_badge_source failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to update badge source",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/badge-sources/:id — delete source
// ---------------------------------------------------------------------------

pub async fn delete_badge_source(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "badge_config:manage") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "badge_config:manage permission required",
        )
        .into_response();
    }

    let result = sqlx::query("DELETE FROM access_control_sources WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => ok(json!({ "deleted": true })).into_response(),
        Ok(_) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Badge source not found")
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_badge_source failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to delete badge source",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/shifts/current — active shift(s) overlapping now()
// ---------------------------------------------------------------------------

pub async fn get_current_shifts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let rows = sqlx::query(
        r#"
        SELECT s.id, s.name, s.crew_id, sc.name AS crew_name, s.pattern_id,
               s.start_time, s.end_time, s.handover_minutes, s.notes, s.status,
               s.source, s.source_system, s.external_id,
               s.created_at, s.created_by
        FROM shifts s
        LEFT JOIN shift_crews sc ON sc.id = s.crew_id
        WHERE s.start_time <= now()
          AND (s.end_time + (s.handover_minutes || ' minutes')::interval) >= now()
        ORDER BY s.start_time
        "#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<ShiftRow> = rows
                .iter()
                .map(|r| ShiftRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    crew_id: r.get("crew_id"),
                    crew_name: r.get("crew_name"),
                    pattern_id: r.get("pattern_id"),
                    start_time: r.get("start_time"),
                    end_time: r.get("end_time"),
                    handover_minutes: r.get("handover_minutes"),
                    notes: r.get("notes"),
                    status: r.get("status"),
                    source: r.get("source"),
                    source_system: r.get("source_system"),
                    external_id: r.get("external_id"),
                    created_at: r.get("created_at"),
                    created_by: r.get("created_by"),
                })
                .collect();
            ok(data).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_current_shifts query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch current shifts",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/shifts/current/personnel — personnel on active shifts
// ---------------------------------------------------------------------------

pub async fn get_current_personnel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "shifts:read") {
        return error_response(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "shifts:read permission required",
        )
        .into_response();
    }

    let rows = sqlx::query(
        r#"
        SELECT DISTINCT sa.user_id, u.display_name, u.email, sa.role_label
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        LEFT JOIN users u ON u.id = sa.user_id
        WHERE s.start_time <= now()
          AND (s.end_time + (s.handover_minutes || ' minutes')::interval) >= now()
        ORDER BY u.display_name
        "#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let data: Vec<CurrentPersonnelRow> = rows
                .iter()
                .map(|r| CurrentPersonnelRow {
                    user_id: r.get("user_id"),
                    display_name: r.get("display_name"),
                    email: r.get("email"),
                    role_label: r.get("role_label"),
                })
                .collect();
            ok(data).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_current_personnel query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch current shift personnel",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/badge-events — recent badge swipe events
// ---------------------------------------------------------------------------

pub async fn list_badge_events(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query(
        "SELECT id, employee_id, event_type, door_id, door_name, event_time, badge_id \
         FROM badge_events \
         ORDER BY event_time DESC \
         LIMIT 100",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let events: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "id": r.try_get::<Uuid, _>("id").ok(),
                        "employee_id": r.try_get::<Option<String>, _>("employee_id").ok().flatten(),
                        "event_type": r.try_get::<String, _>("event_type").unwrap_or_default(),
                        "door_id": r.try_get::<Option<String>, _>("door_id").ok().flatten(),
                        "door_name": r.try_get::<Option<String>, _>("door_name").ok().flatten(),
                        "event_time": r.try_get::<DateTime<Utc>, _>("event_time").ok(),
                        "badge_id": r.try_get::<Option<String>, _>("badge_id").ok().flatten(),
                    })
                })
                .collect();
            ok(events).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_badge_events query failed");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_ERROR",
                "Failed to fetch badge events",
            )
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Route builder (called from main.rs)
// ---------------------------------------------------------------------------

pub fn shifts_routes() -> axum::Router<AppState> {
    use axum::routing::{delete, get, post, put};

    axum::Router::new()
        // Shift patterns (static before /:id)
        .route(
            "/api/shifts/patterns",
            get(list_patterns).post(create_pattern),
        )
        .route(
            "/api/shifts/patterns/:id",
            get(get_pattern).put(update_pattern).delete(delete_pattern),
        )
        .route(
            "/api/shifts/patterns/:id/generate",
            post(generate_from_pattern),
        )
        // Shift crews (static before /:id)
        .route("/api/shifts/crews", get(list_crews).post(create_crew))
        .route(
            "/api/shifts/crews/:id",
            get(get_crew).put(update_crew).delete(delete_crew),
        )
        .route("/api/shifts/crews/:id/members", post(add_crew_member))
        .route(
            "/api/shifts/crews/:id/members/:user_id",
            delete(remove_crew_member),
        )
        // Shifts CRUD — current routes must come before /:id to avoid UUID matching
        .route("/api/shifts/current", get(get_current_shifts))
        .route("/api/shifts/current/personnel", get(get_current_personnel))
        .route("/api/shifts", get(list_shifts).post(create_shift))
        .route(
            "/api/shifts/:id",
            get(get_shift).put(update_shift).delete(delete_shift),
        )
        // Presence
        .route("/api/presence", get(list_presence))
        .route("/api/presence/:user_id", get(get_presence))
        .route("/api/presence/clear/:badge_id", post(clear_presence))
        // Muster points (static before /events)
        .route(
            "/api/muster/points",
            get(list_muster_points).post(create_muster_point),
        )
        // Muster events
        .route(
            "/api/muster/events",
            get(list_muster_events).post(declare_muster_event),
        )
        .route("/api/muster/events/:id", get(get_muster_event))
        .route("/api/muster/events/:id/resolve", put(resolve_muster_event))
        .route("/api/muster/events/:id/account", post(account_person))
        // Badge sources
        .route(
            "/api/badge-sources",
            get(list_badge_sources).post(create_badge_source),
        )
        .route(
            "/api/badge-sources/:id",
            put(update_badge_source).delete(delete_badge_source),
        )
        // Badge events (read-only feed)
        .route("/api/badge-events", get(list_badge_events))
}
