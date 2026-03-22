use std::sync::Arc;

use chrono::Utc;
use dashmap::DashMap;
use uuid::Uuid;

use crate::config::Config;
use io_db::DbPool;

// ---------------------------------------------------------------------------
// MFA pending-token store
// ---------------------------------------------------------------------------

/// An in-memory entry representing a user who has passed primary authentication
/// but has not yet completed their MFA challenge.  Stored in `AppState::mfa_pending_tokens`
/// for a maximum of 5 minutes.
#[derive(Clone)]
pub struct MfaPendingEntry {
    pub user_id: Uuid,
    /// Methods allowed per `mfa_policies` — returned to client at challenge time,
    /// available here for future validation (e.g. reject a TOTP attempt when only
    /// email is allowed).
    #[allow(dead_code)]
    pub allowed_methods: Vec<String>,
    pub expires_at: chrono::DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// AppState
// ---------------------------------------------------------------------------

/// Shared application state passed into axum handlers via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub config: Config,
    pub http: reqwest::Client,
    /// Short-lived tokens issued when MFA is required during login.
    /// Key: opaque UUID token string.  Value: pending entry with 5-minute TTL.
    pub mfa_pending_tokens: Arc<DashMap<String, MfaPendingEntry>>,
}

impl AppState {
    pub fn new(db: DbPool, config: Config) -> Self {
        Self {
            db,
            config,
            http: reqwest::Client::new(),
            mfa_pending_tokens: Arc::new(DashMap::new()),
        }
    }
}
