//! Shiftboard JSON-RPC 2.0 ETL connector.
//!
//! Implements HMAC-SHA1 signed requests to the Shiftboard API for
//! extracting shift schedules and personnel assignments.

use anyhow::{anyhow, Result};
use base64::Engine as _;
use hmac::{Hmac, Mac};
use sha1::Sha1;
use serde::Deserialize;
use serde_json::Value as JsonValue;
use tracing::{info, warn};

use super::{EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// Connector struct
// ---------------------------------------------------------------------------

pub struct ShiftboardJsonRpcConnector;

// ---------------------------------------------------------------------------
// Internal response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    result: Option<JsonValue>,
    error: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// HMAC-SHA1 signature helper
// ---------------------------------------------------------------------------

/// Compute the HMAC-SHA1 signature for a Shiftboard JSON-RPC request.
/// The signed string is: "method" + methodName + "params" + params_json
fn compute_signature(method: &str, params: &JsonValue, secret_key: &str) -> Result<String> {
    let params_str = serde_json::to_string(params)?;
    let sign_data = format!("method{}params{}", method, params_str);
    type HmacSha1 = Hmac<Sha1>;
    let mut mac = HmacSha1::new_from_slice(secret_key.as_bytes())
        .map_err(|e| anyhow!("HMAC key error: {e}"))?;
    mac.update(sign_data.as_bytes());
    let result = mac.finalize();
    Ok(base64::engine::general_purpose::STANDARD.encode(result.into_bytes()))
}

// ---------------------------------------------------------------------------
// JSON-RPC call helper
// ---------------------------------------------------------------------------

/// Issue a single JSON-RPC 2.0 POST to the Shiftboard API endpoint and
/// return the `result` value, or an error if the response contains an
/// `error` field or the HTTP status is not 2xx.
async fn jsonrpc_call(
    client: &reqwest::Client,
    base_url: &str,
    method: &str,
    params: JsonValue,
    access_key_id: &str,
    secret_key: &str,
) -> Result<JsonValue> {
    let signature = compute_signature(method, &params, secret_key)?;
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
        "access_key_id": access_key_id,
        "signature": signature,
    });

    let resp = client.post(base_url).json(&body).send().await?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "shiftboard: HTTP {} from {method}",
            resp.status()
        ));
    }

    let rpc: JsonRpcResponse = resp.json().await?;

    if let Some(err) = rpc.error {
        return Err(anyhow!("shiftboard: JSON-RPC error: {err}"));
    }

    rpc.result
        .ok_or_else(|| anyhow!("shiftboard: missing result in response for {method}"))
}

// ---------------------------------------------------------------------------
// Datetime helper
// ---------------------------------------------------------------------------

/// Convert a Shiftboard datetime string "YYYY-MM-DD HH:MM:SS" to RFC-3339 UTC.
fn shiftboard_dt_to_rfc3339(s: &str) -> String {
    // Replace the space separator with T and append Z for UTC.
    let normalized = s.replacen(' ', "T", 1);
    format!("{normalized}Z")
}

// ---------------------------------------------------------------------------
// EtlConnector implementation
// ---------------------------------------------------------------------------

impl ShiftboardJsonRpcConnector {
    fn base_url(cfg: &EtlConnectorConfig) -> String {
        cfg.connection_config
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| "https://api.shiftboard.com".to_string())
    }

    fn credentials(cfg: &EtlConnectorConfig) -> Result<(String, String)> {
        let access_key_id = cfg
            .auth_config
            .get("access_key_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow!("shiftboard: access_key_id is required in auth_config"))?
            .to_string();
        let secret_key = cfg
            .auth_config
            .get("secret_key")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow!("shiftboard: secret_key is required in auth_config"))?
            .to_string();
        Ok((access_key_id, secret_key))
    }
}

