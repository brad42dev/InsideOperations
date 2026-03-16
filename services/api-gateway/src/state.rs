use crate::config::Config;
use reqwest::Client;
use sqlx::PgPool;

/// Shared application state for the API gateway.
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub http_client: Client,
    pub db: PgPool,
}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        Self { config, http_client, db }
    }
}
