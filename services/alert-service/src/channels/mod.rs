//! Pluggable alert channel adapters.
//!
//! Each channel implements the [`AlertChannel`] trait which provides a uniform
//! `deliver` method used by the escalation dispatcher. The trait is object-safe
//! so channels can be stored in a `Vec<Box<dyn AlertChannel>>` and dispatched
//! by type at runtime without a match arm per channel.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod browser_push;
pub mod pa;
pub mod radio;
pub mod sms;
pub mod voice;

// ---------------------------------------------------------------------------
// Channel types
// ---------------------------------------------------------------------------

/// All supported notification channel types.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    Email,
    Websocket,
    Sms,
    Voice,
    Radio,
    Pa,
    BrowserPush,
}

impl ChannelType {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            ChannelType::Email => "email",
            ChannelType::Websocket => "websocket",
            ChannelType::Sms => "sms",
            ChannelType::Voice => "voice",
            ChannelType::Radio => "radio",
            ChannelType::Pa => "pa",
            ChannelType::BrowserPush => "browser_push",
        }
    }
}

impl std::fmt::Display for ChannelType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for ChannelType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "email" => Ok(ChannelType::Email),
            "websocket" => Ok(ChannelType::Websocket),
            "sms" => Ok(ChannelType::Sms),
            "voice" => Ok(ChannelType::Voice),
            "radio" => Ok(ChannelType::Radio),
            "pa" => Ok(ChannelType::Pa),
            "browser_push" => Ok(ChannelType::BrowserPush),
            other => Err(format!("unknown channel type: {}", other)),
        }
    }
}

// ---------------------------------------------------------------------------
// Recipient
// ---------------------------------------------------------------------------

/// A fully-resolved recipient for a specific channel delivery attempt.
/// Different channel adapters use different fields; unused fields are `None`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelRecipient {
    /// Database user ID (if known).
    pub user_id: Option<Uuid>,
    /// Display name.
    pub name: Option<String>,
    /// Email address — used by the email adapter.
    pub email: Option<String>,
    /// E.164 phone number — used by SMS and Voice adapters.
    pub phone: Option<String>,
    /// Radio talkgroup ID string — used by the Radio adapter.
    pub talkgroup: Option<String>,
    /// PA zone identifier — used by the PA adapter.
    pub pa_zone: Option<String>,
    /// Web-push endpoint URL — used by the BrowserPush adapter.
    pub push_endpoint: Option<String>,
    /// Web-push p256dh key (base64url) — used by the BrowserPush adapter.
    pub push_p256dh: Option<String>,
    /// Web-push auth secret (base64url) — used by the BrowserPush adapter.
    pub push_auth: Option<String>,
}

// ---------------------------------------------------------------------------
// Delivery result
// ---------------------------------------------------------------------------

/// The outcome of a single delivery attempt to one recipient via one channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryResult {
    pub recipient_user_id: Option<Uuid>,
    pub recipient_contact: Option<String>,
    /// "sent" | "failed" | "skipped"
    pub status: String,
    pub external_id: Option<String>,
    pub failure_reason: Option<String>,
}

impl DeliveryResult {
    pub fn sent(user_id: Option<Uuid>, contact: Option<String>, external_id: Option<String>) -> Self {
        DeliveryResult {
            recipient_user_id: user_id,
            recipient_contact: contact,
            status: "sent".into(),
            external_id,
            failure_reason: None,
        }
    }

    pub fn failed(user_id: Option<Uuid>, contact: Option<String>, reason: impl Into<String>) -> Self {
        DeliveryResult {
            recipient_user_id: user_id,
            recipient_contact: contact,
            status: "failed".into(),
            external_id: None,
            failure_reason: Some(reason.into()),
        }
    }

    pub fn skipped(reason: impl Into<String>) -> Self {
        DeliveryResult {
            recipient_user_id: None,
            recipient_contact: None,
            status: "skipped".into(),
            external_id: None,
            failure_reason: Some(reason.into()),
        }
    }
}

// ---------------------------------------------------------------------------
// Channel error
// ---------------------------------------------------------------------------

#[allow(dead_code)]
#[derive(Debug, thiserror::Error)]
pub enum ChannelError {
    #[error("configuration error: {0}")]
    Config(String),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("channel disabled")]
    Disabled,
    #[error("{0}")]
    Other(String),
}

// ---------------------------------------------------------------------------
// Alert summary passed to adapters
// ---------------------------------------------------------------------------

/// A lightweight summary of an alert passed to every channel adapter's `deliver` call.
#[derive(Debug, Clone)]
pub struct AlertSummary {
    pub id: Uuid,
    pub title: String,
    pub message: Option<String>,
    pub severity: String,
}

// ---------------------------------------------------------------------------
// AlertChannel trait
// ---------------------------------------------------------------------------

/// Pluggable delivery channel.
///
/// Implementations must be `Send + Sync` so they can be stored in
/// `Arc<dyn AlertChannel>` and used from async tasks.
#[async_trait]
pub trait AlertChannel: Send + Sync {
    /// The type identifier for this channel.
    #[allow(dead_code)]
    fn channel_type(&self) -> ChannelType;

    /// Human-readable display name shown in the UI.
    #[allow(dead_code)]
    fn display_name(&self) -> &str;

    /// Send the alert to each of the given recipients.
    ///
    /// Returns one [`DeliveryResult`] per recipient (or per push subscription
    /// for BrowserPush where one user may have multiple subscriptions).
    async fn deliver(
        &self,
        alert: &AlertSummary,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult>;

    /// Health check — returns `Ok(())` if the channel is reachable/configured.
    #[allow(dead_code)]
    async fn health_check(&self) -> Result<(), ChannelError>;
}
