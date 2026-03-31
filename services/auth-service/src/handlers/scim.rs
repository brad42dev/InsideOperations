use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// SCIM 2.0 Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct ScimUser {
    pub schemas: Vec<String>,
    pub id: Option<String>,
    #[serde(rename = "userName")]
    pub user_name: String,
    pub name: Option<ScimName>,
    pub emails: Option<Vec<ScimEmail>>,
    pub active: Option<bool>,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScimName {
    pub formatted: Option<String>,
    #[serde(rename = "givenName")]
    pub given_name: Option<String>,
    #[serde(rename = "familyName")]
    pub family_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScimEmail {
    pub value: String,
    pub primary: Option<bool>,
    #[serde(rename = "type")]
    pub email_type: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct ScimListResponse {
    pub schemas: Vec<String>,
    #[serde(rename = "totalResults")]
    pub total_results: usize,
    #[serde(rename = "itemsPerPage")]
    pub items_per_page: usize,
    #[serde(rename = "startIndex")]
    pub start_index: usize,
    #[serde(rename = "Resources")]
    pub resources: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ScimListQuery {
    pub count: Option<i64>,
    #[serde(rename = "startIndex")]
    pub start_index: Option<i64>,
    pub filter: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScimPatchOp {
    #[serde(rename = "Operations")]
    pub operations: Vec<ScimPatchOperation>,
}

#[derive(Debug, Deserialize)]
pub struct ScimPatchOperation {
    pub op: String,
    pub path: Option<String>,
    pub value: Option<Value>,
}

// ---------------------------------------------------------------------------
// SCIM token admin types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ScimTokenRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScimTokenRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateScimTokenResponse {
    pub id: Uuid,
    pub name: String,
    pub token: String, // plaintext — shown once
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn scim_json_response(status: StatusCode, body: Value) -> Response {
    let mut resp = (status, Json(body)).into_response();
    resp.headers_mut()
        .insert("content-type", "application/scim+json".parse().unwrap());
    resp
}

fn extract_permissions(headers: &HeaderMap) -> Vec<String> {
    headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').map(|p| p.trim().to_string()).collect())
        .unwrap_or_default()
}

fn has_permission(headers: &HeaderMap, perm: &str) -> bool {
    let perms = extract_permissions(headers);
    perms.iter().any(|p| p == perm || p == "*")
}

async fn validate_scim_token(headers: &HeaderMap, db: &sqlx::PgPool) -> Result<(), StatusCode> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let hash = format!("{:x}", Sha256::digest(auth.as_bytes()));

    let exists = sqlx::query("SELECT id FROM scim_tokens WHERE token_hash = $1 AND enabled = true")
        .bind(&hash)
        .fetch_optional(db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if exists.is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Update last_used_at (non-fatal if it fails)
    let _ = sqlx::query("UPDATE scim_tokens SET last_used_at = now() WHERE token_hash = $1")
        .bind(&hash)
        .execute(db)
        .await;

    Ok(())
}

fn user_to_scim(
    id: &str,
    username: &str,
    full_name: Option<&str>,
    email: Option<&str>,
    enabled: bool,
    external_id: Option<&str>,
) -> Value {
    json!({
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": id,
        "userName": username,
        "displayName": full_name.unwrap_or(username),
        "name": {"formatted": full_name.unwrap_or(username)},
        "emails": email.map(|e| vec![json!({"value": e, "primary": true, "type": "work"})]).unwrap_or_default(),
        "active": enabled,
        "externalId": external_id,
        "meta": {
            "resourceType": "User",
            "location": format!("/scim/v2/Users/{}", id)
        }
    })
}

// ---------------------------------------------------------------------------
// GET /scim/v2/ServiceProviderConfig
// ---------------------------------------------------------------------------

pub async fn service_provider_config(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    scim_json_response(
        StatusCode::OK,
        json!({
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
            "documentationUri": "https://tools.ietf.org/html/rfc7644",
            "patch": {"supported": true},
            "bulk": {"supported": false, "maxOperations": 0, "maxPayloadSize": 0},
            "filter": {"supported": true, "maxResults": 200},
            "changePassword": {"supported": false},
            "sort": {"supported": false},
            "etag": {"supported": false},
            "authenticationSchemes": [
                {
                    "name": "OAuth Bearer Token",
                    "description": "Authentication scheme using the OAuth Bearer Token standard",
                    "specUri": "http://www.rfc-editor.org/info/rfc6750",
                    "type": "oauthbearertoken",
                    "primary": true
                }
            ],
            "meta": {
                "resourceType": "ServiceProviderConfig",
                "location": "/scim/v2/ServiceProviderConfig"
            }
        }),
    )
}

// ---------------------------------------------------------------------------
// GET /scim/v2/Schemas
// ---------------------------------------------------------------------------

pub async fn list_schemas(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    scim_json_response(
        StatusCode::OK,
        json!({
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 2,
            "Resources": [
                {
                    "id": "urn:ietf:params:scim:schemas:core:2.0:User",
                    "name": "User",
                    "description": "User Account",
                    "attributes": [
                        {"name": "userName", "type": "string", "multiValued": false, "required": true, "caseExact": false, "mutability": "readWrite", "returned": "default", "uniqueness": "server"},
                        {"name": "displayName", "type": "string", "multiValued": false, "required": false, "mutability": "readWrite", "returned": "default"},
                        {"name": "emails", "type": "complex", "multiValued": true, "required": false, "mutability": "readWrite", "returned": "default"},
                        {"name": "active", "type": "boolean", "multiValued": false, "required": false, "mutability": "readWrite", "returned": "default"},
                        {"name": "externalId", "type": "string", "multiValued": false, "required": false, "caseExact": true, "mutability": "readWrite", "returned": "default"}
                    ]
                },
                {
                    "id": "urn:ietf:params:scim:schemas:core:2.0:Group",
                    "name": "Group",
                    "description": "Group",
                    "attributes": [
                        {"name": "displayName", "type": "string", "multiValued": false, "required": true, "mutability": "readWrite", "returned": "default"},
                        {"name": "members", "type": "complex", "multiValued": true, "required": false, "mutability": "readWrite", "returned": "default"}
                    ]
                }
            ]
        }),
    )
}

// ---------------------------------------------------------------------------
// GET /scim/v2/ResourceTypes
// ---------------------------------------------------------------------------

pub async fn list_resource_types(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    scim_json_response(
        StatusCode::OK,
        json!({
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 2,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                    "id": "User",
                    "name": "User",
                    "endpoint": "/Users",
                    "description": "User Account",
                    "schema": "urn:ietf:params:scim:schemas:core:2.0:User",
                    "meta": {"location": "/scim/v2/ResourceTypes/User", "resourceType": "ResourceType"}
                },
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                    "id": "Group",
                    "name": "Group",
                    "endpoint": "/Groups",
                    "description": "Group",
                    "schema": "urn:ietf:params:scim:schemas:core:2.0:Group",
                    "meta": {"location": "/scim/v2/ResourceTypes/Group", "resourceType": "ResourceType"}
                }
            ]
        }),
    )
}

// ---------------------------------------------------------------------------
// GET /scim/v2/Users
// ---------------------------------------------------------------------------

pub async fn list_users(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ScimListQuery>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let limit = query.count.unwrap_or(100).min(200);
    let start_index = query.start_index.unwrap_or(1).max(1);
    let offset = start_index - 1;

    // Parse optional filter: userName eq "value"
    let username_filter: Option<String> = query.filter.as_deref().and_then(|f| {
        // Simple parse: `userName eq "..."`
        let lower = f.to_lowercase();
        if lower.starts_with("username eq ") {
            let rest = &f[12..].trim().to_string();
            Some(rest.trim_matches('"').to_string())
        } else {
            None
        }
    });

    let rows = if let Some(ref uname) = username_filter {
        sqlx::query(
            "SELECT id, username, full_name, email, enabled, external_id
             FROM users
             WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3",
        )
        .bind(uname)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            "SELECT id, username, full_name, email, enabled, external_id
             FROM users
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    };

    let rows = match rows {
        Ok(r) => r,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let resources: Vec<Value> = rows
        .iter()
        .map(|r| {
            let id: Uuid = r.get("id");
            let username: String = r.get("username");
            let full_name: Option<String> = r.get("full_name");
            let email: Option<String> = r.get("email");
            let enabled: bool = r.get("enabled");
            let external_id: Option<String> = r.get("external_id");
            user_to_scim(
                &id.to_string(),
                &username,
                full_name.as_deref(),
                email.as_deref(),
                enabled,
                external_id.as_deref(),
            )
        })
        .collect();

    let total = resources.len();

    scim_json_response(
        StatusCode::OK,
        json!({
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": total,
            "itemsPerPage": limit,
            "startIndex": start_index,
            "Resources": resources
        }),
    )
}

// ---------------------------------------------------------------------------
// GET /scim/v2/Users/:id
// ---------------------------------------------------------------------------

pub async fn get_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let row = sqlx::query(
        "SELECT id, username, full_name, email, enabled, external_id
         FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            let uid: Uuid = r.get("id");
            let username: String = r.get("username");
            let full_name: Option<String> = r.get("full_name");
            let email: Option<String> = r.get("email");
            let enabled: bool = r.get("enabled");
            let external_id: Option<String> = r.get("external_id");
            scim_json_response(
                StatusCode::OK,
                user_to_scim(
                    &uid.to_string(),
                    &username,
                    full_name.as_deref(),
                    email.as_deref(),
                    enabled,
                    external_id.as_deref(),
                ),
            )
        }
        Ok(None) => scim_json_response(
            StatusCode::NOT_FOUND,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "User not found"}),
        ),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /scim/v2/Users
