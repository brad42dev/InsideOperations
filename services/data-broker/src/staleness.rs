use crate::{
    cache::ShadowCache,
    registry::{ClientId, SubscriptionRegistry},
};
use chrono::Utc;
use dashmap::DashMap;
use io_bus::WsServerMessage;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::debug;

/// Periodically scan the shadow cache for points that have not been updated
/// within `stale_threshold_secs` and broadcast `PointStale` messages to all
/// clients subscribed to those points.
pub async fn run_staleness_sweeper(
    stale_threshold_secs: u64,
    sweep_interval_secs: u64,
    cache: Arc<ShadowCache>,
    registry: Arc<SubscriptionRegistry>,
    connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
) {
    let threshold_duration =
        chrono::Duration::seconds(stale_threshold_secs as i64);
    let sweep_interval =
        tokio::time::Duration::from_secs(sweep_interval_secs);

    loop {
        tokio::time::sleep(sweep_interval).await;

        let threshold = Utc::now() - threshold_duration;
        let candidates = cache.find_stale(threshold);

        if candidates.is_empty() {
            continue;
        }

        debug!(count = candidates.len(), "Staleness sweep found stale points");

        for (point_id, last_updated_at) in candidates {
            // mark_stale returns true only on a fresh → stale transition.
            if cache.mark_stale(&point_id) {
                let msg = WsServerMessage::PointStale {
                    point_id,
                    last_updated_at: last_updated_at.to_rfc3339(),
                };

                let client_ids = registry.get_clients_for_point(&point_id);
                for client_id in client_ids {
                    if let Some(tx) = connections.get(&client_id) {
                        let _ = tx.try_send(msg.clone());
                    }
                }
            }
        }
    }
}
