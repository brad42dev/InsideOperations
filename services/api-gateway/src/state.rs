use crate::config::Config;
use crate::handlers::dcs_import::DcsImportJob;
use dashmap::DashMap;
use reqwest::Client;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

/// Shared application state for the API gateway.
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub http_client: Client,
    pub db: PgPool,
    /// In-memory store for stateful DCS import jobs (Phase 12–13 scope).
    /// Jobs are keyed by their UUID and held for the duration of the import wizard session.
    pub dcs_import_jobs: Arc<DashMap<Uuid, DcsImportJob>>,
}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        Self {
            config,
            http_client,
            db,
            dcs_import_jobs: Arc::new(DashMap::new()),
        }
    }
}
