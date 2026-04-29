use io_db::DbPool;
use std::sync::Arc;

use crate::{config::Config, jobs::JobQueue};

#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    #[allow(dead_code)]
    pub config: Arc<Config>,
    pub job_queue: Arc<JobQueue>,
}
