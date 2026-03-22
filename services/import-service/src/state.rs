use sqlx::PgPool;
use std::sync::Arc;
use crate::config::Config;

#[allow(dead_code)]
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
}
