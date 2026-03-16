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
                get(|| async {
                    (StatusCode::NOT_FOUND, "metrics disabled").into_response()
                }),
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

        // Record basic service info as a gauge label.
        metrics::gauge!(
            "io_service_info",
            "service" => config.service_name,
            "version" => config.service_version,
        )
        .set(1.0);

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