// ---------------------------------------------------------------------------

pub async fn create_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScimUser>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let username = body.user_name.trim().to_lowercase();
    if username.is_empty() {
        return scim_json_response(
            StatusCode::BAD_REQUEST,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "400", "detail": "userName is required"}),
        );
    }

    // Extract primary email
    let email = body
        .emails
        .as_ref()
        .and_then(|emails| {
            emails
                .iter()
                .find(|e| e.primary.unwrap_or(false))
                .or_else(|| emails.first())
                .map(|e| e.value.clone())
        })
        .unwrap_or_else(|| format!("{}@scim.local", username));

    // Build full_name from name or displayName
    let full_name = body
        .name
        .as_ref()
        .and_then(|n| n.formatted.clone())
        .or_else(|| body.display_name.clone());

    let enabled = body.active.unwrap_or(true);
    let new_id = Uuid::new_v4();

    let result = sqlx::query(
        "INSERT INTO users (id, username, full_name, email, auth_provider, enabled, external_id, created_at)
         VALUES ($1, $2, $3, $4, 'scim', $5, $6, now())
         ON CONFLICT (username) DO NOTHING
         RETURNING id",
    )
    .bind(new_id)
    .bind(&username)
    .bind(&full_name)
    .bind(&email)
    .bind(enabled)
    .bind(&body.external_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(r)) => {
            let uid: Uuid = r.get("id");
            scim_json_response(
                StatusCode::CREATED,
                user_to_scim(
                    &uid.to_string(),
                    &username,
                    full_name.as_deref(),
                    Some(&email),
                    enabled,
                    body.external_id.as_deref(),
                ),
            )
        }
        Ok(None) => scim_json_response(
            StatusCode::CONFLICT,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "409", "detail": "User already exists", "scimType": "uniqueness"}),
        ),
        Err(e) => {
            tracing::error!(error = %e, "SCIM create_user failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /scim/v2/Users/:id  — full replace
// ---------------------------------------------------------------------------

pub async fn replace_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<ScimUser>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let full_name = body
        .name
        .as_ref()
        .and_then(|n| n.formatted.clone())
        .or_else(|| body.display_name.clone());

    let email = body.emails.as_ref().and_then(|emails| {
        emails
            .iter()
            .find(|e| e.primary.unwrap_or(false))
            .or_else(|| emails.first())
            .map(|e| e.value.clone())
    });

    let enabled = body.active.unwrap_or(true);

    let result = sqlx::query(
        "UPDATE users SET full_name = $1, email = COALESCE($2, email), enabled = $3, external_id = $4
         WHERE id = $5 AND deleted_at IS NULL
         RETURNING id, username, full_name, email, enabled, external_id",
    )
    .bind(&full_name)
    .bind(&email)
    .bind(enabled)
    .bind(&body.external_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(r)) => {
            let uid: Uuid = r.get("id");
            let username: String = r.get("username");
            let fn_: Option<String> = r.get("full_name");
            let em: Option<String> = r.get("email");
            let en: bool = r.get("enabled");
            let ext: Option<String> = r.get("external_id");
            scim_json_response(
                StatusCode::OK,
                user_to_scim(
                    &uid.to_string(),
                    &username,
                    fn_.as_deref(),
                    em.as_deref(),
                    en,
                    ext.as_deref(),
                ),
            )
        }
        Ok(None) => scim_json_response(
            StatusCode::NOT_FOUND,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "User not found"}),
        ),
        Err(e) => {
            tracing::error!(error = %e, "SCIM replace_user failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PATCH /scim/v2/Users/:id  — partial update
// ---------------------------------------------------------------------------

pub async fn patch_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<ScimPatchOp>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    // Process each operation — we support op=replace for active and displayName
    for op in &body.operations {
        if op.op.to_lowercase() == "replace" {
            if let Some(val) = &op.value {
                // Handle `active` field
                if let Some(active_val) = val.get("active").and_then(|v| v.as_bool()) {
                    let _ = sqlx::query(
                        "UPDATE users SET enabled = $1 WHERE id = $2 AND deleted_at IS NULL",
                    )
                    .bind(active_val)
                    .bind(id)
                    .execute(&state.db)
                    .await;
                } else if op.path.as_deref() == Some("active") {
                    if let Some(active_val) = val.as_bool() {
                        let _ = sqlx::query(
                            "UPDATE users SET enabled = $1 WHERE id = $2 AND deleted_at IS NULL",
                        )
                        .bind(active_val)
                        .bind(id)
                        .execute(&state.db)
                        .await;
                    }
                }

                // Handle displayName
                if let Some(display_name) = val.get("displayName").and_then(|v| v.as_str()) {
                    let _ = sqlx::query(
                        "UPDATE users SET full_name = $1 WHERE id = $2 AND deleted_at IS NULL",
                    )
                    .bind(display_name)
                    .bind(id)
                    .execute(&state.db)
                    .await;
                }
            }
        }
    }

    // Return updated user
    let row = sqlx::query(
        "SELECT id, username, full_name, email, enabled, external_id
         FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            let uid: Uuid = r.get("id");
            let username: String = r.get("username");
            let full_name: Option<String> = r.get("full_name");
            let email: Option<String> = r.get("email");
            let enabled: bool = r.get("enabled");
            let external_id: Option<String> = r.get("external_id");
            scim_json_response(
                StatusCode::OK,
                user_to_scim(
                    &uid.to_string(),
                    &username,
                    full_name.as_deref(),
                    email.as_deref(),
                    enabled,
                    external_id.as_deref(),
                ),
            )
        }
        Ok(None) => scim_json_response(
            StatusCode::NOT_FOUND,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "User not found"}),
        ),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /scim/v2/Users/:id  — soft-delete (disable)
