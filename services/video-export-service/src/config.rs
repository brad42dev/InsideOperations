#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub export_dir: String,
    pub jwt_secret: String,
    pub frontend_base_url: String,
    pub export_retention_hours: u64,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: require_env("IO_DATABASE_URL")?,
            export_dir: std::env::var("IO_EXPORT_DIR")
                .unwrap_or_else(|_| "/tmp/io-exports".to_string()),
            jwt_secret: require_env("IO_JWT_SECRET")?,
            frontend_base_url: std::env::var("FRONTEND_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            export_retention_hours: std::env::var("EXPORT_RETENTION_HOURS")
                .unwrap_or_else(|_| "24".to_string())
                .parse()
                .unwrap_or(24),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3011".to_string())
                .parse()?,
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Required env var {} is not set", key))
}
