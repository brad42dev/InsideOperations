//! Stream session status and control endpoints.
//!
//! GET  /import/definitions/:id/stream-session         — current session
//! POST /import/definitions/:id/stream-session/stop    — gracefully stop
//! POST /import/definitions/:id/stream-session/restart — stop + start fresh

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use sqlx::Row as _;
use tracing::warn;
use uuid::Uuid;

use crate::state::AppState;

pub fn stream_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/definitions/:id/stream-session",
            get(get_stream_session),
        )
        .route(
            "/definitions/:id/stream-session/stop",
            post(stop_stream_session),
        )
        .route(
            "/definitions/:id/stream-session/restart",
            post(restart_stream_session),
        )
}

// ---------------------------------------------------------------------------
// GET /import/definitions/:id/stream-session
// ---------------------------------------------------------------------------

async fn get_stream_session(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT id, status, session_type, started_at, last_event_at, \
                reconnect_count, events_received, error_message, updated_at \
         FROM import_stream_sessions \
         WHERE import_definition_id = $1 \
         ORDER BY started_at DESC \
         LIMIT 1",
    )
    .bind(def_id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            let session_id: Uuid = r.try_get("id").unwrap_or_default();
            let status: String = r.try_get("status").unwrap_or_default();
            let session_type: String = r.try_get("session_type").unwrap_or_default();
            let started_at: chrono::DateTime<chrono::Utc> =
                r.try_get("started_at").unwrap_or_else(|_| chrono::Utc::now());
            let last_event_at: Option<chrono::DateTime<chrono::Utc>> =
                r.try_get("last_event_at").ok().flatten();
            let reconnect_count: i32 = r.try_get("reconnect_count").unwrap_or(0);
            let events_received: i64 = r.try_get("events_received").unwrap_or(0);
            let error_message: Option<String> = r.try_get("error_message").ok().flatten();

            let running_in_supervisor = state.supervisor.is_running(def_id);

            Json(json!({
                "success": true,
                "data": {
                    "session_id": session_id,
                    "definition_id": def_id,
                    "status": status,
                    "session_type": session_type,
                    "started_at": started_at,
                    "last_event_at": last_event_at,
                    "reconnect_count": reconnect_count,
                    "events_received": events_received,
                    "error_message": error_message,
                    "supervisor_running": running_in_supervisor,
                }
            }))
            .into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({
                "success": false,
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No stream session found for this definition"
                }
            })),
        )
            .into_response(),
        Err(e) => {
            warn!(def_id = %def_id, "get_stream_session db error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "error": { "code": "DB_ERROR", "message": e.to_string() }
                })),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /import/definitions/:id/stream-session/stop
// ---------------------------------------------------------------------------

async fn stop_stream_session(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
) -> impl IntoResponse {
    let was_running = state.supervisor.abort_session(def_id);

    // Mark the latest active session as stopped in the DB regardless
    let _ = sqlx::query(
        "UPDATE import_stream_sessions \
         SET status = 'stopped', error_message = 'Stopped by operator', updated_at = NOW() \
         WHERE import_definition_id = $1 \
           AND status IN ('connecting', 'active', 'reconnecting')",
    )
    .bind(def_id)
    .execute(&state.db)
    .await;

    Json(json!({
        "success": true,
        "data": {
            "definition_id": def_id,
            "was_running": was_running,
            "message": "Session stopped"
        }
    }))
}

// ---------------------------------------------------------------------------
// POST /import/definitions/:id/stream-session/restart
// ---------------------------------------------------------------------------

async fn restart_stream_session(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
) -> impl IntoResponse {
    // Stop existing session
    state.supervisor.abort_session(def_id);
    let _ = sqlx::query(
        "UPDATE import_stream_sessions \
         SET status = 'stopped', error_message = 'Restarted by operator', updated_at = NOW() \
         WHERE import_definition_id = $1 \
           AND status IN ('connecting', 'active', 'reconnecting')",
    )
    .bind(def_id)
    .execute(&state.db)
    .await;

    // Start a new session
    match state
        .supervisor
        .spawn_session(&state.db, state.config.master_key, def_id)
        .await
    {
        Ok(()) => Json(json!({
            "success": true,
            "data": {
                "definition_id": def_id,
                "message": "Session restarted"
            }
        }))
        .into_response(),
        Err(e) => {
            warn!(def_id = %def_id, "restart_stream_session error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "error": {
                        "code": "START_FAILED",
                        "message": e.to_string()
                    }
                })),
            )
                .into_response()
        }
    }
}
