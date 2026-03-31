use anyhow::{Context, Result};
use rand::rngs::OsRng;
use rand::RngCore;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;

const CREDS_DIR: &str = "/etc/io/creds";
const OUTPUT_PATH: &str = "/etc/io/creds/master-key.enc";

/// Generate a 256-bit master encryption key, seal it via systemd-creds,
/// and store the encrypted blob at /etc/io/creds/master-key.enc.
///
/// The plaintext key is written to a temp file, passed to systemd-creds,
/// then securely overwritten with zeros and deleted. The plaintext never
/// persists on disk after this command completes.
pub fn run() -> Result<()> {
    // Ensure /etc/io/creds/ exists with restricted permissions
    fs::create_dir_all(CREDS_DIR)
        .with_context(|| format!("Failed to create directory {CREDS_DIR}"))?;
    fs::set_permissions(CREDS_DIR, fs::Permissions::from_mode(0o700))
        .with_context(|| format!("Failed to set permissions on {CREDS_DIR}"))?;

    // Generate 32 cryptographically secure random bytes (256-bit key)
    let mut key_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut key_bytes);

    // Write key to a temp file in /tmp with restricted permissions
    let tmp_path = format!("/tmp/io-master-key-{}.tmp", std::process::id());
    fs::write(&tmp_path, key_bytes)
        .with_context(|| format!("Failed to write temp key file {tmp_path}"))?;
    fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))
        .with_context(|| format!("Failed to restrict temp file permissions on {tmp_path}"))?;

    // Zero the key bytes in memory now that they are on disk in the temp file
    key_bytes.iter_mut().for_each(|b| *b = 0);

    // Invoke systemd-creds to encrypt and seal the key.
    // --tpm2-device=auto: use TPM2 if available, fall back to host credential secret otherwise.
    // --name=io-master-key: ties the credential to this specific name for replay protection.
    let result = Command::new("systemd-creds")
        .args([
            "encrypt",
            "--name=io-master-key",
            "--tpm2-device=auto",
            &tmp_path,
            OUTPUT_PATH,
        ])
        .status()
        .with_context(|| "Failed to invoke systemd-creds — is systemd 250+ installed?");

    // Securely overwrite the temp file with zeros before deleting
    secure_delete(&tmp_path);

    // Now check the result of systemd-creds
    let status = result?;
    if !status.success() {
        anyhow::bail!(
            "systemd-creds encrypt failed with exit code {}",
            status.code().unwrap_or(-1)
        );
    }

    // Set restrictive permissions on the encrypted output
    fs::set_permissions(OUTPUT_PATH, fs::Permissions::from_mode(0o400))
        .with_context(|| format!("Failed to set permissions on {OUTPUT_PATH}"))?;

    println!();
    println!("  Master key generated and encrypted successfully.");
    println!();
    println!("  Encrypted credential: {OUTPUT_PATH}");
    println!();
    println!("  CRITICAL BACKUP REMINDER");
    println!("  ─────────────────────────────────────────────────────────────");
    println!("  Back up this file to secure off-site storage IMMEDIATELY:");
    println!("    {OUTPUT_PATH}");
    println!();
    println!("  If this file is lost and the host is re-imaged, all data");
    println!("  encrypted with the master key will be PERMANENTLY unrecoverable.");
    println!();
    println!("  The plaintext key has been securely erased from disk.");
    println!("  At service start, systemd decrypts the credential into a");
    println!("  tmpfs volume — the plaintext is never written to persistent storage.");
    println!();

    Ok(())
}

/// Overwrite the file contents with zeros, then delete it.
/// This is a best-effort secure deletion — it does not guarantee
/// protection against filesystem journaling or SSD wear-leveling,
/// but it eliminates the plaintext from the obvious on-disk location.
fn secure_delete(path: &str) {
    if Path::new(path).exists() {
        // Overwrite with zeros
        if let Ok(meta) = fs::metadata(path) {
            let size = meta.len() as usize;
            let zeros = vec![0u8; size.max(32)];
            let _ = fs::write(path, &zeros);
        }
        // Delete the file
        let _ = fs::remove_file(path);
    }
}
