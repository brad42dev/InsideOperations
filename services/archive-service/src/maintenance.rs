use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{info, warn};

use io_db::DbPool;

use crate::config::Config;

/// Runs the background maintenance loop for TimescaleDB management:
/// - Ensures compression policy is registered
/// - Drops old raw chunks beyond retention period
/// - Refreshes continuous aggregates
pub async fn run_maintenance(db: DbPool, config: Arc<Config>) {
    let mut ticker = interval(Duration::from_secs(config.maintenance_interval_secs));

    loop {
        ticker.tick().await;
        info!(service = "archive-service", "Running scheduled maintenance");

        // 1. Ensure compression policy exists on points_history_raw.
        //    add_compression_policy returns an error if the policy already exists;
        //    we swallow that safely.
        let compress_interval = format!("{} days", config.compression_after_days);
        let compress_result = sqlx::query(
            "SELECT add_compression_policy('points_history_raw', $1::interval)",
        )
        .bind(&compress_interval)
        .execute(&db)
        .await;

        match compress_result {
            Ok(_) => info!(
                service = "archive-service",
                interval = %compress_interval,
                "Compression policy registered"
            ),
            Err(e) => {
                // Policy likely already exists — this is expected after first run.
                let msg = e.to_string();
                if msg.contains("already exists") || msg.contains("already have") {
                    // silently skip
                } else {
                    warn!(
                        service = "archive-service",
                        error = %e,
                        "Could not set compression policy (may already exist)"
                    );
                }
            }
        }

        // 2. Drop old raw chunks beyond retention window.
        let raw_retention = format!("{} days", config.retention_raw_days);
        let drop_result = sqlx::query(
            "SELECT drop_chunks('points_history_raw', older_than => NOW() - $1::interval)",
        )
        .bind(&raw_retention)
        .execute(&db)
        .await;

        match drop_result {
            Ok(r) => info!(
                service = "archive-service",
                retention = %raw_retention,
                rows_affected = r.rows_affected(),
                "Raw data retention sweep complete"
            ),
            Err(e) => warn!(
                service = "archive-service",
                error = %e,
                "Raw data retention sweep failed"
            ),
        }

        // 3. Drop old aggregate chunks beyond their respective retention windows.
        let agg_retentions = [
            ("points_history_1m", config.retention_1m_days),
            ("points_history_5m", config.retention_5m_days),
            ("points_history_15m", config.retention_15m_days),
            ("points_history_1h", config.retention_1h_days),
            ("points_history_1d", config.retention_1d_days),
        ];
        for (table, days) in &agg_retentions {
            let retention = format!("{days} days");
            let result = sqlx::query(
                "SELECT drop_chunks($1, older_than => NOW() - $2::interval)",
            )
            .bind(table)
            .bind(&retention)
            .execute(&db)
            .await;

            match result {
                Ok(r) => info!(
                    service = "archive-service",
                    table = %table,
                    retention = %retention,
                    rows_affected = r.rows_affected(),
                    "Aggregate retention sweep complete"
                ),
                Err(e) => warn!(
                    service = "archive-service",
                    table = %table,
                    error = %e,
                    "Aggregate retention sweep failed"
                ),
            }
        }

        // 4. Refresh continuous aggregates.
        //    Refresh from the beginning of time up to 1 minute ago (to avoid
        //    refresh conflicts with real-time ingestion).
        let aggregates = [
            "points_history_1m",
            "points_history_5m",
            "points_history_15m",
            "points_history_1h",
            "points_history_1d",
        ];
        for agg in &aggregates {
            let refresh_result = sqlx::query(
                "CALL refresh_continuous_aggregate($1, NULL, NOW() - INTERVAL '1 minute')",
            )
            .bind(agg)
            .execute(&db)
            .await;

            match refresh_result {
                Ok(_) => info!(
                    service = "archive-service",
                    aggregate = %agg,
                    "Continuous aggregate refreshed"
                ),
                Err(e) => warn!(
                    service = "archive-service",
                    aggregate = %agg,
                    error = %e,
                    "Continuous aggregate refresh failed"
                ),
            }
        }

        info!(service = "archive-service", "Maintenance cycle complete");
    }
}
