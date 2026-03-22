use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A single data point value read from a source.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PointValue {
    pub point_id: Uuid,
    pub value: f64,
    pub quality: PointQuality,
    pub timestamp: DateTime<Utc>,
}

/// Quality flag for a data point value.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PointQuality {
    Good,
    Uncertain,
    Bad,
}

/// Static metadata describing a data point (tagname, engineering units, etc.).
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PointMetadata {
    pub point_id: Uuid,
    pub tagname: String,
    pub description: Option<String>,
    pub engineering_units: Option<String>,
    pub data_type: String,
    pub source_id: Uuid,
    pub active: bool,
    pub criticality: Option<String>,
    pub area: Option<String>,
}
