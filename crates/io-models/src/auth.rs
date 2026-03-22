use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Condensed user identity embedded in JWTs and WebSocket tickets.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserIdentity {
    pub user_id: Uuid,
    pub username: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub site_id: Option<Uuid>,
}

/// One-time WebSocket authentication ticket issued by the Auth Service.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WsTicket {
    pub ticket: Uuid,
    pub user: UserIdentity,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    /// True once the ticket has been redeemed by the Data Broker.
    pub consumed: bool,
}
