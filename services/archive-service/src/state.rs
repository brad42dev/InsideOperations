use std::sync::Arc;

use crate::config::Config;
use io_db::DbPool;

/// Shared application state passed into axum handlers via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub config: Arc<Config>,
}
