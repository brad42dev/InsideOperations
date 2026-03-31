use crate::{
    cache::ShadowCache,
    config::Config,
    registry::{ClientId, SubscriptionRegistry},
    throttle::ThrottleLevel,
};
use dashmap::DashMap;
use io_bus::WsServerMessage;
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub cache: Arc<ShadowCache>,
    pub registry: Arc<SubscriptionRegistry>,
    pub connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
    /// Reverse map: user_id → set of ClientIds authenticated as that user.
    /// Used by the internal publish endpoint to fan-out typed events to all
    /// of a user's WebSocket connections (e.g. session.locked).
    pub user_connections: Arc<DashMap<Uuid, HashSet<ClientId>>>,
    pub http_client: reqwest::Client,

    // -----------------------------------------------------------------------
    // Adaptive throttling state
    // -----------------------------------------------------------------------
    /// Per-client throttle level. Updated by the StatusReport handler in ws.rs.
    /// Read by the fanout flusher to apply per-client delivery behaviour.
    /// DashMap is used so the hot fanout path never blocks.
    pub throttle_states: Arc<DashMap<ClientId, ThrottleLevel>>,

    /// Set to `true` when more than `config.throttle_global_ratio` of clients
    /// are being throttled. The fanout flusher reads this to apply a wider
    /// batch window and a floor deadband to all clients.
    ///
    /// Updated atomically by the StatusReport handler after each status report.
    pub global_throttle_active: Arc<AtomicBool>,
}

impl AppState {
    /// Returns `true` if the global throttle flag is currently active.
    #[inline]
    pub fn is_global_throttle_active(&self) -> bool {
        self.global_throttle_active.load(Ordering::Relaxed)
    }
}
