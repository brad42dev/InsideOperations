use std::sync::Arc;
use tokio::sync::RwLock;
use crate::config::Config;
use crate::model_manager::ModelManager;

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Config,
    pub model_manager: Arc<RwLock<ModelManager>>,
}

impl AppState {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        let model_dir = config.model_dir.clone();
        Ok(Self {
            config,
            model_manager: Arc::new(RwLock::new(ModelManager::new(model_dir))),
        })
    }
}
