use sqlx::PgPool;
use std::sync::Arc;
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    #[allow(dead_code)]
    pub db: PgPool,
    #[allow(dead_code)]
    pub config: Arc<Config>,
}
