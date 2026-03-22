//! Helper for publishing events to the Data Broker's /internal/broadcast endpoint.
//!
//! The Data Broker acts as the WebSocket fan-out hub. Services that need to push
//! real-time events to browser clients call POST /internal/broadcast with:
//!   { "type": "<event_type>", "payload": { ... } }
//!
//! This module provides a fire-and-forget async helper so handlers can publish
//! without blocking the HTTP response path.

use reqwest::Client;
use tracing::{debug, warn};

/// Publish a broadcast event to all connected WebSocket clients via the Data Broker.
///
/// `broker_url`    — base URL of the data-broker (e.g. "http://127.0.0.1:3001")
/// `service_secret` — IO_SERVICE_SECRET for the x-io-service-secret header
/// `event_type`    — event type string (e.g. "muster_status", "presence_headcount")
/// `payload`       — JSON payload forwarded verbatim to the browser
///
/// Errors are logged as warnings and discarded — the caller's HTTP response is not affected.
pub async fn broadcast(
    http: &Client,
    broker_url: &str,
    service_secret: &str,
    event_type: &str,
    payload: serde_json::Value,
) {
    let url = format!("{}/internal/broadcast", broker_url);
    let body = serde_json::json!({ "type": event_type, "payload": payload });

    let result = http
        .post(&url)
        .header("x-io-service-secret", service_secret)
        .json(&body)
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            debug!(event_type, "broker broadcast: sent");
        }
        Ok(resp) => {
            warn!(
                event_type,
                status = resp.status().as_u16(),
                "broker broadcast: data-broker returned non-2xx"
            );
        }
        Err(e) => {
            warn!(event_type, error = %e, "broker broadcast: request failed");
        }
    }
}
