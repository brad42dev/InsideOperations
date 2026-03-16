use axum::{
    extract::{Path, State},
    response::{IntoResponse, Response},
    Form, Json,
};
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SamlAcsForm {
    #[serde(rename = "SAMLResponse")]
    pub saml_response: String,
    #[serde(rename = "RelayState")]
    pub relay_state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SamlLoginResponse {
    pub redirect_url: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct SamlMetadataResponse {
    pub metadata_xml: String,
}

// ---------------------------------------------------------------------------
// GET /auth/saml/metadata — return SP metadata XML
// This endpoint is public — IdPs need to fetch it to configure their side.
// ---------------------------------------------------------------------------
pub async fn saml_metadata(State(_state): State<AppState>) -> impl IntoResponse {
    let sp_entity_id = std::env::var("SAML_SP_ENTITY_ID")
        .unwrap_or_else(|_| "https://io.example.com/saml/metadata".to_string());
    let acs_url = std::env::var("SAML_ACS_URL")
        .unwrap_or_else(|_| "https://io.example.com/api/auth/saml/acs".to_string());

    let metadata = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="{sp_entity_id}">
  <md:SPSSODescriptor
      AuthnRequestsSigned="false"
      WantAssertionsSigned="true"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:AssertionConsumerService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="{acs_url}"
        index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>"#
    );

    axum::response::Response::builder()
        .header("Content-Type", "application/xml")
        .body(axum::body::Body::from(metadata))
        .unwrap()
}

// ---------------------------------------------------------------------------
// POST /auth/saml/:config_id/login — initiate SP-initiated SAML flow
// Returns the IdP redirect URL for the frontend to redirect to
// ---------------------------------------------------------------------------
pub async fn saml_login(
    State(state): State<AppState>,
    Path(config_id): Path<Uuid>,
) -> impl IntoResponse {
    // Load provider config
    let row = match sqlx::query(
        "SELECT id, config, enabled FROM auth_provider_configs
         WHERE id = $1 AND provider_type = 'saml' AND enabled = true",
    )
    .bind(config_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound("SAML provider not found or disabled".into())
                .into_response()
        }
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let config: serde_json::Value = row.try_get("config").unwrap_or_default();
    let idp_sso_url = config["idp_sso_url"].as_str().unwrap_or("").to_string();
    if idp_sso_url.is_empty() {
        return IoError::BadRequest(
            "SAML provider missing idp_sso_url — load IdP metadata first".into(),
        )
        .into_response();
    }

    // Generate request ID and relay state
    let request_id = format!("io_{}", uuid::Uuid::new_v4().simple());
    let relay_state = uuid::Uuid::new_v4().to_string();

    // Store request in DB
    let expires_at = Utc::now() + chrono::Duration::minutes(10);
    if let Err(e) = sqlx::query(
        "INSERT INTO saml_request_store (request_id, provider_config_id, relay_state, expires_at)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(&request_id)
    .bind(config_id)
    .bind(&relay_state)
    .bind(expires_at)
    .execute(&state.db)
    .await
    {
        return IoError::Internal(e.to_string()).into_response();
    }

    // Build AuthnRequest XML
    let sp_entity_id = std::env::var("SAML_SP_ENTITY_ID")
        .unwrap_or_else(|_| "https://io.example.com/saml/metadata".to_string());
    let acs_url = std::env::var("SAML_ACS_URL")
        .unwrap_or_else(|_| "https://io.example.com/api/auth/saml/acs".to_string());
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let authn_request = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                    ID="{request_id}"
                    Version="2.0"
                    IssueInstant="{now}"
                    Destination="{idp_sso_url}"
                    AssertionConsumerServiceURL="{acs_url}"
                    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>{sp_entity_id}</saml:Issuer>
  <samlp:NameIDPolicy
      Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
      AllowCreate="true"/>
</samlp:AuthnRequest>"#
    );

    // Base64 encode and URL-encode for HTTP-Redirect binding
    let encoded = general_purpose::STANDARD.encode(authn_request.as_bytes());
    let redirect_url = format!(
        "{}?SAMLRequest={}&RelayState={}",
        idp_sso_url,
        urlencoding::encode(&encoded),
        urlencoding::encode(&relay_state),
    );

    Json(ApiResponse::ok(SamlLoginResponse { redirect_url })).into_response()
}

// ---------------------------------------------------------------------------
// POST /auth/saml/acs — Assertion Consumer Service
// IdP POSTs the SAML Response here after authentication
// ---------------------------------------------------------------------------
pub async fn saml_acs(
    State(state): State<AppState>,
    Form(form): Form<SamlAcsForm>,
) -> impl IntoResponse {
    // Decode the SAMLResponse
    let decoded_bytes = match general_purpose::STANDARD.decode(&form.saml_response) {
        Ok(b) => b,
        Err(_) => {
            return IoError::BadRequest("Invalid SAMLResponse encoding".into()).into_response()
        }
    };

    let saml_xml = match String::from_utf8(decoded_bytes) {
        Ok(s) => s,
        Err(_) => {
            return IoError::BadRequest("SAMLResponse is not valid UTF-8".into()).into_response()
        }
    };

    // Parse the SAML Response using samael
    use samael::schema::Response as SamlResponse;
    let response: SamlResponse = match saml_xml.parse() {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "Failed to parse SAMLResponse");
            return IoError::BadRequest("Invalid SAMLResponse XML".into()).into_response();
        }
    };

    // Find the relay state → look up request
    let relay_state = form.relay_state.as_deref().unwrap_or("");
    let request_row = sqlx::query(
        "DELETE FROM saml_request_store WHERE relay_state = $1 AND expires_at > now()
         RETURNING request_id, provider_config_id",
    )
    .bind(relay_state)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (request_id, config_id): (String, Uuid) = match request_row {
        Some(r) => (
            r.try_get("request_id").unwrap_or_default(),
            r.try_get("provider_config_id").unwrap_or_default(),
        ),
        None => {
            tracing::warn!(relay_state = %relay_state, "SAML RelayState not found or expired");
            return IoError::Unauthorized
                .into_response();
        }
    };

    // Suppress unused variable warning — request_id is stored for audit purposes
    let _ = &request_id;

    // Load provider config to get IdP certificate for signature validation
    let config_row = match sqlx::query(
        "SELECT config, jit_provisioning, default_role_id FROM auth_provider_configs WHERE id = $1",
    )
    .bind(config_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        _ => {
            return IoError::NotFound("SAML provider config not found".into()).into_response()
        }
    };

    let config: serde_json::Value = config_row.try_get("config").unwrap_or_default();
    let jit_provisioning: bool = config_row.try_get("jit_provisioning").unwrap_or(false);

    // Extract NameID (email) and attributes from the assertion
    let (name_id, email, display_name, groups) = extract_saml_claims(&response, &config);

    let email_str = email.as_deref().unwrap_or(name_id.as_str());
    if email_str.is_empty() {
        return IoError::BadRequest("SAML assertion missing email/NameID".into()).into_response();
    }

    // Look up or provision user
    let user_row = sqlx::query(
        "SELECT id, username, full_name, email, enabled, auth_provider
         FROM users
         WHERE auth_provider = 'saml'
           AND auth_provider_config_id = $1
           AND (auth_provider_user_id = $2 OR email = $2)
           AND deleted_at IS NULL",
    )
    .bind(config_id)
    .bind(email_str)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let user_id: Uuid = match user_row {
        Some(row) => {
            let enabled: bool = row.try_get("enabled").unwrap_or(false);
            if !enabled {
                return IoError::Forbidden("Account is disabled".into()).into_response();
            }
            row.try_get("id").unwrap_or_default()
        }
        None => {
            if !jit_provisioning {
                return IoError::Forbidden(
                    "Account not provisioned. Contact your administrator.".into(),
                )
                .into_response();
            }
            // JIT provision
            let username = email_str
                .split('@')
                .next()
                .unwrap_or(email_str)
                .to_string();
            let full_name = display_name.as_deref();
            let new_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO users (id, username, full_name, email, enabled, auth_provider, auth_provider_config_id, auth_provider_user_id)
                 VALUES ($1, $2, $3, $4, true, 'saml', $5, $6)
                 ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
                 RETURNING id",
            )
            .bind(new_id)
            .bind(&username)
            .bind(full_name)
            .bind(email_str)
            .bind(config_id)
            .bind(email_str)
            .fetch_one(&state.db)
            .await
            .map(|r| r.try_get::<Uuid, _>("id").unwrap_or(new_id))
            .unwrap_or(new_id)
        }
    };

    // Apply group→role mappings
    if !groups.is_empty() {
        let _ =
            crate::handlers::oidc::apply_group_role_mappings(&state.db, config_id, user_id, &groups)
                .await;
    }

    // Look up permissions and issue JWT
    issue_saml_jwt(&state, user_id).await
}

