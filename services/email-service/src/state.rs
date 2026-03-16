use sqlx::PgPool;
use std::sync::Arc;
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub http_client: reqwest::Client,
}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        Self {
            db,
            config: Arc::new(config),
            http_client,
        }
    }
}
