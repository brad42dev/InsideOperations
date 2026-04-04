//! WebSocket client streaming connector.
//!
//! Implements manual reconnection with exponential backoff and circuit-breaking.
//!
//! Backoff: 500 ms initial, 2× factor, 60 s cap, ±20% jitter.
//! Circuit-break: 10 consecutive failures within 5 minutes → status `failed`,
//! 10-minute wait, then reset and retry.

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use futures::{future::BoxFuture, SinkExt, StreamExt};
use serde_json::Value as JsonValue;
use std::time::{Duration, Instant};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{http::Request, Message},
};
use tracing::{debug, warn};

use super::{StreamConfig, StreamEvent, StreamingConnector};

const INITIAL_BACKOFF_MS: u64 = 500;
const BACKOFF_FACTOR: f64 = 2.0;
const MAX_BACKOFF_MS: u64 = 60_000;
/// Number of consecutive failures that trigger circuit-break.
const CIRCUIT_BREAK_FAILURES: u32 = 10;
/// Window (seconds) within which failures are counted for circuit-break.
const CIRCUIT_BREAK_WINDOW_S: u64 = 300;
/// How long to wait (seconds) after circuit-break before retrying.
const CIRCUIT_BREAK_WAIT_S: u64 = 600;

pub struct WebSocketConnector;

#[async_trait::async_trait]
impl StreamingConnector for WebSocketConnector {
    fn connector_type(&self) -> &'static str {
        "websocket"
    }

    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()> {
        let mut consecutive_failures: u32 = 0;
        let mut failure_window_start = Instant::now();
        let mut backoff_ms = INITIAL_BACKOFF_MS;

        loop {
            if config.cancel.is_cancelled() {
                debug!(
                    session_id = %config.session_id,
                    "WebSocket session cancelled before connect"
                );
                break;
            }

            match run_ws_connection(config, db, on_event.as_ref()).await {
                Ok(()) => {
                    // Normal exit (cancelled)
                    debug!(
                        session_id = %config.session_id,
                        "WebSocket connection closed normally"
                    );
                    break;
                }
                Err(e) => {
                    // Reset failure window if the window has expired
                    if failure_window_start.elapsed().as_secs() > CIRCUIT_BREAK_WINDOW_S {
                        consecutive_failures = 0;
                        failure_window_start = Instant::now();
                        backoff_ms = INITIAL_BACKOFF_MS;
                    }
                    consecutive_failures += 1;

                    warn!(
                        session_id = %config.session_id,
                        consecutive = consecutive_failures,
                        "WebSocket error: {e}"
                    );

                    // Circuit-break check
                    if consecutive_failures >= CIRCUIT_BREAK_FAILURES {
                        warn!(
                            session_id = %config.session_id,
                            "WebSocket circuit-break: {consecutive_failures} failures in window"
                        );
                        let _ = sqlx::query(
                            "UPDATE import_stream_sessions \
                             SET status = 'failed', \
                                 error_message = $2, \
                                 updated_at = NOW() \
                             WHERE id = $1",
                        )
                        .bind(config.session_id)
                        .bind(format!(
                            "Circuit-break after {consecutive_failures} consecutive failures. \
                             Last: {e}"
                        ))
                        .execute(db)
                        .await;

                        // Wait 10 minutes, then reset and try again
                        tokio::select! {
                            _ = config.cancel.cancelled() => break,
                            _ = tokio::time::sleep(Duration::from_secs(CIRCUIT_BREAK_WAIT_S)) => {}
                        }
                        consecutive_failures = 0;
                        failure_window_start = Instant::now();
                        backoff_ms = INITIAL_BACKOFF_MS;
                        continue;
                    }

                    // Update session to reconnecting
                    let _ = sqlx::query(
                        "UPDATE import_stream_sessions \
                         SET status = 'reconnecting', \
                             error_message = $2, \
                             reconnect_count = reconnect_count + 1, \
                             updated_at = NOW() \
                         WHERE id = $1 AND status != 'stopped'",
                    )
                    .bind(config.session_id)
                    .bind(e.to_string())
                    .execute(db)
                    .await;

                    // Exponential backoff with ±20% jitter
                    let jitter_factor = 0.4 * (subsec_jitter() - 0.5); // [-0.2, 0.2)
                    let jittered = (backoff_ms as f64 * (1.0 + jitter_factor)) as u64;
                    let sleep_ms = jittered.clamp(100, MAX_BACKOFF_MS);

                    tokio::select! {
                        _ = config.cancel.cancelled() => break,
                        _ = tokio::time::sleep(Duration::from_millis(sleep_ms)) => {}
                    }

                    backoff_ms = ((backoff_ms as f64 * BACKOFF_FACTOR) as u64).min(MAX_BACKOFF_MS);
                }
            }
        }
        Ok(())
    }
}

