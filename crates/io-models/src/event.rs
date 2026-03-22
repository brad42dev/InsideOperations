use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A unified event crossing service boundaries (alarms, user actions, system events).
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Event {
    pub event_id: Uuid,
    pub event_type: EventType,
    pub severity: EventSeverity,
    pub point_id: Option<Uuid>,
    pub source_id: Option<Uuid>,
    pub summary: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

/// Discriminator for the origin of an event.
#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Alarm,
    System,
    UserAction,
    Import,
    Authentication,
}

/// Severity level for an event, ordered from highest to lowest.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Ord, PartialOrd)]
#[serde(rename_all = "snake_case")]
pub enum EventSeverity {
    Emergency,
    Critical,
    Warning,
    Info,
}
