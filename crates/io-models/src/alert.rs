use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::event::EventSeverity;

/// A fully-resolved alert dispatch payload sent to the Alert Service.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AlertDispatch {
    pub alert_id: Uuid,
    pub severity: EventSeverity,
    pub template_id: Uuid,
    pub title: String,
    pub message: String,
    pub recipients: Vec<AlertRecipient>,
    pub channels: Vec<AlertChannel>,
    pub requires_acknowledgment: bool,
    pub full_screen_takeover: bool,
    /// User or system event that triggered this alert.
    pub triggered_by: Uuid,
    pub triggered_at: DateTime<Utc>,
}

/// A single recipient within an alert dispatch, with their preferred delivery channels.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AlertRecipient {
    pub user_id: Uuid,
    pub delivery_channels: Vec<AlertChannel>,
}

/// Available delivery channels for alerts.
#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum AlertChannel {
    WebSocket,
    Email,
    Sms,
    Voice,
    Radio,
    Pa,
}
