use std::sync::Arc;
use tokio::sync::RwLock;
use crate::config::Config;
use crate::ModelInfo;

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Config,
    pub models: Arc<RwLock<Vec<ModelInfo>>>,
}

impl AppState {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        Ok(Self {
            config,
            models: Arc::new(RwLock::new(Vec::new())),
        })
    }
}
