use crate::config::Config;
use io_db::DbPool;

/// Shared application state for the event-service.
#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub config: Config,
}
