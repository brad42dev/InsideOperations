use crate::{
    cache::ShadowCache,
    config::Config,
    registry::{ClientId, SubscriptionRegistry},
};
use dashmap::DashMap;
use io_bus::WsServerMessage;
use std::{collections::HashSet, sync::Arc};
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
}
