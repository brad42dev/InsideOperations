use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use ldap3::{LdapConnAsync, Scope, SearchEntry};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use io_auth::{build_claims, generate_access_token};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::handlers::auth::fetch_user_permissions;
use crate::handlers::mfa::check_mfa_required;
use crate::handlers::oidc::apply_group_role_mappings;
use crate::state::{AppState, MfaPendingEntry};

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct LdapLoginBody {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
}

// ---------------------------------------------------------------------------
// POST /auth/ldap/:config_id/login
// ---------------------------------------------------------------------------

pub async fn ldap_login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(config_id): Path<Uuid>,
    Json(body): Json<LdapLoginBody>,
) -> Response {
    match ldap_login_inner(state, headers, config_id, body).await {
        Ok(resp) => resp,
        Err(e) => e.into_response(),
    }
}

async fn ldap_login_inner(
    state: AppState,
    headers: HeaderMap,
    config_id: Uuid,
    body: LdapLoginBody,
) -> IoResult<Response> {
    if body.username.is_empty() || body.password.is_empty() {
        return Err(IoError::BadRequest("username and password are required".into()));
    }

    // Load LDAP provider config
    let prov_row = sqlx::query(
        "SELECT config, jit_provisioning, default_role_id
         FROM auth_provider_configs
         WHERE id = $1 AND provider_type = 'ldap' AND enabled = true",
    )
    .bind(config_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound("LDAP provider not found or disabled".into()))?;

    let config_json: serde_json::Value = prov_row.get("config");
    let jit_provisioning: bool = prov_row.get("jit_provisioning");
    let default_role_id: Option<Uuid> = prov_row.get("default_role_id");

    // Parse config fields
    let server_url = config_json["server_url"]
        .as_str()
        .ok_or_else(|| IoError::Internal("LDAP provider missing server_url".into()))?
        .to_string();

    let bind_dn = config_json["bind_dn"]
        .as_str()
        .ok_or_else(|| IoError::Internal("LDAP provider missing bind_dn".into()))?
        .to_string();

    let bind_password = config_json["bind_password"]
        .as_str()
        .ok_or_else(|| IoError::Internal("LDAP provider missing bind_password".into()))?
        .to_string();

    let search_base = config_json["search_base"]
        .as_str()
        .ok_or_else(|| IoError::Internal("LDAP provider missing search_base".into()))?
        .to_string();

    let user_filter_template = config_json["user_filter"]
        .as_str()
        .unwrap_or("(&(sAMAccountName={username})(objectClass=user))")
        .to_string();

    let username_attribute = config_json["username_attribute"]
        .as_str()
        .unwrap_or("sAMAccountName")
        .to_string();

    let email_attribute = config_json["email_attribute"]
        .as_str()
        .unwrap_or("mail")
        .to_string();

    let display_name_attribute = config_json["display_name_attribute"]
        .as_str()
        .unwrap_or("displayName")
        .to_string();

    let group_attribute = config_json["group_attribute"]
        .as_str()
        .unwrap_or("memberOf")
        .to_string();

    // Escape the username to prevent LDAP filter injection
    let escaped_username = ldap_escape_filter(&body.username);
    let user_filter = user_filter_template.replace("{username}", &escaped_username);

    // Connect as service account and search for user
    let (conn, mut ldap) = LdapConnAsync::new(&server_url)
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("LDAP connection failed: {e}")))?;

    ldap3::drive!(conn);

    // Service account bind
    ldap.simple_bind(&bind_dn, &bind_password)
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("LDAP service bind failed: {e}")))?
        .success()
        .map_err(|e| IoError::Internal(format!("LDAP service bind rejected: {e}")))?;

    // Search for the user — request required attributes
    let search_attrs = vec![
        username_attribute.as_str(),
        email_attribute.as_str(),
        display_name_attribute.as_str(),
        group_attribute.as_str(),
    ];

    let (entries, _res) = ldap
        .search(&search_base, Scope::Subtree, &user_filter, search_attrs)
        .await
        .map_err(|e| IoError::Internal(format!("LDAP search error: {e}")))?
        .success()
        .map_err(|_| IoError::BadRequest("Invalid username or password".into()))?;

    let raw_entry = match entries.into_iter().next() {
        Some(e) => e,
        None => {
            return Err(IoError::BadRequest("Invalid username or password".into()));
        }
    };

    let entry = SearchEntry::construct(raw_entry);
    let user_dn = entry.dn.clone();

    ldap.unbind().await.ok();

    // Re-bind as user to verify password
    let (user_conn, mut user_ldap) = LdapConnAsync::new(&server_url)
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("LDAP connect for user auth: {e}")))?;

    ldap3::drive!(user_conn);

    let bind_result = user_ldap.simple_bind(&user_dn, &body.password).await;

    match bind_result {
        Ok(result) => {
            if result.success().is_err() {
                user_ldap.unbind().await.ok();
                return Err(IoError::BadRequest("Invalid username or password".into()));
            }
        }
        Err(_) => {
            return Err(IoError::BadRequest("Invalid username or password".into()));
        }
    }

    user_ldap.unbind().await.ok();

    // Extract user attributes
    let ldap_username = entry
        .attrs
        .get(&username_attribute)
        .and_then(|v| v.first())
        .cloned()
        .unwrap_or_else(|| body.username.clone());

    let email = entry
        .attrs
        .get(&email_attribute)
        .and_then(|v| v.first())
        .cloned()
        .unwrap_or_else(|| format!("{}@ldap.local", &body.username));

    let full_name = entry
        .attrs
        .get(&display_name_attribute)
        .and_then(|v| v.first())
        .cloned();

    // Group memberships from memberOf (or configured attribute)
    let groups: Vec<String> = entry
        .attrs
        .get(&group_attribute)
        .cloned()
        .unwrap_or_default();

    // Use DN as stable unique identifier for this LDAP user
    let ldap_user_id = user_dn.clone();

    // Look up existing user in DB
    let user_row = sqlx::query(
        "SELECT id, username, enabled
         FROM users
         WHERE auth_provider = 'ldap'
           AND auth_provider_config_id = $1
           AND auth_provider_user_id = $2
           AND deleted_at IS NULL",
    )
    .bind(config_id)
    .bind(&ldap_user_id)
    .fetch_optional(&state.db)
    .await?;

    let db_user_id = if let Some(row) = user_row {
        let enabled: bool = row.get("enabled");
        if !enabled {
            return Err(IoError::Forbidden("Account is disabled".into()));
        }
        let uid: Uuid = row.get("id");
        // Refresh contact info from LDAP
        sqlx::query(
            "UPDATE users SET email = $1, full_name = $2, last_login_at = now() WHERE id = $3",
        )
        .bind(&email)
        .bind(full_name.as_deref())
        .bind(uid)
        .execute(&state.db)
        .await?;
        uid
    } else if jit_provisioning {
        // JIT provision
        let base_username = ldap_username
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect::<String>();

        let username = ensure_unique_username(&state.db, &base_username).await?;

        let new_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users
                (id, username, email, full_name, auth_provider, auth_provider_config_id,
                 auth_provider_user_id, enabled, last_login_at)
             VALUES ($1, $2, $3, $4, 'ldap', $5, $6, true, now())",
        )
        .bind(new_id)
        .bind(&username)
        .bind(&email)
        .bind(full_name.as_deref())
        .bind(config_id)
        .bind(&ldap_user_id)
        .execute(&state.db)
        .await?;

        // Assign default role if configured
        if let Some(role_id) = default_role_id {
            let _ = sqlx::query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(new_id)
            .bind(role_id)
            .execute(&state.db)
            .await;
        }

        new_id
    } else {
        return Err(IoError::Forbidden(
            "Account not provisioned. Contact your administrator.".into(),
        ));
    };

    // Apply group → role mappings
    if !groups.is_empty() {
        apply_group_role_mappings(&state.db, config_id, db_user_id, &groups).await?;
    }

    // --- MFA gate ---
    // Check is_service_account for the db user before applying the gate.
    let is_service_account: bool = sqlx::query_scalar(
        "SELECT is_service_account FROM users WHERE id = $1",
    )
    .bind(db_user_id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or(false);

    if !is_service_account {
        if let Some((mfa_token, allowed_methods)) =
            check_mfa_required(&state.db, db_user_id).await?
        {
            state.mfa_pending_tokens.insert(
                mfa_token.clone(),
                MfaPendingEntry {
                    user_id: db_user_id,
                    allowed_methods: allowed_methods.clone(),
                    expires_at: chrono::Utc::now() + chrono::Duration::minutes(5),
                },
            );
            return Ok((
                StatusCode::OK,
                Json(ApiResponse::ok(serde_json::json!({
                    "mfa_required": true,
                    "mfa_token": mfa_token,
                    "allowed_methods": allowed_methods,
                }))),
            )
                .into_response());
        }
    }

    // Issue JWT
    let permissions = fetch_user_permissions(&state.db, db_user_id).await?;

    let username_row = sqlx::query("SELECT username FROM users WHERE id = $1")
        .bind(db_user_id)
        .fetch_one(&state.db)
        .await?;
    let username: String = username_row.get("username");

    let claims = build_claims(&db_user_id.to_string(), &username, permissions);
    let jwt = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    // Issue refresh token
    let refresh_token = Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_token.as_bytes());
    let token_hash = format!("{:x}", hasher.finalize());

    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("127.0.0.1")
        .trim()
        .to_string();

    sqlx::query(
        "INSERT INTO user_sessions
            (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, 'ldap-sso')",
    )
    .bind(Uuid::new_v4())
    .bind(db_user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .bind(&ip)
    .execute(&state.db)
    .await?;

    tracing::info!(user_id = %db_user_id, "LDAP login successful");

    let body_resp = ApiResponse::ok(LoginResponse {
        access_token: jwt,
        token_type: "Bearer".into(),
        expires_in: 900,
    });

    let cookie = format!(
        "refresh_token={refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body_resp)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .parse()
            .map_err(|_| IoError::Internal("cookie encoding error".into()))?,
    );

    Ok(response)
}

