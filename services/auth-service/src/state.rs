use std::sync::Arc;

use chrono::Utc;
use dashmap::DashMap;
use uuid::Uuid;

use crate::config::Config;
use crate::oidc_jwks::{CachedJwks, JwksCache};
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
// Duo Security MFA state store
// ---------------------------------------------------------------------------

/// An in-memory entry representing a Duo Universal Prompt authorization
/// in-flight.  Stored in `AppState::duo_state_tokens` for up to 10 minutes.
#[derive(Clone)]
pub struct DuoStateEntry {
    /// The I/O MFA pending token that started this Duo flow.
    pub mfa_pending_token: String,
    /// The `auth_provider_configs` row ID for this Duo provider.
    #[allow(dead_code)]
    pub config_id: uuid::Uuid,
    /// Duo API hostname (e.g. `api-XXXXXXXX.duosecurity.com`).
    pub api_hostname: String,
    /// Duo OAuth2 client_id.
    pub duo_client_id: String,
    /// Duo OAuth2 client_secret.
    pub duo_client_secret: String,
    /// The redirect_uri registered with Duo.
    pub redirect_uri: String,
    /// OIDC nonce — must match the value in the Duo ID token.
    pub nonce: String,
    /// Username submitted to Duo; validated against `preferred_username` in the ID token.
    pub expected_username: String,
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
    /// JWKS cache for OIDC signature verification.
    /// Key: issuer URL.  Value: cached JWKS document with 1-hour TTL.
    pub jwks_cache: JwksCache,
    /// In-flight Duo Universal Prompt state tokens (CSRF protection).
    /// Key: random 32-byte hex state token.  Value: Duo flow state with 10-min TTL.
    pub duo_state_tokens: Arc<DashMap<String, DuoStateEntry>>,
}

impl AppState {
    pub fn new(db: DbPool, config: Config) -> Self {
        Self {
            db,
            config,
            http: reqwest::Client::new(),
            mfa_pending_tokens: Arc::new(DashMap::new()),
            eula_pending_tokens: Arc::new(DashMap::new()),
            jwks_cache: Arc::new(DashMap::<String, CachedJwks>::new()),
            duo_state_tokens: Arc::new(DashMap::new()),
        }
    }
}
