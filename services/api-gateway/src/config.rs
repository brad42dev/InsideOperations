/// API Gateway configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub jwt_secret: String,
    pub service_secret: String,
    pub port: u16,
    /// Base URL of the auth-service (e.g. http://127.0.0.1:3009)
    pub auth_service_url: String,
    /// Base URL of the event-service (e.g. http://127.0.0.1:3003)
    pub event_service_url: String,
    /// Base URL of the email-service (e.g. http://127.0.0.1:3008)
    pub email_service_url: String,
    /// PostgreSQL connection URL for direct gateway queries (e.g. global search)
    pub database_url: String,
    /// Directory where generated report files are stored.
    /// Dev default: /tmp/io-exports  Production: /opt/io/exports
    pub export_dir: String,
    /// Base URL of the import-service (e.g. http://127.0.0.1:3006)
    pub import_service_url: String,
    /// Base URL of the recognition-service (e.g. http://127.0.0.1:3010)
    pub recognition_service_url: String,
    /// Base URL of the alert-service (e.g. http://127.0.0.1:3007)
    pub alert_service_url: String,
    /// Base URL of the data-broker for internal publish/broadcast (e.g. http://127.0.0.1:3001)
    pub broker_url: String,
    /// Comma-separated list of allowed CORS origins.
    /// If None, defaults to wildcard (*) — dev only.
    /// Example: "https://app.example.com,https://ops.example.com"
    pub cors_allowed_origins: Option<Vec<String>>,
    /// Base URL of the parser-service (e.g. http://127.0.0.1:3004)
    pub parser_service_url: String,
    /// Base URL of the archive-service (e.g. http://127.0.0.1:3005)
    pub archive_service_url: String,
    /// Directory where SVG tile pyramids are stored.
    /// Dev default: /tmp/io-tiles  Production: /opt/io/tiles
    pub tile_storage_dir: String,
    /// Maximum zoom level for tile pyramids (0–N, tiles = 2^N × 2^N at max zoom).
    /// Default: 4  (produces 16×16 = 256 tiles at full zoom)
    pub tile_max_zoom: u8,
    /// Side length in pixels for each tile PNG.
    /// Default: 256
    pub tile_size: u32,
    /// Directory where TLS certificate files (.crt / .key) are stored.
    /// Dev default: /tmp/io-certs  Production: /opt/io/certs
    pub cert_dir: String,
    /// Directory where pg_dump backup files are stored.
    /// Dev default: /tmp/io-backups  Production: /opt/io/backups
    pub backup_dir: String,
    /// Days before certificate expiry at which to trigger renewal.
    /// Default: 30
    pub cert_renew_days: i64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            jwt_secret: require_env("IO_JWT_SECRET")?,
            service_secret: require_env("IO_SERVICE_SECRET")?,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()?,
            auth_service_url: std::env::var("AUTH_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3009".to_string()),
            event_service_url: std::env::var("EVENT_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3003".to_string()),
            email_service_url: std::env::var("EMAIL_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3008".to_string()),
            database_url: require_env("IO_DATABASE_URL")?,
            export_dir: std::env::var("IO_EXPORT_DIR")
                .unwrap_or_else(|_| "/tmp/io-exports".to_string()),
            import_service_url: std::env::var("IMPORT_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3006".to_string()),
            recognition_service_url: std::env::var("RECOGNITION_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3010".to_string()),
            alert_service_url: std::env::var("ALERT_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3007".to_string()),
            broker_url: std::env::var("BROKER_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".to_string()),
            cors_allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS").ok().map(|v| {
                v.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            parser_service_url: std::env::var("PARSER_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3004".to_string()),
            archive_service_url: std::env::var("ARCHIVE_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3005".to_string()),
            tile_storage_dir: std::env::var("TILE_STORAGE_DIR")
                .unwrap_or_else(|_| "/tmp/io-tiles".to_string()),
            tile_max_zoom: std::env::var("TILE_MAX_ZOOM")
                .unwrap_or_else(|_| "4".to_string())
                .parse()
                .unwrap_or(4),
            tile_size: std::env::var("TILE_SIZE")
                .unwrap_or_else(|_| "256".to_string())
                .parse()
                .unwrap_or(256),
            cert_dir: std::env::var("IO_CERT_DIR").unwrap_or_else(|_| "/tmp/io-certs".to_string()),
            backup_dir: std::env::var("IO_BACKUP_DIR")
                .unwrap_or_else(|_| "/tmp/io-backups".to_string()),
            cert_renew_days: std::env::var("IO_CERT_RENEW_DAYS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
        })
    }
}

fn require_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Required env var {} is not set", key))
}
