//! Duo Security MFA — Universal Prompt via OIDC Auth API
//!
//! Flow:
//!   1. `GET /auth/mfa/duo/:config_id/login` — initiate Duo Universal Prompt
//!   2. Duo redirects back to `GET /auth/mfa/duo/callback` with an auth code
//!   3. I/O exchanges the code for a Duo ID token and validates it
//!   4. On success, the pending MFA token is consumed and a JWT is issued
//!
//! Duo's OIDC implementation is non-standard:
//!   - No Discovery (`.well-known/openid-configuration`) endpoint
//!   - No UserInfo endpoint
//!   - JWKS at `https://api-{hostname}.duosecurity.com/.well-known/keys`
//!   - Token endpoint at `https://api-{hostname}.duosecurity.com/oauth/v1/token`
//!   - Health check at `https://api-{hostname}.duosecurity.com/oauth/v1/health_check`
//!
//! We MUST NOT use the `openidconnect` crate's standard discovery for Duo.

use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use io_auth::{build_claims, generate_access_token};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::handlers::auth::fetch_user_permissions;
use crate::oidc_jwks::{fetch_jwks, IdTokenClaims};
use crate::state::{AppState, DuoStateEntry};

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct DuoCallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DuoLoginResponse {
    /// The authorization URL to redirect the user to.
    pub authorization_url: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn random_hex(len: usize) -> String {
    let bytes: Vec<u8> = (0..len).map(|_| rand::thread_rng().gen::<u8>()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn percent_encode(input: &str) -> String {
    let mut output = String::with_capacity(input.len() * 3);
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                output.push(byte as char);
            }
            _ => {
                output.push('%');
                output.push(
                    char::from_digit((byte >> 4) as u32, 16)
                        .unwrap()
                        .to_ascii_uppercase(),
                );
                output.push(
                    char::from_digit((byte & 0xf) as u32, 16)
                        .unwrap()
                        .to_ascii_uppercase(),
                );
            }
        }
    }
    output
}