/// Run a single WebSocket connection attempt.  Returns `Ok(())` when the
/// session is cancelled; returns `Err` on any connection or protocol failure.
async fn run_ws_connection(
    config: &StreamConfig,
    db: &sqlx::PgPool,
    on_event: &(dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync),
) -> Result<()> {
    let url = build_ws_url(config);

    // Build HTTP upgrade request with auth headers
    let builder = apply_ws_auth(Request::builder().uri(&url), config);
    let request = builder.body(())?;

    let (ws_stream, _) = tokio::time::timeout(Duration::from_secs(30), connect_async(request))
        .await
        .map_err(|_| anyhow!("WebSocket connect timed out"))??;

    // Session is now connected
    let _ = sqlx::query(
        "UPDATE import_stream_sessions \
         SET status = 'active', updated_at = NOW() \
         WHERE id = $1 AND status != 'stopped'",
    )
    .bind(config.session_id)
    .execute(db)
    .await;

    let (mut write, mut read) = ws_stream.split();

    // Send optional subscription handshake message
    if let Some(sub_msg) = config.source_config.get("subscription_message") {
        let text = if sub_msg.is_string() {
            sub_msg.as_str().unwrap_or("").to_string()
        } else {
            sub_msg.to_string()
        };
        write.send(Message::Text(text)).await?;
    }

    // Keepalive ping interval (default 30 s, configurable via source_config)
    let ping_secs = config
        .source_config
        .get("ping_interval_secs")
        .and_then(|v| v.as_u64())
        .unwrap_or(30);
    let mut ping_timer = tokio::time::interval(Duration::from_secs(ping_secs));
    ping_timer.tick().await; // consume first immediate tick

    loop {
        tokio::select! {
            _ = config.cancel.cancelled() => {
                let _ = write.send(Message::Close(None)).await;
                return Ok(());
            }
            _ = ping_timer.tick() => {
                write.send(Message::Ping(vec![])).await
                    .map_err(|e| anyhow!("ping failed: {e}"))?;
            }
            msg = read.next() => {
                match msg {
                    None => return Err(anyhow!("WebSocket stream ended unexpectedly")),
                    Some(Err(e)) => return Err(anyhow!("WebSocket read error: {e}")),
                    Some(Ok(Message::Text(text))) => {
                        let data: JsonValue = serde_json::from_str(&text)
                            .unwrap_or_else(|_| JsonValue::String(text.to_string()));
                        emit_event(config, db, on_event, data).await?;
                    }
                    Some(Ok(Message::Binary(bytes))) => {
                        let text = String::from_utf8_lossy(&bytes);
                        let data: JsonValue = serde_json::from_str(&text)
                            .unwrap_or_else(|_| JsonValue::String(text.into_owned()));
                        emit_event(config, db, on_event, data).await?;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        // Respond to server-initiated pings
                        write.send(Message::Pong(data)).await
                            .map_err(|e| anyhow!("pong failed: {e}"))?;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        // Keepalive confirmed — no action needed
                    }
                    Some(Ok(Message::Close(_))) => {
                        return Err(anyhow!("WebSocket server sent close frame"));
                    }
                    Some(Ok(_)) => {} // other frame variants; ignore
                }
            }
        }
    }
}

/// Process one received WebSocket message through the event callback.
async fn emit_event(
    config: &StreamConfig,
    db: &sqlx::PgPool,
    on_event: &(dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync),
    data: JsonValue,
) -> Result<()> {
    let _ = sqlx::query(
        "UPDATE import_stream_sessions \
         SET events_received = events_received + 1, \
             last_event_at = NOW(), \
             updated_at = NOW() \
         WHERE id = $1",
    )
    .bind(config.session_id)
    .execute(db)
    .await;

    let stream_event = StreamEvent {
        event_type: None,
        data,
        resume_token: None,
    };
    if let Err(e) = on_event(stream_event).await {
        warn!(session_id = %config.session_id, "on_event error: {e}");
    }
    Ok(())
}

/// Build a WebSocket URL from the definition config, converting http(s) → ws(s).
fn build_ws_url(config: &StreamConfig) -> String {
    let base = config
        .connection_config
        .get("base_url")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let endpoint = config
        .source_config
        .get("endpoint")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let full = if endpoint.is_empty() {
        base.to_string()
    } else {
        format!(
            "{}/{}",
            base.trim_end_matches('/'),
            endpoint.trim_start_matches('/')
        )
    };
    // Normalize scheme
    if let Some(rest) = full.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = full.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        full
    }
}

/// Apply auth headers to a `tokio_tungstenite` request builder.
fn apply_ws_auth(
    builder: tokio_tungstenite::tungstenite::http::request::Builder,
    config: &StreamConfig,
) -> tokio_tungstenite::tungstenite::http::request::Builder {
    match config.auth_type.as_str() {
        "basic" => {
            let u = config
                .auth_config
                .get("username")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let p = config
                .auth_config
                .get("password")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let encoded = BASE64_STANDARD.encode(format!("{u}:{p}"));
            builder.header("Authorization", format!("Basic {encoded}"))
        }
        "bearer_token" => {
            let t = config
                .auth_config
                .get("bearer_token")
                .or_else(|| config.auth_config.get("token"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            builder.header("Authorization", format!("Bearer {t}"))
        }
        "api_key_header" | "api_key" => {
            let key = config
                .auth_config
                .get("api_key")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let header = config
                .auth_config
                .get("api_key_header_name")
                .and_then(|v| v.as_str())
                .unwrap_or("X-Api-Key");
            builder.header(header, key)
        }
        _ => builder,
    }
}

/// Returns a pseudo-random float in [0.0, 1.0) derived from system-time nanoseconds.
/// Good enough for backoff jitter — not for cryptography.
fn subsec_jitter() -> f64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    (nanos % 1_000) as f64 / 1_000.0
}
