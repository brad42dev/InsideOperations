use crate::{
    registry::ClientId,
    state::AppState,
    throttle::{compute_throttle, ThrottleLevel},
};
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    http::StatusCode,
    response::IntoResponse,
};
use io_bus::{WsBatchUpdate, WsClientMessage, WsPointValue, WsServerMessage};
use serde::Deserialize;
use std::sync::atomic::Ordering;
use tokio::sync::mpsc;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct WsParams {
    pub ticket: String,
}

/// Axum handler for `GET /ws?ticket=<uuid>`.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match validate_ticket(&state, &params.ticket).await {
        Ok(user_id) => ws.on_upgrade(move |socket| handle_socket(socket, state, user_id)),
        Err(_) => (StatusCode::UNAUTHORIZED, "invalid or expired ticket").into_response(),
    }
}

/// Call Auth Service to validate the WebSocket ticket.
async fn validate_ticket(state: &AppState, ticket: &str) -> Result<Uuid, ()> {
    let url = format!(
        "{}/auth/ws-ticket/{}/validate",
        state.config.auth_service_url, ticket
    );

    let response = state
        .http_client
        .get(&url)
        .header("x-io-service-secret", &state.config.service_secret)
        .send()
        .await
        .map_err(|e| {
            warn!(error = %e, "Auth Service request failed during ticket validation");
        })?;

    if !response.status().is_success() {
        warn!(status = %response.status(), ticket = %ticket, "Ticket validation rejected");
        return Err(());
    }

    let body: serde_json::Value = response.json().await.map_err(|e| {
        warn!(error = %e, "Failed to parse ticket validation response");
    })?;

    let user_id = body
        .pointer("/data/user_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| {
            warn!("Ticket validation response missing user_id");
        })?;

    Ok(user_id)
}

