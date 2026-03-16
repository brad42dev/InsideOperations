use io_db::DbPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Notify;
use uuid::Uuid;

use crate::config::Config;

/// Shared application state threaded through the HTTP server.
#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub config: Arc<Config>,
    /// Per-source reconnect notifiers. When a source driver is running it
    /// inserts its Notify here; the reconnect HTTP endpoint looks it up and
    /// calls notify_one() to wake the driver immediately from its backoff sleep.
    pub reconnect_signals: Arc<std::sync::Mutex<HashMap<Uuid, Arc<Notify>>>>,
}
