use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use io_auth::{build_claims, generate_access_token};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::handlers::auth::fetch_user_permissions;
use crate::state::{AppState, EulaPendingEntry};

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct OidcCallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OidcLoginResponse {
    pub authorization_url: String,
}

// ---------------------------------------------------------------------------
// Helper: generate cryptographically random hex string
// ---------------------------------------------------------------------------

fn random_hex(len: usize) -> String {
    let bytes: Vec<u8> = (0..len).map(|_| rand::thread_rng().gen::<u8>()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

// ---------------------------------------------------------------------------
// POST /auth/oidc/:config_id/login
// Initiate OIDC authorization code + PKCE flow.
// Returns the authorization URL for the frontend to redirect to.
// ---------------------------------------------------------------------------

pub async fn oidc_login(
    State(state): State<AppState>,
    Path(config_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    // Load provider config
    let row = sqlx::query(
        "SELECT id, name, config, jit_provisioning, enabled
         FROM auth_provider_configs
         WHERE id = $1 AND provider_type = 'oidc' AND enabled = true",
    )
    .bind(config_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound("OIDC provider not found or disabled".into()))?;

    let config_json: serde_json::Value = row.get("config");

    let issuer_url = config_json["issuer_url"]
        .as_str()
        .ok_or_else(|| IoError::Internal("OIDC provider missing issuer_url".into()))?
        .to_string();

    let client_id = config_json["client_id"]
        .as_str()
        .ok_or_else(|| IoError::Internal("OIDC provider missing client_id".into()))?
        .to_string();

    let redirect_uri = config_json["redirect_uri"]
        .as_str()
        .unwrap_or("/api/auth/oidc/callback")
        .to_string();

    // Scopes: default to openid profile email; allow override in config
    let scopes: Vec<String> = if let Some(arr) = config_json["scopes"].as_array() {
        arr.iter()
            .filter_map(|s| s.as_str().map(String::from))
            .collect()
    } else {
        vec!["openid".into(), "profile".into(), "email".into()]
    };

    // Discover OIDC endpoints via metadata URL
    // We construct the authorization_endpoint from the issuer following RFC 8414.
    // If the config provides an explicit authorization_endpoint, use that instead.
    let auth_endpoint = if let Some(ep) = config_json["authorization_endpoint"].as_str() {
        ep.to_string()
    } else {
        // Attempt discovery — fetch the well-known configuration
        let discovery_url = format!("{}/.well-known/openid-configuration", issuer_url.trim_end_matches('/'));
        let client = reqwest::Client::new();
        let discovery_resp = client
            .get(&discovery_url)
            .send()
            .await
            .map_err(|e| IoError::ServiceUnavailable(format!("OIDC discovery failed: {e}")))?;

        if !discovery_resp.status().is_success() {
            return Err(IoError::ServiceUnavailable(
                format!("OIDC discovery returned {}", discovery_resp.status()),
            ));
        }

        let metadata: serde_json::Value = discovery_resp
            .json()
            .await
            .map_err(|e| IoError::Internal(format!("OIDC metadata parse error: {e}")))?;

        metadata["authorization_endpoint"]
            .as_str()
            .ok_or_else(|| IoError::Internal("OIDC metadata missing authorization_endpoint".into()))?
            .to_string()
    };

    // Generate PKCE verifier (random 64-byte URL-safe string)
    let pkce_verifier = random_hex(64);

    // PKCE challenge = BASE64URL(SHA256(verifier))
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(pkce_verifier.as_bytes());
    let digest = hasher.finalize();
    let pkce_challenge = base64_url_encode(&digest);

    // CSRF state token and nonce
    let state_token = random_hex(32);
    let nonce = random_hex(32);

    // Persist state in DB (10 minute expiry)
    sqlx::query(
        "INSERT INTO oidc_state_store (state, provider_config_id, pkce_verifier, nonce, redirect_uri)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&state_token)
    .bind(config_id)
    .bind(&pkce_verifier)
    .bind(&nonce)
    .bind(&redirect_uri)
    .execute(&state.db)
    .await?;

    // Build authorization URL
    let scope_str = scopes.join(" ");
    let auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&nonce={}&code_challenge={}&code_challenge_method=S256",
        auth_endpoint,
        percent_encode(&client_id),
        percent_encode(&redirect_uri),
        percent_encode(&scope_str),
        percent_encode(&state_token),
        percent_encode(&nonce),
        percent_encode(&pkce_challenge),
    );

    Ok(Json(ApiResponse::ok(OidcLoginResponse { authorization_url: auth_url })))
}

// ---------------------------------------------------------------------------
// GET /auth/oidc/callback
// Handle OIDC authorization code callback.
// Exchanges code for tokens, looks up / JIT-provisions user, issues JWT.
// ---------------------------------------------------------------------------

pub async fn oidc_callback(
    State(state): State<AppState>,
    Query(params): Query<OidcCallbackParams>,
) -> Response {
    match oidc_callback_inner(state, params).await {
        Ok(resp) => resp,
        Err(e) => e.into_response(),
    }
}

async fn oidc_callback_inner(
    state: AppState,
    params: OidcCallbackParams,
) -> IoResult<Response> {
    // Handle IdP-side errors
    if let Some(err) = params.error {
        let desc = params.error_description.unwrap_or_default();
        return Err(IoError::BadRequest(format!("OIDC error: {err} — {desc}")));
    }

    let code = params.code.ok_or_else(|| IoError::BadRequest("Missing authorization code".into()))?;
    let state_param = params.state.ok_or_else(|| IoError::BadRequest("Missing state parameter".into()))?;

    // Look up state record — verify and consume (single-use)
    let state_row = sqlx::query(
        "DELETE FROM oidc_state_store
         WHERE state = $1 AND expires_at > now()
         RETURNING provider_config_id, pkce_verifier, nonce, redirect_uri",
    )
    .bind(&state_param)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::BadRequest("Invalid or expired OIDC state".into()))?;

    let provider_config_id: Uuid = state_row.get("provider_config_id");
    let pkce_verifier: String = state_row.get("pkce_verifier");
    let expected_nonce: String = state_row.get("nonce");
    let redirect_uri: String = state_row.get("redirect_uri");

    // Load provider config
    let prov_row = sqlx::query(
        "SELECT config, jit_provisioning, default_role_id
         FROM auth_provider_configs
         WHERE id = $1 AND provider_type = 'oidc' AND enabled = true",
    )
    .bind(provider_config_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound("OIDC provider not found or disabled".into()))?;

    let config_json: serde_json::Value = prov_row.get("config");
    let jit_provisioning: bool = prov_row.get("jit_provisioning");
    let default_role_id: Option<Uuid> = prov_row.get("default_role_id");

    let issuer_url = config_json["issuer_url"]
        .as_str()
        .ok_or_else(|| IoError::Internal("OIDC provider missing issuer_url".into()))?
        .to_string();

    let client_id = config_json["client_id"]
        .as_str()
        .ok_or_else(|| IoError::Internal("OIDC provider missing client_id".into()))?
        .to_string();

    let client_secret = config_json["client_secret"]
        .as_str()
        .ok_or_else(|| IoError::Internal("OIDC provider missing client_secret".into()))?
        .to_string();

    // Discover token endpoint
    let discovery_url = format!(
        "{}/.well-known/openid-configuration",
        issuer_url.trim_end_matches('/')
    );
    let http = reqwest::Client::new();
    let metadata: serde_json::Value = http
        .get(&discovery_url)
        .send()
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("OIDC discovery failed: {e}")))?
        .json()
        .await
        .map_err(|e| IoError::Internal(format!("OIDC metadata parse: {e}")))?;

    let token_endpoint = metadata["token_endpoint"]
        .as_str()
        .ok_or_else(|| IoError::Internal("OIDC metadata missing token_endpoint".into()))?
        .to_string();

    let userinfo_endpoint = metadata["userinfo_endpoint"]
        .as_str()
        .map(String::from);

    // Exchange authorization code for tokens
    let token_resp: serde_json::Value = http
        .post(&token_endpoint)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("code_verifier", &pkce_verifier),
        ])
        .send()
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("Token exchange failed: {e}")))?
        .json()
        .await
        .map_err(|e| IoError::Internal(format!("Token response parse: {e}")))?;

    if let Some(err) = token_resp["error"].as_str() {
        let desc = token_resp["error_description"].as_str().unwrap_or("");
        return Err(IoError::BadRequest(format!("Token exchange error: {err} — {desc}")));
    }

    let access_token_oidc = token_resp["access_token"]
        .as_str()
        .ok_or_else(|| IoError::Internal("No access_token in token response".into()))?
        .to_string();

    // Decode ID token claims (without full signature validation for simplicity)
    // In production, full JWT verification against JWKS is required.
    let id_token_str = token_resp["id_token"].as_str().unwrap_or("");
    let id_claims = decode_jwt_payload(id_token_str)?;

    // Validate nonce
    if let Some(token_nonce) = id_claims["nonce"].as_str() {
        if token_nonce != expected_nonce {
            return Err(IoError::BadRequest("OIDC nonce mismatch".into()));
        }
    }

    // Extract user identity from ID token claims
    let oidc_sub = id_claims["sub"]
        .as_str()
        .ok_or_else(|| IoError::Internal("ID token missing sub claim".into()))?
        .to_string();

    // Try userinfo endpoint first for richer claims, fall back to ID token
    let user_claims = if let Some(ref ui_endpoint) = userinfo_endpoint {
        match http.get(ui_endpoint).bearer_auth(&access_token_oidc).send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<serde_json::Value>().await.unwrap_or(id_claims.clone())
            }
            _ => id_claims.clone(),
        }
    } else {
        id_claims.clone()
    };

    let email = user_claims["email"]
        .as_str()
        .or_else(|| id_claims["email"].as_str())
        .unwrap_or(&oidc_sub)
        .to_string();

    let full_name = user_claims["name"]
        .as_str()
        .or_else(|| {
            // Try given_name + family_name
            let given = user_claims["given_name"].as_str().unwrap_or("");
            let family = user_claims["family_name"].as_str().unwrap_or("");
            if !given.is_empty() || !family.is_empty() {
                // Leak-free: store in a temporary — caller borrows the value before returning
                None // We'll handle below
            } else {
                None
            }
        })
        .map(String::from)
        .or_else(|| {
            let given = user_claims["given_name"].as_str().unwrap_or("");
            let family = user_claims["family_name"].as_str().unwrap_or("");
            if !given.is_empty() || !family.is_empty() {
                Some(format!("{} {}", given, family).trim().to_string())
            } else {
                None
            }
        });

    // Extract groups claim (varies by IdP: "groups", "roles", custom)
    let groups: Vec<String> = user_claims["groups"]
        .as_array()
        .or_else(|| user_claims["roles"].as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    // Look up existing user
    let user_row = sqlx::query(
        "SELECT id, username, full_name, email, enabled
         FROM users
         WHERE auth_provider = 'oidc'
           AND auth_provider_config_id = $1
           AND auth_provider_user_id = $2
           AND deleted_at IS NULL",
    )
    .bind(provider_config_id)
    .bind(&oidc_sub)
    .fetch_optional(&state.db)
    .await?;

    let user_id = if let Some(row) = user_row {
        let enabled: bool = row.get("enabled");
        if !enabled {
            return Err(IoError::Forbidden("Account is disabled".into()));
        }
        // Update email/name in case they changed at the IdP
        let uid: Uuid = row.get("id");
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
        // JIT provision a new user
        // Derive a username from email local-part, de-duplicate if needed
        let base_username = email
            .split('@')
            .next()
            .unwrap_or(&oidc_sub)
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
             VALUES ($1, $2, $3, $4, 'oidc', $5, $6, true, now())",
        )
        .bind(new_id)
        .bind(&username)
        .bind(&email)
        .bind(full_name.as_deref())
        .bind(provider_config_id)
        .bind(&oidc_sub)
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

    // Apply group → role mappings for this provider
    if !groups.is_empty() {
        apply_group_role_mappings(&state.db, provider_config_id, user_id, &groups).await?;
    }

    // Get username for JWT
    let username_row = sqlx::query("SELECT username, is_service_account, is_emergency_account FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;
    let username: String = username_row.get("username");
    let is_service_account: bool = username_row.try_get("is_service_account").unwrap_or(false);
    let is_emergency_account: bool = username_row.try_get("is_emergency_account").unwrap_or(false);

    // EULA gate — check acceptance before issuing JWT.
    // Service accounts and emergency accounts are exempt.
    if !is_service_account && !is_emergency_account {
        let eula_not_accepted: bool = sqlx::query(
            "SELECT NOT EXISTS (
                SELECT 1 FROM eula_acceptances ea
                JOIN eula_versions ev ON ev.id = ea.eula_version_id
                WHERE ea.user_id = $1 AND ev.is_active = true AND ev.eula_type = 'end_user'
            ) AS eula_not_accepted",
        )
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<bool, _>("eula_not_accepted").ok())
        .unwrap_or(false);

        if eula_not_accepted {
            // Issue a pending token and redirect the frontend to the EULA page
            let bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen::<u8>()).collect();
            let pending_token: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();

            state.eula_pending_tokens.insert(
                pending_token.clone(),
                EulaPendingEntry {
                    user_id,
                    expires_at: Utc::now() + chrono::Duration::minutes(5),
                    used: false,
                },
            );

            tracing::info!(user_id = %user_id, "OIDC: EULA acceptance required — redirecting to EULA page");

            let frontend_url = std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string());
            let redirect = format!("{}/eula-required?pending_token={}", frontend_url, pending_token);

            return Ok(axum::response::Response::builder()
                .status(StatusCode::FOUND)
                .header(header::LOCATION, redirect)
                .body(axum::body::Body::empty())
                .map_err(|e| IoError::Internal(e.to_string()))?);
        }
    }

    // Collect permissions and issue JWT
    let permissions = fetch_user_permissions(&state.db, user_id).await?;

    let claims = build_claims(&user_id.to_string(), &username, permissions);
    let jwt = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    // Issue refresh token
    use sha2::{Digest, Sha256};
    let refresh_token = Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_token.as_bytes());
    let token_hash = format!("{:x}", hasher.finalize());

    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    sqlx::query(
        "INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, '127.0.0.1'::inet, 'oidc-sso')",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    tracing::info!(user_id = %user_id, "OIDC login successful");

    // Return JSON with access token (frontend will store it)
    // Refresh token set as httpOnly cookie
    let body = ApiResponse::ok(serde_json::json!({
        "access_token": jwt,
        "token_type": "Bearer",
        "expires_in": 900u64,
    }));

    let cookie = format!(
        "refresh_token={refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .parse()
            .map_err(|_| IoError::Internal("cookie encoding error".into()))?,
    );

    Ok(response)
}

