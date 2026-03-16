/// Parser-service configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub service_secret: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3004".to_string())
                .parse()?,
            service_secret: std::env::var("IO_SERVICE_SECRET").unwrap_or_default(),
        })
    }
}
