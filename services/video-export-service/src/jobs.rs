use dashmap::DashMap;
use io_db::DbPool;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{config::Config, db, render};

pub struct JobQueue {
    tx: mpsc::Sender<Uuid>,
    in_flight: Arc<DashMap<Uuid, tokio::task::AbortHandle>>,
}

impl JobQueue {
    pub fn new(pool: DbPool, cfg: Arc<Config>) -> Self {
        let (tx, mut rx) = mpsc::channel::<Uuid>(100);
        let in_flight: Arc<DashMap<Uuid, tokio::task::AbortHandle>> = Arc::new(DashMap::new());
        let in_flight_worker = Arc::clone(&in_flight);

        tokio::spawn(async move {
            while let Some(job_id) = rx.recv().await {
                let pool = pool.clone();
                let cfg = Arc::clone(&cfg);
                let in_flight_ref = Arc::clone(&in_flight_worker);

                let handle = tokio::spawn(async move {
                    match render::playwright::render_job(&pool, &cfg, job_id).await {
                        Ok(()) => {}
                        Err(e) => {
                            // render_job handles state for worker errors; this catches early failures
                            db::set_failed(&pool, job_id, &e.to_string()).await.ok();
                            db::notify_complete(&pool, job_id, "failed").await.ok();
                        }
                    }
                    in_flight_ref.remove(&job_id);
                });

                in_flight_worker.insert(job_id, handle.abort_handle());

                match handle.await {
                    Ok(_) => {}
                    Err(e) if e.is_cancelled() => {
                        tracing::info!(%job_id, "video export job cancelled");
                    }
                    Err(e) => {
                        tracing::error!(%job_id, error = %e, "video export job panicked");
                    }
                }
            }
        });

        Self { tx, in_flight }
    }

    pub async fn enqueue(&self, job_id: Uuid) {
        let _ = self.tx.send(job_id).await;
    }

    pub fn cancel(&self, job_id: Uuid) -> bool {
        if let Some((_, handle)) = self.in_flight.remove(&job_id) {
            handle.abort();
            true
        } else {
            false
        }
    }
}
