#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub service_secret: String,
    pub database_url: String,
    pub email_service_url: String,
    pub data_broker_url: String,
    /// Public-facing URL Twilio posts delivery status callbacks to.
    /// Used for HMAC-SHA1 signature validation.
    /// Example: "https://example.com/api/alerts/webhooks/twilio/status"
    /// Leave empty (default) to skip signature validation in dev mode.
    pub twilio_status_callback_url: Option<String>,
    /// Public-facing URL Twilio posts voice keypress callbacks to.
    /// Used for HMAC-SHA1 signature validation.
    pub twilio_voice_callback_url: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3007".to_string())
                .parse()?,
            service_secret: std::env::var("IO_SERVICE_SECRET").unwrap_or_default(),
            database_url: std::env::var("IO_DATABASE_URL")
                .map_err(|_| anyhow::anyhow!("IO_DATABASE_URL not set"))?,
            email_service_url: std::env::var("EMAIL_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3008".to_string()),
            data_broker_url: std::env::var("DATA_BROKER_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".to_string()),
            twilio_status_callback_url: std::env::var("TWILIO_STATUS_CALLBACK_URL").ok(),
            twilio_voice_callback_url: std::env::var("TWILIO_VOICE_CALLBACK_URL").ok(),
        })
    }
}
