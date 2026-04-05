//! Streaming connector trait for long-lived, event-driven data sources.
//!
//! Unlike EtlConnector (one-shot extract), StreamingConnector runs indefinitely
//! and processes events as they arrive. Each connector type manages its own
//! connection lifecycle, reconnection, and event parsing.

pub mod mongo_cdc;
pub mod mysql_cdc;
pub mod pg_cdc;
pub mod sse;
pub mod supervisor;
pub mod websocket;

use anyhow::Result;
use futures::future::BoxFuture;
use serde_json::Value as JsonValue;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Configuration for a streaming connector session.
#[derive(Debug, Clone)]
pub struct StreamConfig {
    pub definition_id: Uuid,
    pub session_id: Uuid,
    pub connection_config: JsonValue,
    pub auth_type: String,
    pub auth_config: JsonValue,
    pub source_config: JsonValue,
    pub resume_token: Option<JsonValue>,
    /// Signals the connector to stop gracefully. Cancel this token to request shutdown.
    pub cancel: tokio_util::sync::CancellationToken,
}

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------

/// A single event received from the stream.
#[derive(Debug, Clone)]
pub struct StreamEvent {
    #[allow(dead_code)]
    pub event_type: Option<String>,
    #[allow(dead_code)]
    pub data: JsonValue,
    /// Optional cursor/offset that can be used to resume after a restart.
    #[allow(dead_code)]
    pub resume_token: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Trait for streaming connectors.  Implementations must be Send + Sync.
/// The `run()` method is expected to run indefinitely until cancelled or a
/// permanent failure occurs.
#[async_trait::async_trait]
pub trait StreamingConnector: Send + Sync {
    /// Identifies this connector type (e.g. `"sse"`, `"websocket"`).
    #[allow(dead_code)]
    fn connector_type(&self) -> &'static str;

    /// Run the streaming connection.
    ///
    /// Implementations should:
    /// 1. Connect to the source
    /// 2. Process events via the provided `on_event` callback
    /// 3. Handle reconnection on transient failures
    /// 4. Return only when `config.cancel` is triggered or a circuit-break fires
    ///
    /// Session status updates (connecting → active → reconnecting) should be
    /// written to `import_stream_sessions` directly.
    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/// Returns a `StreamingConnector` for the given connection type, or `None`.
pub fn get_streaming_connector(connection_type: &str) -> Option<Box<dyn StreamingConnector>> {
    match connection_type {
        "sse" => Some(Box::new(sse::SseConnector)),
        "websocket" => Some(Box::new(websocket::WebSocketConnector)),
        "pg_cdc" => Some(Box::new(pg_cdc::PgCdcConnector)),
        "mysql_cdc" => Some(Box::new(mysql_cdc::MysqlCdcConnector)),
        "mongo_change_stream" => Some(Box::new(mongo_cdc::MongoChangeStreamConnector)),
        _ => None,
    }
}
