use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// OPC UA quality
// ---------------------------------------------------------------------------

/// OPC UA data quality codes (simplified subset of the full OPC UA standard).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum OpcQuality {
    #[default]
    Good,
    Bad,
    Uncertain,
}

impl OpcQuality {
    pub fn is_good(&self) -> bool {
        matches!(self, OpcQuality::Good)
    }
}

impl std::fmt::Display for OpcQuality {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpcQuality::Good => write!(f, "good"),
            OpcQuality::Bad => write!(f, "bad"),
            OpcQuality::Uncertain => write!(f, "uncertain"),
        }
    }
}

// ---------------------------------------------------------------------------
// OPC value + point
// ---------------------------------------------------------------------------

/// A timestamped, quality-stamped floating-point value from an OPC UA server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct OpcValue {
    pub value: f64,
    pub quality: OpcQuality,
    pub timestamp: DateTime<Utc>,
}

impl OpcValue {
    pub fn new(value: f64, quality: OpcQuality) -> Self {
        Self {
            value,
            quality,
            timestamp: Utc::now(),
        }
    }

    pub fn good(value: f64) -> Self {
        Self::new(value, OpcQuality::Good)
    }
}

/// An OPC UA data point, optionally carrying its most-recent value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct OpcPoint {
    pub id: Uuid,
    pub tagname: String,
    pub source_id: Uuid,
    pub value: Option<OpcValue>,
}

impl OpcPoint {
    pub fn new(id: Uuid, tagname: impl Into<String>, source_id: Uuid) -> Self {
        Self {
            id,
            tagname: tagname.into(),
            source_id,
            value: None,
        }
    }
}

// ---------------------------------------------------------------------------
// OPC source / server descriptor
// ---------------------------------------------------------------------------

/// Connection descriptor for an OPC UA server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct OpcSource {
    pub id: Uuid,
    pub name: String,
    pub endpoint_url: String,
    pub enabled: bool,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum OpcError {
    #[error("connection failed: {0}")]
    ConnectionFailed(String),

    #[error("subscription error: {0}")]
    SubscriptionError(String),

    #[error("browse error: {0}")]
    BrowseError(String),

    #[error("point not found: {0}")]
    PointNotFound(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- OpcQuality ---

    #[test]
    fn good_quality_is_good() {
        assert!(OpcQuality::Good.is_good());
    }

    #[test]
    fn bad_quality_is_not_good() {
        assert!(!OpcQuality::Bad.is_good());
    }

    #[test]
    fn uncertain_quality_is_not_good() {
        assert!(!OpcQuality::Uncertain.is_good());
    }

    #[test]
    fn opc_quality_default_is_good() {
        let q: OpcQuality = Default::default();
        assert_eq!(q, OpcQuality::Good);
    }

    #[test]
    fn opc_quality_display_matches_wire_strings() {
        assert_eq!(OpcQuality::Good.to_string(), "good");
        assert_eq!(OpcQuality::Bad.to_string(), "bad");
        assert_eq!(OpcQuality::Uncertain.to_string(), "uncertain");
    }

    // --- OpcValue constructors ---

    #[test]
    fn opc_value_good_sets_quality_to_good() {
        let v = OpcValue::good(1.23);
        assert!((v.value - 1.23).abs() < f64::EPSILON);
        assert_eq!(v.quality, OpcQuality::Good);
    }

    #[test]
    fn opc_value_new_with_bad_quality_stores_bad_quality() {
        let v = OpcValue::new(0.0, OpcQuality::Bad);
        assert_eq!(v.quality, OpcQuality::Bad);
    }

    #[test]
    fn opc_value_new_with_uncertain_quality_stores_uncertain() {
        let v = OpcValue::new(-5.5, OpcQuality::Uncertain);
        assert_eq!(v.quality, OpcQuality::Uncertain);
        assert!((v.value - (-5.5)).abs() < f64::EPSILON);
    }

    #[test]
    fn opc_value_preserves_special_float_values() {
        let v_nan = OpcValue::good(f64::NAN);
        assert!(v_nan.value.is_nan(), "NaN value must round-trip through OpcValue");

        let v_inf = OpcValue::good(f64::INFINITY);
        assert!(v_inf.value.is_infinite());
    }

    // --- OpcPoint ---

    #[test]
    fn new_opc_point_has_no_value_by_default() {
        let src = Uuid::new_v4();
        let pt = OpcPoint::new(Uuid::new_v4(), "FI-101", src);
        assert!(pt.value.is_none(), "Freshly constructed OpcPoint must have no cached value");
        assert_eq!(pt.tagname, "FI-101");
        assert_eq!(pt.source_id, src);
    }

    // --- OpcError display ---

    #[test]
    fn opc_error_connection_failed_message_propagates_detail() {
        let err = OpcError::ConnectionFailed("timeout".to_string());
        assert!(err.to_string().contains("connection failed"));
        assert!(err.to_string().contains("timeout"));
    }

    #[test]
    fn opc_error_subscription_error_message_propagates_detail() {
        let err = OpcError::SubscriptionError("max nodes exceeded".to_string());
        assert!(err.to_string().contains("subscription error"));
        assert!(err.to_string().contains("max nodes exceeded"));
    }

    #[test]
    fn opc_error_browse_error_message_propagates_detail() {
        let err = OpcError::BrowseError("access denied".to_string());
        assert!(err.to_string().contains("browse error"));
        assert!(err.to_string().contains("access denied"));
    }

    #[test]
    fn opc_error_point_not_found_message_contains_tagname() {
        let err = OpcError::PointNotFound("FI-999".to_string());
        let msg = err.to_string();
        assert!(msg.contains("FI-999"), "PointNotFound error must include tagname: {msg}");
    }
}
