//! File scanning helper for upload endpoints.
//!
//! Wraps the `io-scan` crate and converts scan results into `IoError`
//! so upload handlers can use `?` to short-circuit blocked files.

use io_error::IoError;
use io_scan::ScanAction;
use tracing::debug;

/// Scan `data` using the built-in YARA rule set.
///
/// Returns `Ok(())` when the file is safe to process.
/// Returns `Err(IoError::BadRequest)` when the file is blocked.
///
/// On scanner failure the function returns `Ok(())` (fail-open) and logs a
/// warning via the `io_scan` crate — uploads are never silently dropped due
/// to a scanner fault.
pub fn check_upload(data: &[u8], filename: &str) -> Result<(), IoError> {
    let result = match io_scan::scan_bytes(data, filename) {
        Ok(r) => r,
        Err(e) => {
            // Scanner internal error — fail open so legitimate uploads proceed.
            tracing::warn!(
                error = %e,
                filename = %filename,
                "File scanner returned an internal error; allowing upload"
            );
            return Ok(());
        }
    };

    if result.action == ScanAction::Block {
        return Err(IoError::BadRequest(format!(
            "File '{}' was rejected by security scan (matched rules: {})",
            filename,
            result.rule_names.join(", ")
        )));
    }

    debug!(filename = %filename, matched = result.matched, "File scan passed");
    Ok(())
}
