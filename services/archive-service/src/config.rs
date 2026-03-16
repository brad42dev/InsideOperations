/// Archive service configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub service_secret: String,
    pub port: u16,
    /// Raw data retention in days (default 90).
    pub retention_raw_days: i64,
    /// 1-minute aggregate retention in days (default 365).
    pub retention_1m_days: i64,
    /// 5-minute aggregate retention in days (default 730 — 2 years).
    pub retention_5m_days: i64,
    /// 1-hour aggregate retention in days (default 1825 — 5 years).
    pub retention_1h_days: i64,
    /// Compress chunks older than this many days (default 7).
    pub compression_after_days: i64,
    /// How often to run the maintenance job, in seconds (default 3600).
    pub maintenance_interval_secs: u64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: require_env("IO_DATABASE_URL")?,
            service_secret: require_env("IO_SERVICE_SECRET")?,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3005".to_string())
                .parse()?,
            retention_raw_days: std::env::var("RETENTION_RAW_DAYS")
                .unwrap_or_else(|_| "90".to_string())
                .parse()?,
            retention_1m_days: std::env::var("RETENTION_1M_DAYS")
                .unwrap_or_else(|_| "365".to_string())
                .parse()?,
            retention_5m_days: std::env::var("RETENTION_5M_DAYS")
                .unwrap_or_else(|_| "730".to_string())
                .parse()?,
            retention_1h_days: std::env::var("RETENTION_1H_DAYS")
                .unwrap_or_else(|_| "1825".to_string())
                .parse()?,
            compression_after_days: std::env::var("COMPRESSION_AFTER_DAYS")
                .unwrap_or_else(|_| "7".to_string())
                .parse()?,
            maintenance_interval_secs: std::env::var("MAINTENANCE_INTERVAL_SECS")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()?,
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Required env var {} is not set", key))
}
