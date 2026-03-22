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
// EULA pending-token store
// ---------------------------------------------------------------------------

/// An in-memory entry representing a user who passed primary authentication but
/// has not yet accepted the current active EULA.  Stored in
/// `AppState::eula_pending_tokens` for a maximum of 5 minutes (single-use).
#[derive(Clone)]
pub struct EulaPendingEntry {
    pub user_id: Uuid,
    pub expires_at: chrono::DateTime<Utc>,
    /// Set to `true` once the token has been consumed by `accept_eula_pending`.
    pub used: bool,
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
    /// Short-lived tokens issued when EULA acceptance is required during login.
    /// Key: opaque 32-byte hex string.  Value: pending entry with 5-minute TTL.
    pub eula_pending_tokens: Arc<DashMap<String, EulaPendingEntry>>,
}

impl AppState {
    pub fn new(db: DbPool, config: Config) -> Self {
        Self {
            db,
            config,
            http: reqwest::Client::new(),
            mfa_pending_tokens: Arc::new(DashMap::new()),
            eula_pending_tokens: Arc::new(DashMap::new()),
        }
    }
}
