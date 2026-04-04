use crate::config::Config;
use crate::connectors::streaming::supervisor::SupervisorHandle;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    #[allow(dead_code)]
    pub db: PgPool,
    #[allow(dead_code)]
    pub config: Arc<Config>,
    /// Handle to the streaming session supervisor for stop/restart from HTTP handlers.
    pub supervisor: SupervisorHandle,
}
