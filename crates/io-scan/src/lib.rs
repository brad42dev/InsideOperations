//! File scanning via YARA-X for malware and policy enforcement.
//!
//! # Feature flags
//!
//! | Feature | Effect |
//! |---------|--------|
//! | `yara` (default: off) | Links yara-x and compiles built-in YARA rules. |
//!
//! Without the `yara` feature every scan returns `ScanResult { matched: false,
//! action: Allow }` so the build succeeds on platforms where yara-x native
//! bindings are unavailable.
//!
//! # Usage
//!
//! ```rust,no_run
//! use io_scan::{scan_bytes, ScanAction};
//!
//! let data = b"some file content";
//! let result = io_scan::scan_bytes(data, "upload.bin").unwrap();
//! assert_eq!(result.action, ScanAction::Allow);
//! ```

use anyhow::Result;
#[cfg(feature = "yara")]
use tracing::warn;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Result of a file scan.
#[derive(Debug, Clone)]
pub struct ScanResult {
    /// Whether any rules matched (potential threat detected).
    pub matched: bool,
    /// Names of the matching rules, if any.
    pub rule_names: Vec<String>,
    /// Recommended action for the caller to take.
    pub action: ScanAction,
}

/// Recommended action after scanning a file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScanAction {
    /// File is safe to process normally.
    Allow,
    /// File should be rejected and the user notified.
    Block,
    /// File should be moved to quarantine for further analysis.
    Quarantine,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Scan `data` in memory using the built-in YARA rule set.
///
/// Returns `Ok(ScanResult)` on success.  Errors are only returned for
/// unrecoverable internal faults; a scanner initialisation failure degrades
/// gracefully to `Allow`.
pub fn scan_bytes(data: &[u8], filename: &str) -> Result<ScanResult> {
    #[cfg(feature = "yara")]
    {
        scan_bytes_yara(data, filename)
    }

    #[cfg(not(feature = "yara"))]
    {
        let _ = (data, filename); // suppress unused warnings
        Ok(ScanResult {
            matched: false,
            rule_names: vec![],
            action: ScanAction::Allow,
        })
    }
}

// ---------------------------------------------------------------------------
// YARA-X implementation (feature = "yara")
// ---------------------------------------------------------------------------

#[cfg(feature = "yara")]
fn scan_bytes_yara(data: &[u8], filename: &str) -> Result<ScanResult> {
    let rules_source = builtin_rules();

    let mut compiler = yara_x::Compiler::new();

    if let Err(e) = compiler.add_source(rules_source) {
        warn!(error = ?e, "Failed to compile built-in YARA rules, allowing file");
        return Ok(ScanResult {
            matched: false,
            rule_names: vec![],
            action: ScanAction::Allow,
        });
    }

    let rules = match compiler.build() {
        Ok(r) => r,
        Err(e) => {
            warn!(error = ?e, "Failed to build YARA rules, allowing file");
            return Ok(ScanResult {
                matched: false,
                rule_names: vec![],
                action: ScanAction::Allow,
            });
        }
    };

    let mut scanner = yara_x::Scanner::new(&rules);

    let scan_results = match scanner.scan(data) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = ?e, filename = %filename, "YARA scan failed, allowing file");
            return Ok(ScanResult {
                matched: false,
                rule_names: vec![],
                action: ScanAction::Allow,
            });
        }
    };

    let matching_rules: Vec<String> = scan_results
        .matching_rules()
        .map(|r| r.identifier().to_string())
        .collect();

    if matching_rules.is_empty() {
        Ok(ScanResult {
            matched: false,
            rule_names: vec![],
            action: ScanAction::Allow,
        })
    } else {
        warn!(
            filename = %filename,
            rules = ?matching_rules,
            "File scan: rules matched — blocking upload"
        );
        Ok(ScanResult {
            matched: true,
            rule_names: matching_rules,
            action: ScanAction::Block,
        })
    }
}

// ---------------------------------------------------------------------------
// Built-in minimal YARA rules
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------
    // scan_bytes — clean data
    // ------------------------------------------------------------------

    #[test]
    fn scan_bytes_with_clean_data_returns_allow() {
        let data = b"This is ordinary process monitoring telemetry data. Nothing suspicious here.";
        let result = scan_bytes(data, "telemetry.bin").expect("scan should not error");
        assert_eq!(result.action, ScanAction::Allow, "clean data must be allowed");
        assert!(!result.matched, "clean data must not match any rules");
    }

    #[test]
    fn scan_bytes_empty_slice_returns_allow() {
        let result = scan_bytes(b"", "empty.bin").expect("scan should not error");
        assert_eq!(result.action, ScanAction::Allow);
    }

    #[test]
    fn scan_bytes_with_eicar_string_behaves_correctly() {
        // The EICAR test string: safe to include in source — it is a well-known
        // antivirus test artifact with no actual malicious payload.
        let eicar: &[u8] =
            b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

        let result = scan_bytes(eicar, "eicar.com").expect("scan should not error");

        #[cfg(feature = "yara")]
        {
            // With YARA enabled the rule fires and the file should be blocked.
            assert_eq!(
                result.action,
                ScanAction::Block,
                "EICAR test file must be blocked when yara feature is active"
            );
            assert!(result.matched);
            assert!(!result.rule_names.is_empty());
        }

        #[cfg(not(feature = "yara"))]
        {
            // Without YARA, scanning is a no-op and everything is allowed.
            assert_eq!(result.action, ScanAction::Allow);
            assert!(!result.matched);
        }
    }

    // ------------------------------------------------------------------
    // ScanAction derives PartialEq — structural equality check
    // ------------------------------------------------------------------

    #[test]
    fn scan_action_allow_equals_allow() {
        assert_eq!(ScanAction::Allow, ScanAction::Allow);
    }

    #[test]
    fn scan_action_block_does_not_equal_allow() {
        assert_ne!(ScanAction::Block, ScanAction::Allow);
    }
}

#[cfg(feature = "yara")]
fn builtin_rules() -> &'static str {
    r#"
rule detect_eicar_test {
    meta:
        description = "EICAR antivirus test file"
        action = "block"
    strings:
        $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    condition:
        $eicar
}

rule detect_php_webshell {
    meta:
        description = "PHP web shell signature"
        action = "block"
    strings:
        $a = "<?php" nocase
        $b = "eval(" nocase
        $c = "base64_decode(" nocase
    condition:
        $a and ($b or $c) and filesize < 100KB
}

rule detect_pe_executable {
    meta:
        description = "Windows PE executable"
        action = "block"
    strings:
        $mz = { 4D 5A }
    condition:
        $mz at 0
}
"#
}
