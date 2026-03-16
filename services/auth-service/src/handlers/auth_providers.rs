use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

/// Extract permissions from the `x-io-permissions` header injected by the gateway.
fn extract_permissions(headers: &HeaderMap) -> Vec<String> {
    headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').map(|p| p.trim().to_string()).collect())
        .unwrap_or_default()
}

/// Check whether the caller has `system:configure` (or wildcard `*`).
fn require_configure(headers: &HeaderMap) -> IoResult<()> {
    let perms = extract_permissions(headers);
    if perms.iter().any(|p| p == "system:configure" || p == "*") {
        Ok(())
    } else {
        Err(IoError::Forbidden("system:configure permission required".into()))
    }
}

/// Extract the acting user ID from `x-io-user-id` header.
fn extract_user_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

// ---------------------------------------------------------------------------
// Response / request types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct AuthProviderConfig {
    pub id: Uuid,
    pub provider_type: String,
    pub name: String,
    pub display_name: String,
    pub enabled: bool,
    pub config: serde_json::Value,
    pub jit_provisioning: bool,
    pub default_role_id: Option<Uuid>,
    pub display_order: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProviderBody {
    pub provider_type: String,
    pub name: String,
    pub display_name: String,
    pub enabled: Option<bool>,
    pub config: serde_json::Value,
    pub jit_provisioning: Option<bool>,
    pub default_role_id: Option<Uuid>,
    pub display_order: Option<i16>,
}

#[derive(Debug, Serialize)]
pub struct PublicProvider {
    pub id: Uuid,
    pub name: String,
    pub display_name: String,
    pub provider_type: String,
    pub display_order: i16,
}

#[derive(Debug, Serialize)]
pub struct IdpRoleMapping {
    pub id: Uuid,
    pub provider_config_id: Uuid,
    pub idp_group: String,
    pub role_id: Uuid,
    pub match_type: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMappingBody {
    pub idp_group: String,
    pub role_id: Uuid,
    pub match_type: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /auth/providers — public, no auth required
// Returns enabled providers for the login page.
// ---------------------------------------------------------------------------

pub async fn list_public_providers(
    State(state): State<AppState>,
) -> IoResult<impl IntoResponse> {
    let rows = sqlx::query(
        "SELECT id, name, display_name, provider_type, display_order
         FROM auth_provider_configs
         WHERE enabled = true
         ORDER BY display_order, name",
    )
    .fetch_all(&state.db)
    .await?;

    let providers: Vec<PublicProvider> = rows
        .into_iter()
        .map(|r| PublicProvider {
            id: r.get("id"),
            name: r.get("name"),
            display_name: r.get("display_name"),
            provider_type: r.get("provider_type"),
            display_order: r.get("display_order"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(providers)))
}

// ---------------------------------------------------------------------------
// GET /auth/admin/providers — requires system:configure
// ---------------------------------------------------------------------------

pub async fn list_providers(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    let rows = sqlx::query(
        "SELECT id, provider_type, name, display_name, enabled, config,
                jit_provisioning, default_role_id, display_order,
                created_at, updated_at, created_by, updated_by
         FROM auth_provider_configs
         ORDER BY display_order, name",
    )
    .fetch_all(&state.db)
    .await?;

    let providers: Vec<AuthProviderConfig> = rows
        .into_iter()
        .map(row_to_provider_config)
        .collect();

    Ok(Json(ApiResponse::ok(providers)))
}

// ---------------------------------------------------------------------------
// POST /auth/admin/providers — requires system:configure
// ---------------------------------------------------------------------------

pub async fn create_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateProviderBody>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    // Validate provider_type
    if !matches!(body.provider_type.as_str(), "oidc" | "saml" | "ldap") {
        return Err(IoError::BadRequest(
            "provider_type must be one of: oidc, saml, ldap".into(),
        ));
    }

    let acting_user_id = extract_user_id(&headers);
    let enabled = body.enabled.unwrap_or(false);
    let jit_provisioning = body.jit_provisioning.unwrap_or(false);
    let display_order = body.display_order.unwrap_or(0);

    let row = sqlx::query(
        "INSERT INTO auth_provider_configs
            (provider_type, name, display_name, enabled, config,
             jit_provisioning, default_role_id, display_order, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING id, provider_type, name, display_name, enabled, config,
                   jit_provisioning, default_role_id, display_order,
                   created_at, updated_at, created_by, updated_by",
    )
    .bind(&body.provider_type)
    .bind(&body.name)
    .bind(&body.display_name)
    .bind(enabled)
    .bind(&body.config)
    .bind(jit_provisioning)
    .bind(body.default_role_id)
    .bind(display_order)
    .bind(acting_user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            IoError::Conflict(format!("Provider name '{}' already exists", body.name))
        } else {
            IoError::Database(e)
        }
    })?;

    let provider = row_to_provider_config(row);

    Ok((StatusCode::CREATED, Json(ApiResponse::ok(provider))))
}

// ---------------------------------------------------------------------------
// GET /auth/admin/providers/:id — requires system:configure
// ---------------------------------------------------------------------------

pub async fn get_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    let row = sqlx::query(
        "SELECT id, provider_type, name, display_name, enabled, config,
                jit_provisioning, default_role_id, display_order,
                created_at, updated_at, created_by, updated_by
         FROM auth_provider_configs
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Provider {} not found", id)))?;

    Ok(Json(ApiResponse::ok(row_to_provider_config(row))))
}

// ---------------------------------------------------------------------------
// PUT /auth/admin/providers/:id — requires system:configure
// ---------------------------------------------------------------------------

pub async fn update_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateProviderBody>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    if !matches!(body.provider_type.as_str(), "oidc" | "saml" | "ldap") {
        return Err(IoError::BadRequest(
            "provider_type must be one of: oidc, saml, ldap".into(),
        ));
    }

