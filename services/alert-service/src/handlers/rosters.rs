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
pub struct AlertRoster {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub source_config: Option<serde_json::Value>,
    pub members: Option<serde_json::Value>,
    pub built_in: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
}

/// A resolved channel recipient — the email address, phone number, or other
/// contact detail needed to deliver a notification to a specific user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelRecipient {
    pub user_id: Option<Uuid>,
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRosterBody {
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub source_config: Option<serde_json::Value>,
    pub members: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRosterBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub source: Option<String>,
    pub source_config: Option<serde_json::Value>,
    pub members: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// CRUD handlers
// ---------------------------------------------------------------------------

/// GET /alerts/rosters — list all recipient rosters
pub async fn list_rosters(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, AlertRoster>(
        "SELECT id, name, description, source, source_config, members, built_in,
                created_at, updated_at, created_by, updated_by
         FROM alert_rosters
         ORDER BY built_in DESC, name ASC",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rosters) => (StatusCode::OK, Json(ApiResponse::ok(rosters))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// GET /alerts/rosters/:id — get a single roster
pub async fn get_roster(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query_as::<_, AlertRoster>(
        "SELECT id, name, description, source, source_config, members, built_in,
                created_at, updated_at, created_by, updated_by
         FROM alert_rosters
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(roster)) => (StatusCode::OK, Json(ApiResponse::ok(roster))).into_response(),
        Ok(None) => IoError::NotFound(format!("Alert roster {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/rosters — create a new roster
pub async fn create_roster(
    State(state): State<AppState>,
    Json(body): Json<CreateRosterBody>,
) -> impl IntoResponse {
    // Validate source value
    if !is_valid_source(&body.source) {
        return IoError::field(
            "source",
            format!(
                "Invalid source '{}'. Must be one of: manual, role_group, all_users, on_shift, on_site",
                body.source
            ),
        )
        .into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::field("name", "Name is required").into_response();
    }

    let row = sqlx::query_as::<_, AlertRoster>(
        "INSERT INTO alert_rosters (name, description, source, source_config, members)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, source, source_config, members, built_in,
                   created_at, updated_at, created_by, updated_by",
    )
    .bind(body.name.trim())
    .bind(body.description.as_deref())
    .bind(&body.source)
    .bind(&body.source_config)
    .bind(&body.members)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(roster) => (StatusCode::CREATED, Json(ApiResponse::ok(roster))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// PUT /alerts/rosters/:id — update an existing roster
pub async fn update_roster(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRosterBody>,
) -> impl IntoResponse {
    // Validate source if provided
    if let Some(ref source) = body.source {
        if !is_valid_source(source) {
            return IoError::field(
                "source",
                format!(
                    "Invalid source '{}'. Must be one of: manual, role_group, all_users, on_shift, on_site",
                    source
                ),
            )
            .into_response();
        }
    }

    let row = sqlx::query_as::<_, AlertRoster>(
        "UPDATE alert_rosters
         SET name          = COALESCE($2, name),
             description   = COALESCE($3, description),
             source        = COALESCE($4, source),
             source_config = COALESCE($5, source_config),
             members       = COALESCE($6, members),
             updated_at    = NOW()
         WHERE id = $1
         RETURNING id, name, description, source, source_config, members, built_in,
                   created_at, updated_at, created_by, updated_by",
    )
    .bind(id)
    .bind(body.name.as_deref().map(|n| n.trim()))
    .bind(body.description.as_deref())
    .bind(body.source.as_deref())
    .bind(&body.source_config)
    .bind(&body.members)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(roster)) => (StatusCode::OK, Json(ApiResponse::ok(roster))).into_response(),
        Ok(None) => IoError::NotFound(format!("Alert roster {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// DELETE /alerts/rosters/:id — delete a roster (built-in rosters return 409)
pub async fn delete_roster(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Check if roster exists and whether it is built-in
    let check = sqlx::query_scalar::<_, bool>(
        "SELECT built_in FROM alert_rosters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match check {
        Ok(None) => {
            return IoError::NotFound(format!("Alert roster {} not found", id)).into_response()
        }
        Ok(Some(true)) => {
            // Built-in rosters cannot be deleted — return 409 Conflict
            return IoError::Conflict(
                "Built-in rosters cannot be deleted".to_string(),
            )
            .into_response();
        }
        Ok(Some(false)) => {}
        Err(e) => return IoError::Database(e).into_response(),
    }

    let result = sqlx::query("DELETE FROM alert_rosters WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Roster member resolution
// ---------------------------------------------------------------------------

/// Resolve the members of a roster into concrete channel recipients.
///
/// Supports the following roster sources:
/// - `manual`     — members JSONB deserialized directly from the roster record
/// - `role_group` — queries users whose role name/id matches source_config
/// - `all_users`  — all active users in the system
/// - `on_shift`   — TODO: integrate with access-control-service when available
/// - `on_site`    — TODO: integrate with access-control-service when available
pub async fn resolve_roster_members(
    state: &AppState,
    roster_id: Uuid,
) -> Vec<ChannelRecipient> {
    let roster = sqlx::query_as::<_, AlertRoster>(
        "SELECT id, name, description, source, source_config, members, built_in,
                created_at, updated_at, created_by, updated_by
         FROM alert_rosters
         WHERE id = $1",
    )
    .bind(roster_id)
    .fetch_optional(&state.db)
    .await;

    let roster = match roster {
        Ok(Some(r)) => r,
        Ok(None) => {
            tracing::warn!(roster_id = %roster_id, "resolve_roster_members: roster not found");
            return vec![];
        }
        Err(e) => {
            tracing::error!(roster_id = %roster_id, error = %e, "resolve_roster_members: db error");
            return vec![];
        }
    };

    match roster.source.as_str() {
        "manual" => resolve_manual(&roster),
        "role_group" => resolve_role_group(state, &roster).await,
        "all_users" => resolve_all_users(state).await,
        "on_shift" | "on_site" => {
            // TODO: query access-control-service when the presence/shift integration is built.
            // Until then, return an empty list to avoid blocking alert dispatch.
            tracing::warn!(
                roster_id = %roster_id,
                source = %roster.source,
                "resolve_roster_members: on_shift/on_site roster resolution not yet implemented"
            );
            vec![]
        }
        other => {
            tracing::warn!(
                roster_id = %roster_id,
                source = other,
                "resolve_roster_members: unknown roster source"
            );
            vec![]
        }
    }
}

/// Deserialize `members` JSONB from a manual roster.
fn resolve_manual(roster: &AlertRoster) -> Vec<ChannelRecipient> {
    match &roster.members {
        Some(members) => {
            match serde_json::from_value::<Vec<ChannelRecipient>>(members.clone()) {
                Ok(recipients) => recipients,
                Err(e) => {
                    tracing::error!(
                        roster_id = %roster.id,
                        error = %e,
                        "resolve_manual: failed to deserialize members JSONB"
                    );
                    vec![]
                }
            }
        }
        None => vec![],
    }
}

/// Query users that belong to a specific role, identified by role_name or role_id in source_config.
async fn resolve_role_group(state: &AppState, roster: &AlertRoster) -> Vec<ChannelRecipient> {
    let role_id: Option<Uuid> = roster
        .source_config
        .as_ref()
        .and_then(|cfg| cfg.get("role_id"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok());

    let role_name: Option<&str> = roster
        .source_config
        .as_ref()
        .and_then(|cfg| cfg.get("role_name"))
        .and_then(|v| v.as_str());

    if let Some(rid) = role_id {
        // Use role_id for direct lookup
        let sql_rows = sqlx::query(
            "SELECT u.id, u.display_name, u.email
             FROM users u
             JOIN user_roles_lookup url ON url.user_id = u.id
             WHERE url.role_id = $1
               AND u.status = 'active'",
        )
        .bind(rid)
        .fetch_all(&state.db)
        .await;

        match sql_rows {
            Ok(rows) => rows
                .iter()
                .map(|r| {
                    use sqlx::Row;
                    ChannelRecipient {
                        user_id: Some(r.get("id")),
                        name: r.try_get("display_name").unwrap_or(None),
                        email: Some(r.get("email")),
                    }
                })
                .collect(),
            Err(e) => {
                tracing::error!(roster_id = %roster.id, error = %e, "resolve_role_group: db error (role_id)");
                vec![]
            }
        }
    } else if let Some(rname) = role_name {
        // Use role_name for lookup via JOIN to roles table
        let sql_rows = sqlx::query(
            "SELECT u.id, u.display_name, u.email
             FROM users u
             JOIN user_roles_lookup url ON url.user_id = u.id
             JOIN roles r ON r.id = url.role_id
             WHERE r.name = $1
               AND u.status = 'active'",
        )
        .bind(rname)
        .fetch_all(&state.db)
        .await;

        match sql_rows {
            Ok(rows) => rows
                .iter()
                .map(|r| {
                    use sqlx::Row;
                    ChannelRecipient {
                        user_id: Some(r.get("id")),
                        name: r.try_get("display_name").unwrap_or(None),
                        email: Some(r.get("email")),
                    }
                })
                .collect(),
            Err(e) => {
                tracing::error!(roster_id = %roster.id, error = %e, "resolve_role_group: db error (role_name)");
                vec![]
            }
        }
    } else {
        tracing::warn!(
            roster_id = %roster.id,
            "resolve_role_group: source_config missing both role_id and role_name"
        );
        vec![]
    }
}

/// Query all active users in the system.
async fn resolve_all_users(state: &AppState) -> Vec<ChannelRecipient> {
    let rows = sqlx::query(
        "SELECT id, display_name, email
         FROM users
         WHERE status = 'active'
         ORDER BY display_name ASC",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => rows
            .iter()
            .map(|r| {
                use sqlx::Row;
                ChannelRecipient {
                    user_id: Some(r.get("id")),
                    name: r.try_get("display_name").unwrap_or(None),
                    email: Some(r.get("email")),
                }
            })
            .collect(),
        Err(e) => {
            tracing::error!(error = %e, "resolve_all_users: db error");
            vec![]
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn is_valid_source(source: &str) -> bool {
    matches!(source, "manual" | "role_group" | "all_users" | "on_shift" | "on_site")
}
