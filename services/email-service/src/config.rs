#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub service_secret: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("IO_DATABASE_URL")
                .or_else(|_| std::env::var("DATABASE_URL"))
                .map_err(|_| anyhow::anyhow!("IO_DATABASE_URL not set"))?,
            port: std::env::var("EMAIL_SERVICE_PORT")
                .unwrap_or_else(|_| "3008".to_string())
                .parse()?,
            service_secret: std::env::var("IO_SERVICE_SECRET")
                .unwrap_or_default(),
        })
    }
}
