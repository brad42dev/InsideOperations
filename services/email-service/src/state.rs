use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use crate::config::Config;

/// Cached OAuth2 access token, keyed by provider UUID.
pub struct CachedToken {
    pub access_token: String,
    pub expires_at: std::time::Instant,
}

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub http_client: reqwest::Client,
    /// In-memory token cache for OAuth2 providers. Keyed by provider UUID.
    pub token_cache: Arc<Mutex<HashMap<Uuid, CachedToken>>>,
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
            token_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