    let acting_user_id = extract_user_id(&headers);
    let enabled = body.enabled.unwrap_or(false);
    let jit_provisioning = body.jit_provisioning.unwrap_or(false);
    let display_order = body.display_order.unwrap_or(0);

    let row = sqlx::query(
        "UPDATE auth_provider_configs
         SET provider_type = $1,
             name = $2,
             display_name = $3,
             enabled = $4,
             config = $5,
             jit_provisioning = $6,
             default_role_id = $7,
             display_order = $8,
             updated_by = $9,
             updated_at = now()
         WHERE id = $10
         RETURNING id, provider_type, name, display_name, enabled, config,
                   jit_provisioning, default_role_id, display_order,
                   created_at, updated_at, created_by, updated_by",
    )
    .bind(&body.provider_type)
    .bind(&body.name)
    .bind(&body.display_name)
    .bind(enabled)
    .bind(&body.config)
    .bind(jit_provisioning)
    .bind(body.default_role_id)
    .bind(display_order)
    .bind(acting_user_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            IoError::Conflict(format!("Provider name '{}' already exists", body.name))
        } else {
            IoError::Database(e)
        }
    })?
    .ok_or_else(|| IoError::NotFound(format!("Provider {} not found", id)))?;

    Ok(Json(ApiResponse::ok(row_to_provider_config(row))))
}

// ---------------------------------------------------------------------------
// DELETE /auth/admin/providers/:id — requires system:configure
// ---------------------------------------------------------------------------

pub async fn delete_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    let result = sqlx::query("DELETE FROM auth_provider_configs WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!("Provider {} not found", id)));
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))))
}

// ---------------------------------------------------------------------------
// GET /auth/admin/providers/:id/mappings — requires system:configure
// ---------------------------------------------------------------------------

pub async fn list_mappings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    // Verify provider exists
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM auth_provider_configs WHERE id = $1)",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(IoError::NotFound(format!("Provider {} not found", id)));
    }

    let rows = sqlx::query(
        "SELECT id, provider_config_id, idp_group, role_id, match_type, created_at
         FROM idp_role_mappings
         WHERE provider_config_id = $1
         ORDER BY idp_group",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let mappings: Vec<IdpRoleMapping> = rows
        .into_iter()
        .map(|r| IdpRoleMapping {
            id: r.get("id"),
            provider_config_id: r.get("provider_config_id"),
            idp_group: r.get("idp_group"),
            role_id: r.get("role_id"),
            match_type: r.get("match_type"),
            created_at: r.get("created_at"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(mappings)))
}

// ---------------------------------------------------------------------------
// POST /auth/admin/providers/:id/mappings — requires system:configure
// ---------------------------------------------------------------------------

pub async fn create_mapping(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateMappingBody>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    let match_type = body.match_type.as_deref().unwrap_or("exact").to_string();
    if !matches!(match_type.as_str(), "exact" | "prefix" | "contains") {
        return Err(IoError::BadRequest(
            "match_type must be one of: exact, prefix, contains".into(),
        ));
    }

    let row = sqlx::query(
        "INSERT INTO idp_role_mappings (provider_config_id, idp_group, role_id, match_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, provider_config_id, idp_group, role_id, match_type, created_at",
    )
    .bind(id)
    .bind(&body.idp_group)
    .bind(body.role_id)
    .bind(&match_type)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique") {
            IoError::Conflict("Mapping already exists for this group and role".into())
        } else if e.to_string().contains("foreign key") {
            IoError::BadRequest("Provider or role not found".into())
        } else {
            IoError::Database(e)
        }
    })?;

    let mapping = IdpRoleMapping {
        id: row.get("id"),
        provider_config_id: row.get("provider_config_id"),
        idp_group: row.get("idp_group"),
        role_id: row.get("role_id"),
        match_type: row.get("match_type"),
        created_at: row.get("created_at"),
    };

    Ok((StatusCode::CREATED, Json(ApiResponse::ok(mapping))))
}

// ---------------------------------------------------------------------------
// DELETE /auth/admin/providers/:id/mappings/:mapping_id — requires system:configure
// ---------------------------------------------------------------------------

pub async fn delete_mapping(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, mapping_id)): Path<(Uuid, Uuid)>,
) -> IoResult<impl IntoResponse> {
    require_configure(&headers)?;

    let result = sqlx::query(
        "DELETE FROM idp_role_mappings WHERE id = $1 AND provider_config_id = $2",
    )
    .bind(mapping_id)
    .bind(id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!("Mapping {} not found", mapping_id)));
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))))
}

// ---------------------------------------------------------------------------
// Helper: map a sqlx Row to AuthProviderConfig
// ---------------------------------------------------------------------------

fn row_to_provider_config(r: sqlx::postgres::PgRow) -> AuthProviderConfig {
    AuthProviderConfig {
        id: r.get("id"),
        provider_type: r.get("provider_type"),
        name: r.get("name"),
        display_name: r.get("display_name"),
        enabled: r.get("enabled"),
        config: r.get("config"),
        jit_provisioning: r.get("jit_provisioning"),
        default_role_id: r.get("default_role_id"),
        display_order: r.get("display_order"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
        created_by: r.get("created_by"),
        updated_by: r.get("updated_by"),
    }
}