// ---------------------------------------------------------------------------

pub async fn delete_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let result = sqlx::query(
        "UPDATE users SET enabled = false, deleted_at = now()
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => StatusCode::NO_CONTENT.into_response(),
        Ok(_) => scim_json_response(
            StatusCode::NOT_FOUND,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "User not found"}),
        ),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

// ---------------------------------------------------------------------------
// SCIM Group types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct ScimGroup {
    pub schemas: Vec<String>,
    pub id: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub members: Option<Vec<ScimGroupMember>>,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScimGroupMember {
    pub value: String, // user ID
    pub display: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper: build a SCIM Group JSON value from DB rows
// ---------------------------------------------------------------------------

fn group_to_scim(
    role_id: &str,
    display_name: &str,
    members: &[(String, Option<String>)], // (user_id, username)
) -> Value {
    let member_list: Vec<Value> = members
        .iter()
        .map(|(uid, uname)| {
            json!({
                "value": uid,
                "display": uname,
                "$ref": format!("/scim/v2/Users/{}", uid)
            })
        })
        .collect();
    json!({
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        "id": role_id,
        "displayName": display_name,
        "members": member_list,
        "meta": {
            "resourceType": "Group",
            "location": format!("/scim/v2/Groups/{}", role_id)
        }
    })
}

/// Fetch members of a role where role_source = 'scim'.
async fn fetch_group_members(
    db: &sqlx::PgPool,
    role_id: Uuid,
) -> Result<Vec<(String, Option<String>)>, StatusCode> {
    let rows = sqlx::query(
        "SELECT ur.user_id, u.username
         FROM user_roles ur
         JOIN users u ON u.id = ur.user_id
         WHERE ur.role_id = $1 AND ur.role_source = 'scim'",
    )
    .bind(role_id)
    .fetch_all(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(rows
        .iter()
        .map(|r| {
            let uid: Uuid = r.get("user_id");
            let uname: Option<String> = r.get("username");
            (uid.to_string(), uname)
        })
        .collect())
}

// ---------------------------------------------------------------------------
// GET /scim/v2/Groups
// ---------------------------------------------------------------------------

pub async fn list_groups(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ScimListQuery>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let limit = query.count.unwrap_or(100).min(200);
    let start_index = query.start_index.unwrap_or(1).max(1);
    let offset = start_index - 1;

    // Parse optional filter: displayName eq "value"
    let name_filter: Option<String> = query.filter.as_deref().and_then(|f| {
        let lower = f.to_lowercase();
        if lower.starts_with("displayname eq ") {
            let rest = &f[15..].trim().to_string();
            Some(rest.trim_matches('"').to_string())
        } else {
            None
        }
    });

    let rows = if let Some(ref name) = name_filter {
        sqlx::query(
            "SELECT id, name FROM roles
             WHERE LOWER(name) = LOWER($1)
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3",
        )
        .bind(name)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            "SELECT id, name FROM roles
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    };

    let rows = match rows {
        Ok(r) => r,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let mut resources: Vec<Value> = Vec::with_capacity(rows.len());
    for r in &rows {
        let role_id: Uuid = r.get("id");
        let role_name: String = r.get("name");
        let members = match fetch_group_members(&state.db, role_id).await {
            Ok(m) => m,
            Err(s) => return s.into_response(),
        };
        resources.push(group_to_scim(&role_id.to_string(), &role_name, &members));
    }

    let total = resources.len();
    scim_json_response(
        StatusCode::OK,
        json!({
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": total,
            "itemsPerPage": limit,
            "startIndex": start_index,
            "Resources": resources
        }),
    )
}

// ---------------------------------------------------------------------------
// GET /scim/v2/Groups/:id
// ---------------------------------------------------------------------------

pub async fn get_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let row = sqlx::query("SELECT id, name FROM roles WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    match row {
        Ok(Some(r)) => {
            let role_id: Uuid = r.get("id");
            let role_name: String = r.get("name");
            let members = match fetch_group_members(&state.db, role_id).await {
                Ok(m) => m,
                Err(s) => return s.into_response(),
            };
            scim_json_response(
                StatusCode::OK,
                group_to_scim(&role_id.to_string(), &role_name, &members),
            )
        }
        Ok(None) => scim_json_response(
            StatusCode::NOT_FOUND,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "Group not found"}),
        ),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /scim/v2/Groups
// ---------------------------------------------------------------------------

pub async fn create_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScimGroup>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    let display_name = body.display_name.trim().to_string();
    if display_name.is_empty() {
        return scim_json_response(
            StatusCode::BAD_REQUEST,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "400", "detail": "displayName is required"}),
        );
    }

    // Idempotent: if a role with this name already exists, return it
    let existing = sqlx::query("SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1)")
        .bind(&display_name)
        .fetch_optional(&state.db)
        .await;

    match existing {
        Ok(Some(r)) => {
            let role_id: Uuid = r.get("id");
            let role_name: String = r.get("name");
            let members = match fetch_group_members(&state.db, role_id).await {
                Ok(m) => m,
                Err(s) => return s.into_response(),
            };
            return scim_json_response(
                StatusCode::OK,
                group_to_scim(&role_id.to_string(), &role_name, &members),
            );
        }
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Ok(None) => {}
    }

    let new_id = Uuid::new_v4();
    let result = sqlx::query(
        "INSERT INTO roles (id, name, description, created_at)
         VALUES ($1, $2, $3, now())
         RETURNING id, name",
    )
    .bind(new_id)
    .bind(&display_name)
    .bind(format!("SCIM-provisioned group: {}", display_name))
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(r) => {
            let role_id: Uuid = r.get("id");
            let role_name: String = r.get("name");

            // Add initial members if provided
            if let Some(members) = &body.members {
                for member in members {
                    if let Ok(user_id) = Uuid::parse_str(&member.value) {
                        let _ = sqlx::query(
                            "INSERT INTO user_roles (user_id, role_id, role_source, assigned_at)
                             VALUES ($1, $2, 'scim', now())
                             ON CONFLICT (user_id, role_id) DO NOTHING",
                        )
                        .bind(user_id)
                        .bind(role_id)
                        .execute(&state.db)
                        .await;
                    }
                }
            }

            let current_members = match fetch_group_members(&state.db, role_id).await {
                Ok(m) => m,
                Err(s) => return s.into_response(),
            };
            scim_json_response(
                StatusCode::CREATED,
                group_to_scim(&role_id.to_string(), &role_name, &current_members),
            )
        }
        Err(e) => {
            tracing::error!(error = %e, "SCIM create_group failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /scim/v2/Groups/:id  — full replace (replaces members)
// ---------------------------------------------------------------------------

pub async fn replace_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<ScimGroup>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    // Verify group exists
    let row = sqlx::query("SELECT id, name FROM roles WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    let (role_id, role_name) = match row {
        Ok(Some(r)) => {
            let rid: Uuid = r.get("id");
            let rname: String = r.get("name");
            (rid, rname)
        }
        Ok(None) => {
            return scim_json_response(
                StatusCode::NOT_FOUND,
                json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "Group not found"}),
            )
        }
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    // Compute desired member set
    let desired_ids: Vec<Uuid> = body
        .members
        .as_ref()
        .map(|members| {
            members
                .iter()
                .filter_map(|m| Uuid::parse_str(&m.value).ok())
                .collect()
        })
        .unwrap_or_default();

    // Fetch current scim-managed members
    let current_rows =
        sqlx::query("SELECT user_id FROM user_roles WHERE role_id = $1 AND role_source = 'scim'")
            .bind(role_id)
            .fetch_all(&state.db)
            .await;

    let current_ids: Vec<Uuid> = match current_rows {
        Ok(rows) => rows.iter().map(|r| r.get::<Uuid, _>("user_id")).collect(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    // Remove members not in desired set
    for uid in &current_ids {
        if !desired_ids.contains(uid) {
            let _ = sqlx::query(
                "DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 AND role_source = 'scim'",
            )
            .bind(uid)
            .bind(role_id)
            .execute(&state.db)
            .await;
        }
    }

    // Add members in desired set not currently present
    for uid in &desired_ids {
        if !current_ids.contains(uid) {
            let _ = sqlx::query(
                "INSERT INTO user_roles (user_id, role_id, role_source, assigned_at)
                 VALUES ($1, $2, 'scim', now())
                 ON CONFLICT (user_id, role_id) DO NOTHING",
            )
            .bind(uid)
            .bind(role_id)
            .execute(&state.db)
            .await;
        }
    }

    let members = match fetch_group_members(&state.db, role_id).await {
        Ok(m) => m,
        Err(s) => return s.into_response(),
    };
    scim_json_response(
        StatusCode::OK,
        group_to_scim(&role_id.to_string(), &role_name, &members),
    )
}

// ---------------------------------------------------------------------------
// PATCH /scim/v2/Groups/:id  — partial update
// ---------------------------------------------------------------------------

pub async fn patch_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<ScimPatchOp>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    // Verify group exists
    let row = sqlx::query("SELECT id, name FROM roles WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    let (role_id, role_name) = match row {
        Ok(Some(r)) => {
            let rid: Uuid = r.get("id");
            let rname: String = r.get("name");
            (rid, rname)
        }
        Ok(None) => {
            return scim_json_response(
                StatusCode::NOT_FOUND,
                json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "Group not found"}),
            )
        }
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    for op in &body.operations {
        let op_lower = op.op.to_lowercase();
        let path_lower = op.path.as_deref().map(|p| p.to_lowercase());

        // Only handle operations on members path
        let is_members = path_lower.as_deref() == Some("members")
            || path_lower
                .as_deref()
                .map(|p| p.starts_with("members"))
                .unwrap_or(false);

        if !is_members {
            continue;
        }

        let member_ids: Vec<Uuid> = op
            .value
            .as_ref()
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        item.get("value")
                            .and_then(|v| v.as_str())
                            .and_then(|s| Uuid::parse_str(s).ok())
                    })
                    .collect()
            })
            .unwrap_or_default();

        match op_lower.as_str() {
            "add" => {
                for uid in &member_ids {
                    let _ = sqlx::query(
                        "INSERT INTO user_roles (user_id, role_id, role_source, assigned_at)
                         VALUES ($1, $2, 'scim', now())
                         ON CONFLICT (user_id, role_id) DO NOTHING",
                    )
                    .bind(uid)
                    .bind(role_id)
                    .execute(&state.db)
                    .await;
                }
            }
            "remove" => {
                for uid in &member_ids {
                    let _ = sqlx::query(
                        "DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 AND role_source = 'scim'",
                    )
                    .bind(uid)
                    .bind(role_id)
                    .execute(&state.db)
                    .await;
                }
            }
            "replace" => {
                // Replace is same as PUT on members list — diff against current
                let current_rows = sqlx::query(
                    "SELECT user_id FROM user_roles WHERE role_id = $1 AND role_source = 'scim'",
                )
                .bind(role_id)
                .fetch_all(&state.db)
                .await;

                let current_ids: Vec<Uuid> = match current_rows {
                    Ok(rows) => rows.iter().map(|r| r.get::<Uuid, _>("user_id")).collect(),
                    Err(_) => continue,
                };

                for uid in &current_ids {
                    if !member_ids.contains(uid) {
                        let _ = sqlx::query(
                            "DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 AND role_source = 'scim'",
                        )
                        .bind(uid)
                        .bind(role_id)
                        .execute(&state.db)
                        .await;
                    }
                }
                for uid in &member_ids {
                    if !current_ids.contains(uid) {
                        let _ = sqlx::query(
                            "INSERT INTO user_roles (user_id, role_id, role_source, assigned_at)
                             VALUES ($1, $2, 'scim', now())
                             ON CONFLICT (user_id, role_id) DO NOTHING",
                        )
                        .bind(uid)
                        .bind(role_id)
                        .execute(&state.db)
                        .await;
                    }
                }
            }
            _ => {}
        }
    }

    let members = match fetch_group_members(&state.db, role_id).await {
        Ok(m) => m,
        Err(s) => return s.into_response(),
    };
    scim_json_response(
        StatusCode::OK,
        group_to_scim(&role_id.to_string(), &role_name, &members),
    )
}

