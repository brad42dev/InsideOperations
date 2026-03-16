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
        })
    }
}
