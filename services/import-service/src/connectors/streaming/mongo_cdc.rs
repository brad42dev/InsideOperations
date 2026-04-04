//! MongoDB change stream CDC connector.
//!
//! Source-side requirements:
//! 1. MongoDB must be running as a replica set (not a standalone instance).
//! 2. The connecting user must have `read` access to the target collection.
//!
//! Connection config keys: connection_string (MongoDB URI), database
//! Source config keys:
//!   collection — name of the collection to watch (required)

use anyhow::{anyhow, Result};
use bson::Document;
use futures::{future::BoxFuture, StreamExt};
use mongodb::{
    change_stream::event::{ChangeStreamEvent, OperationType, ResumeToken},
    Client,
};
use serde_json::Value as JsonValue;
use tracing::{debug, warn};

use super::{StreamConfig, StreamEvent, StreamingConnector};

pub struct MongoChangeStreamConnector;

#[async_trait::async_trait]
impl StreamingConnector for MongoChangeStreamConnector {
    fn connector_type(&self) -> &'static str {
        "mongo_change_stream"
    }

    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()> {
        let uri = config
            .connection_config
            .get("connection_string")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mongo_cdc: connection_string required in connection_config"))?;
        let database_name = config
            .connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mongo_cdc: database required in connection_config"))?;
        let collection_name = config
            .source_config
            .get("collection")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mongo_cdc: collection required in source_config"))?;

        let client = Client::with_uri_str(uri)
            .await
            .map_err(|e| anyhow!("mongo_cdc: connect failed: {e}"))?;
        let mongo_db = client.database(database_name);
        let collection = mongo_db.collection::<Document>(collection_name);

        // Restore resume token if available
        let resume_token: Option<ResumeToken> = config
            .resume_token
            .as_ref()
            .and_then(|v| serde_json::from_value::<ResumeToken>(v.clone()).ok());

        let mut stream = match resume_token {
            Some(token) => collection
                .watch()
                .resume_after(token)
                .await
                .map_err(|e| anyhow!("mongo_cdc: watch (resume) failed: {e}"))?,
            None => collection
                .watch()
                .await
                .map_err(|e| anyhow!("mongo_cdc: watch failed: {e}"))?,
        };

        // Mark session active
        let _ = sqlx::query(
            "UPDATE import_stream_sessions \
             SET status = 'active', updated_at = NOW() \
             WHERE id = $1 AND status != 'stopped'",
        )
        .bind(config.session_id)
        .execute(db)
        .await;

        loop {
            tokio::select! {
                _ = config.cancel.cancelled() => {
                    debug!(session_id = %config.session_id, "mongo_cdc cancelled");
                    break;
                }
                maybe = stream.next() => {
                    match maybe {
                        None => break, // stream ended (e.g. invalidate)
                        Some(Err(e)) => {
                            return Err(anyhow!("mongo_cdc stream error: {e}"));
                        }
                        Some(Ok(event)) => {
                            // Grab resume token from stream (more reliable than from event)
                            let resume_json: Option<JsonValue> = stream
                                .resume_token()
                                .and_then(|t| serde_json::to_value(&t).ok());

                            process_change_event(config, db, on_event.as_ref(), &event, resume_json).await?;
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

async fn process_change_event(
    config: &StreamConfig,
    db: &sqlx::PgPool,
    on_event: &(dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync),
    event: &ChangeStreamEvent<Document>,
    resume_json: Option<JsonValue>,
) -> Result<()> {
    let op_type = match &event.operation_type {
        OperationType::Insert => Some("insert"),
        OperationType::Update | OperationType::Replace => Some("update"),
        OperationType::Delete => Some("delete"),
        _ => None, // Drop, Rename, DropDatabase, Invalidate, Create, Other, …
    };

    // Skip DDL/admin events
    let op_str = match op_type {
        Some(s) => s,
        None => return Ok(()),
    };

    // Build event data from full_document or document_key fallback
    let data = event
        .full_document
        .as_ref()
        .and_then(|d| serde_json::to_value(d).ok())
        .or_else(|| {
            event
                .document_key
                .as_ref()
                .and_then(|k| serde_json::to_value(k).ok())
        })
        .unwrap_or(JsonValue::Null);

    let _ = sqlx::query(
        "UPDATE import_stream_sessions \
         SET events_received = events_received + 1, \
             last_event_at = NOW(), \
             updated_at = NOW(), \
             resume_token = COALESCE($2, resume_token) \
         WHERE id = $1",
    )
    .bind(config.session_id)
    .bind(resume_json.as_ref())
    .execute(db)
    .await;

    let stream_event = StreamEvent {
        event_type: Some(op_str.to_string()),
        data,
        resume_token: resume_json,
    };
    if let Err(e) = on_event(stream_event).await {
        warn!(session_id = %config.session_id, "on_event error: {e}");
    }
    Ok(())
}
