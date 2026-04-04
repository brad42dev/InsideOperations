//! SSE (Server-Sent Events) streaming connector.
//!
//! Uses `reqwest-eventsource` which handles HTTP-level reconnection automatically.
//! Session lifecycle updates (status, event counts) are written directly to
//! `import_stream_sessions`.

use anyhow::Result;
use futures::{future::BoxFuture, StreamExt};
use reqwest_eventsource::{Event, EventSource};
use serde_json::Value as JsonValue;
use tracing::{debug, warn};

use super::{StreamConfig, StreamEvent, StreamingConnector};

pub struct SseConnector;

#[async_trait::async_trait]
impl StreamingConnector for SseConnector {
    fn connector_type(&self) -> &'static str {
        "sse"
    }

    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()> {
        let base_url = config
            .connection_config
            .get("base_url")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let endpoint = config
            .source_config
            .get("endpoint")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let url = if endpoint.is_empty() {
            base_url.to_string()
        } else {
            format!(
                "{}/{}",
                base_url.trim_end_matches('/'),
                endpoint.trim_start_matches('/')
            )
        };

        let client = reqwest::Client::new();
        let mut builder = client.get(&url);
        builder = apply_sse_auth(builder, config);

        // Resume from last event ID if available
        if let Some(resume) = &config.resume_token {
            if let Some(id) = resume.get("last_event_id").and_then(|v| v.as_str()) {
                builder = builder.header("Last-Event-ID", id);
            }
        }

        let mut es = EventSource::new(builder)?;

        loop {
            tokio::select! {
                _ = config.cancel.cancelled() => {
                    es.close();
                    debug!(session_id = %config.session_id, "SSE session cancelled");
                    break;
                }
                item = es.next() => {
                    match item {
                        None => {
                            debug!(session_id = %config.session_id, "SSE stream ended");
                            break;
                        }
                        Some(Ok(Event::Open)) => {
                            let _ = sqlx::query(
                                "UPDATE import_stream_sessions \
                                 SET status = 'active', updated_at = NOW() \
                                 WHERE id = $1 AND status != 'stopped'",
                            )
                            .bind(config.session_id)
                            .execute(db)
                            .await;
                        }
                        Some(Ok(Event::Message(msg))) => {
                            let data: JsonValue = serde_json::from_str(&msg.data)
                                .unwrap_or_else(|_| JsonValue::String(msg.data.clone()));
                            let event_type = if msg.event.is_empty() {
                                None
                            } else {
                                Some(msg.event.clone())
                            };
                            let resume_token = if msg.id.is_empty() {
                                None
                            } else {
                                Some(serde_json::json!({ "last_event_id": msg.id }))
                            };

                            // Update session statistics
                            let _ = sqlx::query(
                                "UPDATE import_stream_sessions \
                                 SET events_received = events_received + 1, \
                                     last_event_at = NOW(), \
                                     updated_at = NOW(), \
                                     resume_token = COALESCE($2, resume_token) \
                                 WHERE id = $1",
                            )
                            .bind(config.session_id)
                            .bind(resume_token.as_ref())
                            .execute(db)
                            .await;

                            let stream_event = StreamEvent {
                                event_type,
                                data,
                                resume_token,
                            };
                            if let Err(e) = on_event(stream_event).await {
                                warn!(
                                    session_id = %config.session_id,
                                    "on_event error: {e}"
                                );
                            }
                        }
                        Some(Err(e)) => {
                            warn!(
                                session_id = %config.session_id,
                                "SSE error (will reconnect): {e}"
                            );
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
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

fn apply_sse_auth(
    builder: reqwest::RequestBuilder,
    config: &StreamConfig,
) -> reqwest::RequestBuilder {
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
            builder.basic_auth(u, Some(p))
        }
        "bearer_token" => {
            let t = config
                .auth_config
                .get("bearer_token")
                .or_else(|| config.auth_config.get("token"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            builder.bearer_auth(t)
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
