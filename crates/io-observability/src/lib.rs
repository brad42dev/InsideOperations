use axum::{http::StatusCode, response::IntoResponse, routing::get, Router};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Configuration for the observability subsystem.
pub struct ObservabilityConfig {
    pub service_name: &'static str,
    pub service_version: &'static str,
    /// Default log level if `IO_LOG_LEVEL` env var is not set.
    pub log_level: &'static str,
    pub metrics_enabled: bool,
    pub tracing_enabled: bool,
}

/// Handle returned from `init()`. Use to attach the `/metrics` route.
pub struct ObservabilityHandle {
    prometheus_handle: Option<PrometheusHandle>,
}

impl ObservabilityHandle {
    /// Spawns a background task that sends `WATCHDOG=1` to systemd every 10 seconds,
    /// keeping the service alive under `WatchdogSec=30s`.  No-op when the `systemd`
    /// feature is not enabled or when not running under systemd.
    #[cfg(feature = "systemd")]
    pub fn start_watchdog_keepalive(&self) {
        // Send WATCHDOG=1 to systemd every ~10s (well under the 30s WatchdogSec threshold)
        tokio::spawn(async {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
            loop {
                interval.tick().await;
                let _ = sd_notify::notify(false, &[sd_notify::NotifyState::Watchdog]);
            }
        });
    }

    /// No-op stub when the `systemd` feature is not enabled.
    #[cfg(not(feature = "systemd"))]
    pub fn start_watchdog_keepalive(&self) {}

    /// Returns an axum Router exposing `GET /metrics` in Prometheus text format.
    pub fn metrics_router(&self) -> Router {
        match &self.prometheus_handle {
            Some(handle) => {
                let handle = handle.clone();
                Router::new().route(
                    "/metrics",
                    get(move || {
                        let h = handle.clone();
                        async move {
                            (
                                StatusCode::OK,
                                [("content-type", "text/plain; version=0.0.4")],
                                h.render(),
                            )
                                .into_response()
                        }
                    }),
                )
            }
            None => Router::new().route(
                "/metrics",
                get(|| async { (StatusCode::NOT_FOUND, "metrics disabled").into_response() }),
            ),
        }
    }
}

/// Initialise logging and metrics.  Call once at process startup.
pub fn init(config: ObservabilityConfig) -> Result<ObservabilityHandle, anyhow::Error> {
    // ---- Tracing / logging ------------------------------------------------
    let env_filter = EnvFilter::try_from_env("IO_LOG_LEVEL")
        .unwrap_or_else(|_| EnvFilter::new(config.log_level));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .json()
                .with_current_span(true)
                .with_span_list(false),
        )
        .try_init()
        .ok(); // ok() — a second init call (e.g. in tests) is silently ignored

    // ---- Metrics ----------------------------------------------------------
    let prometheus_handle = if config.metrics_enabled {
        let handle = PrometheusBuilder::new()
            .install_recorder()
            .map_err(|e| anyhow::anyhow!("failed to install prometheus recorder: {e}"))?;

        // Record basic service info as a gauge label (with build_hash).
        let build_hash = std::env::var("IO_BUILD_HASH").unwrap_or_else(|_| "unknown".to_string());
        metrics::gauge!(
            "io_service_info",
            "service" => config.service_name,
            "version" => config.service_version,
            "build_hash" => build_hash,
        )
        .set(1.0);

        // Spawn a task that updates io_service_uptime_seconds every 15 seconds.
        let start = std::time::Instant::now();
        let svc = config.service_name;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(15));
            loop {
                interval.tick().await;
                metrics::gauge!("io_service_uptime_seconds", "service" => svc)
                    .set(start.elapsed().as_secs_f64());
            }
        });

        Some(handle)
    } else {
        None
    };

    // Notify systemd that the observability subsystem is ready.
    // This is a best-effort notification; errors are silently ignored.
    #[cfg(feature = "systemd")]
    let _ = sd_notify::notify(false, &[sd_notify::NotifyState::Ready]);

    Ok(ObservabilityHandle { prometheus_handle })
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- init with metrics disabled ---

    #[test]
    fn init_without_metrics_returns_ok() {
        let cfg = ObservabilityConfig {
            service_name: "test-svc",
            service_version: "0.0.1",
            log_level: "warn",
            metrics_enabled: false,
            tracing_enabled: false,
        };
        let handle = init(cfg).expect("init must succeed when metrics are disabled");
        // metrics_router returns a router even when metrics are disabled (returns 404).
        let _ = handle.metrics_router();
    }

    // --- ObservabilityConfig fields ---

    #[test]
    fn observability_config_fields_are_accessible() {
        let cfg = ObservabilityConfig {
            service_name: "io-api-gateway",
            service_version: "1.2.3",
            log_level: "info",
            metrics_enabled: true,
            tracing_enabled: true,
        };
        assert_eq!(cfg.service_name, "io-api-gateway");
        assert_eq!(cfg.service_version, "1.2.3");
        assert_eq!(cfg.log_level, "info");
        assert!(cfg.metrics_enabled);
        assert!(cfg.tracing_enabled);
    }
}