// ---------------------------------------------------------------------------
// Helper: decode JWT payload without verification (parse claims only)
// ---------------------------------------------------------------------------

fn decode_jwt_payload(token: &str) -> IoResult<serde_json::Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 {
        return Err(IoError::BadRequest("Invalid ID token format".into()));
    }
    let payload_b64 = parts[1];
    // Add padding if needed
    let padded = match payload_b64.len() % 4 {
        0 => payload_b64.to_string(),
        2 => format!("{payload_b64}=="),
        3 => format!("{payload_b64}="),
        _ => payload_b64.to_string(),
    };
    let decoded = base64_decode_url_safe(&padded)
        .map_err(|e| IoError::Internal(format!("ID token decode error: {e}")))?;
    serde_json::from_slice(&decoded)
        .map_err(|e| IoError::Internal(format!("ID token claims parse: {e}")))
}

// ---------------------------------------------------------------------------
// Helper: BASE64URL encode (no padding)
// ---------------------------------------------------------------------------

fn base64_url_encode(data: &[u8]) -> String {
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    URL_SAFE_NO_PAD.encode(data)
}

fn base64_decode_url_safe(s: &str) -> Result<Vec<u8>, base64::DecodeError> {
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    // Strip padding for URL-safe no-pad decoder
    let stripped = s.trim_end_matches('=');
    URL_SAFE_NO_PAD.decode(stripped)
}

