#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub service_secret: String,
    #[allow(dead_code)]
    pub model_dir: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            port: std::env::var("RECOGNITION_PORT")
                .unwrap_or_else(|_| "3010".to_string())
                .parse()?,
            service_secret: std::env::var("IO_SERVICE_SECRET").unwrap_or_default(),
            model_dir: std::env::var("IO_MODEL_DIR")
                .unwrap_or_else(|_| "/opt/io/models".to_string()),
        })
    }
}
