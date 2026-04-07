/// Active alarm query and operator-action endpoints for the event-service.
///
/// These endpoints are **internal** — protected by the service secret header
/// (`x-io-service-secret`). They are proxied through the API gateway, which
/// injects the secret. Direct external access is not permitted.
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
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

use crate::alarm_state::{transition, AlarmEvent, AlarmState};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Service-secret guard
// ---------------------------------------------------------------------------

fn check_service_secret(headers: &HeaderMap, expected: &str) -> bool {
    headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .map(|s| s == expected)
        .unwrap_or(false)
}

fn user_id_from_headers(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ActiveAlarmItem {
    pub definition_id: Uuid,
    pub definition_name: String,
    pub point_id: Option<Uuid>,
    pub state: String,
    pub priority: String,
    pub message: String,
    pub transitioned_at: DateTime<Utc>,
    pub last_event_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct AlarmHistoryItem {
    pub id: Uuid,
    pub event_id: Uuid,
    pub state: String,
    pub previous_state: Option<String>,
    pub transitioned_at: DateTime<Utc>,
    pub transitioned_by: Option<Uuid>,
    pub comment: Option<String>,
    pub metadata: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ActiveAlarmFilter {
    pub point_id: Option<Uuid>,
    pub state: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AlarmHistoryFilter {
    // Use i64 instead of u32 for SQLx binding compatibility (sqlx encodes i64 as
    // BIGINT which binds cleanly to LIMIT/OFFSET in PostgreSQL).
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub definition_id: Option<Uuid>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ShelveRequest {
    pub duration_secs: i64,
    pub reason: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /alarms/active
// ---------------------------------------------------------------------------

pub async fn get_active_alarms(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<ActiveAlarmFilter>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    // Find the most recent alarm_states row per definition by joining events.
    // We select from alarm_states joined to alarm_definitions for the name/priority.
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (ad.id)
            ad.id                    AS definition_id,
            ad.name                  AS definition_name,
            ad.point_id              AS point_id,
            ad.priority::text        AS priority,
            ast.state::text          AS state,
            ast.transitioned_at      AS transitioned_at,
            ast.id                   AS alarm_state_id,
            e.id                     AS event_id,
            e.message                AS message
        FROM alarm_definitions ad
        JOIN alarm_states ast ON ast.event_id IN (
            SELECT id FROM events
            WHERE event_type = 'io_alarm'
              AND ($1::uuid IS NULL OR point_id = $1)
            ORDER BY timestamp DESC
            LIMIT 100
        )
        JOIN events e ON e.id = ast.event_id
        WHERE ad.enabled = true
          AND ad.deleted_at IS NULL
          AND ast.state::text NOT IN ('cleared', 'disabled')
          AND ($1::uuid IS NULL OR ad.point_id = $1)
          AND ($2::text IS NULL OR ast.state::text = $2)
          AND ($3::text IS NULL OR ad.priority::text = $3)
        ORDER BY ad.id, ast.transitioned_at DESC
        "#,
    )
    .bind(filter.point_id)
    .bind(filter.state.as_deref())
    .bind(filter.priority.as_deref())
    .fetch_all(&state.db)
    .await?;

    let items: Vec<ActiveAlarmItem> = rows
        .iter()
        .filter_map(|r| {
            Some(ActiveAlarmItem {
                definition_id: r.try_get("definition_id").ok()?,
                definition_name: r.try_get("definition_name").unwrap_or_default(),
                point_id: r.try_get("point_id").ok().flatten(),
                state: r.try_get("state").unwrap_or_default(),
                priority: r.try_get("priority").unwrap_or_default(),
                message: r.try_get("message").unwrap_or_default(),
                transitioned_at: r.try_get("transitioned_at").ok()?,
                last_event_id: r.try_get("event_id").ok()?,
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(items)))
}

// ---------------------------------------------------------------------------
// POST /alarms/:id/acknowledge
// ---------------------------------------------------------------------------

/// `id` is the `alarm_definitions.id` (definition_id).
pub async fn acknowledge_alarm(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    let user_id = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::BadRequest("x-io-user-id header required".into()))?;

    let now = Utc::now();

    // Fetch the latest alarm_state for this definition.
    let state_row = sqlx::query(
        r#"
        SELECT ast.id, ast.state::text AS state, e.id AS event_id, e.timestamp AS event_ts
        FROM alarm_states ast
        JOIN events e ON e.id = ast.event_id
        WHERE e.metadata->>'definition_id' = $1
        ORDER BY ast.transitioned_at DESC
        LIMIT 1
        "#,
    )
    .bind(id.to_string())
    .fetch_optional(&state.db)
    .await?;

    let state_row = state_row
        .ok_or_else(|| IoError::NotFound(format!("No active alarm for definition {id}")))?;

    let current_state_str: String = state_row.try_get("state").map_err(IoError::Database)?;
    let current_state = parse_db_state(&current_state_str);
    let event_id: Uuid = state_row.try_get("event_id").map_err(IoError::Database)?;
    let event_ts: DateTime<Utc> = state_row.try_get("event_ts").map_err(IoError::Database)?;

    // Build a dummy instance just to pass through transition.
    let def_row = sqlx::query("SELECT name, point_id FROM alarm_definitions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Alarm definition {id} not found")))?;

    let name: String = def_row.try_get("name").map_err(IoError::Database)?;
    let point_id: Option<Uuid> = def_row.try_get("point_id").map_err(IoError::Database)?;

    let mut instance =
        crate::alarm_state::AlarmInstance::new(id, point_id.unwrap_or(Uuid::nil()), 3, &name);
    instance.state = current_state.clone();

    let event = AlarmEvent::OperatorAcknowledge { user_id };
    let next = transition(&current_state, &event, &mut instance, now).ok_or_else(|| {
        IoError::BadRequest(format!(
            "Cannot acknowledge alarm in state '{current_state_str}'"
        ))
    })?;

    let new_state_db = alarm_state_to_db(&next);
    let prev_state_db = alarm_state_to_db(&current_state);

    // Insert new alarm_states row.
    sqlx::query(
        "INSERT INTO alarm_states
             (id, event_id, event_timestamp, state, previous_state,
              transitioned_at, transitioned_by)
         VALUES ($1, $2, $3, $4::alarm_state_enum, $5::alarm_state_enum, $6, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(event_ts)
    .bind(new_state_db)
    .bind(prev_state_db)
    .bind(now)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    metrics::counter!("io_alarms_acknowledged_total").increment(1);

    // NOTIFY
    let payload = serde_json::json!({
        "definition_id": id,
        "state": next.to_string(),
        "acknowledged_by": user_id,
        "at": now,
    });
    sqlx::query("SELECT pg_notify('alarm_state_changed', $1)")
        .bind(payload.to_string())
        .execute(&state.db)
        .await
        .ok();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "definition_id": id,
        "new_state": next.to_string(),
    }))))
}

// ---------------------------------------------------------------------------
// POST /alarms/:id/shelve
// ---------------------------------------------------------------------------

pub async fn shelve_alarm(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<ShelveRequest>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    let user_id = user_id_from_headers(&headers)
        .ok_or_else(|| IoError::BadRequest("x-io-user-id header required".into()))?;

    if req.duration_secs <= 0 {
        return Err(IoError::BadRequest(
            "duration_secs must be greater than zero".into(),
        ));
    }

    let now = Utc::now();
    let expires = now + chrono::Duration::seconds(req.duration_secs);

    // Record shelve in alarm_shelving table.
    sqlx::query(
        "INSERT INTO alarm_shelving
             (id, alarm_definition_id, shelved_by, shelf_duration_seconds, shelf_expires_at, reason)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(user_id)
    .bind(req.duration_secs as i32)
    .bind(expires)
    .bind(req.reason.as_deref().unwrap_or("operator shelved"))
    .execute(&state.db)
    .await?;

    // Insert alarm state transition record.
    // We look up the latest event for this definition to attach the state to.
    let event_row = sqlx::query(
        "SELECT id, timestamp FROM events
         WHERE metadata->>'definition_id' = $1
           AND event_type = 'io_alarm'
         ORDER BY timestamp DESC LIMIT 1",
    )
    .bind(id.to_string())
    .fetch_optional(&state.db)
    .await?;

    if let Some(ev) = event_row {
        let event_id: Uuid = ev.try_get("id").map_err(IoError::Database)?;
        let event_ts: DateTime<Utc> = ev.try_get("timestamp").map_err(IoError::Database)?;

        sqlx::query(
            "INSERT INTO alarm_states
                 (id, event_id, event_timestamp, state, previous_state, transitioned_at, transitioned_by)
             VALUES ($1, $2, $3, 'shelved'::alarm_state_enum, NULL, $4, $5)",
        )
        .bind(Uuid::new_v4())
        .bind(event_id)
        .bind(event_ts)
        .bind(now)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    }

    // NOTIFY
    let payload = serde_json::json!({
        "definition_id": id,
        "state": "shelved",
        "shelved_by": user_id,
        "expires_at": expires,
    });
    sqlx::query("SELECT pg_notify('alarm_state_changed', $1)")
        .bind(payload.to_string())
        .execute(&state.db)
        .await
        .ok();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "definition_id": id,
        "shelved_until": expires,
    }))))
}