// ---------------------------------------------------------------------------
// Helper: percent-encode a string for use in a URL query parameter
// ---------------------------------------------------------------------------

fn percent_encode(input: &str) -> String {
    let mut output = String::with_capacity(input.len() * 3);
    for byte in input.bytes() {
        match byte {
            // Unreserved characters per RFC 3986
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'~' => {
                output.push(byte as char);
            }
            _ => {
                output.push('%');
                output.push(char::from_digit((byte >> 4) as u32, 16).unwrap().to_ascii_uppercase());
                output.push(char::from_digit((byte & 0xf) as u32, 16).unwrap().to_ascii_uppercase());
            }
        }
    }
    output
}

// ---------------------------------------------------------------------------
// Helper: ensure username is unique by appending a numeric suffix
// ---------------------------------------------------------------------------

async fn ensure_unique_username(
    db: &io_db::DbPool,
    base: &str,
) -> IoResult<String> {
    let base = if base.is_empty() { "user" } else { base };
    // Try the base username first
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL)",
    )
    .bind(base)
    .fetch_one(db)
    .await?;

    if !exists {
        return Ok(base.to_string());
    }

    // Append numeric suffix
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

    Ok(format!("{base}{}", Uuid::new_v4().to_string().replace('-', "")))
}

// ---------------------------------------------------------------------------
// Helper: apply IdP group → role mappings
// (pub so ldap_auth.rs can reuse it)
// ---------------------------------------------------------------------------

pub async fn apply_group_role_mappings(
    db: &io_db::DbPool,
    provider_config_id: Uuid,
    user_id: Uuid,
    groups: &[String],
) -> IoResult<()> {
    // Fetch all mappings for this provider
    let mapping_rows = sqlx::query(
        "SELECT idp_group, role_id, match_type FROM idp_role_mappings WHERE provider_config_id = $1",
    )
    .bind(provider_config_id)
    .fetch_all(db)
    .await?;

    for mapping in mapping_rows {
        let idp_group: String = mapping.get("idp_group");
        let role_id: Uuid = mapping.get("role_id");
        let match_type: String = mapping.get("match_type");

        let matched = groups.iter().any(|g| match match_type.as_str() {
            "exact" => g == &idp_group,
            "prefix" => g.starts_with(&idp_group),
            "contains" => g.contains(&idp_group),
            _ => false,
        });

        if matched {
            let _ = sqlx::query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(role_id)
            .execute(db)
            .await;
        }
    }

    Ok(())
}