#[async_trait::async_trait]
impl EtlConnector for ShiftboardJsonRpcConnector {
    fn connector_type(&self) -> &'static str {
        "shiftboard_jsonrpc"
    }

    /// Verify credentials by calling shift.list with a minimal 1-day, 1-record range.
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let base_url = Self::base_url(cfg);
        let (access_key_id, secret_key) = Self::credentials(cfg)?;
        let client = reqwest::Client::new();
        let params = serde_json::json!({
            "start_date": "2026-01-01",
            "end_date": "2026-01-01",
            "page": { "batch": 1, "start": 1 }
        });
        jsonrpc_call(
            &client,
            &base_url,
            "shift.list",
            params,
            &access_key_id,
            &secret_key,
        )
        .await?;
        info!("shiftboard: test_connection succeeded");
        Ok(())
    }

    /// Return the fixed schema produced by extract().
    async fn discover_schema(&self, _cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let fields = vec![
            SchemaField { name: "external_id".into(), data_type: "text".into() },
            SchemaField { name: "name".into(), data_type: "text".into() },
            SchemaField { name: "start_time".into(), data_type: "timestamptz".into() },
            SchemaField { name: "end_time".into(), data_type: "timestamptz".into() },
            SchemaField { name: "employee_id".into(), data_type: "text".into() },
            SchemaField { name: "role_label".into(), data_type: "text".into() },
            SchemaField { name: "shift_external_id".into(), data_type: "text".into() },
            SchemaField { name: "crew_name".into(), data_type: "text".into() },
        ];
        Ok(vec![SchemaTable {
            name: "shifts".into(),
            fields,
        }])
    }

    /// Extract shift records from Shiftboard, with pagination and delta sync.
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let base_url = Self::base_url(cfg);
        let (access_key_id, secret_key) = Self::credentials(cfg)?;

        // Determine whether to use delta sync (shift.listUpdated) or full sync (shift.list).
        let updated_since = cfg
            .watermark_state
            .as_ref()
            .and_then(|ws| ws.get("last_value"))
            .and_then(|v| v.as_str())
            .map(|s| {
                // Watermark is stored as RFC-3339 (e.g. "2026-04-01T18:00:00Z").
                // Shiftboard expects "YYYY-MM-DD HH:MM:SS".
                // Strip trailing Z/offset and replace T with space.
                let base = s.trim_end_matches('Z');
                let base = if let Some(pos) = base.rfind('+') {
                    &base[..pos]
                } else {
                    base
                };
                base.replacen('T', " ", 1)
            });

        let use_delta = updated_since.is_some();
        let method = if use_delta { "shift.listUpdated" } else { "shift.list" };

        let client = reqwest::Client::new();
        let mut records: Vec<SourceRecord> = Vec::new();
        let mut page_start: u64 = 1;

        loop {
            let params = if use_delta {
                serde_json::json!({
                    "updated_since": updated_since.as_deref().unwrap_or(""),
                    "page": { "batch": 25, "start": page_start }
                })
            } else {
                let start_date = cfg
                    .source_config
                    .get("start_date")
                    .and_then(|v| v.as_str())
                    .unwrap_or("2026-01-01");
                let end_date = cfg
                    .source_config
                    .get("end_date")
                    .and_then(|v| v.as_str())
                    .unwrap_or("2026-12-31");
                serde_json::json!({
                    "start_date": start_date,
                    "end_date": end_date,
                    "page": { "batch": 25, "start": page_start }
                })
            };

            let result = jsonrpc_call(
                &client,
                &base_url,
                method,
                params,
                &access_key_id,
                &secret_key,
            )
            .await?;

            let shifts = result
                .get("shifts")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            info!(
                "shiftboard: page {page_start} — {} shifts (method={method})",
                shifts.len()
            );

            for shift in &shifts {
                let id = shift
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let start_raw = match shift.get("start_date").and_then(|v| v.as_str()) {
                    Some(s) => s.to_string(),
                    None => {
                        warn!("shiftboard: shift {id} missing start_date, skipping");
                        continue;
                    }
                };
                let end_raw = match shift.get("end_date").and_then(|v| v.as_str()) {
                    Some(s) => s.to_string(),
                    None => {
                        warn!("shiftboard: shift {id} missing end_date, skipping");
                        continue;
                    }
                };

                let name = shift
                    .get("subject")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let employee_id = shift
                    .get("covering_member")
                    .and_then(|m| {
                        m.get("external_id")
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.is_empty())
                            .or_else(|| m.get("id").and_then(|v| v.as_str()))
                    })
                    .unwrap_or("")
                    .to_string();

                let role_label = shift
                    .get("workgroup")
                    .and_then(|w| w.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let crew_name = shift
                    .get("location")
                    .and_then(|l| l.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let mut fields = std::collections::HashMap::new();
                fields.insert("external_id".into(), JsonValue::String(id.clone()));
                fields.insert("name".into(), JsonValue::String(name));
                fields.insert(
                    "start_time".into(),
                    JsonValue::String(shiftboard_dt_to_rfc3339(&start_raw)),
                );
                fields.insert(
                    "end_time".into(),
                    JsonValue::String(shiftboard_dt_to_rfc3339(&end_raw)),
                );
                fields.insert("employee_id".into(), JsonValue::String(employee_id));
                fields.insert("role_label".into(), JsonValue::String(role_label));
                fields.insert("shift_external_id".into(), JsonValue::String(id));
                fields.insert("crew_name".into(), JsonValue::String(crew_name));

                records.push(SourceRecord {
                    row_number: records.len() as i64 + 1,
                    fields,
                    raw: String::new(),
                });
            }

            // Follow pagination: result.page.next; stop when null/absent.
            match result.get("page").and_then(|p| p.get("next")) {
                Some(JsonValue::Number(n)) => {
                    page_start = n.as_u64().unwrap_or(0);
                    if page_start == 0 {
                        break;
                    }
                }
                _ => break,
            }
        }

        info!("shiftboard: extracted {} total records", records.len());
        Ok(records)
    }
}
