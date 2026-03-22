//! Stub badge adapters for scaffolding.
//!
//! `NoOpAdapter` — always returns empty event lists. Used when a source has an
//!   unrecognised adapter type.
//!
//! `GenericDatabaseAdapter` — placeholder for a future implementation that
//!   queries a generic SQL access-control database.  Currently behaves like
//!   `NoOpAdapter` (returns empty events) so the poller can run end-to-end
//!   without crashing.

use async_trait::async_trait;
use chrono::{DateTime, Utc};

use super::{BadgeAdapter, BadgeAdapterError, BadgeAdapterType, BadgeEvent, ExternalPerson};

// ---------------------------------------------------------------------------
// NoOpAdapter
// ---------------------------------------------------------------------------

/// A no-operation adapter that always returns an empty event list.
///
/// Used as a safe fallback for source types that have no concrete
/// implementation yet.
pub struct NoOpAdapter {
    name: String,
}

impl NoOpAdapter {
    pub fn new(name: String) -> Self {
        Self { name }
    }
}

#[async_trait]
impl BadgeAdapter for NoOpAdapter {
    fn adapter_type(&self) -> BadgeAdapterType {
        BadgeAdapterType::NoOp
    }

    fn display_name(&self) -> &str {
        &self.name
    }

    async fn poll_events(
        &self,
        _since: DateTime<Utc>,
    ) -> Result<Vec<BadgeEvent>, BadgeAdapterError> {
        Ok(vec![])
    }

    async fn lookup_person(
        &self,
        _identifier: &str,
    ) -> Result<Option<ExternalPerson>, BadgeAdapterError> {
        Ok(None)
    }

    async fn health_check(&self) -> Result<(), BadgeAdapterError> {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// GenericDatabaseAdapter
// ---------------------------------------------------------------------------

/// Stub for a future "generic SQL access-control database" adapter.
///
/// In a real implementation this would hold a connection pool and query
/// a standardised schema.  For now it delegates to `NoOpAdapter` behaviour
/// so the overall polling architecture can be validated end-to-end.
pub struct GenericDatabaseAdapter {
    inner: NoOpAdapter,
}

impl GenericDatabaseAdapter {
    pub fn new(name: String) -> Self {
        Self {
            inner: NoOpAdapter::new(name),
        }
    }
}

#[async_trait]
impl BadgeAdapter for GenericDatabaseAdapter {
    fn adapter_type(&self) -> BadgeAdapterType {
        BadgeAdapterType::GenericDatabase
    }

    fn display_name(&self) -> &str {
        self.inner.display_name()
    }

    async fn poll_events(
        &self,
        since: DateTime<Utc>,
    ) -> Result<Vec<BadgeEvent>, BadgeAdapterError> {
        // TODO: implement actual SQL query against the generic schema
        self.inner.poll_events(since).await
    }

    async fn lookup_person(
        &self,
        identifier: &str,
    ) -> Result<Option<ExternalPerson>, BadgeAdapterError> {
        // TODO: implement lookup
        self.inner.lookup_person(identifier).await
    }

    async fn health_check(&self) -> Result<(), BadgeAdapterError> {
        // TODO: verify database connectivity
        self.inner.health_check().await
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn noop_adapter_returns_empty_events() {
        let adapter = NoOpAdapter::new("test".to_string());
        let events = adapter.poll_events(Utc::now()).await.unwrap();
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn noop_adapter_health_check_passes() {
        let adapter = NoOpAdapter::new("test".to_string());
        adapter.health_check().await.unwrap();
    }

    #[tokio::test]
    async fn generic_db_adapter_returns_empty_events() {
        let adapter = GenericDatabaseAdapter::new("test-generic".to_string());
        let events = adapter.poll_events(Utc::now()).await.unwrap();
        assert!(events.is_empty());
    }
}
