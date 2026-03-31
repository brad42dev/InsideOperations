//! Badge polling engine — adapter trait and shared types.
//!
//! Each supported access-control vendor implements the [`BadgeAdapter`] trait.
//! The poller module uses it to poll badge events from configured sources.

pub mod generic;
pub mod poller;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Identifies the vendor/integration type of a badge source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum BadgeAdapterType {
    Lenel,
    CCure,
    Genetec,
    Honeywell,
    Gallagher,
    GenericDatabase,
    NoOp,
}

/// The type of event recorded at a badge reader.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BadgeEventType {
    SwipeIn,
    SwipeOut,
    AccessDenied,
    DoorForced,
    DoorHeldOpen,
    Duress,
    PassbackViolation,
    Tailgate,
}

// ---------------------------------------------------------------------------
// Data structs
// ---------------------------------------------------------------------------

/// A single badge event returned by an adapter's `poll_events` call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgeEvent {
    /// Unique identifier within the originating access-control system.
    pub external_event_id: String,
    /// Badge number / card number from the access-control system.
    pub badge_id: String,
    /// Employee ID (if available from the access-control system).
    pub employee_id: Option<String>,
    /// Reader / door identifier.
    pub reader_id: Option<String>,
    /// Human-readable reader label.
    pub reader_name: Option<String>,
    /// The type of event.
    pub event_type: BadgeEventType,
    /// When the event occurred (UTC).
    pub occurred_at: DateTime<Utc>,
    /// Any additional metadata from the vendor.
    pub raw_data: Option<serde_json::Value>,
}

/// A person record returned by `lookup_person`, populated from the external
/// access-control system's personnel database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ExternalPerson {
    pub employee_id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub department: Option<String>,
    pub title: Option<String>,
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum BadgeAdapterError {
    #[error("connection error: {0}")]
    Connection(String),
    #[error("authentication failed: {0}")]
    Auth(String),
    #[error("request error: {0}")]
    Request(String),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("not supported: {0}")]
    NotSupported(String),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// ---------------------------------------------------------------------------
// The adapter trait
// ---------------------------------------------------------------------------

/// Common interface that every badge-source adapter must implement.
///
/// Implementors are expected to be `Send + Sync` and cheap to clone (or
/// wrapped in `Arc`) so they can be held in long-running async tasks.
#[async_trait]
#[allow(dead_code)]
pub trait BadgeAdapter: Send + Sync {
    /// Returns the vendor/integration type of this adapter.
    fn adapter_type(&self) -> BadgeAdapterType;

    /// Human-readable name for this adapter instance (e.g. "Main Plant Lenel").
    fn display_name(&self) -> &str;

    /// Poll for new badge events that occurred after `since`.
    ///
    /// The poller stores the most recent `occurred_at` timestamp as a
    /// checkpoint and passes it as `since` on the next cycle.
    async fn poll_events(&self, since: DateTime<Utc>)
        -> Result<Vec<BadgeEvent>, BadgeAdapterError>;

    /// Look up a person record by badge ID or employee ID.
    async fn lookup_person(
        &self,
        identifier: &str,
    ) -> Result<Option<ExternalPerson>, BadgeAdapterError>;

    /// Verify that the adapter can reach its upstream system.
    async fn health_check(&self) -> Result<(), BadgeAdapterError>;
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/// Build an adapter for the given `adapter_type`.  Returns a stub `NoOpAdapter`
/// for unimplemented vendor types so the poller can still run.
pub fn build_adapter(
    adapter_type: &str,
    display_name: String,
    _config: &serde_json::Value,
) -> Box<dyn BadgeAdapter> {
    match adapter_type {
        "generic_database" => Box::new(generic::GenericDatabaseAdapter::new(display_name)),
        _ => {
            tracing::warn!(
                adapter_type,
                "No adapter implementation for this type; using NoOpAdapter"
            );
            Box::new(generic::NoOpAdapter::new(display_name))
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn badge_event_type_roundtrip() {
        let t = BadgeEventType::SwipeIn;
        let s = serde_json::to_string(&t).unwrap();
        let back: BadgeEventType = serde_json::from_str(&s).unwrap();
        assert_eq!(t, back);
    }

    #[test]
    fn badge_adapter_type_roundtrip() {
        let t = BadgeAdapterType::GenericDatabase;
        let s = serde_json::to_string(&t).unwrap();
        let back: BadgeAdapterType = serde_json::from_str(&s).unwrap();
        assert_eq!(t, back);
    }
}
