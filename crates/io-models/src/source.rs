use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Current connection status of a data source.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SourceStatus {
    pub source_id: Uuid,
    /// Protocol type, e.g. `"opc_ua"`, `"mssql"`, `"rest_api"`.
    pub source_type: String,
    pub status: SourceState,
    pub last_connected_at: Option<DateTime<Utc>>,
    pub last_error_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

/// Connection lifecycle state of a data source.
#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SourceState {
    Active,
    Inactive,
    Connecting,
    Error,
}