// ---------------------------------------------------------------------------
// DELETE /scim/v2/Groups/:id
// ---------------------------------------------------------------------------

pub async fn delete_group(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Response {
    if let Err(status) = validate_scim_token(&headers, &state.db).await {
        return status.into_response();
    }

    // Remove all SCIM-managed role assignments for this role
    let _ = sqlx::query("DELETE FROM user_roles WHERE role_id = $1 AND role_source = 'scim'")
        .bind(id)
        .execute(&state.db)
        .await;

    // Verify the role exists before attempting to soft-delete it
    let result = sqlx::query("SELECT id FROM roles WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    match result {
        Ok(Some(_)) => {
            // Soft-delete by marking description (roles table has no deleted_at — leave the role but return 204)
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(None) => scim_json_response(
            StatusCode::NOT_FOUND,
            json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": "404", "detail": "Group not found"}),
        ),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

// ---------------------------------------------------------------------------
// Admin: SCIM token management (JWT-protected, system:configure)
// ---------------------------------------------------------------------------

pub async fn list_scim_tokens(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    if !has_permission(&headers, "system:configure") {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    let rows = sqlx::query(
        "SELECT id, name, description, enabled, last_used_at, created_at
         FROM scim_tokens
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let tokens: Vec<ScimTokenRow> = rows
        .into_iter()
        .map(|r| ScimTokenRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            enabled: r.get("enabled"),
            last_used_at: r.get("last_used_at"),
            created_at: r.get("created_at"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(tokens)))
}

pub async fn create_scim_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateScimTokenRequest>,
) -> IoResult<impl IntoResponse> {
    if !has_permission(&headers, "system:configure") {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    if body.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".to_string()));
    }

    // Generate a 32-byte random token, hex-encoded
    let raw_bytes: [u8; 32] = rand::random();
    let token_plain: String = raw_bytes.iter().map(|b| format!("{:02x}", b)).collect();
    let token_hash = format!("{:x}", Sha256::digest(token_plain.as_bytes()));

    let new_id = Uuid::new_v4();

    // Optionally get caller user_id for created_by
    let created_by: Option<Uuid> = headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok());

    sqlx::query(
        "INSERT INTO scim_tokens (id, name, description, token_hash, enabled, created_at, created_by)
         VALUES ($1, $2, $3, $4, true, now(), $5)",
    )
    .bind(new_id)
    .bind(body.name.trim())
    .bind(&body.description)
    .bind(&token_hash)
    .bind(created_by)
    .execute(&state.db)
    .await?;

    Ok(Json(ApiResponse::ok(CreateScimTokenResponse {
        id: new_id,
        name: body.name.trim().to_string(),
        token: token_plain,
    })))
}

pub async fn delete_scim_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    if !has_permission(&headers, "system:configure") {
        return Err(IoError::Forbidden("system:configure required".to_string()));
    }

    let result = sqlx::query("DELETE FROM scim_tokens WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound("SCIM token not found".to_string()));
    }

    Ok(Json(ApiResponse::ok(
        json!({"message": "SCIM token deleted"}),
    )))
}