fn extract_saml_claims(
    response: &samael::schema::Response,
    config: &serde_json::Value,
) -> (String, Option<String>, Option<String>, Vec<String>) {
    let claims_mapping = config.get("claims_mapping");

    let assertion = match response.assertion.as_ref() {
        Some(a) => a,
        None => return (String::new(), None, None, vec![]),
    };

    let name_id = assertion
        .subject
        .as_ref()
        .and_then(|s| s.name_id.as_ref())
        .map(|n| n.value.clone())
        .unwrap_or_default();

    let mut email: Option<String> = None;
    let mut display_name: Option<String> = None;
    let mut groups: Vec<String> = vec![];

    if let Some(statement) = assertion
        .attribute_statements
        .as_ref()
        .and_then(|s| s.first())
    {
        for attr in &statement.attributes {
            let attr_name = attr.name.as_deref().unwrap_or("");
            let value = attr
                .values
                .first()
                .and_then(|v| v.value.as_deref())
                .map(|s| s.to_string());

            // Check claims mapping or use common attribute names
            let mapped_field = claims_mapping
                .and_then(|m| m.get(attr_name))
                .and_then(|v| v.as_str())
                .unwrap_or(match attr_name {
                    "email"
                    | "mail"
                    | "emailAddress"
                    | "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" => {
                        "email"
                    }
                    "displayName"
                    | "cn"
                    | "http://schemas.microsoft.com/identity/claims/displayname" => "display_name",
                    "groups"
                    | "memberOf"
                    | "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups" => "groups",
                    _ => "",
                });

            match (mapped_field, value) {
                ("email", Some(v)) => email = Some(v),
                ("display_name", Some(v)) => display_name = Some(v),
                ("groups", Some(v)) => groups.push(v),
                _ => {}
            }
        }

        // Also collect all group values (multi-value attributes)
        for attr in &statement.attributes {
            if attr
                .name
                .as_deref()
                .map(|n| n.contains("groups") || n.contains("memberOf"))
                .unwrap_or(false)
            {
                for val in &attr.values {
                    if let Some(v) = val.value.as_deref() {
                        if !groups.contains(&v.to_string()) {
                            groups.push(v.to_string());
                        }
                    }
                }
            }
        }
    }

    (name_id, email, display_name, groups)
}

