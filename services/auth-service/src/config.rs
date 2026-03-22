/// Auth-service configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    /// Secret used for service-to-service calls.
    pub service_secret: String,
    pub port: u16,
    /// Maximum concurrent sessions per user (IEC 62443 SR 2.7).
    pub max_sessions_per_user: u32,
    /// Refresh token lifetime in seconds (default: 7 days).
    pub refresh_token_ttl_secs: u64,
    /// Lock account after this many consecutive failed logins.
    pub max_failed_logins: i32,
    /// Lockout duration in seconds after max_failed_logins.
    pub lockout_duration_secs: u64,
    /// Base URL of the email-service for sending MFA codes.
    pub email_service_url: String,
    /// Base URL of the data-broker for publishing typed WebSocket events.
    pub data_broker_url: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: require_env("IO_DATABASE_URL")?,
            jwt_secret: require_env("IO_JWT_SECRET")?,
            service_secret: require_env("IO_SERVICE_SECRET")?,
            port: std::env::var("AUTH_SERVICE_PORT")
                .unwrap_or_else(|_| "3009".to_string())
                .parse()?,
            max_sessions_per_user: std::env::var("MAX_SESSIONS_PER_USER")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
            refresh_token_ttl_secs: std::env::var("REFRESH_TOKEN_TTL_SECS")
                .unwrap_or_else(|_| "604800".to_string())
                .parse()
                .unwrap_or(604800),
            max_failed_logins: std::env::var("MAX_FAILED_LOGINS")
                .unwrap_or_else(|_| "5".to_string())
                .parse()
                .unwrap_or(5),
            lockout_duration_secs: std::env::var("LOCKOUT_DURATION_SECS")
                .unwrap_or_else(|_| "300".to_string())
                .parse()
                .unwrap_or(300),
            email_service_url: std::env::var("EMAIL_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3008".to_string()),
            data_broker_url: std::env::var("DATA_BROKER_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".to_string()),
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Required env var {} is not set", key))
}
