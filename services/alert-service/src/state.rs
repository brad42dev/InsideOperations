use std::sync::Arc;

use crate::config::Config;
use dashmap::DashMap;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Config,
    pub db: PgPool,
    pub http: reqwest::Client,
    /// In-process registry of pending escalation timers, keyed by alert ID.
    /// Cancelling the token stops all future escalation tiers for that alert.
    pub escalation_tokens: Arc<DashMap<Uuid, CancellationToken>>,
}

impl AppState {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        let db = io_db::create_pool(&config.database_url).await?;
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        Ok(Self {
            config,
            db,
            http,
            escalation_tokens: Arc::new(DashMap::new()),
        })
    }
}
