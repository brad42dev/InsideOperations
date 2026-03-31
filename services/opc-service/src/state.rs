use io_db::DbPool;
use opcua::client::Session;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Notify;
use uuid::Uuid;

use crate::config::Config;

/// Registry of live OPC UA sessions keyed by source UUID.
///
/// HTTP handlers that need to invoke OPC UA methods (acknowledge, shelve, etc.)
/// look up the active session here. The outer `Mutex` is a std (not async) lock
/// and is held only briefly to clone the `Arc` — never while doing I/O.
pub type SessionRegistry = Arc<std::sync::Mutex<HashMap<Uuid, Arc<Session>>>>;

/// Shared application state threaded through the HTTP server.
#[derive(Clone)]
#[allow(dead_code)]
pub struct AppState {
    pub db: DbPool,
    pub config: Arc<Config>,
    /// Per-source reconnect notifiers. When a source driver is running it
    /// inserts its Notify here; the reconnect HTTP endpoint looks it up and
    /// calls notify_one() to wake the driver immediately from its backoff sleep.
    pub reconnect_signals: Arc<std::sync::Mutex<HashMap<Uuid, Arc<Notify>>>>,
    /// Live OPC UA sessions indexed by source UUID.
    /// Inserted by driver::run_source once the session is established;
    /// removed when the driver task exits (on error or graceful shutdown).
    pub sessions: SessionRegistry,
}
