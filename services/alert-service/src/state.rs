use crate::config::Config;
use sqlx::PgPool;

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Config,
    pub db: PgPool,
    pub http: reqwest::Client,
}

impl AppState {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        let db = io_db::create_pool(&config.database_url).await?;
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        Ok(Self { config, db, http })
    }
}
