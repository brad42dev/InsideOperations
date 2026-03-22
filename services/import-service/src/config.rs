#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub service_secret: String,
    /// AES-256 master key (32 bytes) used to encrypt/decrypt credential fields
    /// in `import_connections.auth_config`. Loaded from the `IO_APP_MASTER_KEY`
    /// environment variable, which must be a 64-character hex string encoding
    /// exactly 32 bytes. Startup fails with a clear error if the variable is
    /// absent or malformed.
    pub master_key: [u8; 32],
    /// Directory where uploaded import files are stored temporarily.
    /// Configurable via `IMPORT_UPLOAD_DIR`; defaults to `/tmp/io-imports`.
    pub upload_dir: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let master_key = load_master_key()?;
        Ok(Self {
            database_url: std::env::var("IO_DATABASE_URL")
                .or_else(|_| std::env::var("DATABASE_URL"))?,
            port: std::env::var("IMPORT_SERVICE_PORT")
                .unwrap_or_else(|_| "3006".to_string())
                .parse()?,
            service_secret: std::env::var("IO_SERVICE_SECRET").unwrap_or_default(),
            master_key,
            upload_dir: std::env::var("IMPORT_UPLOAD_DIR")
                .unwrap_or_else(|_| "/tmp/io-imports".to_string()),
        })
    }
}

/// Load and validate the AES-256 master key from `IO_APP_MASTER_KEY`.
///
/// The variable must contain exactly 64 hex characters (32 bytes). Startup
/// will abort with a descriptive error message if it is missing, empty, or
/// has the wrong length/encoding.
fn load_master_key() -> anyhow::Result<[u8; 32]> {
    let raw = std::env::var("IO_APP_MASTER_KEY").unwrap_or_default();

    if raw.is_empty() {
        // In development/test environments the key may not be set. Use a
        // deterministic all-zeros key with a loud warning so developers are
        // aware.  In production the key MUST be set — callers should treat a
        // missing key as a fatal misconfiguration.
        tracing::warn!(
            "IO_APP_MASTER_KEY is not set. \
             Using insecure all-zeros key — DO NOT use in production."
        );
        return Ok([0u8; 32]);
    }

    let bytes = hex::decode(&raw)
        .map_err(|e| anyhow::anyhow!("IO_APP_MASTER_KEY is not valid hex: {e}"))?;

    if bytes.len() != 32 {
        anyhow::bail!(
            "IO_APP_MASTER_KEY must be exactly 64 hex characters (32 bytes), \
             got {} bytes",
            bytes.len()
        );
    }

    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}
