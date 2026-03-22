// Internal HTTP endpoint: POST /internal/publish
//
// Called by auth-service (and future services) to push typed WebSocket events
// to all connections authenticated as a specific user.
//
// Request body:
//   { "event_type": "session.locked" | "session.unlocked",
//     "user_id": "<uuid>",
//     "payload": { ... }   }
//
// The caller must present the IO_SERVICE_SECRET in `x-io-service-secret`.
// Returns 200 on success; 401 if secret missing/wrong; 400 if body malformed.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use io_bus::WsServerMessage;
use serde::Deserialize;
use tracing::{info, warn};
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct PublishRequest {
    pub event_type: String,
    pub user_id: Uuid,
    /// Additional event-specific data (e.g. `{"session_id": "<uuid>"}`)
    pub payload: serde_json::Value,
}

pub async fn publish_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PublishRequest>,
) -> impl IntoResponse {
    // Validate service secret.
    let secret = headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if secret != state.config.service_secret {
        warn!(event_type = %req.event_type, "publish_handler: invalid service secret");
        return StatusCode::UNAUTHORIZED.into_response();
    }

    // Build the WsServerMessage from the event type.
    let session_id = req
        .payload
        .get("session_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok())
        .unwrap_or_else(Uuid::nil);

    let msg = match req.event_type.as_str() {
        "session.locked" => WsServerMessage::SessionLocked { session_id },
        "session.unlocked" => WsServerMessage::SessionUnlocked { session_id },
        other => {
            warn!(event_type = other, "publish_handler: unknown event type");
            return (
                StatusCode::BAD_REQUEST,
                format!("unknown event_type: {}", other),
            )
                .into_response();
        }
    };

    // Find all client IDs for this user and send the message.
    let client_ids: Vec<Uuid> = state
        .user_connections
        .get(&req.user_id)
        .map(|set| set.iter().copied().collect())
        .unwrap_or_default();

    let mut sent = 0usize;
    for client_id in &client_ids {
        if let Some(tx) = state.connections.get(client_id) {
            if tx.try_send(msg.clone()).is_ok() {
                sent += 1;
            }
        }
    }

    info!(
        event_type = %req.event_type,
        user_id = %req.user_id,
        clients_sent = sent,
        "published typed event to user connections"
    );

    StatusCode::OK.into_response()
}
