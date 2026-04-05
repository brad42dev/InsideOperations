//! UKG Pro WFM (formerly Kronos) ETL connector.
//!
//! Implements OAuth 2.0 ROPC authentication and schedule extraction via
//! the UKG multi_read scheduling API.

use anyhow::{anyhow, Result};
use serde::Deserialize;
use serde_json::Value as JsonValue;
use tracing::{info, warn};

use super::{EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// Connector struct
// ---------------------------------------------------------------------------

pub struct UkgWfmConnector;

// ---------------------------------------------------------------------------
// Internal response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct ScheduleResponse {
    #[serde(default)]
    shifts: Vec<UkgShift>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UkgShift {
    start_date_time: Option<String>,
    end_date_time: Option<String>,
    label: Option<String>,
    employee_ref: Option<UkgEmployeeRef>,
    #[serde(default)]
    segments: Vec<UkgSegment>,
}

#[derive(Debug, Deserialize)]
struct UkgEmployeeRef {
    qualifier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UkgSegment {
    #[serde(rename = "orgJobRef")]
    org_job_ref: Option<UkgOrgJobRef>,
}

#[derive(Debug, Deserialize)]
struct UkgOrgJobRef {
    qualifier: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper: parse UKG datetime string to RFC-3339
// ---------------------------------------------------------------------------

/// UKG returns datetimes like "2026-04-01T06:00:00.000" (no timezone).
/// We treat them as UTC and convert to RFC-3339.
fn to_rfc3339(s: &str, timezone: &str) -> String {
    // Strip milliseconds fraction if present
    let base = s.split('.').next().unwrap_or(s);
    if timezone.is_empty() || timezone.eq_ignore_ascii_case("utc") {
        format!("{base}Z")
    } else {
        // Caller provides a fixed offset like "+05:30"; just append it.
        // Full tz-database parsing would require chrono-tz (LGPL risk), so we
        // accept only numeric offset strings from source_config.
        format!("{base}{timezone}")
    }
}

// ---------------------------------------------------------------------------
// EtlConnector implementation
// ---------------------------------------------------------------------------

impl UkgWfmConnector {
    fn base_url(cfg: &EtlConnectorConfig) -> Result<String> {
        cfg.connection_config
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(|s| s.trim_end_matches('/').to_string())
            .ok_or_else(|| anyhow!("ukg_wfm: base_url is required in connection config"))
    }

    fn app_key(cfg: &EtlConnectorConfig) -> Option<String> {
        cfg.connection_config
            .get("app_key")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
    }

    /// Acquire an OAuth 2.0 ROPC access token from the UKG token endpoint.
    async fn acquire_token(cfg: &EtlConnectorConfig) -> Result<String> {
        let base = Self::base_url(cfg)?;
        let token_url = format!("{base}/api/authentication/access_token");

        let username = cfg
            .auth_config
            .get("username")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let password = cfg
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let client_id = cfg
            .auth_config
            .get("client_id")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let client_secret = cfg
            .auth_config
            .get("client_secret")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()?;

        let resp = client
            .post(&token_url)
            .form(&[
                ("username", username),
                ("password", password),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("grant_type", "password"),
                ("auth_chain", "OAuthLdapService"),
            ])
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(anyhow!(
                "ukg_wfm: token acquisition failed: HTTP {}",
                resp.status()
            ));
        }

        let token: TokenResponse = resp.json().await?;
        Ok(token.access_token)
    }
}

#[async_trait::async_trait]
impl EtlConnector for UkgWfmConnector {
    fn connector_type(&self) -> &'static str {
        "ukg_wfm"
    }

    /// Test the connection by acquiring an OAuth token.
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let _token = Self::acquire_token(cfg).await?;
        info!("ukg_wfm: test_connection succeeded");
        Ok(())
    }

    /// Return a fixed schema describing the fields produced by extract().
    async fn discover_schema(&self, _cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let fields = vec![
            SchemaField {
                name: "external_id".into(),
                data_type: "text".into(),
            },
            SchemaField {
                name: "name".into(),
                data_type: "text".into(),
            },
            SchemaField {
                name: "start_time".into(),
                data_type: "timestamptz".into(),
            },
            SchemaField {
                name: "end_time".into(),
                data_type: "timestamptz".into(),
            },
            SchemaField {
                name: "employee_id".into(),
                data_type: "text".into(),
            },
            SchemaField {
                name: "role_label".into(),
                data_type: "text".into(),
            },
            SchemaField {
                name: "shift_external_id".into(),
                data_type: "text".into(),
            },
        ];
        Ok(vec![SchemaTable {
            name: "shifts".into(),
            fields,
        }])
    }

    /// Extract shift schedule records from UKG Pro WFM.
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let base = Self::base_url(cfg)?;
        let app_key = Self::app_key(cfg);
        let token = Self::acquire_token(cfg).await?;
        let timezone = cfg
            .source_config
            .get("timezone")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Determine date range — use watermark for delta sync when available.
        // The pipeline stores watermarks as { "last_value": "<RFC-3339>", ... };
        // UKG expects date-only strings ("YYYY-MM-DD"), so we take the first 10 chars.
        let start_date = cfg
            .watermark_state
            .as_ref()
            .and_then(|ws| ws.get("last_value"))
            .and_then(|v| v.as_str())
            .map(|s| s.chars().take(10).collect::<String>())
            .unwrap_or_else(|| {
                cfg.source_config
                    .get("start_date")
                    .and_then(|v| v.as_str())
                    .unwrap_or("2026-01-01")
                    .to_string()
            });

        let end_date = cfg
            .source_config
            .get("end_date")
            .and_then(|v| v.as_str())
            .unwrap_or("2026-12-31")
            .to_string();

        let hyperfind = cfg
            .source_config
            .get("hyperfind_qualifier")
            .and_then(|v| v.as_str())
            .unwrap_or("All Home")
            .to_string();

        let schedule_url = format!("{base}/api/v1/scheduling/schedule/multi_read");
        let body = serde_json::json!({
            "where": {
                "employees": {
                    "hyperfind": { "qualifier": hyperfind },
                    "startDate": start_date,
                    "endDate": end_date
                },
                "excludeBreaks": true
            }
        });

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()?;

        let mut req = client.post(&schedule_url).bearer_auth(&token).json(&body);

        if let Some(ref key) = app_key {
            req = req.header("appkey", key.as_str());
        }

        let resp = req.send().await?;

        if resp.status().as_u16() == 429 {
            let retry = resp
                .headers()
                .get("Retry-After")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("60");
            return Err(anyhow!("ukg_wfm: rate limited; retry after {retry}s"));
        }

        if !resp.status().is_success() {
            return Err(anyhow!(
                "ukg_wfm: schedule multi_read failed: HTTP {}",
                resp.status()
            ));
        }

        let schedule: ScheduleResponse = resp.json().await?;
        info!(
            "ukg_wfm: received {} shifts for {start_date}..{end_date}",
            schedule.shifts.len()
        );

        let mut records: Vec<SourceRecord> = Vec::with_capacity(schedule.shifts.len());

        for shift in &schedule.shifts {
            let start_dt = match &shift.start_date_time {
                Some(s) => s.clone(),
                None => {
                    warn!("ukg_wfm: shift missing startDateTime, skipping");
                    continue;
                }
            };
            let end_dt = match &shift.end_date_time {
                Some(s) => s.clone(),
                None => {
                    warn!("ukg_wfm: shift missing endDateTime, skipping");
                    continue;
                }
            };

            let employee_id = shift
                .employee_ref
                .as_ref()
                .and_then(|r| r.qualifier.as_deref())
                .unwrap_or("")
                .to_string();

            let label = shift.label.as_deref().unwrap_or("").to_string();

            let external_id = format!("{employee_id}_{start_dt}");
            let shift_external_id = format!("{label}_{start_dt}");

            let role_label = shift
                .segments
                .first()
                .and_then(|s| s.org_job_ref.as_ref())
                .and_then(|r| r.qualifier.as_deref())
                .unwrap_or("")
                .to_string();

            let mut fields = std::collections::HashMap::new();
            fields.insert("external_id".into(), JsonValue::String(external_id));
            fields.insert("name".into(), JsonValue::String(label));
            fields.insert(
                "start_time".into(),
                JsonValue::String(to_rfc3339(&start_dt, &timezone)),
            );
            fields.insert(
                "end_time".into(),
                JsonValue::String(to_rfc3339(&end_dt, &timezone)),
            );
            fields.insert("employee_id".into(), JsonValue::String(employee_id));
            fields.insert("role_label".into(), JsonValue::String(role_label));
            fields.insert(
                "shift_external_id".into(),
                JsonValue::String(shift_external_id),
            );

            records.push(SourceRecord {
                row_number: records.len() as i64 + 1,
                fields,
                raw: String::new(),
            });
        }

        Ok(records)
    }
}
