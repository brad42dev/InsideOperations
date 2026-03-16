use anyhow::Context;

/// Runtime configuration for the OPC Service.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Config {
    /// PostgreSQL connection URL.
    pub database_url: String,

    /// Shared inter-service secret (IO_SERVICE_SECRET).
    pub service_secret: String,

    /// HTTP port for health + metrics endpoints.
    pub port: u16,

    /// Path to UDS socket for Data Broker.
    pub opc_broker_sock: String,

    /// How often (ms) to flush accumulated point updates.
    pub batch_interval_ms: u64,

    /// Maximum points per flush batch.
    pub batch_max_points: usize,

    /// How many monitored items to create per OPC subscription call.
    pub subscription_batch_size: usize,

    /// OPC UA publishing interval in milliseconds.
    pub publishing_interval_ms: u64,

    /// Seconds without a value update before a point is considered stale.
    pub stale_threshold_secs: u64,

    /// Maximum backoff delay (seconds) between reconnect attempts.
    pub reconnect_max_secs: u64,

    /// Directory for OPC UA PKI trust store (client keypair + server cert storage).
    /// Sub-directories trusted/certs/ and rejected/certs/ are created automatically
    /// by the opcua crate. Defaults to /tmp/io-opc-pki in dev.
    pub pki_dir: String,

    /// When true, server certificates are auto-trusted on first connect (dev default).
    /// When false, connections to sources with unrecognised server certs will fail
    /// until an administrator approves the certificate via the Settings UI.
    pub auto_trust_server_certs: bool,
}

impl Config {
    /// Build configuration from environment variables.
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("IO_DATABASE_URL")
                .context("IO_DATABASE_URL must be set")?,

            service_secret: std::env::var("IO_SERVICE_SECRET")
                .context("IO_SERVICE_SECRET must be set")?,

            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3002".to_string())
                .parse()
                .context("PORT must be a valid port number")?,

            opc_broker_sock: std::env::var("OPC_BROKER_SOCK")
                .unwrap_or_else(|_| "/var/run/io/opc-broker.sock".to_string()),

            batch_interval_ms: std::env::var("BATCH_INTERVAL_MS")
                .unwrap_or_else(|_| "250".to_string())
                .parse()
                .context("BATCH_INTERVAL_MS must be a valid integer")?,

            batch_max_points: std::env::var("BATCH_MAX_POINTS")
                .unwrap_or_else(|_| "500".to_string())
                .parse()
                .context("BATCH_MAX_POINTS must be a valid integer")?,

            subscription_batch_size: std::env::var("SUBSCRIPTION_BATCH_SIZE")
                .unwrap_or_else(|_| "500".to_string())
                .parse()
                .context("SUBSCRIPTION_BATCH_SIZE must be a valid integer")?,

            publishing_interval_ms: std::env::var("PUBLISHING_INTERVAL_MS")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()
                .context("PUBLISHING_INTERVAL_MS must be a valid integer")?,

            stale_threshold_secs: std::env::var("STALE_THRESHOLD_SECS")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .context("STALE_THRESHOLD_SECS must be a valid integer")?,

            reconnect_max_secs: std::env::var("RECONNECT_MAX_SECS")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .context("RECONNECT_MAX_SECS must be a valid integer")?,

            pki_dir: std::env::var("OPC_PKI_DIR")
                .unwrap_or_else(|_| "/tmp/io-opc-pki".to_string()),

            auto_trust_server_certs: std::env::var("OPC_AUTO_TRUST_CERTS")
                .unwrap_or_else(|_| "true".to_string())
                .to_lowercase()
                == "true",
        })
    }
}
