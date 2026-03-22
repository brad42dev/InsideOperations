//! TLS helpers — self-signed certificate auto-generation on first startup.
//!
//! On startup, if `IO_CERT_DIR/active.crt` does not exist, a self-signed
//! certificate is generated using `rcgen` (MIT/Apache-2.0, pure Rust) and
//! written to `IO_CERT_DIR`.  Symlinks `active.crt` → `self-signed.crt` and
//! `active.key` → `self-signed.key` are then created so that nginx and any
//! other consumer can always refer to a stable `active.*` path.

use chrono::Datelike;
use rcgen::{date_time_ymd, CertificateParams, DistinguishedName, DnType, KeyPair};
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// Ensure a valid TLS certificate exists in `cert_dir`.
///
/// If `cert_dir/active.crt` already exists (or is a valid symlink), this is a
/// no-op.  Otherwise a self-signed certificate valid for 365 days is generated
/// and symlinked as the active certificate.
pub async fn ensure_active_cert(cert_dir: &str) -> anyhow::Result<()> {
    let dir = PathBuf::from(cert_dir);
    tokio::fs::create_dir_all(&dir).await?;

    let active_crt = dir.join("active.crt");

    // If active.crt already exists (real file or valid symlink) — nothing to do.
    if active_crt.exists() {
        info!(
            path = %active_crt.display(),
            "active.crt already exists — skipping self-signed generation"
        );
        return Ok(());
    }

    info!("No active.crt found — generating self-signed certificate");
    // Blocking FS + crypto work; run on a dedicated thread to stay async-safe.
    tokio::task::spawn_blocking(move || generate_self_signed(&dir))
        .await
        .map_err(|e| anyhow::anyhow!("spawn_blocking failed: {}", e))??;

    Ok(())
}

/// Generate a self-signed certificate and write it + its key to `dir`.
///
/// Creates `self-signed.crt`, `self-signed.key`, and symlinks
/// `active.crt` → `self-signed.crt` and `active.key` → `self-signed.key`.
fn generate_self_signed(dir: &Path) -> anyhow::Result<()> {
    // Determine a reasonable CN — fall back to "localhost" if unavailable.
    let hostname = std::env::var("HOSTNAME").unwrap_or_else(|_| "localhost".to_string());

    // Build params via the simple constructor (handles IP/DNS detection automatically).
    let san_strings = if hostname == "localhost" {
        vec!["localhost".to_string(), "127.0.0.1".to_string()]
    } else {
        vec![
            hostname.clone(),
            "localhost".to_string(),
            "127.0.0.1".to_string(),
        ]
    };

    let mut params = CertificateParams::new(san_strings)?;

    // Set the distinguished name.
    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, hostname.as_str());
    dn.push(DnType::OrganizationName, "Inside/Operations");
    params.distinguished_name = dn;

    // Valid for 365 days from today.
    let now = chrono::Utc::now();
    let expire = now + chrono::Duration::days(365);

    params.not_before = date_time_ymd(
        now.year() as i32,
        now.month() as u8,
        now.day() as u8,
    );
    params.not_after = date_time_ymd(
        expire.year() as i32,
        expire.month() as u8,
        expire.day() as u8,
    );

    // Generate key pair and self-sign.
    let key_pair = KeyPair::generate()?;
    let cert = params.self_signed(&key_pair)?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();

    let crt_path = dir.join("self-signed.crt");
    let key_path = dir.join("self-signed.key");

    std::fs::write(&crt_path, cert_pem.as_bytes())?;
    std::fs::write(&key_path, key_pem.as_bytes())?;

    // Restrict key file permissions to owner read/write only on Unix.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600))
        {
            warn!(error = %e, "Failed to set key file permissions");
        }
    }

    // Create (or replace) symlinks: active.crt → self-signed.crt and active.key → self-signed.key.
    let active_crt = dir.join("active.crt");
    let active_key = dir.join("active.key");

    // Remove stale symlinks or files if present.
    for path in [&active_crt, &active_key] {
        if path.exists() || path.symlink_metadata().is_ok() {
            std::fs::remove_file(path)?;
        }
    }

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink("self-signed.crt", &active_crt)?;
        std::os::unix::fs::symlink("self-signed.key", &active_key)?;
    }
    #[cfg(not(unix))]
    {
        // On non-Unix platforms (e.g. Windows dev), copy instead of symlink.
        std::fs::copy(&crt_path, &active_crt)?;
        std::fs::copy(&key_path, &active_key)?;
    }

    info!(
        crt = %crt_path.display(),
        key = %key_path.display(),
        "Self-signed certificate generated and linked as active.crt / active.key"
    );

    Ok(())
}
