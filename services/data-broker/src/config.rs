use anyhow::Context;

pub struct Config {
    pub database_url: String,
    pub service_secret: String,
    pub auth_service_url: String,
    pub port: u16,
    pub opc_broker_sock: String,
    pub stale_threshold_secs: u64,
    pub staleness_sweep_secs: u64,
    pub max_subscriptions_per_client: usize,
    pub ping_interval_secs: u64,
    /// How long (in milliseconds) to accumulate point updates before flushing
    /// a batch to each client. Default: 250 ms.
    pub batch_window_ms: u64,
    /// How long (in seconds) a point may go without a fanout before a
    /// heartbeat is re-sent so clients know the value is still valid.
    /// Default: 60 s.
    pub max_silence_secs: u64,
    /// Per-point deadband as a fraction of the absolute value (0.0 = disabled).
    /// An update is suppressed if |new − old| ≤ |old| × deadband.
    /// Default: 0.0 (all changes are fanned out).
    pub fanout_deadband: f64,

    // -----------------------------------------------------------------------
    // Adaptive throttling thresholds
    // -----------------------------------------------------------------------

    /// FPS below which the broker escalates a client's throttle level.
    /// Default: 30.0 (spec: "FPS dropping")
    pub throttle_fps_low: f64,

    /// FPS above which the broker considers a client recovered (used for
    /// de-escalation together with `throttle_pending_low`).
    /// Default: 55.0
    pub throttle_fps_high: f64,

    /// Pending-update count below which (combined with high FPS) a client is
    /// considered recovered.  Default: 5
    pub throttle_pending_low: u32,

    /// Pending-update count above which the broker escalates throttle level.
    /// Default: 50 (spec: "pending updates climbing")
    pub throttle_pending_high: u32,

    /// Fraction of clients that must be above Normal throttle to trigger
    /// server-wide measures (wider batch window + force deadband).
    /// Default: 0.30 (spec: ">30%")
    pub throttle_global_ratio: f64,

    /// Batch window (ms) used when the global throttle flag is active.
    /// Default: 1000 ms (spec: "increase global batch interval")
    ///
    /// Currently used as a reference value; the flusher applies per-client
    /// skip-counting to achieve the equivalent effective window.
    #[allow(dead_code)]
    pub throttle_global_batch_window_ms: u64,

    /// Deadband applied globally when the global throttle flag is active
    /// (clients without per-point deadband config get this as a floor).
    /// Default: 0.005 (0.5%)
    pub throttle_global_deadband: f64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("IO_DATABASE_URL")
                .context("IO_DATABASE_URL must be set")?,
            service_secret: std::env::var("IO_SERVICE_SECRET")
                .context("IO_SERVICE_SECRET must be set")?,
            auth_service_url: std::env::var("AUTH_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3009".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .context("PORT must be a valid port number")?,
            opc_broker_sock: std::env::var("OPC_BROKER_SOCK")
                .unwrap_or_else(|_| "/var/run/io/opc-broker.sock".to_string()),
            stale_threshold_secs: std::env::var("STALE_THRESHOLD_SECS")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .context("STALE_THRESHOLD_SECS must be a valid integer")?,
            staleness_sweep_secs: std::env::var("STALENESS_SWEEP_SECS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .context("STALENESS_SWEEP_SECS must be a valid integer")?,
            max_subscriptions_per_client: std::env::var("MAX_SUBSCRIPTIONS_PER_CLIENT")
                .unwrap_or_else(|_| "5000".to_string())
                .parse()
                .context("MAX_SUBSCRIPTIONS_PER_CLIENT must be a valid integer")?,
            ping_interval_secs: std::env::var("PING_INTERVAL_SECS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .context("PING_INTERVAL_SECS must be a valid integer")?,
            batch_window_ms: std::env::var("BATCH_WINDOW_MS")
                .unwrap_or_else(|_| "250".to_string())
                .parse()
                .context("BATCH_WINDOW_MS must be a valid integer")?,
            max_silence_secs: std::env::var("MAX_SILENCE_SECS")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .context("MAX_SILENCE_SECS must be a valid integer")?,
            fanout_deadband: std::env::var("FANOUT_DEADBAND")
                .unwrap_or_else(|_| "0.0".to_string())
                .parse()
                .context("FANOUT_DEADBAND must be a valid float")?,
            throttle_fps_low: std::env::var("THROTTLE_FPS_LOW")
                .unwrap_or_else(|_| "30.0".to_string())
                .parse()
                .context("THROTTLE_FPS_LOW must be a valid float")?,
            throttle_fps_high: std::env::var("THROTTLE_FPS_HIGH")
                .unwrap_or_else(|_| "55.0".to_string())
                .parse()
                .context("THROTTLE_FPS_HIGH must be a valid float")?,
            throttle_pending_low: std::env::var("THROTTLE_PENDING_LOW")
                .unwrap_or_else(|_| "5".to_string())
                .parse()
                .context("THROTTLE_PENDING_LOW must be a valid integer")?,
            throttle_pending_high: std::env::var("THROTTLE_PENDING_HIGH")
                .unwrap_or_else(|_| "50".to_string())
                .parse()
                .context("THROTTLE_PENDING_HIGH must be a valid integer")?,
            throttle_global_ratio: std::env::var("THROTTLE_GLOBAL_RATIO")
                .unwrap_or_else(|_| "0.30".to_string())
                .parse()
                .context("THROTTLE_GLOBAL_RATIO must be a valid float")?,
            throttle_global_batch_window_ms: std::env::var("THROTTLE_GLOBAL_BATCH_WINDOW_MS")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()
                .context("THROTTLE_GLOBAL_BATCH_WINDOW_MS must be a valid integer")?,
            throttle_global_deadband: std::env::var("THROTTLE_GLOBAL_DEADBAND")
                .unwrap_or_else(|_| "0.005".to_string())
                .parse()
                .context("THROTTLE_GLOBAL_DEADBAND must be a valid float")?,
        })
    }
}
