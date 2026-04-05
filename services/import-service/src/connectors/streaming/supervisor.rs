//! Streaming session supervisor.
//!
//! Manages lifecycle for all SSE and WebSocket streaming sessions:
//! - On startup: orphaned sessions (left in active/reconnecting from a previous
//!   process) are marked stopped, then a fresh session is started for each
//!   enabled `stream_session` schedule.
//! - Polls every 10 seconds to start sessions for any schedule that lacks one.
//! - Exposes `SupervisorHandle` so HTTP handlers can stop/restart sessions.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use futures::future::BoxFuture;
use sqlx::Row as _;
use tokio::task::AbortHandle;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};
use uuid::Uuid;

use super::{get_streaming_connector, StreamConfig, StreamEvent};

// ---------------------------------------------------------------------------
// Handle — shared between supervisor loop and HTTP handlers
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct SupervisorHandle {
    inner: Arc<SupervisorInner>,
}

struct SupervisorInner {
    /// def_id → (abort handle, cancel token)
    sessions: Mutex<HashMap<Uuid, (AbortHandle, CancellationToken)>>,
}

impl SupervisorHandle {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(SupervisorInner {
                sessions: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// Register a running session task.
    pub fn insert(&self, def_id: Uuid, abort: AbortHandle, cancel: CancellationToken) {
        self.inner
            .sessions
            .lock()
            .unwrap()
            .insert(def_id, (abort, cancel));
    }

    /// Deregister a session that has exited.
    pub fn remove(&self, def_id: Uuid) {
        self.inner.sessions.lock().unwrap().remove(&def_id);
    }

    /// Returns `true` if a task is currently registered for this definition.
    pub fn is_running(&self, def_id: Uuid) -> bool {
        self.inner.sessions.lock().unwrap().contains_key(&def_id)
    }

    /// Gracefully cancel (then abort) a running session.  Returns `true` if a
    /// session was found and cancelled.
    pub fn abort_session(&self, def_id: Uuid) -> bool {
        let mut guard = self.inner.sessions.lock().unwrap();
        if let Some((abort, cancel)) = guard.remove(&def_id) {
            cancel.cancel();
            abort.abort();
            true
        } else {
            false
        }
    }

    /// Start a new streaming session for the given definition.
    /// Looks up the definition + connection from the DB, creates a session row,
    /// and spawns the connector task.
    pub async fn spawn_session(
        &self,
        db: &sqlx::PgPool,
        master_key: [u8; 32],
        def_id: Uuid,
    ) -> anyhow::Result<()> {
        spawn_session_for_definition(db, master_key, self, def_id).await
    }
}

// ---------------------------------------------------------------------------
// Supervisor main loop
// ---------------------------------------------------------------------------

/// Spawned at startup.  Manages all streaming sessions for the lifetime of the
/// service process.
pub async fn run_streaming_supervisor(
    db: sqlx::PgPool,
    master_key: [u8; 32],
    handle: SupervisorHandle,
) {
    // Mark all orphaned sessions stopped so the poll can create fresh ones.
    if let Err(e) = startup_recovery(&db).await {
        warn!("streaming supervisor startup recovery error: {e}");
    }

    // First poll immediately; thereafter every 10 seconds.
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
    loop {
        interval.tick().await;
        if let Err(e) = poll_stream_sessions(&db, master_key, &handle).await {
            warn!("streaming supervisor poll error: {e}");
        }
    }
}

/// Mark any sessions left in connecting/active/reconnecting as stopped.
/// Called once on startup before the first poll.
async fn startup_recovery(db: &sqlx::PgPool) -> anyhow::Result<()> {
    let affected = sqlx::query(
        "UPDATE import_stream_sessions \
         SET status = 'stopped', \
             error_message = 'Service restarted — session will be recovered', \
             updated_at = NOW() \
         WHERE status IN ('connecting', 'active', 'reconnecting')",
    )
    .execute(db)
    .await?
    .rows_affected();

    if affected > 0 {
        info!(
            recovered = affected,
            "Marked orphaned stream sessions as stopped; will restart"
        );
    }
    Ok(())
}

/// One poll cycle: start sessions for any enabled stream_session schedules
/// that do not currently have a running task.
async fn poll_stream_sessions(
    db: &sqlx::PgPool,
    master_key: [u8; 32],
    handle: &SupervisorHandle,
) -> anyhow::Result<()> {
    let rows = sqlx::query(
        "SELECT s.definition_id \
         FROM import_schedules s \
         JOIN import_definitions d ON d.id = s.definition_id \
         WHERE s.enabled = true \
           AND d.enabled = true \
           AND s.schedule_type = 'stream_session'",
    )
    .fetch_all(db)
    .await?;

    for row in &rows {
        let def_id: Uuid = row.try_get("definition_id")?;
        if handle.is_running(def_id) {
            continue;
        }
        // Check the DB too — the task may have just exited and removed itself
        // but a new session row was already inserted.
        let has_active: bool = sqlx::query_scalar(
            "SELECT EXISTS ( \
                 SELECT 1 FROM import_stream_sessions \
                 WHERE import_definition_id = $1 \
                   AND status IN ('connecting', 'active', 'reconnecting') \
             )",
        )
        .bind(def_id)
        .fetch_one(db)
        .await
        .unwrap_or(false);

        if has_active {
            continue;
        }

        if let Err(e) = spawn_session_for_definition(db, master_key, handle, def_id).await {
            warn!(def_id = %def_id, "failed to start streaming session: {e}");
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Session spawning
// ---------------------------------------------------------------------------

/// Query the DB, build a `StreamConfig`, create the session row, and spawn the
/// connector task.  Shared by the supervisor poll and the HTTP restart handler.
pub async fn spawn_session_for_definition(
    db: &sqlx::PgPool,
    master_key: [u8; 32],
    handle: &SupervisorHandle,
    def_id: Uuid,
) -> anyhow::Result<()> {
    let row = sqlx::query(
        "SELECT d.source_config, \
                c.connection_type, c.config AS connection_config, \
                c.auth_type, c.auth_config \
         FROM import_definitions d \
         JOIN import_connections c ON c.id = d.connection_id \
         WHERE d.id = $1 AND d.enabled = true",
    )
    .bind(def_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| anyhow::anyhow!("definition {def_id} not found or disabled"))?;

    let source_config: serde_json::Value = row.try_get("source_config")?;
    let connection_type: String = row.try_get("connection_type")?;
    let connection_config: serde_json::Value = row.try_get("connection_config")?;
    let auth_type: String = row.try_get("auth_type")?;
    let auth_config_raw: serde_json::Value = row.try_get("auth_config")?;
    let auth_config = crate::crypto::decrypt_sensitive_fields(&auth_config_raw, &master_key);

    let pipeline_row = sqlx::query(
        "SELECT field_mappings, target_table FROM import_definitions WHERE id = $1",
    )
    .bind(def_id)
    .fetch_one(db)
    .await?;

    let field_mappings: serde_json::Value = pipeline_row.try_get("field_mappings")?;
    let target_table: String = pipeline_row
        .try_get::<String, _>("target_table")
        .unwrap_or_else(|_| "custom_import_data".to_string());

    let event_kind_filter: Option<String> = source_config
        .get("event_kind_filter")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let connector = get_streaming_connector(&connection_type)
        .ok_or_else(|| anyhow::anyhow!("no streaming connector for type '{connection_type}'"))?;

    let session_type = match connection_type.as_str() {
        "sse" => "sse",
        "websocket" => "websocket",
        "pg_cdc" => "pg_cdc",
        "mysql_cdc" => "mysql_cdc",
        "mongo_change_stream" => "mongo_change_stream",
        other => anyhow::bail!("unsupported streaming connection type '{other}'"),
    };

    // Load resume token from the most recent session that has one.
    // This allows CDC connectors to resume from their last WAL/binlog/change-stream position.
    let resume_token: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT resume_token \
         FROM import_stream_sessions \
         WHERE import_definition_id = $1 AND resume_token IS NOT NULL \
         ORDER BY started_at DESC \
         LIMIT 1",
    )
    .bind(def_id)
    .fetch_optional(db)
    .await
    .unwrap_or(None)
    .flatten();

    // Insert the session row; bail silently if one is already active.
    let session_id = Uuid::new_v4();
    let inserted = sqlx::query(
        "INSERT INTO import_stream_sessions \
         (id, import_definition_id, session_type, status) \
         VALUES ($1, $2, $3, 'connecting') \
         ON CONFLICT DO NOTHING",
    )
    .bind(session_id)
    .bind(def_id)
    .bind(session_type)
    .execute(db)
    .await?
    .rows_affected();

    if inserted == 0 {
        // Another process already created an active session.
        return Ok(());
    }

    let cancel = CancellationToken::new();
    let config = StreamConfig {
        definition_id: def_id,
        session_id,
        connection_config,
        auth_type,
        auth_config,
        source_config: source_config.clone(),
        resume_token,
        cancel: cancel.clone(),
    };

    // Build the on_event callback: map fields and load into target_table.
    let db_event = db.clone();
    let on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, anyhow::Result<()>> + Send + Sync> = {
        let field_mappings = field_mappings.clone();
        let target_table = target_table.clone();
        let event_kind_filter = event_kind_filter.clone();
        let def_source_config = source_config.clone();

        Box::new(move |event: StreamEvent| {
            let db = db_event.clone();
            let field_mappings = field_mappings.clone();
            let target_table = target_table.clone();
            let event_kind_filter = event_kind_filter.clone();
            let def_source_config = def_source_config.clone();

            Box::pin(async move {
                crate::pipeline::process_stream_event(
                    &db,
                    session_id,
                    def_id,
                    &event,
                    &field_mappings,
                    &target_table,
                    &def_source_config,
                    event_kind_filter.as_deref(),
                )
                .await
            })
        })
    };

    let db_task = db.clone();
    let handle_task = handle.clone();
    let join = tokio::spawn(async move {
        if let Err(e) = connector.run(&config, &db_task, on_event).await {
            warn!(
                session_id = %config.session_id,
                def_id = %config.definition_id,
                "streaming connector exited with error: {e}"
            );
            let _ = sqlx::query(
                "UPDATE import_stream_sessions \
                 SET status = 'failed', error_message = $2, updated_at = NOW() \
                 WHERE id = $1 AND status != 'stopped'",
            )
            .bind(config.session_id)
            .bind(e.to_string())
            .execute(&db_task)
            .await;
        } else {
            // Mark stopped if not already (e.g. cancel was signalled)
            let _ = sqlx::query(
                "UPDATE import_stream_sessions \
                 SET status = 'stopped', updated_at = NOW() \
                 WHERE id = $1 AND status NOT IN ('stopped', 'failed')",
            )
            .bind(config.session_id)
            .execute(&db_task)
            .await;
        }
        handle_task.remove(def_id);
    });

    handle.insert(def_id, join.abort_handle(), cancel);
    info!(
        def_id = %def_id,
        session_id = %session_id,
        conn_type = %connection_type,
        "Streaming session started"
    );
    Ok(())
}
