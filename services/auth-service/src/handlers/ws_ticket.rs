use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use dashmap::DashMap;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::time::{Duration, Instant};
use tracing::warn;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// In-memory ticket store
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct TicketEntry {
    user_id: Uuid,
    username: String,
    permissions: Vec<String>,
    created_at: Instant,
}

static TICKETS: Lazy<DashMap<String, TicketEntry>> = Lazy::new(DashMap::new);
const TICKET_TTL: Duration = Duration::from_secs(30);

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct WsTicketResponse {
    pub ticket: String,
}

#[derive(Serialize)]
pub struct WsTicketValidation {
    pub user_id: Uuid,
    pub username: String,
    pub permissions: Vec<String>,
}

// ---------------------------------------------------------------------------
// Service-secret guard (for validate endpoint, called by Data Broker)
// ---------------------------------------------------------------------------

fn check_service_secret(headers: &HeaderMap, expected: &str) -> IoResult<()> {
    let provided = headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != expected {
        warn!("ws-ticket validate endpoint called with invalid or missing x-io-service-secret");
        return Err(IoError::Forbidden("Invalid service secret".to_string()));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Sweep expired tickets from the in-memory store
// ---------------------------------------------------------------------------

fn sweep_expired() {
    TICKETS.retain(|_, entry| entry.created_at.elapsed() < TICKET_TTL);
}

// ---------------------------------------------------------------------------
// POST /auth/ws-ticket
// Called by the frontend (JWT validated by API Gateway, which forwards user
// context via x-io-user-id / x-io-username / x-io-permissions headers).
// ---------------------------------------------------------------------------

pub async fn create_ws_ticket(
    headers: HeaderMap,
    State(_state): State<AppState>,
) -> IoResult<impl IntoResponse> {
    // Extract user context injected by the API Gateway after JWT validation.
    let user_id_str = headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| IoError::Unauthorized)?;

    let user_id = Uuid::parse_str(user_id_str)
        .map_err(|_| IoError::BadRequest("Invalid x-io-user-id header".to_string()))?;

    let username = headers
        .get("x-io-username")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let permissions: Vec<String> = headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.trim().to_string())
        .collect();

    // Prune expired tickets while we're here.
    sweep_expired();

    // Generate a single-use ticket and store it.
    let ticket = Uuid::new_v4().to_string();
    TICKETS.insert(
        ticket.clone(),
        TicketEntry {
            user_id,
            username,
            permissions,
            created_at: Instant::now(),
        },
    );

    Ok(Json(ApiResponse::ok(WsTicketResponse { ticket })))
}

// ---------------------------------------------------------------------------
// GET /auth/ws-ticket/:ticket/validate
// Called by the Data Broker with the IO_SERVICE_SECRET header.
// Single-use: the ticket is removed after a successful lookup.
// ---------------------------------------------------------------------------

pub async fn validate_ws_ticket(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticket): Path<String>,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    // Remove the ticket atomically (single-use).
    let entry = TICKETS
        .remove(&ticket)
        .map(|(_, v)| v)
        .ok_or_else(|| IoError::NotFound("Ticket not found".to_string()))?;

    // Check TTL even though sweep_expired() eventually prunes them.
    if entry.created_at.elapsed() >= TICKET_TTL {
        return Err(IoError::Gone("Ticket has expired".to_string()));
    }

    Ok(Json(ApiResponse::ok(WsTicketValidation {
        user_id: entry.user_id,
        username: entry.username,
        permissions: entry.permissions,
    })))
}
