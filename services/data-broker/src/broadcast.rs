// Internal HTTP endpoint: POST /internal/broadcast
//
// Called by the alert-service (and future services) to push a typed
// WebSocket event to ALL currently connected browser sessions.  This is
// intentionally different from /internal/publish (which fans out to a
// single user's sessions) because alert notifications must reach every
// open window regardless of which user is authenticated.
//
// Request body:
//   {
//     "type": "alert_notification" | "alert_acknowledged",
//     "payload": { ... }      -- passed through verbatim as the WS payload
//   }
//
// The caller must present IO_SERVICE_SECRET in `x-io-service-secret`.
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

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct BroadcastRequest {
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: serde_json::Value,
}

pub async fn broadcast_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<BroadcastRequest>,
) -> impl IntoResponse {
    // Validate service secret.
    let secret = headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if secret != state.config.service_secret {
        warn!(event_type = %req.event_type, "broadcast_handler: invalid service secret");
        return StatusCode::UNAUTHORIZED.into_response();
    }

    // Map the event type to a WsServerMessage variant.
    let msg: WsServerMessage = match req.event_type.as_str() {
        "alert_notification" => WsServerMessage::AlertNotification {
            payload: req.payload,
        },
        "alert_acknowledged" => WsServerMessage::AlertAcknowledged {
            payload: req.payload,
        },
        other => {
            warn!(event_type = other, "broadcast_handler: unknown event type");
            return (
                StatusCode::BAD_REQUEST,
                format!("unknown event_type: {}", other),
            )
                .into_response();
        }
    };

    // Broadcast to all connected clients.
    let mut sent = 0usize;
    let mut dead = Vec::new();

    for entry in state.connections.iter() {
        match entry.value().try_send(msg.clone()) {
            Ok(()) => sent += 1,
            Err(_) => {
                // Channel full or closed — record for removal.
                dead.push(*entry.key());
            }
        }
    }

    // Clean up dead connections.
    for client_id in dead {
        state.connections.remove(&client_id);
    }

    info!(
        event_type = %req.event_type,
        clients_sent = sent,
        "broadcast: sent alert event to all connected sessions"
    );

    StatusCode::OK.into_response()
}
