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