// ---------------------------------------------------------------------------
// GET /alarms/history
// ---------------------------------------------------------------------------

pub async fn get_alarm_history(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<AlarmHistoryFilter>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    let page = filter.page.unwrap_or(1).max(1);
    let limit = filter.per_page.unwrap_or(50).clamp(1, 500);
    let offset = (page - 1) * limit;

    let from = filter
        .from
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(7));
    let to = filter.to.unwrap_or_else(Utc::now);

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM alarm_states ast
         JOIN events e ON e.id = ast.event_id
         WHERE ast.transitioned_at >= $1
           AND ast.transitioned_at <= $2
           AND ($3::uuid IS NULL OR e.metadata->>'definition_id' = $3::text)",
    )
    .bind(from)
    .bind(to)
    .bind(filter.definition_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<i64, _>(0))?;

    let rows = sqlx::query(
        "SELECT ast.id, ast.event_id, ast.state::text AS state,
                ast.previous_state::text AS previous_state,
                ast.transitioned_at, ast.transitioned_by, ast.comment,
                e.metadata
         FROM alarm_states ast
         JOIN events e ON e.id = ast.event_id
         WHERE ast.transitioned_at >= $1
           AND ast.transitioned_at <= $2
           AND ($3::uuid IS NULL OR e.metadata->>'definition_id' = $3::text)
         ORDER BY ast.transitioned_at DESC
         LIMIT $4 OFFSET $5",
    )
    .bind(from)
    .bind(to)
    .bind(filter.definition_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<AlarmHistoryItem> = rows
        .iter()
        .filter_map(|r| {
            Some(AlarmHistoryItem {
                id: r.try_get("id").ok()?,
                event_id: r.try_get("event_id").ok()?,
                state: r.try_get("state").unwrap_or_default(),
                previous_state: r.try_get("previous_state").ok().flatten(),
                transitioned_at: r.try_get("transitioned_at").ok()?,
                transitioned_by: r.try_get("transitioned_by").ok().flatten(),
                comment: r.try_get("comment").ok().flatten(),
                metadata: r.try_get("metadata").ok().flatten(),
            })
        })
        .collect();

    Ok(Json(PagedResponse::new(
        items,
        page as u32,
        limit as u32,
        total as u64,
    )))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /alarms/opc/active
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct OpcActiveAlarmItem {
    pub point_id: Uuid,
    pub tagname: String,
    pub condition_name: String,
    pub state: String,
    pub priority: String,
    pub severity: i16,
    pub limit_state: Option<String>,
    pub message: Option<String>,
    pub activated_at: Option<DateTime<Utc>>,
    pub last_event_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct OpcActiveAlarmFilter {
    pub point_id: Option<Uuid>,
    pub priority: Option<String>,
}

pub async fn get_opc_active_alarms(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<OpcActiveAlarmFilter>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    let rows = sqlx::query(
        r#"
        SELECT
            ac.point_id,
            COALESCE(pm.tagname, ac.condition_name) AS tagname,
            ac.condition_name,
            ac.state::text       AS state,
            ac.priority::text    AS priority,
            ac.severity,
            ac.limit_state,
            ac.message,
            ac.activated_at,
            ac.last_event_at
        FROM alarms_current ac
        LEFT JOIN points_metadata pm ON pm.id = ac.point_id
        WHERE ac.alarm_source = 'opc'
          AND ac.state NOT IN ('cleared'::alarm_state_enum, 'disabled'::alarm_state_enum)
          AND ($1::uuid IS NULL OR ac.point_id = $1)
          AND ($2::text IS NULL OR ac.priority::text = $2)
        ORDER BY ac.priority, ac.last_event_at DESC
        "#,
    )
    .bind(filter.point_id)
    .bind(filter.priority.as_deref())
    .fetch_all(&state.db)
    .await?;

    let items: Vec<OpcActiveAlarmItem> = rows
        .iter()
        .filter_map(|r| {
            Some(OpcActiveAlarmItem {
                point_id: r.try_get("point_id").ok()?,
                tagname: r.try_get("tagname").unwrap_or_default(),
                condition_name: r.try_get("condition_name").unwrap_or_default(),
                state: r.try_get("state").unwrap_or_default(),
                priority: r.try_get("priority").unwrap_or_default(),
                severity: r.try_get("severity").unwrap_or(0),
                limit_state: r.try_get("limit_state").ok().flatten(),
                message: r.try_get("message").ok().flatten(),
                activated_at: r.try_get("activated_at").ok().flatten(),
                last_event_at: r.try_get("last_event_at").ok()?,
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(items)))
}

// ---------------------------------------------------------------------------
// POST /alarms/opc/:point_id/acknowledge
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
pub struct OpcAcknowledgeRequest {
    #[serde(default)]
    pub comment: String,
    pub condition_name: Option<String>,
}

pub async fn acknowledge_opc_alarm(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(point_id): Path<Uuid>,
    Json(req): Json<OpcAcknowledgeRequest>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    // Look up the current alarm state for this point from alarms_current.
    let row = sqlx::query(
        r#"
        SELECT
            ac.source_id,
            ac.event_id_hex,
            ac.condition_name,
            ac.metadata->>'source_ref' AS source_ref
        FROM alarms_current ac
        WHERE ac.point_id = $1
          AND ac.alarm_source = 'opc'
          AND ($2::text IS NULL OR ac.condition_name = $2)
          AND ac.active = true
        ORDER BY ac.last_event_at DESC
        LIMIT 1
        "#,
    )
    .bind(point_id)
    .bind(req.condition_name.as_deref())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("No active OPC alarm for point {point_id}")))?;

    let source_id: Uuid = row
        .try_get::<Option<Uuid>, _>("source_id")
        .map_err(IoError::Database)?
        .ok_or_else(|| {
            IoError::BadRequest("Alarm has no source_id — cannot proxy to OPC service".into())
        })?;
    let event_id_hex: Option<String> = row.try_get("event_id_hex").ok().flatten();
    let source_ref: Option<String> = row.try_get("source_ref").ok().flatten();
    let condition_name: String = row.try_get("condition_name").unwrap_or_default();

    // Build condition NodeId: SimBLAH convention is ns=1;s="alarm:<point_name>".
    let node_name = source_ref.as_deref().unwrap_or(&condition_name);
    let condition_node_id = format!("alarm:{node_name}");

    let body = serde_json::json!({
        "condition_node_id": condition_node_id,
        "event_id": event_id_hex.unwrap_or_default(),
        "comment": req.comment,
    });

    let url = format!(
        "{}/internal/alarm/{source_id}/acknowledge",
        state.config.opc_service_url
    );

    let resp = state
        .http
        .post(&url)
        .header("x-io-service-secret", &state.config.service_secret)
        .json(&body)
        .send()
        .await
        .map_err(|e| IoError::Internal(format!("OPC service unreachable: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(IoError::Internal(format!(
            "OPC service returned {status}: {text}"
        )));
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "point_id": point_id,
        "acknowledged": true,
    }))))
}

fn parse_db_state(s: &str) -> AlarmState {
    match s {
        "active" => AlarmState::Unacknowledged,
        "acknowledged" => AlarmState::Acknowledged,
        "rtn" => AlarmState::ReturnToNormal,
        "shelved" => AlarmState::Shelved,
        "suppressed" | "out_of_service" => AlarmState::Suppressed,
        "disabled" => AlarmState::Disabled,
        _ => AlarmState::Normal,
    }
}

fn alarm_state_to_db(s: &AlarmState) -> &'static str {
    match s {
        AlarmState::Normal => "cleared",
        AlarmState::Unacknowledged => "active",
        AlarmState::Acknowledged => "acknowledged",
        AlarmState::ReturnToNormal => "rtn",
        AlarmState::Shelved => "shelved",
        AlarmState::Suppressed => "suppressed",
        AlarmState::Disabled => "disabled",
    }
}
