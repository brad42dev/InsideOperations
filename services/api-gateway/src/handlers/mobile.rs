//! Mobile-specific API endpoints for the Inside/Operations PWA.
//!
//! These endpoints are optimised for use on mobile devices with intermittent
//! connectivity. Key features:
//!
//! - Batch sync for round responses (avoids per-checkpoint round-trips on poor connections)
//! - Active rounds pre-cache endpoint (full detail payload for offline use)
//! - Presence heartbeat (periodic GPS + status update from field devices)
//! - Config endpoint (mobile PWA startup configuration, no DB required)
//! - Lightweight health check (no auth, minimal payload)

use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use super::rounds::{
    evaluate_thresholds, row_to_instance, row_to_response, row_to_template, RoundInstanceDetail,
    RoundResponseRow,
};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helpers (mirror rounds.rs pattern)
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
// Request / response types
// ---------------------------------------------------------------------------

/// A single checkpoint response payload as sent by a mobile client.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct MobileResponseItem {
    pub checkpoint_index: i32,
    pub response_value: String,
    pub notes: Option<String>,
    pub captured_at: Option<DateTime<Utc>>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
}

/// Body for `POST /api/mobile/rounds/sync`.
#[derive(Debug, Deserialize)]
pub struct BatchSyncRequest {
    pub instance_id: Uuid,
    pub responses: Vec<MobileResponseItem>,
}

/// Body for `POST /api/mobile/presence`.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct PresenceRequest {
    pub status: String,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub accuracy_meters: Option<f64>,
}

/// Mobile-specific configuration returned by `GET /api/mobile/config`.
#[derive(Debug, Serialize)]
pub struct MobileConfig {
    pub sync_interval_ms: u32,
    pub heartbeat_interval_ms: u32,
    pub offline_cache_duration_mins: u32,
    pub gps_required: bool,
    pub min_touch_target_px: u32,
}

// ---------------------------------------------------------------------------
// POST /api/mobile/rounds/sync
//
// Batch upsert of offline-queued checkpoint responses.  Accepts all pending
// responses for a single round instance in one request — far more efficient
// than one round-trip per checkpoint on a poor mobile connection.
//
// Permission: rounds:write (maps to rounds:execute in this codebase)
// ---------------------------------------------------------------------------

