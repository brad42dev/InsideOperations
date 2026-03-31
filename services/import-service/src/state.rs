use crate::config::Config;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    #[allow(dead_code)]
    pub db: PgPool,
    #[allow(dead_code)]
    pub config: Arc<Config>,
}
