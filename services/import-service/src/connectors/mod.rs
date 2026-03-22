pub mod canary_rest;
pub mod db_writes;
pub mod experion_rest;
pub mod kepware_rest;
pub mod pi_web_api;
pub mod s800xa_rest;
pub mod siemens_sph_rest;
pub mod wincc_oa_rest;

use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Shared data types
// ---------------------------------------------------------------------------

/// Metadata a supplemental connector can provide for a point.
#[derive(Debug, Default)]
pub struct SupplementalMetadata {
    pub tagname: String,
    pub description: Option<String>,
    pub engineering_units: Option<String>,
    pub eu_range_low: Option<f64>,
    pub eu_range_high: Option<f64>,
    pub alarm_limit_hh: Option<f64>,
    pub alarm_limit_h: Option<f64>,
    pub alarm_limit_l: Option<f64>,
    pub alarm_limit_ll: Option<f64>,
}

/// An alarm/event from a supplemental connector.
#[derive(Debug)]
pub struct SupplementalEvent {
    pub event_type: String,
    pub source_name: String,
    pub timestamp: DateTime<Utc>,
    pub severity: Option<i32>,
    pub message: Option<String>,
    pub alarm_type: Option<String>,
    pub alarm_state: Option<String>,
    pub external_id: Option<String>,
    pub limit_value: Option<f64>,
    pub actual_value: Option<f64>,
}

/// Config passed to a connector from the import_connections row.
#[derive(Debug, Clone)]
pub struct ConnectorConfig {
    #[allow(dead_code)]
    pub connection_id: Uuid,
    pub base_url: Option<String>,
    pub auth_type: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub api_key: Option<String>,
    pub bearer_token: Option<String>,
    pub extra: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Trait that all DCS supplemental REST connectors implement.
#[async_trait::async_trait]
pub trait DcsConnector: Send + Sync {
    #[allow(dead_code)]
    fn connector_type(&self) -> &'static str;
    #[allow(dead_code)]
    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()>;
    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>>;
    async fn fetch_events(
        &self,
        cfg: &ConnectorConfig,
        since: DateTime<Utc>,
    ) -> Result<Vec<SupplementalEvent>>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

pub fn get_connector(connector_type: &str) -> Option<Box<dyn DcsConnector>> {
    match connector_type {
        "pi_web_api" => Some(Box::new(pi_web_api::PiWebApiConnector)),
        "experion_rest" => Some(Box::new(experion_rest::ExperionConnector)),
        "siemens_sph_rest" => Some(Box::new(siemens_sph_rest::SiemensSphConnector)),
        "wincc_oa_rest" => Some(Box::new(wincc_oa_rest::WinccOaConnector)),
        "s800xa_rest" => Some(Box::new(s800xa_rest::AbbImConnector)),
        "kepware_rest" => Some(Box::new(kepware_rest::KepwareConnector)),
        "canary_rest" => Some(Box::new(canary_rest::CanaryConnector)),
        _ => None,
    }
}

/// Build a ConnectorConfig from an import_connections row.
/// The row must expose: id, connection_type, config (JSONB), auth_type, auth_config (JSONB).
pub fn extract_connector_config(
    id: Uuid,
    config: &serde_json::Value,
    auth_type: &str,
    auth_config: &serde_json::Value,
) -> ConnectorConfig {
    let base_url = config
        .get("base_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let username = auth_config
        .get("username")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let password = auth_config
        .get("password")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let api_key = auth_config
        .get("api_key")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let bearer_token = auth_config
        .get("bearer_token")
        .or_else(|| auth_config.get("token"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    ConnectorConfig {
        connection_id: id,
        base_url,
        auth_type: auth_type.to_string(),
        username,
        password,
        api_key,
        bearer_token,
        extra: config.clone(),
    }
}

// ---------------------------------------------------------------------------
// Auth helpers shared across connectors
// ---------------------------------------------------------------------------

/// Apply auth headers to a request builder based on ConnectorConfig.
pub fn apply_auth(
    builder: reqwest::RequestBuilder,
    cfg: &ConnectorConfig,
) -> reqwest::RequestBuilder {
    match cfg.auth_type.as_str() {
        "basic" => {
            if let (Some(u), Some(p)) = (cfg.username.as_deref(), cfg.password.as_deref()) {
                builder.basic_auth(u, Some(p))
            } else {
                builder
            }
        }
        "bearer_token" => {
            if let Some(token) = cfg.bearer_token.as_deref() {
                builder.bearer_auth(token)
            } else {
                builder
            }
        }
        "api_key" | "api_key_header" => {
            if let Some(key) = cfg.api_key.as_deref() {
                builder.header("X-Api-Key", key)
            } else {
                builder
            }
        }
        _ => builder,
    }
}