/// Drive a connected WebSocket session.
async fn handle_socket(mut socket: WebSocket, state: AppState, user_id: Uuid) {
    let client_id: ClientId = Uuid::new_v4();

    info!(
        client_id = %client_id,
        user_id = %user_id,
        "WebSocket client connected"
    );

    // Per-client channel for outbound messages.
    let (tx, mut rx) = mpsc::channel::<WsServerMessage>(256);

    // Register the client's sender in the connections map.
    state.connections.insert(client_id, tx.clone());

    // Register user_id → client_id in the reverse map (used for targeted publish).
    state
        .user_connections
        .entry(user_id)
        .or_default()
        .insert(client_id);

    // Record updated connection count gauge.
    metrics::gauge!("io_ws_connections").set(state.connections.len() as f64);

    let max_subs = state.config.max_subscriptions_per_client;

    // Drive send and receive concurrently. We use select! so that both
    // halves share the same `socket` without splitting it (axum 0.7 `WebSocket`
    // provides both `send` and `recv` on `&mut self`).
    loop {
        tokio::select! {
            // Outbound: relay messages from the mpsc channel to the WebSocket.
            msg = rx.recv() => {
                match msg {
                    Some(server_msg) => {
                        let json = match serde_json::to_string(&server_msg) {
                            Ok(s) => s,
                            Err(e) => {
                                warn!(error = %e, "Failed to serialize WsServerMessage");
                                continue;
                            }
                        };
                        if socket.send(Message::Text(json)).await.is_err() {
                            break;
                        }
                        metrics::counter!("io_ws_messages_sent_total").increment(1);
                    }
                    None => break, // channel closed
                }
            }

            // Inbound: process messages from the client.
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<WsClientMessage>(&text) {
                            Ok(WsClientMessage::Subscribe { points }) => {
                                let subscribed =
                                    state.registry.subscribe(client_id, &points, max_subs);

                                // Update subscription count gauge after new subscriptions.
                                metrics::gauge!("io_ws_subscriptions").set(
                                    state.registry.total_subscription_count() as f64,
                                );

                                // Send immediate Update for each newly subscribed
                                // point that has a cached value. Batch all points
                                // into a single WsBatchUpdate message.
                                let points: Vec<WsPointValue> = subscribed
                                    .iter()
                                    .filter_map(|point_id| {
                                        state.cache.get(point_id).map(|cached| WsPointValue {
                                            id: *point_id,
                                            v: cached.value,
                                            q: cached.quality.clone(),
                                            t: cached.timestamp.timestamp_millis(),
                                        })
                                    })
                                    .collect();
                                if !points.is_empty() {
                                    let _ = tx.try_send(WsServerMessage::Update(
                                        WsBatchUpdate { points },
                                    ));
                                }
                            }
                            Ok(WsClientMessage::Unsubscribe { points }) => {
                                state.registry.unsubscribe(client_id, &points);
                            }
                            Ok(WsClientMessage::Pong) => {
                                // Client acknowledged our Ping — nothing to do.
                            }
                            Ok(WsClientMessage::StatusReport {
                                render_fps,
                                pending_updates,
                                last_batch_process_ms,
                            }) => {
                                tracing::debug!(
                                    client_id = %client_id,
                                    render_fps,
                                    pending_updates,
                                    last_batch_process_ms,
                                    "Client status report"
                                );

                                // --- Adaptive throttle: compute new level ---
                                let current = state
                                    .throttle_states
                                    .get(&client_id)
                                    .map(|v| *v)
                                    .unwrap_or_default();

                                let cfg = &state.config;
                                let new_level = compute_throttle(
                                    current,
                                    render_fps,
                                    pending_updates,
                                    cfg.throttle_fps_low,
                                    cfg.throttle_fps_high,
                                    cfg.throttle_pending_low,
                                    cfg.throttle_pending_high,
                                );

                                if new_level != current {
                                    tracing::info!(
                                        client_id = %client_id,
                                        ?current,
                                        ?new_level,
                                        render_fps,
                                        pending_updates,
                                        "Client throttle level changed"
                                    );
                                }

                                state.throttle_states.insert(client_id, new_level);

                                // --- Server-wide aggregate check ---
                                // Count how many tracked clients are above Normal.
                                // We only count clients present in throttle_states;
                                // clients at Normal (or not yet reported) are treated
                                // as unthrottled.
                                let total = state.connections.len();
                                if total > 0 {
                                    let throttled: usize = state
                                        .throttle_states
                                        .iter()
                                        .filter(|e| *e.value() != ThrottleLevel::Normal)
                                        .count();
                                    let ratio = throttled as f64 / total as f64;
                                    let was_active = state.is_global_throttle_active();
                                    let now_active = ratio > cfg.throttle_global_ratio;
                                    if now_active != was_active {
                                        state
                                            .global_throttle_active
                                            .store(now_active, Ordering::Relaxed);
                                        if now_active {
                                            tracing::warn!(
                                                throttled,
                                                total,
                                                ratio,
                                                "Global throttle ACTIVATED \
                                                 (>{:.0}% of clients throttled)",
                                                cfg.throttle_global_ratio * 100.0,
                                            );
                                        } else {
                                            tracing::info!(
                                                throttled,
                                                total,
                                                ratio,
                                                "Global throttle CLEARED"
                                            );
                                        }
                                    }
                                }
                            }
                            Ok(WsClientMessage::AcknowledgeAlert { alert_id }) => {
                                tracing::debug!(
                                    client_id = %client_id,
                                    alert_id = %alert_id,
                                    "Client acknowledged alert (not handled by broker)"
                                );
                            }
                            Err(e) => {
                                warn!(
                                    client_id = %client_id,
                                    error = %e,
                                    "Failed to deserialize WsClientMessage"
                                );
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    Some(Ok(_)) => {
                        // Binary / Ping / Pong frames — ignore.
                    }
                }
            }
        }
    }

    // Clean up on disconnect.
    state.registry.remove_client(client_id);
    state.connections.remove(&client_id);
    state.throttle_states.remove(&client_id);

    // Remove client from user_connections reverse map.
    if let Some(mut client_set) = state.user_connections.get_mut(&user_id) {
        client_set.remove(&client_id);
    }

    // Update gauges to reflect the post-disconnect counts.
    metrics::gauge!("io_ws_connections").set(state.connections.len() as f64);
    metrics::gauge!("io_ws_subscriptions").set(
        state.registry.total_subscription_count() as f64,
    );

    info!(
        client_id = %client_id,
        user_id = %user_id,
        "WebSocket client disconnected"
    );
}
