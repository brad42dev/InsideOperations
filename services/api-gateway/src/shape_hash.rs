use once_cell::sync::Lazy;
use serde_json::Value as JsonValue;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

const SCHEMA_STR: &str =
    include_str!("../../../frontend/shapes-source/_schema/io-shape-v1.schema.json");

static SHAPE_SCHEMA: Lazy<jsonschema::Validator> = Lazy::new(|| {
    let schema_value: serde_json::Value =
        serde_json::from_str(SCHEMA_STR).expect("io-shape-v1.schema.json must be valid JSON");
    jsonschema::validator_for(&schema_value)
        .expect("io-shape-v1.schema.json must be a valid JSON Schema")
});

/// Validate a sidecar JSON value against io-shape-v1 schema.
/// Returns `Ok(())` on success, `Err(Vec<String>)` with human-readable errors on failure.
///
/// ## HTTP 422 response pattern for sidecar-write endpoints
///
/// When a user-facing endpoint (e.g., the future Shape Authoring Wizard) accepts a
/// full sidecar JSON, validate it and return HTTP 422 on failure:
///
/// ```rust,ignore
/// if let Err(validation_errors) = crate::shape_hash::validate_sidecar(&sidecar_json) {
///     return (
///         StatusCode::UNPROCESSABLE_ENTITY,
///         Json(serde_json::json!({
///             "success": false,
///             "error": {
///                 "code": "SIDECAR_VALIDATION_FAILED",
///                 "message": "Sidecar JSON does not conform to io-shape-v1 schema",
///                 "details": validation_errors
///             }
///         }))
///     ).into_response();
/// }
/// ```
pub fn validate_sidecar(sidecar: &serde_json::Value) -> Result<(), Vec<String>> {
    let errors: Vec<String> = SHAPE_SCHEMA
        .iter_errors(sidecar)
        .map(|e| format!("{} at {}", e, e.instance_path))
        .collect();
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// SHA-256 of RFC 8785 canonical JSON (keys sorted recursively, no whitespace).
/// Returns lowercase hex string (64 chars).
pub fn sidecar_hash(sidecar: &JsonValue) -> String {
    let canonical = canonicalize_json(sidecar);
    let s = serde_json::to_string(&canonical).unwrap_or_default();
    sha256_hex(s.as_bytes())
}

/// SHA-256 of SVG bytes with line endings normalized to LF.
/// Returns lowercase hex string (64 chars).
pub fn svg_hash(svg: &str) -> String {
    let normalized = svg.replace("\r\n", "\n").replace('\r', "\n");
    sha256_hex(normalized.as_bytes())
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

fn canonicalize_json(val: &JsonValue) -> JsonValue {
    match val {
        JsonValue::Object(map) => {
            let sorted: BTreeMap<String, JsonValue> = map
                .iter()
                .map(|(k, v)| (k.clone(), canonicalize_json(v)))
                .collect();
            serde_json::to_value(sorted).unwrap_or(JsonValue::Null)
        }
        JsonValue::Array(arr) => JsonValue::Array(arr.iter().map(canonicalize_json).collect()),
        other => other.clone(),
    }
}
