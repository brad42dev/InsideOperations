use crate::config::Config;
use io_db::DbPool;

/// Shared application state passed into axum handlers via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub config: Config,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(db: DbPool, config: Config) -> Self {
        Self {
            db,
            config,
            http: reqwest::Client::new(),
        }
    }
}
