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
    pub body: Option<String>,
    pub severity: String,
    pub source_type: Option<String>,
    pub source_id: Option<Uuid>,
    pub policy_id: Option<Uuid>,
    pub current_tier: i16,
    pub status: String,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlertDelivery {
    pub id: Uuid,
    pub alert_id: Uuid,
    pub tier: i16,
    pub channel: String,
    pub recipient_id: Option<Uuid>,
    pub status: String,
    pub sent_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
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
    pub body: Option<String>,
    pub severity: Option<String>,
    pub source_type: Option<String>,
    pub source_id: Option<Uuid>,
    pub policy_id: Option<Uuid>,
    pub expires_in_mins: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AlertsQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

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

    let expires_at: Option<DateTime<Utc>> = body.expires_in_mins.map(|mins| {
        Utc::now() + chrono::Duration::minutes(mins as i64)
    });

    let alert = sqlx::query_as::<_, AlertInstance>(
        "INSERT INTO alert_instances
             (title, body, severity, source_type, source_id, policy_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, body, severity, source_type, source_id, policy_id,
                   current_tier, status, acknowledged_by, acknowledged_at,
                   resolved_by, resolved_at, created_at, expires_at",
    )
    .bind(body.title.trim())
    .bind(body.body.as_deref())
    .bind(&severity)
    .bind(body.source_type.as_deref())
    .bind(body.source_id)
    .bind(body.policy_id)
    .bind(expires_at)
    .fetch_one(&state.db)
    .await;

    match alert {
        Ok(alert) => {
            // Spawn escalation in background if policy is set
            if alert.policy_id.is_some() {
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

/// GET /alerts — list alert instances, filterable by status/severity
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
                "SELECT id, title, body, severity, source_type, source_id, policy_id,
                        current_tier, status, acknowledged_by, acknowledged_at,
                        resolved_by, resolved_at, created_at, expires_at
                 FROM alert_instances
                 WHERE status = $1 AND severity = $2
                 ORDER BY created_at DESC
                 LIMIT $3 OFFSET $4",
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
                "SELECT id, title, body, severity, source_type, source_id, policy_id,
                        current_tier, status, acknowledged_by, acknowledged_at,
                        resolved_by, resolved_at, created_at, expires_at
                 FROM alert_instances
                 WHERE status = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3",
            )
            .bind(status)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        (None, Some(severity)) => {
            sqlx::query_as::<_, AlertInstance>(
                "SELECT id, title, body, severity, source_type, source_id, policy_id,
                        current_tier, status, acknowledged_by, acknowledged_at,
                        resolved_by, resolved_at, created_at, expires_at
                 FROM alert_instances
                 WHERE severity = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3",
            )
            .bind(severity)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, AlertInstance>(
                "SELECT id, title, body, severity, source_type, source_id, policy_id,
                        current_tier, status, acknowledged_by, acknowledged_at,
                        resolved_by, resolved_at, created_at, expires_at
                 FROM alert_instances
                 ORDER BY created_at DESC
                 LIMIT $1 OFFSET $2",
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
        "SELECT id, title, body, severity, source_type, source_id, policy_id,
                current_tier, status, acknowledged_by, acknowledged_at,
                resolved_by, resolved_at, created_at, expires_at
         FROM alert_instances
         WHERE id = $1",
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
        "SELECT id, alert_id, tier, channel, recipient_id, status, sent_at, error, created_at
         FROM alert_deliveries
         WHERE alert_id = $1
         ORDER BY created_at ASC",
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
        "SELECT id, title, body, severity, source_type, source_id, policy_id,
                current_tier, status, acknowledged_by, acknowledged_at,
                resolved_by, resolved_at, created_at, expires_at
         FROM alert_instances WHERE id = $1",
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
        "UPDATE alert_instances
         SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = now()
         WHERE id = $2
         RETURNING id, title, body, severity, source_type, source_id, policy_id,
                   current_tier, status, acknowledged_by, acknowledged_at,
                   resolved_by, resolved_at, created_at, expires_at",
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(a) => (StatusCode::OK, Json(ApiResponse::ok(a))).into_response(),
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
        "SELECT id, title, body, severity, source_type, source_id, policy_id,
                current_tier, status, acknowledged_by, acknowledged_at,
                resolved_by, resolved_at, created_at, expires_at
         FROM alert_instances WHERE id = $1",
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
        "UPDATE alert_instances
         SET status = 'resolved', resolved_by = $1, resolved_at = now()
         WHERE id = $2
         RETURNING id, title, body, severity, source_type, source_id, policy_id,
                   current_tier, status, acknowledged_by, acknowledged_at,
                   resolved_by, resolved_at, created_at, expires_at",
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match updated {
        Ok(a) => (StatusCode::OK, Json(ApiResponse::ok(a))).into_response(),
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
