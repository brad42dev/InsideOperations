//! Browser Push channel adapter — delivers Web Push notifications via VAPID.
//!
//! Uses the `web-push-native` crate (MIT/Apache-2.0) which implements RFC 8030
//! (Generic Event Delivery Using HTTP Push) and RFC 8292 (VAPID).
//!
//! Push subscriptions are stored in the `push_subscriptions` table. One user
//! can have multiple subscriptions (one per browser/device). The adapter queries
//! the database for each recipient's subscriptions and sends a push to each.
//!
//! Expired or invalid subscriptions (HTTP 404 / 410 from the push service) are
//! deleted from the database automatically.

use async_trait::async_trait;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};
use web_push_native::{
    jwt_simple::algorithms::ES256KeyPair, p256::PublicKey, Auth, WebPushBuilder,
};

use super::{
    AlertChannel, AlertSummary, ChannelError, ChannelRecipient, ChannelType, DeliveryResult,
};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/// Deserialised from `alert_channels.config` JSONB for the `browser_push` channel type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserPushConfig {
    /// VAPID subject — typically `mailto:admin@example.com` or the application URL.
    pub vapid_subject: String,
    /// VAPID private key in base64url-encoded raw bytes format (stored encrypted at rest;
    /// decrypted by the channel_config handler before constructing this struct).
    pub vapid_private_key: String,
    /// VAPID public key in uncompressed base64url format — provided to browsers
    /// during push subscription registration.
    pub vapid_public_key: String,
    /// Time-to-live for push messages in seconds (default: 3600 = 1 hour).
    #[serde(default = "default_ttl")]
    pub ttl_seconds: u64,
}

fn default_ttl() -> u64 {
    3600
}

