#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub service_secret: String,
    /// 32-byte master key used for AES-256-GCM encryption of provider secrets.
    pub master_key: [u8; 32],
    /// How often the queue worker polls for pending messages, in milliseconds.
    pub queue_poll_interval_ms: u64,
    /// Number of concurrent queue worker tasks to spawn.
    pub queue_workers: usize,
    /// Maximum number of delivery attempts before a message is marked failed.
    pub queue_retry_max: u8,
    /// How many days to retain sent/failed queue records before pruning.
    pub queue_retention_days: u32,
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
            service_secret: std::env::var("IO_SERVICE_SECRET").unwrap_or_default(),
            master_key: load_master_key()?,
            queue_poll_interval_ms: std::env::var("EMAIL_QUEUE_POLL_INTERVAL_MS")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()
                .unwrap_or(1000),
            queue_workers: std::env::var("EMAIL_QUEUE_WORKERS")
                .unwrap_or_else(|_| "4".to_string())
                .parse()
                .unwrap_or(4),
            queue_retry_max: std::env::var("EMAIL_QUEUE_RETRY_MAX")
                .unwrap_or_else(|_| "4".to_string())
                .parse()
                .unwrap_or(4),
            queue_retention_days: std::env::var("EMAIL_QUEUE_RETENTION_DAYS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
        })
    }
}

/// Load the 32-byte master key for AES-256-GCM encryption.
///
/// Resolution order:
/// 1. `$CREDENTIALS_DIRECTORY/email-master-key` — systemd `LoadCredentialEncrypted` path
/// 2. `IO_EMAIL_MASTER_KEY` environment variable — hex-encoded 32 bytes (for dev/CI)
/// 3. Fixed deterministic dev key (warns loudly — never use in production)
fn load_master_key() -> anyhow::Result<[u8; 32]> {
    // Option 1: systemd credential file
    if let Ok(cred_dir) = std::env::var("CREDENTIALS_DIRECTORY") {
        let path = std::path::Path::new(&cred_dir).join("email-master-key");
        if path.exists() {
            let raw = std::fs::read(&path).map_err(|e| {
                anyhow::anyhow!("Failed to read credential file {}: {}", path.display(), e)
            })?;
            // The file must be exactly 32 bytes (raw binary) or 64 hex chars.
            return parse_key_bytes(&raw);
        }
    }

    // Option 2: hex-encoded env var (dev/CI)
    if let Ok(hex_key) = std::env::var("IO_EMAIL_MASTER_KEY") {
        let bytes = hex::decode(hex_key.trim())
            .map_err(|e| anyhow::anyhow!("IO_EMAIL_MASTER_KEY is not valid hex: {e}"))?;
        if bytes.len() != 32 {
            anyhow::bail!(
                "IO_EMAIL_MASTER_KEY must be 64 hex chars (32 bytes), got {} bytes",
                bytes.len()
            );
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        return Ok(key);
    }

    // Option 3: deterministic dev key — warns loudly
    tracing::warn!(
        "No master key configured (CREDENTIALS_DIRECTORY/email-master-key or \
         IO_EMAIL_MASTER_KEY). Using insecure dev key — NOT safe for production."
    );
    // Fixed dev key: all zeros is obviously insecure; use a named constant.
    #[rustfmt::skip]
    let dev_key: [u8; 32] = [
        0x44, 0x45, 0x56, 0x5f, 0x45, 0x4d, 0x41, 0x49,  // "DEV_EMAI"
        0x4c, 0x5f, 0x4b, 0x45, 0x59, 0x5f, 0x4e, 0x4f,  // "L_KEY_NO"
        0x54, 0x5f, 0x46, 0x4f, 0x52, 0x5f, 0x50, 0x52,  // "T_FOR_PR"
        0x4f, 0x44, 0x21, 0x21, 0x21, 0x21, 0x21, 0x21,  // "OD!!!!!!"
    ];
    Ok(dev_key)
}

/// Parse a raw byte slice as a 32-byte key.
/// Accepts either 32 raw bytes or 64 ASCII hex characters.
fn parse_key_bytes(raw: &[u8]) -> anyhow::Result<[u8; 32]> {
    if raw.len() == 32 {
        let mut key = [0u8; 32];
        key.copy_from_slice(raw);
        return Ok(key);
    }
    // Try hex (possibly with trailing newline)
    let trimmed = std::str::from_utf8(raw)
        .map_err(|_| anyhow::anyhow!("Credential file is not valid UTF-8 and not 32 raw bytes"))?
        .trim();
    if trimmed.len() == 64 {
        let bytes = hex::decode(trimmed)
            .map_err(|e| anyhow::anyhow!("Credential file hex decode failed: {e}"))?;
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        return Ok(key);
    }
    anyhow::bail!(
        "Credential file must be 32 raw bytes or 64 hex chars, got {} bytes",
        raw.len()
    )
}
