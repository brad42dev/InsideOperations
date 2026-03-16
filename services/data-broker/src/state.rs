use crate::{
    cache::ShadowCache,
    config::Config,
    registry::{ClientId, SubscriptionRegistry},
};
use dashmap::DashMap;
use io_bus::WsServerMessage;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub cache: Arc<ShadowCache>,
    pub registry: Arc<SubscriptionRegistry>,
    pub connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
    pub http_client: reqwest::Client,
}