/// Call the Duo health check endpoint before initiating the auth flow.
/// Returns `Err` if Duo is unreachable or returns a non-2xx response.
async fn duo_health_check(
    http: &reqwest::Client,
    api_hostname: &str,
    client_id: &str,
    client_secret: &str,
) -> IoResult<()> {
    let url = format!(
        "https://{api_hostname}/oauth/v1/health_check"
    );

    // Duo health check uses HTTP Basic auth: base64(client_id:client_secret)
    let resp = http
        .get(&url)
        .basic_auth(client_id, Some(client_secret))
        .send()
        .await
        .map_err(|e| {
            IoError::ServiceUnavailable(format!("Duo health check unreachable: {e}"))
        })?;

    if !resp.status().is_success() {
        return Err(IoError::ServiceUnavailable(format!(
            "Duo health check returned HTTP {}",
            resp.status()
        )));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// GET /auth/mfa/duo/:config_id/login
//
// Initiates the Duo Universal Prompt.  The caller must supply the
// `mfa_token` query parameter (the short-lived MFA pending token issued
// during primary authentication).
//
// Returns the Duo authorization URL for the frontend to redirect to.
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct DuoLoginQuery {
    pub mfa_token: String,
}

pub async fn duo_login(
    State(state): State<AppState>,
    Path(config_id): Path<Uuid>,
    Query(query): Query<DuoLoginQuery>,
) -> IoResult<impl IntoResponse> {
    // --- 1. Validate the MFA pending token ---
    let pending_entry = {
        let entry = state
            .mfa_pending_tokens
            .get(&query.mfa_token)
            .map(|e| e.clone());
        entry.ok_or(IoError::Unauthorized)?
    };

    if pending_entry.expires_at < Utc::now() {
        state.mfa_pending_tokens.remove(&query.mfa_token);
        return Err(IoError::Unauthorized);
    }

    let user_id = pending_entry.user_id;

    // --- 2. Load Duo provider config ---
    let row = sqlx::query(
        "SELECT config FROM auth_provider_configs
         WHERE id = $1 AND provider_type = 'duo' AND enabled = true",
    )
    .bind(config_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound("Duo provider not found or disabled".into()))?;

    let config_json: serde_json::Value = row.get("config");

    let api_hostname = config_json["api_hostname"]
        .as_str()
        .ok_or_else(|| IoError::Internal("Duo provider missing api_hostname".into()))?
        .to_string();

    let duo_client_id = config_json["client_id"]
        .as_str()
        .ok_or_else(|| IoError::Internal("Duo provider missing client_id".into()))?
        .to_string();

    let duo_client_secret = config_json["client_secret"]
        .as_str()
        .ok_or_else(|| IoError::Internal("Duo provider missing client_secret".into()))?
        .to_string();

    let redirect_uri = config_json["redirect_uri"]
        .as_str()
        .unwrap_or("/api/auth/mfa/duo/callback")
        .to_string();

    // --- 3. Duo health check (per spec: call before redirecting) ---
    duo_health_check(&state.http, &api_hostname, &duo_client_id, &duo_client_secret).await?;

    // --- 4. Look up the username for the duo_uname parameter ---
    let user_row = sqlx::query("SELECT username FROM users WHERE id = $1 AND deleted_at IS NULL")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(IoError::Unauthorized)?;
    let username: String = user_row.get("username");

    // --- 5. Generate CSRF state token and nonce ---
    let state_token = random_hex(32);
    let nonce = random_hex(32);

    // --- 6. Store Duo state in memory (10-minute TTL) ---
    state.duo_state_tokens.insert(
        state_token.clone(),
        DuoStateEntry {
            mfa_pending_token: query.mfa_token.clone(),
            config_id,
            api_hostname: api_hostname.clone(),
            duo_client_id: duo_client_id.clone(),
            duo_client_secret: duo_client_secret.clone(),
            redirect_uri: redirect_uri.clone(),
            nonce: nonce.clone(),
            expected_username: username.clone(),
            expires_at: Utc::now() + chrono::Duration::minutes(10),
        },
    );

    // --- 7. Build Duo authorization URL ---
    let auth_url = format!(
        "https://{api_hostname}/oauth/v1/authorize?response_type=code&client_id={}&redirect_uri={}&scope=openid&state={}&nonce={}&duo_uname={}",
        percent_encode(&duo_client_id),
        percent_encode(&redirect_uri),
        percent_encode(&state_token),
        percent_encode(&nonce),
        percent_encode(&username),
    );

    tracing::info!(user_id = %user_id, "Duo Universal Prompt initiated");

    Ok(Json(ApiResponse::ok(DuoLoginResponse {
        authorization_url: auth_url,
    })))
}

// ---------------------------------------------------------------------------
// GET /auth/mfa/duo/callback
//
// Handles the redirect from Duo after the user completes the challenge.
// Validates state, exchanges code for tokens, validates the Duo ID token,
// and issues the I/O JWT.
// ---------------------------------------------------------------------------

pub async fn duo_callback(
    State(state): State<AppState>,
    Query(params): Query<DuoCallbackParams>,
) -> Response {
    match duo_callback_inner(state, params).await {
        Ok(resp) => resp,
        Err(e) => e.into_response(),
    }
}

async fn duo_callback_inner(
    state: AppState,
    params: DuoCallbackParams,
) -> IoResult<Response> {
    // Handle Duo-side errors
    if let Some(err) = params.error {
        let desc = params.error_description.unwrap_or_default();
        return Err(IoError::BadRequest(format!("Duo error: {err} — {desc}")));
    }

    let code = params
        .code
        .ok_or_else(|| IoError::BadRequest("Missing authorization code from Duo".into()))?;

    let state_param = params
        .state
        .ok_or_else(|| IoError::BadRequest("Missing state parameter from Duo".into()))?;

    // --- 1. Validate and consume Duo state token (CSRF protection) ---
    let duo_entry = state
        .duo_state_tokens
        .remove(&state_param)
        .map(|(_, v)| v)
        .ok_or_else(|| IoError::BadRequest("Invalid or expired Duo state token".into()))?;

    if duo_entry.expires_at < Utc::now() {
        return Err(IoError::BadRequest("Duo state token has expired".into()));
    }

    let api_hostname = &duo_entry.api_hostname;
    let duo_client_id = &duo_entry.duo_client_id;
    let duo_client_secret = &duo_entry.duo_client_secret;
    let redirect_uri = &duo_entry.redirect_uri;
    let expected_nonce = &duo_entry.nonce;
    let expected_username = &duo_entry.expected_username;
    let mfa_pending_token = &duo_entry.mfa_pending_token;

    // --- 2. Look up and validate the MFA pending token (still valid?) ---
    let pending_entry = {
        state
            .mfa_pending_tokens
            .get(mfa_pending_token)
            .map(|e| e.clone())
            .ok_or(IoError::Unauthorized)?
    };

    if pending_entry.expires_at < Utc::now() {
        state.mfa_pending_tokens.remove(mfa_pending_token);
        return Err(IoError::Unauthorized);
    }

    let user_id = pending_entry.user_id;

    // --- 3. Exchange authorization code for Duo tokens (Basic auth) ---
    // Duo token endpoint: POST https://api-{hostname}.duosecurity.com/oauth/v1/token
    let token_endpoint = format!("https://{api_hostname}/oauth/v1/token");

    let token_resp: serde_json::Value = state
        .http
        .post(&token_endpoint)
        .basic_auth(duo_client_id, Some(duo_client_secret))
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
        .map_err(|e| IoError::ServiceUnavailable(format!("Duo token exchange failed: {e}")))?
        .json()
        .await
        .map_err(|e| IoError::Internal(format!("Duo token response parse error: {e}")))?;

    if let Some(err) = token_resp["error"].as_str() {
        let desc = token_resp["error_description"].as_str().unwrap_or("");
        return Err(IoError::BadRequest(format!(
            "Duo token exchange error: {err} — {desc}"
        )));
    }

    let id_token_str = token_resp["id_token"]
        .as_str()
        .ok_or_else(|| IoError::Internal("Duo token response missing id_token".into()))?;

    // --- 4. Validate the Duo ID token ---
    // Duo JWKS endpoint: GET https://api-{hostname}.duosecurity.com/.well-known/keys
    // (Note: Duo does NOT have a Discovery endpoint — endpoints are hardcoded)
    let jwks_uri = format!("https://{api_hostname}/.well-known/keys");

    // Duo issuer is the API hostname (without https://)
    // The `iss` in the token is `https://api-{hostname}.duosecurity.com`
    let expected_issuer = format!("https://{api_hostname}");

    // Use the shared JWKS fetch+cache from oidc_jwks.rs
    let id_claims: IdTokenClaims = verify_duo_id_token(
        &state.http,
        &state.jwks_cache,
        id_token_str,
        &jwks_uri,
        &expected_issuer,
        duo_client_id,
        expected_nonce,
    )
    .await?;

    // --- 5. Verify the Duo username matches the expected user ---
    // Duo returns the username in the `preferred_username` claim
    let duo_username = id_claims
        .extra
        .get("preferred_username")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if duo_username != expected_username {
        tracing::warn!(
            user_id = %user_id,
            duo_username = duo_username,
            expected = expected_username,
            "Duo callback: preferred_username mismatch"
        );
        return Err(IoError::BadRequest(
            "Duo preferred_username does not match expected user".into(),
        ));
    }

    // --- 6. Consume the MFA pending token (single-use) ---
    state.mfa_pending_tokens.remove(mfa_pending_token);

    // --- 7. Issue I/O JWT + refresh token ---
    let user_row = sqlx::query(
        "SELECT username, enabled FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let enabled: bool = user_row.get("enabled");
    if !enabled {
        return Err(IoError::Forbidden("Account is disabled".into()));
    }

    let username: String = user_row.get("username");
    let permissions = fetch_user_permissions(&state.db, user_id).await?;
    let claims = build_claims(&user_id.to_string(), &username, permissions);
    let access_token = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    // Refresh token
    let refresh_token = Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_token.as_bytes());
    let refresh_token_hash = format!("{:x}", hasher.finalize());

    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    sqlx::query(
        "INSERT INTO user_sessions
            (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, '127.0.0.1'::inet, 'duo-mfa')",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&refresh_token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    sqlx::query(
        "UPDATE users SET last_login_at = NOW(), failed_login_count = 0, locked_until = NULL
         WHERE id = $1",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    metrics::counter!(
        "io_mfa_verifications_total",
        "method" => "duo",
        "result" => "success",
    )
    .increment(1);

    tracing::info!(user_id = %user_id, "Duo MFA verification successful — login complete");

    let body_resp = ApiResponse::ok(serde_json::json!({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 900u64,
    }));

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
// Duo ID token verification
//
// Duo's OIDC is non-standard:
//   - No Discovery endpoint — JWKS URI is hardcoded to /.well-known/keys
//   - No UserInfo endpoint
//   - iss = "https://api-{hostname}.duosecurity.com"
//   - aud = client_id (single string, not array)
//   - nonce MUST match
//   - preferred_username MUST match the username submitted
// ---------------------------------------------------------------------------

async fn verify_duo_id_token(
    http: &reqwest::Client,
    jwks_cache: &crate::oidc_jwks::JwksCache,
    id_token: &str,
    jwks_uri: &str,
    expected_issuer: &str,
    expected_client_id: &str,
    expected_nonce: &str,
) -> IoResult<IdTokenClaims> {
    use jsonwebtoken::{decode_header, Validation};

    if id_token.is_empty() {
        return Err(IoError::BadRequest(
            "Duo id_token is missing from token response".into(),
        ));
    }

    // Parse the JWT header to identify the key and algorithm.
    let header = decode_header(id_token)
        .map_err(|e| IoError::BadRequest(format!("Duo id_token header parse error: {e}")))?;

    let alg = header.alg;
    let kid = header.kid.as_deref();

    // Fetch (or cache-hit) the Duo JWKS.
    let jwks = fetch_jwks(http, jwks_cache, expected_issuer, jwks_uri).await?;

    // Find the matching JWK.
    let jwk = crate::oidc_jwks::find_matching_key_pub(&jwks, kid, alg)
        .ok_or_else(|| IoError::BadRequest("No matching JWKS key found for Duo id_token".into()))?;

    // Build the decoding key.
    let decoding_key = crate::oidc_jwks::jwk_to_decoding_key_pub(jwk)?;

    // Validate: exp, iss.  aud is validated manually below.
    let mut validation = Validation::new(alg);
    validation.validate_aud = false;
    validation.validate_exp = true;
    validation.set_issuer(&[expected_issuer]);

    let token_data =
        jsonwebtoken::decode::<IdTokenClaims>(id_token, &decoding_key, &validation)
            .map_err(|e| {
                IoError::BadRequest(format!("Duo id_token signature validation failed: {e}"))
            })?;

    let claims = token_data.claims;

    // Issuer check.
    if claims.iss != expected_issuer {
        return Err(IoError::BadRequest(format!(
            "Duo id_token issuer mismatch: got '{}', expected '{}'",
            claims.iss, expected_issuer
        )));
    }

    // Audience check.
    let aud_ok = match &claims.aud {
        serde_json::Value::String(s) => s == expected_client_id,
        serde_json::Value::Array(arr) => arr
            .iter()
            .any(|v| v.as_str() == Some(expected_client_id)),
        _ => false,
    };
    if !aud_ok {
        return Err(IoError::BadRequest(format!(
            "Duo id_token audience does not include client_id '{}'",
            expected_client_id
        )));
    }

    // Expiry check.
    let now = Utc::now().timestamp();
    if claims.exp < now {
        return Err(IoError::BadRequest("Duo id_token has expired".into()));
    }

    // Nonce validation — MUST be present and match.
    match &claims.nonce {
        Some(n) if n == expected_nonce => {}
        Some(n) => {
            return Err(IoError::BadRequest(format!(
                "Duo nonce mismatch: token has '{n}', expected '{expected_nonce}'"
            )));
        }
        None => {
            return Err(IoError::BadRequest(
                "Duo id_token is missing the nonce claim".into(),
            ));
        }
    }

    Ok(claims)
}