// ---------------------------------------------------------------------------
// Background sync: re-sync LDAP group memberships for a single user
// ---------------------------------------------------------------------------

/// Connect to an LDAP provider as the service account, search for `username`,
/// extract group memberships, and apply group→role mappings.
///
/// On any LDAP connection or query failure the function returns an error so the
/// caller can log it and preserve existing role assignments unchanged.
pub async fn sync_ldap_user_groups(
    db: &io_db::DbPool,
    server_url: &str,
    bind_dn: &str,
    bind_password: &str,
    search_base: &str,
    user_filter_template: &str,
    username_attribute: &str,
    group_attribute: &str,
    provider_config_id: Uuid,
    user_id: Uuid,
    username: &str,
) -> Result<(), io_error::IoError> {
    let escaped_username = ldap_escape_filter(username);
    let user_filter = user_filter_template.replace("{username}", &escaped_username);

    let (conn, mut ldap) = LdapConnAsync::new(server_url)
        .await
        .map_err(|e| io_error::IoError::ServiceUnavailable(format!("LDAP sync connect: {e}")))?;

    ldap3::drive!(conn);

    ldap.simple_bind(bind_dn, bind_password)
        .await
        .map_err(|e| io_error::IoError::ServiceUnavailable(format!("LDAP sync bind: {e}")))?
        .success()
        .map_err(|e| io_error::IoError::Internal(format!("LDAP sync bind rejected: {e}")))?;

    let search_attrs = vec![username_attribute, group_attribute];

    let (entries, _res) = ldap
        .search(search_base, Scope::Subtree, &user_filter, search_attrs)
        .await
        .map_err(|e| io_error::IoError::Internal(format!("LDAP sync search: {e}")))?
        .success()
        .map_err(|e| io_error::IoError::Internal(format!("LDAP sync search failed: {e}")))?;

    ldap.unbind().await.ok();

    let raw_entry = match entries.into_iter().next() {
        Some(e) => e,
        None => {
            return Err(io_error::IoError::NotFound(format!(
                "LDAP sync: user '{username}' not found in directory"
            )));
        }
    };

    let entry = SearchEntry::construct(raw_entry);

    let groups: Vec<String> = entry
        .attrs
        .get(group_attribute)
        .cloned()
        .unwrap_or_default();

    if !groups.is_empty() {
        apply_group_role_mappings(db, provider_config_id, user_id, &groups).await?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helper: escape special characters in an LDAP filter value (RFC 4515)
// ---------------------------------------------------------------------------

fn ldap_escape_filter(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '*' => out.push_str("\\2a"),
            '(' => out.push_str("\\28"),
            ')' => out.push_str("\\29"),
            '\\' => out.push_str("\\5c"),
            '\0' => out.push_str("\\00"),
            _ => out.push(c),
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Helper: ensure username uniqueness
// ---------------------------------------------------------------------------

async fn ensure_unique_username(
    db: &io_db::DbPool,
    base: &str,
) -> IoResult<String> {
    let base = if base.is_empty() { "user" } else { base };

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL)",
    )
    .bind(base)
    .fetch_one(db)
    .await?;

    if !exists {
        return Ok(base.to_string());
    }

    for i in 2..=9999u32 {
        let candidate = format!("{base}{i}");
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL)",
        )
        .bind(&candidate)
        .fetch_one(db)
        .await?;
        if !exists {
            return Ok(candidate);
        }
    }

    Ok(format!(
        "{base}{}",
        Uuid::new_v4().to_string().replace('-', "")
    ))
}
