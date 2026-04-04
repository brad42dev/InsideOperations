//! Webhook receiver for push-based import triggers.
//!
//! POST /import/webhooks/:token  (no auth — HMAC validated internally)
//! - Token lookup against import_schedules.schedule_config->>'webhook_token'
//! - HMAC-SHA256 signature validation from X-IO-Signature header
//! - Writes to import_webhook_buffer for async processing
//! - Returns 200 immediately (external system cannot wait for pipeline)
//!
//! POST /import/definitions/:id/webhook-token  (service-secret protected)
//! - Generates a 32-byte random token, stores in the webhook schedule's schedule_config

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::Row as _;
use tracing::error;

use crate::state::AppState;

type HmacSha256 = Hmac<Sha256>;

// ---------------------------------------------------------------------------
// POST /import/webhooks/:token — unauthenticated, HMAC-validated
// ---------------------------------------------------------------------------

pub async fn receive_webhook(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // 1. Look up the schedule by webhook token
    let schedule_row = sqlx::query(
        "SELECT s.id, s.definition_id, s.schedule_config \
         FROM import_schedules s \
         WHERE s.schedule_type = 'webhook' \
           AND s.enabled = true \
           AND s.schedule_config->>'webhook_token' = $1",
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await;

    let schedule_row = match schedule_row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "not found"})),
            )
                .into_response()
        }
        Err(e) => {
            error!("webhook token lookup error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "internal"})),
            )
                .into_response();
        }
    };

    let definition_id: uuid::Uuid = schedule_row.try_get("definition_id").unwrap();
    let schedule_config: serde_json::Value = schedule_row
        .try_get("schedule_config")
        .unwrap_or_default();

    // 2. HMAC validation (if hmac_secret is configured)
    if let Some(hmac_secret) = schedule_config
        .get("hmac_secret")
        .and_then(|v| v.as_str())
    {
        let signature_header = headers
            .get("x-io-signature")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let mut mac = HmacSha256::new_from_slice(hmac_secret.as_bytes())
            .expect("HMAC accepts any key length");
        mac.update(&body);
        let expected = hex::encode(mac.finalize().into_bytes());

        if !constant_time_eq::constant_time_eq(
            signature_header.as_bytes(),
            expected.as_bytes(),
        ) {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "invalid signature"})),
            )
                .into_response();
        }
    }

    // 3. Check buffer depth (rate limiting)
    let buffer_depth: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM import_webhook_buffer \
         WHERE import_definition_id = $1 \
           AND processing_status IN ('pending', 'processing')",
    )
    .bind(definition_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let max_buffer = schedule_config
        .get("max_buffer_depth")
        .and_then(|v| v.as_i64())
        .unwrap_or(1000);

    if buffer_depth >= max_buffer {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({"error": "buffer full"})),
        )
            .into_response();
    }

    // 4. Parse payload
    let payload: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid JSON"})),
            )
                .into_response()
        }
    };

    // 5. Write to buffer
    let result = sqlx::query(
        "INSERT INTO import_webhook_buffer \
         (import_definition_id, payload, received_at) \
         VALUES ($1, $2, NOW())",
    )
    .bind(definition_id)
    .bind(&payload)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            metrics::counter!("io_import_webhook_received_total").increment(1);
            (
                StatusCode::OK,
                Json(serde_json::json!({"status": "accepted"})),
            )
                .into_response()
        }
        Err(e) => {
            error!("webhook buffer write error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "internal"})),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /import/definitions/:id/webhook-token — service-secret protected
// ---------------------------------------------------------------------------

pub async fn generate_webhook_token(
    State(state): State<AppState>,
    Path(definition_id): Path<uuid::Uuid>,
) -> impl IntoResponse {
    // Verify the definition exists
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM import_definitions WHERE id = $1)",
    )
    .bind(definition_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if !exists {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "definition not found"})),
        )
            .into_response();
    }

    // Generate a 32-byte random token as 64 hex chars (two UUIDs concatenated)
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().as_simple(),
        uuid::Uuid::new_v4().as_simple()
    );

    // Upsert a webhook schedule for this definition, storing the token
    let result = sqlx::query(
        "INSERT INTO import_schedules \
         (id, definition_id, schedule_type, enabled, schedule_config, next_run_at) \
         VALUES (gen_random_uuid(), $1, 'webhook', true, jsonb_build_object('webhook_token', $2::text), NOW()) \
         ON CONFLICT (definition_id, schedule_type) \
         DO UPDATE SET schedule_config = import_schedules.schedule_config || jsonb_build_object('webhook_token', $2::text)",
    )
    .bind(definition_id)
    .bind(&token)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "webhook_token": token,
                "webhook_path": format!("/import/webhooks/{}", token)
            })),
        )
            .into_response(),
        Err(e) => {
            error!("generate_webhook_token db error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "internal"})),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Admin routes (service-secret protected via main.rs middleware)
// ---------------------------------------------------------------------------

pub fn webhook_admin_routes() -> Router<AppState> {
    Router::new().route(
        "/definitions/:id/webhook-token",
        post(generate_webhook_token),
    )
}
