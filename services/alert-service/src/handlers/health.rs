use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::state::AppState;

/// GET /health — enriched health response with active alert count,
/// pending escalation count, and per-channel enabled/test status.
///
/// Returns HTTP 503 if the core DB query (active alert count) fails.
/// Channel data is optional — failures there yield an empty array.
pub async fn health_handler(State(state): State<AppState>) -> Response {
    // Count active alerts — this is the critical query; 503 on failure.
    let active_alerts: i64 =
        match sqlx::query_scalar("SELECT COUNT(*) FROM alerts WHERE status = 'active'")
            .fetch_one(&state.db)
            .await
        {
            Ok(count) => count,
            Err(err) => {
                tracing::error!(error = %err, "health: failed to query active alert count");
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({
                        "status": "unhealthy",
                        "error": "db_query_failed"
                    })),
                )
                    .into_response();
            }
        };

    // Pending escalations — count of in-memory escalation tokens (best effort, never fails).
    let pending_escalations = state.escalation_tokens.len() as i64;

    // Per-channel status — optional; empty array on failure.
    let channels: Vec<serde_json::Value> = sqlx::query(
        "SELECT channel_type, enabled, last_test_ok \
         FROM alert_channels \
         ORDER BY channel_type",
    )
    .fetch_all(&state.db)
    .await
    .map(|rows| {
        use sqlx::Row;
        rows.iter()
            .map(|r| {
                let last_test_ok: Option<bool> = r.try_get("last_test_ok").ok().flatten();
                let mut obj = json!({
                    "type":    r.get::<String, _>("channel_type"),
                    "enabled": r.get::<bool, _>("enabled"),
                });
                if let Some(ok) = last_test_ok {
                    obj["last_test_ok"] = json!(ok);
                }
                obj
            })
            .collect()
    })
    .unwrap_or_default();

    (
        StatusCode::OK,
        Json(json!({
            "status": "healthy",
            "active_alerts": active_alerts,
            "pending_escalations": pending_escalations,
            "channels": channels,
        })),
    )
        .into_response()
}