// ---------------------------------------------------------------------------
// Push subscription row from DB
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct PushSubscription {
    pub id: uuid::Uuid,
    pub endpoint: String,
    pub p256dh: String,
    pub auth_secret: String,
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

pub struct BrowserPushAdapter {
    config: BrowserPushConfig,
    db: sqlx::PgPool,
    http: reqwest::Client,
}

impl BrowserPushAdapter {
    pub fn new(config: BrowserPushConfig, state: &AppState) -> Self {
        BrowserPushAdapter {
            config,
            db: state.db.clone(),
            http: state.http.clone(),
        }
    }

    /// Load all push subscriptions for a given user from the database.
    async fn load_subscriptions(&self, user_id: uuid::Uuid) -> Vec<PushSubscription> {
        let rows = sqlx::query(
            "SELECT id, endpoint, p256dh, auth
             FROM push_subscriptions
             WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_all(&self.db)
        .await;

        match rows {
            Ok(rows) => {
                use sqlx::Row;
                rows.into_iter()
                    .map(|r| PushSubscription {
                        id: r.get("id"),
                        endpoint: r.get("endpoint"),
                        p256dh: r.get("p256dh"),
                        auth_secret: r.get("auth"),
                    })
                    .collect()
            }
            Err(e) => {
                error!(error = %e, user_id = %user_id, "browser_push: failed to load push subscriptions");
                Vec::new()
            }
        }
    }

    /// Delete a stale push subscription from the database.
    async fn delete_subscription(&self, subscription_id: uuid::Uuid) {
        if let Err(e) = sqlx::query("DELETE FROM push_subscriptions WHERE id = $1")
            .bind(subscription_id)
            .execute(&self.db)
            .await
        {
            warn!(error = %e, id = %subscription_id, "browser_push: failed to delete stale subscription");
        }
    }

    /// Build and send a single VAPID-signed push notification.
    async fn send_push(
        &self,
        alert: &AlertSummary,
        subscription: &PushSubscription,
    ) -> Result<(), String> {
        // Decode the VAPID private key (base64url-encoded raw bytes).
        let private_key_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(&self.config.vapid_private_key)
            .map_err(|e| format!("failed to decode VAPID private key: {}", e))?;

        let key_pair = ES256KeyPair::from_bytes(&private_key_bytes)
            .map_err(|e| format!("invalid VAPID key pair: {}", e))?;

        // Decode the subscription public key (p256dh).
        let p256dh_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(&subscription.p256dh)
            .map_err(|e| format!("failed to decode p256dh: {}", e))?;

        let subscriber_key = PublicKey::from_sec1_bytes(&p256dh_bytes)
            .map_err(|e| format!("invalid subscriber public key: {}", e))?;

        // Decode the push subscription auth secret (must be exactly 16 bytes).
        let auth_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(&subscription.auth_secret)
            .map_err(|e| format!("failed to decode auth secret: {}", e))?;

        if auth_bytes.len() != 16 {
            return Err(format!(
                "auth secret must be 16 bytes, got {}",
                auth_bytes.len()
            ));
        }

        let auth = Auth::clone_from_slice(&auth_bytes);

        // Parse the push endpoint URI (uses the `http` crate re-exported by axum).
        let endpoint_uri: axum::http::Uri =
            subscription
                .endpoint
                .parse()
                .map_err(|e: axum::http::uri::InvalidUri| {
                    format!("invalid push endpoint URI: {}", e)
                })?;

        // Build the notification payload as JSON.
        let payload = serde_json::json!({
            "title": &alert.title,
            "body": alert.message.as_deref().unwrap_or(""),
            "severity": &alert.severity,
            "alert_id": alert.id,
        })
        .to_string();

        // Build the VAPID-signed push request (returns http::Request<Vec<u8>>).
        // NOTE: with_valid_duration must be called BEFORE with_vapid because the
        // two methods are defined on different generic instantiations of WebPushBuilder.
        let push_request = WebPushBuilder::new(endpoint_uri, subscriber_key, auth)
            .with_valid_duration(std::time::Duration::from_secs(self.config.ttl_seconds))
            .with_vapid(&key_pair, &self.config.vapid_subject)
            .build(payload.as_bytes())
            .map_err(|e| format!("failed to build push request: {}", e))?;

        // Translate the http::Request<Vec<u8>> into a reqwest request.
        let (parts, body_bytes) = push_request.into_parts();

        let endpoint_str = parts.uri.to_string();
        let mut reqwest_req = self
            .http
            .request(
                reqwest::Method::from_bytes(parts.method.as_str().as_bytes())
                    .unwrap_or(reqwest::Method::POST),
                &endpoint_str,
            )
            .body(body_bytes);

        // Copy HTTP headers from the web-push request to reqwest.
        // We use explicit type annotations to help the compiler resolve the
        // `HeaderName` and `HeaderValue` types from the `http` crate.
        for (name, value) in parts.headers.iter() {
            let name_str: &str = name.as_str();
            if let Ok(value_str) = value.to_str() {
                reqwest_req = reqwest_req.header(name_str, value_str);
            }
        }

        let resp = reqwest_req.send().await.map_err(|e| e.to_string())?;

        let status = resp.status().as_u16();
        if status == 200 || status == 201 {
            Ok(())
        } else {
            let body_text = resp.text().await.unwrap_or_default();
            Err(format!("push service HTTP {}: {}", status, body_text))
        }
    }
}

#[async_trait]
impl AlertChannel for BrowserPushAdapter {
    fn channel_type(&self) -> ChannelType {
        ChannelType::BrowserPush
    }

    fn display_name(&self) -> &str {
        "Browser Push"
    }

    async fn deliver(
        &self,
        alert: &AlertSummary,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult> {
        let mut results = Vec::new();

        for recipient in recipients {
            let user_id = match recipient.user_id {
                Some(id) => id,
                None => {
                    warn!("browser_push: recipient has no user_id, skipping");
                    results.push(DeliveryResult::skipped("no user_id"));
                    continue;
                }
            };

            // Use inline subscription from the ChannelRecipient if provided (e.g. from
            // the test_channel handler). Otherwise load subscriptions from the DB.
            let subscriptions = if recipient.push_endpoint.is_some() {
                vec![PushSubscription {
                    id: uuid::Uuid::nil(),
                    endpoint: recipient.push_endpoint.clone().unwrap_or_default(),
                    p256dh: recipient.push_p256dh.clone().unwrap_or_default(),
                    auth_secret: recipient.push_auth.clone().unwrap_or_default(),
                }]
            } else {
                self.load_subscriptions(user_id).await
            };

            if subscriptions.is_empty() {
                info!(
                    user_id = %user_id,
                    "browser_push: user has no push subscriptions, skipping"
                );
                results.push(DeliveryResult::skipped("no push subscriptions"));
                continue;
            }

            for sub in &subscriptions {
                match self.send_push(alert, sub).await {
                    Ok(()) => {
                        info!(
                            alert_id = %alert.id,
                            user_id = %user_id,
                            endpoint = %sub.endpoint,
                            "browser_push: sent"
                        );
                        results.push(DeliveryResult::sent(
                            Some(user_id),
                            Some(sub.endpoint.clone()),
                            None,
                        ));
                    }
                    Err(ref e) => {
                        // Detect stale subscriptions from 404/410 responses.
                        let is_stale = e.contains("HTTP 404") || e.contains("HTTP 410");
                        if is_stale && sub.id != uuid::Uuid::nil() {
                            warn!(
                                alert_id = %alert.id,
                                user_id = %user_id,
                                endpoint = %sub.endpoint,
                                "browser_push: subscription expired, deleting"
                            );
                            self.delete_subscription(sub.id).await;
                            results.push(DeliveryResult::skipped("subscription expired (removed)"));
                        } else {
                            error!(
                                alert_id = %alert.id,
                                user_id = %user_id,
                                endpoint = %sub.endpoint,
                                error = %e,
                                "browser_push: push failed"
                            );
                            results.push(DeliveryResult::failed(
                                Some(user_id),
                                Some(sub.endpoint.clone()),
                                e.clone(),
                            ));
                        }
                    }
                }
            }
        }

        results
    }

    async fn health_check(&self) -> Result<(), ChannelError> {
        if self.config.vapid_subject.is_empty() {
            return Err(ChannelError::Config("vapid_subject is required".into()));
        }
        if self.config.vapid_private_key.is_empty() {
            return Err(ChannelError::Config("vapid_private_key is required".into()));
        }
        if self.config.vapid_public_key.is_empty() {
            return Err(ChannelError::Config("vapid_public_key is required".into()));
        }
        // Attempt to decode and validate the private key.
        let private_key_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(&self.config.vapid_private_key)
            .map_err(|e| {
                ChannelError::Config(format!("invalid vapid_private_key encoding: {}", e))
            })?;
        ES256KeyPair::from_bytes(&private_key_bytes)
            .map_err(|e| ChannelError::Config(format!("invalid VAPID key pair: {}", e)))?;
        Ok(())
    }
}
