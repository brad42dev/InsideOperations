use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlertInstance {
    pub id: Uuid,
    pub title: String,
    pub message: String,
    pub severity: String,
    pub source: String,
    pub source_reference_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub roster_id: Option<Uuid>,
    pub escalation_policy: Option<serde_json::Value>,
    pub current_escalation: i16,
    pub channels_used: Vec<String>,
    pub status: String,
    pub triggered_by: Option<Uuid>,
    pub triggered_at: DateTime<Utc>,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub cancelled_by: Option<Uuid>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlertDelivery {
    pub id: Uuid,
    pub alert_id: Uuid,
    pub channel_type: String,
    pub recipient_user_id: Option<Uuid>,
    pub recipient_name: Option<String>,
    pub recipient_contact: Option<String>,
    pub status: String,
    pub sent_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub failure_reason: Option<String>,
    pub external_id: Option<String>,
    pub escalation_level: i16,
}

#[derive(Debug, Serialize)]
pub struct AlertWithDeliveries {
    #[serde(flatten)]
    pub alert: AlertInstance,
    pub deliveries: Vec<AlertDelivery>,
}

#[derive(Debug, Deserialize)]
pub struct TriggerAlertBody {
    pub title: String,
    pub message: Option<String>,
    pub severity: Option<String>,
    pub source: Option<String>,
    pub source_reference_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub template_variables: Option<serde_json::Value>,
    pub roster_id: Option<Uuid>,
    pub channels: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AlertsQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ---------------------------------------------------------------------------
// Helpers — column list shared by all SELECT queries
// ---------------------------------------------------------------------------

const ALERT_COLUMNS: &str = "id, title, message, severity, source, source_reference_id,
        template_id, roster_id, escalation_policy, current_escalation, channels_used,
        status, triggered_by, triggered_at, acknowledged_by, acknowledged_at,
        resolved_by, resolved_at, cancelled_by, cancelled_at, metadata";

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /alerts/trigger — create an alert and start escalation
pub async fn trigger_alert(
    State(state): State<AppState>,
    Json(body): Json<TriggerAlertBody>,
) -> impl IntoResponse {
    if body.title.trim().is_empty() {
        return IoError::field("title", "Title is required").into_response();
    }

    let severity = body
        .severity
        .as_deref()
        .unwrap_or("info")
        .to_string();

    // Validate severity
    if !["emergency", "critical", "warning", "info"].contains(&severity.as_str()) {
        return IoError::field(
            "severity",
            "Must be one of: emergency, critical, warning, info",
        )
        .into_response();
    }

    let message = body.message.clone().unwrap_or_default();
    let source = body.source.clone().unwrap_or_else(|| "manual".to_string());
    let channels_used: Vec<String> = body.channels.clone().unwrap_or_else(|| vec!["websocket".to_string()]);

    let alert = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "INSERT INTO alerts
                 (title, message, severity, source, source_reference_id,
                  template_id, roster_id, channels_used)
             VALUES ($1, $2, $3::alert_severity, $4, $5, $6, $7, $8)
             RETURNING {ALERT_COLUMNS}"
        ),
    )
    .bind(body.title.trim())
    .bind(&message)
    .bind(&severity)
    .bind(&source)
    .bind(body.source_reference_id)
    .bind(body.template_id)
    .bind(body.roster_id)
    .bind(&channels_used)
    .fetch_one(&state.db)
    .await;

    match alert {
        Ok(alert) => {
            // Spawn escalation in background if escalation_policy is set
            if alert.escalation_policy.is_some() {
                let state_clone = state.clone();
                let alert_id = alert.id;
                tokio::spawn(async move {
                    super::escalation::dispatch_tier(state_clone, alert_id, 1).await;
                });
            }
            (StatusCode::CREATED, Json(ApiResponse::ok(alert))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// GET /alerts — list alerts, filterable by status/severity
pub async fn list_alerts(
    State(state): State<AppState>,
    Query(params): Query<AlertsQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);

    // Build query dynamically based on filters
    let alerts = match (&params.status, &params.severity) {
        (Some(status), Some(severity)) => {
            sqlx::query_as::<_, AlertInstance>(
                &format!(
                    "SELECT {ALERT_COLUMNS}
                     FROM alerts
                     WHERE status = $1::alert_status AND severity = $2::alert_severity
                     ORDER BY triggered_at DESC
                     LIMIT $3 OFFSET $4"
                ),
            )
            .bind(status)
            .bind(severity)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        (Some(status), None) => {
            sqlx::query_as::<_, AlertInstance>(
                &format!(
                    "SELECT {ALERT_COLUMNS}
                     FROM alerts
                     WHERE status = $1::alert_status
                     ORDER BY triggered_at DESC
                     LIMIT $2 OFFSET $3"
                ),
            )
            .bind(status)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        (None, Some(severity)) => {
            sqlx::query_as::<_, AlertInstance>(
                &format!(
                    "SELECT {ALERT_COLUMNS}
                     FROM alerts
                     WHERE severity = $1::alert_severity
                     ORDER BY triggered_at DESC
                     LIMIT $2 OFFSET $3"
                ),
            )
            .bind(severity)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, AlertInstance>(
                &format!(
                    "SELECT {ALERT_COLUMNS}
                     FROM alerts
                     ORDER BY triggered_at DESC
                     LIMIT $1 OFFSET $2"
                ),
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
    };

    match alerts {
        Ok(data) => (StatusCode::OK, Json(ApiResponse::ok(data))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// GET /alerts/:id — get alert with deliveries
pub async fn get_alert(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let alert = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "SELECT {ALERT_COLUMNS}
             FROM alerts
             WHERE id = $1"
        ),
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let alert = match alert {
        Ok(Some(a)) => a,
        Ok(None) => return IoError::NotFound(format!("Alert {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let deliveries = sqlx::query_as::<_, AlertDelivery>(
        "SELECT id, alert_id, channel_type, recipient_user_id, recipient_name,
                recipient_contact, status, sent_at, delivered_at, acknowledged_at,
                failure_reason, external_id, escalation_level
         FROM alert_deliveries
         WHERE alert_id = $1
         ORDER BY sent_at ASC NULLS LAST",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    let deliveries = match deliveries {
        Ok(d) => d,
        Err(e) => return IoError::Database(e).into_response(),
    };

    (
        StatusCode::OK,
        Json(ApiResponse::ok(AlertWithDeliveries { alert, deliveries })),
    )
        .into_response()
}

/// POST /alerts/:id/acknowledge — mark alert as acknowledged
pub async fn acknowledge_alert(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = extract_user_id(&headers);

    // Verify alert exists and is active
    let alert = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "SELECT {ALERT_COLUMNS}
             FROM alerts WHERE id = $1"
        ),
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let alert = match alert {
        Ok(Some(a)) => a,
        Ok(None) => return IoError::NotFound(format!("Alert {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    if alert.status == "acknowledged" {
        return IoError::BadRequest("Alert already acknowledged".to_string()).into_response();
    }
    if alert.status == "resolved" {
        return IoError::BadRequest("Cannot acknowledge a resolved alert".to_string())
            .into_response();
    }

    let updated = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "UPDATE alerts
             SET status = 'acknowledged'::alert_status,
                 acknowledged_by = $1,
                 acknowledged_at = now()
             WHERE id = $2
             RETURNING {ALERT_COLUMNS}"
        ),
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(a) => {
            // Cancel any pending escalation timer for this alert
            if let Some((_, token)) = state.escalation_tokens.remove(&id) {
                token.cancel();
            }

            // Broadcast alert_acknowledged to all connected WebSocket sessions
            // so every open window can dismiss any overlay.
            let ack_payload = serde_json::json!({
                "type": "alert_acknowledged",
                "payload": {
                    "alert_id": id,
                    "acknowledged_by": user_id,
                    "acknowledged_by_name": null,
                    "acknowledged_at": a.acknowledged_at,
                }
            });
            let broker_url = format!(
                "{}/internal/broadcast",
                state.config.data_broker_url
            );
            let http = state.http.clone();
            let secret = state.config.service_secret.clone();
            tokio::spawn(async move {
                let result = http
                    .post(&broker_url)
                    .header("x-io-service-secret", &secret)
                    .json(&ack_payload)
                    .send()
                    .await;
                match result {
                    Ok(resp) if resp.status().is_success() => {
                        tracing::info!(
                            alert_id = %id,
                            "acknowledge_alert: alert_acknowledged broadcast sent"
                        );
                    }
                    Ok(resp) => {
                        tracing::warn!(
                            alert_id = %id,
                            status_code = resp.status().as_u16(),
                            "acknowledge_alert: alert_acknowledged broadcast failed"
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            alert_id = %id,
                            error = %e,
                            "acknowledge_alert: alert_acknowledged broadcast request error"
                        );
                    }
                }
            });

            (StatusCode::OK, Json(ApiResponse::ok(a))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/:id/resolve — mark alert as resolved
pub async fn resolve_alert(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = extract_user_id(&headers);

    let alert = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "SELECT {ALERT_COLUMNS}
             FROM alerts WHERE id = $1"
        ),
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let alert = match alert {
        Ok(Some(a)) => a,
        Ok(None) => return IoError::NotFound(format!("Alert {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    if alert.status == "resolved" {
        return IoError::BadRequest("Alert already resolved".to_string()).into_response();
    }

    let updated = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "UPDATE alerts
             SET status = 'resolved'::alert_status,
                 resolved_by = $1,
                 resolved_at = now()
             WHERE id = $2
             RETURNING {ALERT_COLUMNS}"
        ),
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(a) => {
            // Cancel any pending escalation timer for this alert
            if let Some((_, token)) = state.escalation_tokens.remove(&id) {
                token.cancel();
            }
            (StatusCode::OK, Json(ApiResponse::ok(a))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/:id/cancel — mark alert as cancelled
pub async fn cancel_alert(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = extract_user_id(&headers);

    let alert = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "SELECT {ALERT_COLUMNS}
             FROM alerts WHERE id = $1"
        ),
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let alert = match alert {
        Ok(Some(a)) => a,
        Ok(None) => return IoError::NotFound(format!("Alert {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    if alert.status == "cancelled" {
        return IoError::BadRequest("Alert already cancelled".to_string()).into_response();
    }
    if alert.status == "resolved" {
        return IoError::BadRequest("Cannot cancel a resolved alert".to_string()).into_response();
    }

    let updated = sqlx::query_as::<_, AlertInstance>(
        &format!(
            "UPDATE alerts
             SET status = 'cancelled'::alert_status,
                 cancelled_by = $1,
                 cancelled_at = now()
             WHERE id = $2
             RETURNING {ALERT_COLUMNS}"
        ),
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(a) => {
            // Cancel any pending escalation timer for this alert
            if let Some((_, token)) = state.escalation_tokens.remove(&id) {
                token.cancel();
            }
            (StatusCode::OK, Json(ApiResponse::ok(a))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_user_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<Uuid>().ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn is_valid_severity(severity: &str) -> bool {
        matches!(severity, "emergency" | "critical" | "warning" | "info")
    }

    fn standard_escalation_delay_mins(tier: i16) -> Option<u64> {
        match tier {
            1 => Some(1),
            2 => Some(5),
            3 => Some(15),
            4 => Some(30),
            _ => None,
        }
    }

    // --- is_valid_severity ---

    #[test]
    fn valid_severity_strings_are_accepted() {
        for sev in ["emergency", "critical", "warning", "info"] {
            assert!(
                is_valid_severity(sev),
                "\"{sev}\" must be a valid severity"
            );
        }
    }

    #[test]
    fn invalid_severity_strings_are_rejected() {
        for sev in ["", "urgent", "CRITICAL", "high", "low", " info"] {
            assert!(
                !is_valid_severity(sev),
                "\"{sev}\" must NOT be a valid severity"
            );
        }
    }

    // --- standard_escalation_delay_mins ---

    #[test]
    fn tier_1_fires_after_1_minute() {
        assert_eq!(standard_escalation_delay_mins(1), Some(1));
    }

    #[test]
    fn tier_2_fires_after_5_minutes() {
        assert_eq!(standard_escalation_delay_mins(2), Some(5));
    }

    #[test]
    fn tier_3_fires_after_15_minutes() {
        assert_eq!(standard_escalation_delay_mins(3), Some(15));
    }

    #[test]
    fn tier_4_fires_after_30_minutes() {
        assert_eq!(standard_escalation_delay_mins(4), Some(30));
    }

    #[test]
    fn tier_beyond_schedule_returns_none() {
        assert!(
            standard_escalation_delay_mins(5).is_none(),
            "Tier 5 exceeds the four-tier standard schedule"
        );
        assert!(standard_escalation_delay_mins(0).is_none());
    }

    #[test]
    fn escalation_delay_increases_monotonically() {
        let delays: Vec<u64> = (1i16..=4)
            .map(|t| standard_escalation_delay_mins(t).unwrap())
            .collect();
        for pair in delays.windows(2) {
            assert!(
                pair[1] > pair[0],
                "Each escalation tier must have a longer delay than the previous: {:?}",
                delays
            );
        }
    }

    // --- extract_user_id ---

    #[test]
    fn extract_user_id_returns_some_for_valid_uuid_header() {
        let mut headers = HeaderMap::new();
        let id = Uuid::new_v4();
        headers.insert(
            "x-io-user-id",
            HeaderValue::from_str(&id.to_string()).unwrap(),
        );
        assert_eq!(extract_user_id(&headers), Some(id));
    }

    #[test]
    fn extract_user_id_returns_none_when_header_absent() {
        let headers = HeaderMap::new();
        assert!(extract_user_id(&headers).is_none());
    }

    #[test]
    fn extract_user_id_returns_none_for_malformed_uuid() {
        let mut headers = HeaderMap::new();
        headers.insert("x-io-user-id", HeaderValue::from_static("not-a-uuid"));
        assert!(extract_user_id(&headers).is_none());
    }
}
