/// Event-service configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub service_secret: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: require_env("IO_DATABASE_URL")?,
            service_secret: require_env("IO_SERVICE_SECRET")?,
            port: std::env::var("EVENT_SERVICE_PORT")
                .unwrap_or_else(|_| "3003".to_string())
                .parse()?,
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Required env var {} is not set", key))
}
