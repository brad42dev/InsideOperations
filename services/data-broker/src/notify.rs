use crate::{
    cache::ShadowCache,
    fanout::{fanout_batch, PendingMap},
    registry::SubscriptionRegistry,
};
use chrono::DateTime;
use io_bus::{
    NotifyPointUpdates, PointQuality, UdsPointBatch, UdsPointUpdate,
};
use io_db::DbPool;
use std::sync::Arc;
use tracing::{error, info, warn};

/// Listen on the PostgreSQL `point_updates` NOTIFY channel and fan out updates
/// via the same fanout engine used by the UDS path. This serves as a fallback
/// when the OPC Service cannot reach the UDS socket directly.
pub async fn run_notify_listener(
    db: DbPool,
    cache: Arc<ShadowCache>,
    registry: Arc<SubscriptionRegistry>,
    pending: PendingMap,
    deadband: f64,
) {
    let mut listener: sqlx::postgres::PgListener = match sqlx::postgres::PgListener::connect_with(&db).await {
        Ok(l) => l,
        Err(e) => {
            error!(error = %e, "Failed to create PgListener — NOTIFY fallback disabled");
            return;
        }
    };

    if let Err(e) = listener.listen("point_updates").await {
        error!(error = %e, "Failed to LISTEN on point_updates channel — NOTIFY fallback disabled");
        return;
    }

    info!("NOTIFY/LISTEN fallback active on channel 'point_updates'");

    loop {
        match listener.recv().await {
            Ok(notification) => {
                let payload = notification.payload();
                match serde_json::from_str::<NotifyPointUpdates>(payload) {
                    Ok(notify) => {
                        let batch = notify_to_batch(notify);
                        fanout_batch(&batch, &cache, &registry, &pending, deadband);
                    }
                    Err(e) => {
                        warn!(error = %e, payload = %payload, "Failed to deserialize point_updates NOTIFY payload");
                    }
                }
            }
            Err(e) => {
                error!(error = %e, "PgListener error — attempting reconnect");
                // sqlx PgListener handles reconnect internally on the next recv().
            }
        }
    }
}

/// Convert a `NotifyPointUpdates` message into the `UdsPointBatch` shape so
/// we can reuse the same fanout engine for both UDS and NOTIFY paths.
fn notify_to_batch(notify: NotifyPointUpdates) -> UdsPointBatch {
    let points = notify
        .points
        .into_iter()
        .map(|p| {
            // Parse the RFC 3339 timestamp into epoch milliseconds.
            let ts_ms = DateTime::parse_from_rfc3339(&p.ts)
                .map(|dt| dt.timestamp_millis())
                .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis());

            let quality = match p.quality.as_str() {
                "good" => PointQuality::Good,
                "uncertain" => PointQuality::Uncertain,
                _ => PointQuality::Bad,
            };

            UdsPointUpdate {
                point_id: p.id,
                value: p.value,
                quality,
                timestamp: ts_ms,
            }
        })
        .collect();

    UdsPointBatch {
        source_id: notify.source_id,
        points,
    }
}