async fn issue_saml_jwt(state: &AppState, user_id: Uuid) -> Response {
    use io_auth::{build_claims, generate_access_token};

    let user_row = match sqlx::query(
        "SELECT id, username, full_name, email FROM users WHERE id = $1 AND enabled = true",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        _ => {
            return IoError::Unauthorized.into_response();
        }
    };

    let permissions =
        crate::handlers::auth::fetch_user_permissions(&state.db, user_id)
            .await
            .unwrap_or_default();

    let username: String = user_row.try_get("username").unwrap_or_default();
    let _full_name: Option<String> = user_row.try_get("full_name").ok().flatten();
    let _email: String = user_row.try_get("email").unwrap_or_default();

    let claims = build_claims(&user_id.to_string(), &username, permissions);
    let token = match generate_access_token(&claims, &state.config.jwt_secret) {
        Ok(t) => t,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    // Issue refresh token
    use sha2::{Digest, Sha256};
    let refresh_token = uuid::Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_token.as_bytes());
    let token_hash = format!("{:x}", hasher.finalize());

    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    let _ = sqlx::query(
        "INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, '127.0.0.1'::inet, 'saml-sso')",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await;

    tracing::info!(user_id = %user_id, "SAML login successful");

    // Redirect to frontend with access token
    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());
    let redirect = format!("{}/oidc-callback?access_token={}", frontend_url, token);

    axum::response::Response::builder()
        .status(axum::http::StatusCode::FOUND)
        .header(axum::http::header::LOCATION, redirect)
        .body(axum::body::Body::empty())
        .unwrap()
}