pub async fn batch_sync_rounds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BatchSyncRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:execute") {
        return IoError::Forbidden("rounds:execute permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    // Verify the calling user is the one who locked this instance.
    let lock_check = sqlx::query(
        "SELECT locked_to_user, status \
         FROM round_instances \
         WHERE id = $1",
    )
    .bind(body.instance_id)
    .fetch_optional(&state.db)
    .await;

    match lock_check {
        Ok(Some(row)) => {
            let locked: Option<Uuid> = row.try_get("locked_to_user").ok().flatten();
            let status: String = row.try_get("status").unwrap_or_default();

            if status == "completed" || status == "missed" {
                return IoError::Conflict(format!("Round is already {status}")).into_response();
            }

            if let Some(owner) = locked {
                if owner != user_id {
                    return IoError::Forbidden("Round is locked to a different user".into())
                        .into_response();
                }
            }
        }
        Ok(None) => {
            return IoError::NotFound(format!("Round instance {} not found", body.instance_id))
                .into_response();
        }
        Err(e) => return IoError::Database(e).into_response(),
    }

    // Fetch template checkpoints for threshold evaluation.
    let template_row = sqlx::query(
        "SELECT rt.checkpoints \
         FROM round_instances ri \
         JOIN round_templates rt ON rt.id = ri.template_id \
         WHERE ri.id = $1",
    )
    .bind(body.instance_id)
    .fetch_optional(&state.db)
    .await;

    let checkpoints: JsonValue = template_row
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<JsonValue, _>("checkpoints").ok())
        .unwrap_or(JsonValue::Array(vec![]));

    let checkpoint_arr = checkpoints.as_array().cloned().unwrap_or_default();

    let total = body.responses.len();
    let mut synced: usize = 0;
    let mut failed: usize = 0;

    for item in &body.responses {
        // Build a serde_json::Value from the string payload.
        // Attempt numeric parse; fall back to string.
        let response_value: JsonValue = if let Ok(n) = item.response_value.parse::<f64>() {
            JsonValue::Number(
                serde_json::Number::from_f64(n).unwrap_or_else(|| serde_json::Number::from(0)),
            )
        } else {
            JsonValue::String(item.response_value.clone())
        };

        // Infer response_type from what came over the wire.
        let response_type = if response_value.is_f64() || response_value.is_i64() {
            "numeric"
        } else {
            "text"
        };

        // Threshold evaluation for numeric responses.
        let (is_out_of_range, alarm_triggered) = if response_type == "numeric" {
            if let Some(val) = response_value.as_f64() {
                let checkpoint = checkpoint_arr.iter().find(|c| {
                    c.get("index")
                        .and_then(|v| v.as_i64())
                        .is_some_and(|i| i == item.checkpoint_index as i64)
                });
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

        let calculated_value: Option<f64> = if response_type == "numeric" {
            response_value.as_f64()
        } else {
            None
        };

        // Notes are appended to the response as a comment field when present.
        let final_value: JsonValue = if let Some(notes) = &item.notes {
            if !notes.is_empty() && response_type == "text" {
                // Embed notes as a structured field rather than overwriting the value.
                json!({ "value": response_value, "_notes": notes })
            } else {
                response_value
            }
        } else {
            response_value
        };

        let result = sqlx::query(
            "INSERT INTO round_responses \
             (instance_id, checkpoint_index, response_type, response_value, calculated_value, \
              gps_latitude, gps_longitude, is_out_of_range, alarm_triggered, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
             ON CONFLICT ON CONSTRAINT uq_round_responses_instance_checkpoint \
             DO UPDATE SET \
               response_type    = EXCLUDED.response_type, \
               response_value   = EXCLUDED.response_value, \
               calculated_value = EXCLUDED.calculated_value, \
               gps_latitude     = EXCLUDED.gps_latitude, \
               gps_longitude    = EXCLUDED.gps_longitude, \
               is_out_of_range  = EXCLUDED.is_out_of_range, \
               alarm_triggered  = EXCLUDED.alarm_triggered",
        )
        .bind(body.instance_id)
        .bind(item.checkpoint_index)
        .bind(response_type)
        .bind(&final_value)
        .bind(calculated_value)
        .bind(item.gps_lat)
        .bind(item.gps_lon)
        .bind(is_out_of_range)
        .bind(alarm_triggered)
        .bind(user_id)
        .execute(&state.db)
        .await;

        match result {
            Ok(_) => synced += 1,
            Err(e) => {
                tracing::warn!(
                    instance_id = %body.instance_id,
                    checkpoint_index = item.checkpoint_index,
                    error = %e,
                    "mobile batch sync: failed to upsert response"
                );
                failed += 1;
            }
        }
    }

    // Determine resulting instance status.
    let instance_status = sqlx::query("SELECT status FROM round_instances WHERE id = $1")
        .bind(body.instance_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>("status").ok())
        .unwrap_or_else(|| "in_progress".to_string());

    let payload = json!({
        "synced": synced,
        "failed": failed,
        "instance_id": body.instance_id,
        "instance_status": instance_status,
    });

    if failed > 0 && synced == 0 {
        // Everything failed — return 422 so the client knows to retry
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "success": false,
                "error": {
                    "code": "SYNC_FAILED",
                    "message": format!("All {} responses failed to sync", total),
                }
            })),
        )
            .into_response();
    }

    Json(ApiResponse::ok(payload)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/mobile/rounds/active
//
// Returns all round instances currently locked to the authenticated user with
// status = 'in_progress', including full template + checkpoint data and any
// existing responses.  This is the payload the PWA pre-caches when starting
// a round so that subsequent data entry works fully offline.
//
// Permission: rounds:execute (round must be locked to the calling user)
// ---------------------------------------------------------------------------

pub async fn get_active_rounds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "rounds:execute") {
        return IoError::Forbidden("rounds:execute permission required".into()).into_response();
    }

    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    // Fetch all in_progress instances locked to this user.
    let instances_rows = sqlx::query(
        "SELECT ri.id, ri.template_id, rt.name as template_name, ri.status, \
                ri.locked_to_user, ri.started_at, ri.completed_at, ri.due_by, ri.created_at \
         FROM round_instances ri \
         JOIN round_templates rt ON rt.id = ri.template_id \
         WHERE ri.locked_to_user = $1 AND ri.status = 'in_progress' \
         ORDER BY ri.started_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await;

    let instance_rows = match instances_rows {
        Ok(rows) => rows,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let mut details: Vec<RoundInstanceDetail> = Vec::with_capacity(instance_rows.len());

    for irow in &instance_rows {
        let instance = match row_to_instance(irow) {
            Ok(i) => i,
            Err(e) => return IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        };

        // Fetch template (with checkpoints) for each instance.
        let template_row = sqlx::query(
            "SELECT id, name, description, version, checkpoints, is_active, created_by, created_at \
             FROM round_templates WHERE id = $1",
        )
        .bind(instance.template_id)
        .fetch_optional(&state.db)
        .await;

        let template = template_row
            .ok()
            .flatten()
            .and_then(|r| row_to_template(&r).ok());

        // Fetch existing responses so partially-completed rounds are resumable.
        let response_rows = sqlx::query(
            "SELECT id, instance_id, checkpoint_index, response_type, response_value, \
                    calculated_value, is_out_of_range, alarm_triggered, created_by, created_at \
             FROM round_responses \
             WHERE instance_id = $1 \
             ORDER BY checkpoint_index",
        )
        .bind(instance.id)
        .fetch_all(&state.db)
        .await;

        let responses: Vec<RoundResponseRow> = match response_rows {
            Ok(rows) => rows
                .iter()
                .filter_map(|r| row_to_response(r).ok())
                .collect(),
            Err(e) => return IoError::Database(e).into_response(),
        };

        details.push(RoundInstanceDetail {
            instance,
            template,
            responses,
        });
    }

    Json(ApiResponse::ok(details)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/mobile/presence
//
// Mobile presence heartbeat.  Called periodically by the PWA to record the
// user's current location and on-site status.  Uses an upsert so that a row
// is created on first call and updated on subsequent calls.
//
// Permission: none beyond being authenticated (any valid JWT is sufficient).
// ---------------------------------------------------------------------------

pub async fn update_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PresenceRequest>,
) -> impl IntoResponse {
    let Some(user_id) = user_id_from_claims(&claims) else {
        return IoError::Unauthorized.into_response();
    };

    // Map the mobile "status" field to the boolean on_site column.
    // "on_site" or any truthy value → true; anything else (e.g. "off_site") → false.
    let on_site = matches!(body.status.as_str(), "on_site" | "active" | "online");

    // Convert GPS accuracy to a human-readable area string if provided.
    let last_area: Option<String> = match (body.gps_lat, body.gps_lon) {
        (Some(lat), Some(lon)) => Some(format!("{:.6},{:.6}", lat, lon)),
        _ => None,
    };

    let result = sqlx::query(
        "INSERT INTO presence_status (user_id, on_site, last_seen_at, last_area, updated_at) \
         VALUES ($1, $2, NOW(), $3, NOW()) \
         ON CONFLICT (user_id) DO UPDATE SET \
           on_site      = EXCLUDED.on_site, \
           last_seen_at = EXCLUDED.last_seen_at, \
           last_area    = COALESCE(EXCLUDED.last_area, presence_status.last_area), \
           updated_at   = EXCLUDED.updated_at",
    )
    .bind(user_id)
    .bind(on_site)
    .bind(last_area)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(json!({ "acknowledged": true })).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// GET /api/mobile/config
//
// Returns mobile-specific PWA configuration.  Values come from environment
// variables where available; otherwise sensible hardcoded defaults are used.
// No DB query is performed.
//
// Permission: none beyond being authenticated.
// ---------------------------------------------------------------------------

pub async fn get_config(Extension(_claims): Extension<Claims>) -> impl IntoResponse {
    let config = MobileConfig {
        sync_interval_ms: std::env::var("MOBILE_SYNC_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30_000),
        heartbeat_interval_ms: std::env::var("MOBILE_HEARTBEAT_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60_000),
        offline_cache_duration_mins: std::env::var("MOBILE_OFFLINE_CACHE_DURATION_MINS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(480), // 8 hours
        gps_required: std::env::var("MOBILE_GPS_REQUIRED")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(false),
        min_touch_target_px: std::env::var("MOBILE_MIN_TOUCH_TARGET_PX")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60), // doc 20: 60px minimum for gloved operation
    };

    Json(ApiResponse::ok(config)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/mobile/health
//
// Lightweight health check optimised for mobile polling (no auth required,
// minimal JSON payload).  Useful for connectivity detection and heartbeat.
// ---------------------------------------------------------------------------

pub async fn health() -> impl IntoResponse {
    Json(json!({
        "ok": true,
        "ts": Utc::now().to_rfc3339(),
    }))
}
