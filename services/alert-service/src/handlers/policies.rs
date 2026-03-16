use axum::{
    extract::{Path, State},
    http::StatusCode,
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
pub struct EscalationPolicy {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct EscalationPolicyWithTiers {
    #[serde(flatten)]
    pub policy: EscalationPolicy,
    pub tiers: Vec<EscalationTier>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EscalationTier {
    pub id: Uuid,
    pub policy_id: Uuid,
    pub tier_order: i16,
    pub escalate_after_mins: i16,
    pub notify_groups: Vec<Uuid>,
    pub notify_users: Vec<Uuid>,
    pub channels: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePolicyBody {
    pub name: String,
    pub description: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePolicyBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTierBody {
    pub tier_order: Option<i16>,
    pub escalate_after_mins: Option<i16>,
    pub notify_groups: Option<Vec<Uuid>>,
    pub notify_users: Option<Vec<Uuid>>,
    pub channels: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTierBody {
    pub tier_order: Option<i16>,
    pub escalate_after_mins: Option<i16>,
    pub notify_groups: Option<Vec<Uuid>>,
    pub notify_users: Option<Vec<Uuid>>,
    pub channels: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// Policy CRUD
// ---------------------------------------------------------------------------

/// GET /alerts/policies — list all escalation policies
pub async fn list_policies(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, EscalationPolicy>(
        "SELECT id, name, description, enabled, created_at, updated_at
         FROM escalation_policies
         ORDER BY name ASC",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(policies) => (
            StatusCode::OK,
            Json(ApiResponse::ok(policies)),
        )
            .into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/policies — create escalation policy
pub async fn create_policy(
    State(state): State<AppState>,
    Json(body): Json<CreatePolicyBody>,
) -> impl IntoResponse {
    if body.name.trim().is_empty() {
        return IoError::field("name", "Name is required").into_response();
    }

    let enabled = body.enabled.unwrap_or(true);

    let row = sqlx::query_as::<_, EscalationPolicy>(
        "INSERT INTO escalation_policies (name, description, enabled)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, enabled, created_at, updated_at",
    )
    .bind(body.name.trim())
    .bind(body.description.as_deref())
    .bind(enabled)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(policy) => (StatusCode::CREATED, Json(ApiResponse::ok(policy))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// GET /alerts/policies/:id — get policy with its tiers
pub async fn get_policy(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let policy = sqlx::query_as::<_, EscalationPolicy>(
        "SELECT id, name, description, enabled, created_at, updated_at
         FROM escalation_policies
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let policy = match policy {
        Ok(Some(p)) => p,
        Ok(None) => {
            return IoError::NotFound(format!("Policy {} not found", id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    let tiers = fetch_tiers_for_policy(&state, id).await;
    let tiers = match tiers {
        Ok(t) => t,
        Err(e) => return IoError::Database(e).into_response(),
    };

    (
        StatusCode::OK,
        Json(ApiResponse::ok(EscalationPolicyWithTiers { policy, tiers })),
    )
        .into_response()
}

/// PUT /alerts/policies/:id — update policy
pub async fn update_policy(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePolicyBody>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, EscalationPolicy>(
        "SELECT id, name, description, enabled, created_at, updated_at
         FROM escalation_policies WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let existing = match existing {
        Ok(Some(p)) => p,
        Ok(None) => {
            return IoError::NotFound(format!("Policy {} not found", id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    let name = body.name.as_deref().unwrap_or(&existing.name).to_string();
    let description = body.description.as_ref().or(existing.description.as_ref()).cloned();
    let enabled = body.enabled.unwrap_or(existing.enabled);

    let row = sqlx::query_as::<_, EscalationPolicy>(
        "UPDATE escalation_policies
         SET name = $1, description = $2, enabled = $3, updated_at = now()
         WHERE id = $4
         RETURNING id, name, description, enabled, created_at, updated_at",
    )
    .bind(&name)
    .bind(description.as_deref())
    .bind(enabled)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(policy) => (StatusCode::OK, Json(ApiResponse::ok(policy))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// DELETE /alerts/policies/:id — delete policy
pub async fn delete_policy(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM escalation_policies WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Policy {} not found", id)).into_response()
        }
        Ok(_) => (
            StatusCode::OK,
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))),
        )
            .into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Tier CRUD
// ---------------------------------------------------------------------------

/// GET /alerts/policies/:id/tiers — list tiers for policy
pub async fn list_tiers(
    State(state): State<AppState>,
    Path(policy_id): Path<Uuid>,
) -> impl IntoResponse {
    // Check policy exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM escalation_policies WHERE id = $1)",
    )
    .bind(policy_id)
    .fetch_one(&state.db)
    .await;

    match exists {
        Ok(false) => {
            return IoError::NotFound(format!("Policy {} not found", policy_id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
        _ => {}
    }

    let tiers = fetch_tiers_for_policy(&state, policy_id).await;
    match tiers {
        Ok(t) => (StatusCode::OK, Json(ApiResponse::ok(t))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/policies/:id/tiers — add tier to policy
pub async fn create_tier(
    State(state): State<AppState>,
    Path(policy_id): Path<Uuid>,
    Json(body): Json<CreateTierBody>,
) -> impl IntoResponse {
    // Validate policy exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM escalation_policies WHERE id = $1)",
    )
    .bind(policy_id)
    .fetch_one(&state.db)
    .await;

    match exists {
        Ok(false) => {
            return IoError::NotFound(format!("Policy {} not found", policy_id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
        _ => {}
    }

    let tier_order = body.tier_order.unwrap_or(1);
    let escalate_after_mins = body.escalate_after_mins.unwrap_or(15);
    let notify_groups = body.notify_groups.unwrap_or_default();
    let notify_users = body.notify_users.unwrap_or_default();
    let channels = body
        .channels
        .unwrap_or_else(|| vec!["email".to_string(), "websocket".to_string()]);

    let row = sqlx::query_as::<_, EscalationTier>(
        "INSERT INTO escalation_tiers
             (policy_id, tier_order, escalate_after_mins, notify_groups, notify_users, channels)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, policy_id, tier_order, escalate_after_mins, notify_groups, notify_users, channels",
    )
    .bind(policy_id)
    .bind(tier_order)
    .bind(escalate_after_mins)
    .bind(&notify_groups)
    .bind(&notify_users)
    .bind(&channels)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(tier) => (StatusCode::CREATED, Json(ApiResponse::ok(tier))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// PUT /alerts/policies/:id/tiers/:tier_id — update tier
pub async fn update_tier(
    State(state): State<AppState>,
    Path((policy_id, tier_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateTierBody>,
) -> impl IntoResponse {
    let existing = sqlx::query_as::<_, EscalationTier>(
        "SELECT id, policy_id, tier_order, escalate_after_mins, notify_groups, notify_users, channels
         FROM escalation_tiers
         WHERE id = $1 AND policy_id = $2",
    )
    .bind(tier_id)
    .bind(policy_id)
    .fetch_optional(&state.db)
    .await;

    let existing = match existing {
        Ok(Some(t)) => t,
        Ok(None) => {
            return IoError::NotFound(format!("Tier {} not found in policy {}", tier_id, policy_id))
                .into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    let tier_order = body.tier_order.unwrap_or(existing.tier_order);
    let escalate_after_mins = body.escalate_after_mins.unwrap_or(existing.escalate_after_mins);
    let notify_groups = body.notify_groups.unwrap_or(existing.notify_groups);
    let notify_users = body.notify_users.unwrap_or(existing.notify_users);
    let channels = body.channels.unwrap_or(existing.channels);

    let row = sqlx::query_as::<_, EscalationTier>(
        "UPDATE escalation_tiers
         SET tier_order = $1, escalate_after_mins = $2,
             notify_groups = $3, notify_users = $4, channels = $5
         WHERE id = $6 AND policy_id = $7
         RETURNING id, policy_id, tier_order, escalate_after_mins, notify_groups, notify_users, channels",
    )
    .bind(tier_order)
    .bind(escalate_after_mins)
    .bind(&notify_groups)
    .bind(&notify_users)
    .bind(&channels)
    .bind(tier_id)
    .bind(policy_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(tier) => (StatusCode::OK, Json(ApiResponse::ok(tier))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// DELETE /alerts/policies/:id/tiers/:tier_id — delete tier
pub async fn delete_tier(
    State(state): State<AppState>,
    Path((policy_id, tier_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let result =
        sqlx::query("DELETE FROM escalation_tiers WHERE id = $1 AND policy_id = $2")
            .bind(tier_id)
            .bind(policy_id)
            .execute(&state.db)
            .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Tier {} not found in policy {}", tier_id, policy_id))
                .into_response()
        }
        Ok(_) => (
            StatusCode::OK,
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))),
        )
            .into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

pub async fn fetch_tiers_for_policy(
    state: &AppState,
    policy_id: Uuid,
) -> Result<Vec<EscalationTier>, sqlx::Error> {
    sqlx::query_as::<_, EscalationTier>(
        "SELECT id, policy_id, tier_order, escalate_after_mins, notify_groups, notify_users, channels
         FROM escalation_tiers
         WHERE policy_id = $1
         ORDER BY tier_order ASC",
    )
    .bind(policy_id)
    .fetch_all(&state.db)
    .await
}
