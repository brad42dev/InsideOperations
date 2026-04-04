use axum::{
    extract::{ConnectInfo, MatchedPath, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use dashmap::DashMap;
use once_cell::sync::Lazy;
use serde_json::json;
use sqlx::Row;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use crate::state::AppState;
use io_auth::{validate_token, Claims};

// ---------------------------------------------------------------------------
// JWT extraction middleware
//
// Reads the Bearer token from Authorization header, validates it, and
// inserts Claims into request extensions. Skips unprotected paths.
// ---------------------------------------------------------------------------

pub async fn jwt_auth(State(state): State<AppState>, mut req: Request, next: Next) -> Response {
    // Paths that don't require JWT validation
    let path = req.uri().path();
    if is_public_path(path) {
        return next.run(req).await;
    }

    let jwt_secret = req
        .extensions()
        .get::<Arc<String>>()
        .cloned()
        .map(|s| s.as_ref().clone())
        .unwrap_or_default();

    let token = match extract_bearer(req.headers()) {
        Some(t) => t.to_owned(),
        None => return unauthorized("Authentication required"),
    };

    // Allow service-to-service calls with the service secret
    if let Some(service_secret) = req.extensions().get::<Arc<ServiceSecret>>() {
        if constant_time_eq(&token, &service_secret.0) {
            // Service-level access: insert a synthetic claims struct
            let service_claims = Claims {
                sub: "service".to_string(),
                username: "service".to_string(),
                permissions: vec!["*".to_string()],
                exp: i64::MAX,
                iat: Utc::now().timestamp(),
            };
            req.extensions_mut().insert(service_claims);
            return next.run(req).await;
        }
    }

    // API key path: tokens prefixed with io_sk_
    if token.starts_with("io_sk_") {
        return handle_api_key_auth(&token, &state, req, next).await;
    }

    match validate_token(&token, &jwt_secret) {
        Ok(claims) => {
            // Check that the user account is still enabled. This enforces immediate
            // lockout when an admin disables an account — the 15-min access-token
            // window is bypassed. We only reject if the DB confirms enabled=false;
            // on DB error we allow the request through to avoid service disruption.
            if let Ok(Some(row)) =
                sqlx::query("SELECT enabled FROM users WHERE id = $1::uuid AND deleted_at IS NULL")
                    .bind(&claims.sub)
                    .fetch_optional(&state.db)
                    .await
            {
                let enabled: bool = row.get("enabled");
                if !enabled {
                    return unauthorized("Account is disabled");
                }
            }

            // Inject user context headers so downstream services can read them
            // without re-validating the JWT.
            if let Ok(v) = HeaderValue::from_str(&claims.sub) {
                req.headers_mut().insert("x-io-user-id", v);
            }
            if let Ok(v) = HeaderValue::from_str(&claims.username) {
                req.headers_mut().insert("x-io-username", v);
            }
            if let Ok(v) = HeaderValue::from_str(&claims.permissions.join(",")) {
                req.headers_mut().insert("x-io-permissions", v);
            }
            req.extensions_mut().insert(claims);
            next.run(req).await
        }
        Err(_) => unauthorized("Invalid or expired token"),
    }
}

fn is_public_path(path: &str) -> bool {
    matches!(
        path,
        "/api/auth/login"
        | "/api/auth/refresh"
        | "/api/auth/providers"
        // EULA current text is public so EulaAcceptance page works even without a JWT
        // (e.g. direct URL navigation to /eula, or pre-acceptance state)
        | "/api/auth/eula/current"
        | "/api/auth/mfa/email/send"
        | "/api/auth/mfa/email/verify"
        | "/api/auth/mfa/sms/send"
        | "/api/auth/mfa/sms/verify"
        | "/api/mobile/health"
        | "/health/live"
        | "/health/ready"
        | "/health/startup"
        | "/metrics"
        // Internal certificate renewal — called by systemd timer as root with no token.
        | "/api/internal/certs/renew"
    ) || path.starts_with("/api/auth/oidc/")
        || path.starts_with("/api/auth/saml/")
        || path.starts_with("/api/auth/ldap/")
        || path.starts_with("/scim/v2/")
        // Webhook receiver — HMAC-SHA256 validated internally by import-service
        || path.starts_with("/api/import/webhooks/")
}

fn extract_bearer(headers: &axum::http::HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
}

fn unauthorized(message: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "success": false,
            "error": { "code": "UNAUTHORIZED", "message": message }
        })),
    )
        .into_response()
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

// ---------------------------------------------------------------------------
// Service secret wrapper (inserted into extensions by main)
// ---------------------------------------------------------------------------

pub struct ServiceSecret(pub String);

// ---------------------------------------------------------------------------
// API key authentication
//
// Tokens with the `io_sk_` prefix are API keys stored in the database.
// The full token is hashed with Argon2id at creation time; we cannot do a
// direct hash-equality lookup, so we first narrow by key_prefix (first 8
// characters) and then verify each candidate with Argon2id.
// ---------------------------------------------------------------------------

async fn handle_api_key_auth(
    token: &str,
    state: &AppState,
    mut req: Request,
    next: Next,
) -> Response {
    // The prefix stored in the DB is the first 8 characters of the token.
    // For io_sk_ keys this is always the first 8 chars (e.g. "io_sk_XX").
    let prefix: String = token.chars().take(8).collect();

    // Fetch all active, non-expired candidates that share this prefix.
    // We do Argon2 verification in Rust to find the matching row.
    let rows = match sqlx::query(
        "SELECT id, user_id, key_hash, scopes, expires_at
         FROM api_keys
         WHERE key_prefix = $1
           AND (expires_at IS NULL OR expires_at > NOW())",
    )
    .bind(&prefix)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "api key db lookup failed");
            return unauthorized("Authentication error");
        }
    };

    // Argon2 verify each candidate. We never log the raw token.
    let mut matched_row = None;
    for row in &rows {
        let stored_hash: &str = row.get("key_hash");
        match io_auth::verify_password(token, stored_hash) {
            Ok(true) => {
                matched_row = Some(row);
                break;
            }
            Ok(false) => continue,
            Err(e) => {
                tracing::warn!(error = %e, "api key hash verification error");
                continue;
            }
        }
    }

    let row = match matched_row {
        Some(r) => r,
        None => return unauthorized("Invalid or expired API key"),
    };

    let key_id: uuid::Uuid = row.get("id");
    let user_id: uuid::Uuid = row.get("user_id");
    let scopes: Vec<String> = row
        .get::<Option<Vec<String>>, _>("scopes")
        .unwrap_or_default();

    // Look up the username so the synthetic claims include a meaningful identity.
    let username = match sqlx::query(
        "SELECT username FROM users WHERE id = $1 AND deleted_at IS NULL AND enabled = true",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r.get::<String, _>("username"),
        Ok(None) => return unauthorized("API key owner not found or disabled"),
        Err(e) => {
            tracing::error!(error = %e, "api key user lookup failed");
            return unauthorized("Authentication error");
        }
    };

    // Fire-and-forget: update last_used_at asynchronously so we don't block the request.
    let db = state.db.clone();
    tokio::spawn(async move {
        let _ = sqlx::query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1")
            .bind(key_id)
            .execute(&db)
            .await;
    });

    let api_claims = Claims {
        sub: user_id.to_string(),
        username,
        permissions: scopes,
        exp: i64::MAX,
        iat: Utc::now().timestamp(),
    };

    // Inject the same context headers as the JWT path.
    if let Ok(v) = HeaderValue::from_str(&api_claims.sub) {
        req.headers_mut().insert("x-io-user-id", v);
    }
    if let Ok(v) = HeaderValue::from_str(&api_claims.username) {
        req.headers_mut().insert("x-io-username", v);
    }
    if let Ok(v) = HeaderValue::from_str(&api_claims.permissions.join(",")) {
        req.headers_mut().insert("x-io-permissions", v);
    }
    req.extensions_mut().insert(api_claims);
    next.run(req).await
}

// ---------------------------------------------------------------------------
// Rate limiting middleware
//
// Token bucket per IP for auth endpoints (10 req/min),
// per-user for authenticated endpoints (600 req/min).
// Unauthenticated non-auth endpoints: 30 req/min per IP.
// ---------------------------------------------------------------------------

#[derive(Default)]
struct Bucket {
    tokens: f64,
    last_refill: i64, // Unix timestamp seconds
}

static RATE_BUCKETS: Lazy<DashMap<String, Bucket>> = Lazy::new(DashMap::new);

const AUTH_LIMIT: f64 = 10.0;
const AUTH_WINDOW_SECS: f64 = 60.0;
const USER_LIMIT: f64 = 600.0;
const USER_WINDOW_SECS: f64 = 60.0;
const UNAUTH_LIMIT: f64 = 30.0;

pub async fn rate_limit(req: Request, next: Next) -> Response {
    let path = req.uri().path();
    let now = Utc::now().timestamp();

    // Authenticated API endpoints are exempt from per-IP rate limiting here.
    //
    // The rate_limit middleware runs BEFORE jwt_auth in the tower stack, so
    // Claims are not yet injected when this function executes. Any request to
    // an authenticated endpoint therefore falls into the unauthenticated branch
    // below (30 req/min per IP), causing spurious 429s during normal single-user
    // sessions (e.g. loading /designer triggers multiple /api/v1/design-objects
    // calls that exceed this limit).
    //
    // Auth endpoints (/api/auth/*) are NOT exempt — they retain the tight
    // AUTH_LIMIT (10/min per IP) to protect against credential-stuffing attacks.
    // All other /api/* endpoints require a valid JWT; jwt_auth will still reject
    // unauthenticated requests, so exempting them here introduces no security
    // regression.
    if is_authenticated_api_endpoint(path) {
        return next.run(req).await;
    }

    // Prefer the real socket IP from ConnectInfo (injected by into_make_service_with_connect_info).
    // Fall back to X-Forwarded-For/X-Real-IP only when ConnectInfo is absent (e.g. tests).
    let socket_ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip().to_string());

    let (key, limit, window_secs) = if is_auth_endpoint(path) {
        let ip = socket_ip
            .clone()
            .unwrap_or_else(|| client_ip(req.headers()));
        // Localhost (dev/UAT) is exempt from auth rate limiting — no credential-stuffing risk.
        if ip == "127.0.0.1" || ip == "::1" {
            return next.run(req).await;
        }
        (format!("auth:{ip}"), AUTH_LIMIT, AUTH_WINDOW_SECS)
    } else if let Some(claims) = req.extensions().get::<Claims>() {
        (format!("user:{}", claims.sub), USER_LIMIT, USER_WINDOW_SECS)
    } else {
        let ip = socket_ip.unwrap_or_else(|| client_ip(req.headers()));
        (format!("ip:{ip}"), UNAUTH_LIMIT, AUTH_WINDOW_SECS)
    };

    let (allowed, remaining) = {
        let mut entry = RATE_BUCKETS.entry(key.clone()).or_insert_with(|| Bucket {
            tokens: limit,
            last_refill: now,
        });

        let elapsed = (now - entry.last_refill) as f64;
        let refill = elapsed * (limit / window_secs);
        entry.tokens = (entry.tokens + refill).min(limit);
        entry.last_refill = now;

        if entry.tokens >= 1.0 {
            entry.tokens -= 1.0;
            (true, entry.tokens.floor() as u64)
        } else {
            (false, 0u64)
        }
    };

    let reset_ts = now + window_secs as i64;

    if !allowed {
        let retry_after = window_secs as u64 / limit as u64;
        let mut resp = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({
                "success": false,
                "error": {
                    "code": "RATE_LIMITED",
                    "message": format!("Too many requests. Retry after {} seconds.", retry_after)
                }
            })),
        )
            .into_response();
        resp.headers_mut().insert(
            "retry-after",
            HeaderValue::from_str(&retry_after.to_string()).unwrap(),
        );
        resp.headers_mut().insert(
            "x-ratelimit-limit",
            HeaderValue::from_str(&(limit as u64).to_string()).unwrap(),
        );
        resp.headers_mut()
            .insert("x-ratelimit-remaining", HeaderValue::from_str("0").unwrap());
        resp.headers_mut().insert(
            "x-ratelimit-reset",
            HeaderValue::from_str(&reset_ts.to_string()).unwrap(),
        );
        return resp;
    }

    let mut resp = next.run(req).await;
    resp.headers_mut().insert(
        "x-ratelimit-limit",
        HeaderValue::from_str(&(limit as u64).to_string()).unwrap(),
    );
    resp.headers_mut().insert(
        "x-ratelimit-remaining",
        HeaderValue::from_str(&remaining.to_string()).unwrap(),
    );
    resp.headers_mut().insert(
        "x-ratelimit-reset",
        HeaderValue::from_str(&reset_ts.to_string()).unwrap(),
    );
    resp
}

fn is_auth_endpoint(path: &str) -> bool {
    path.starts_with("/api/auth/")
}

/// Returns true for any API endpoint that requires JWT authentication.
///
/// These endpoints are exempt from per-IP rate limiting in the rate_limit
/// middleware because that middleware runs before jwt_auth and therefore
/// cannot see the user identity. Applying the low UNAUTH_LIMIT (30/min) to
/// authenticated endpoints causes spurious 429s during normal single-user
/// sessions (e.g. /api/v1/design-objects during Designer load).
///
/// Auth endpoints (/api/auth/*) are excluded — they remain subject to
/// AUTH_LIMIT (10/min per IP) to deter credential-stuffing attacks.
/// jwt_auth still enforces JWT validity on all non-auth routes; exempting
/// them from this middleware introduces no security regression.
fn is_authenticated_api_endpoint(path: &str) -> bool {
    path.starts_with("/api/") && !path.starts_with("/api/auth/")
}

/// Fallback IP extraction from headers. Only used when ConnectInfo<SocketAddr> is absent
/// (e.g. unit tests). In production, real socket IP from ConnectInfo is preferred.
/// Do NOT use this as primary IP in rate-limiting — X-Forwarded-For can be spoofed.
fn client_ip(headers: &axum::http::HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("127.0.0.1")
        .trim()
        .to_string()
}

// ---------------------------------------------------------------------------
// HTTP metrics middleware
//
// Records per-request counters and latency histograms after every response.
// This middleware must be applied inside the router (before `.with_state()`),
// so that Axum's routing pass has already run and `MatchedPath` is available
// in request extensions. Using route templates (e.g. `/api/points/:id`)
// instead of raw URI paths prevents label cardinality explosion in Prometheus.
// ---------------------------------------------------------------------------

pub async fn metrics_middleware(req: Request, next: Next) -> Response {
    let method = req.method().to_string();
    // Extract the route template from Axum's MatchedPath extension.
    // This is only populated after the router has resolved the route, so this
    // middleware must run inside the router (not as an outermost app layer).
    let path = req
        .extensions()
        .get::<MatchedPath>()
        .map(|mp| mp.as_str().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let start = Instant::now();

    metrics::gauge!("io_http_requests_in_flight", "service" => "api-gateway").increment(1.0);
    let response = next.run(req).await;
    metrics::gauge!("io_http_requests_in_flight", "service" => "api-gateway").decrement(1.0);

    let duration_secs = start.elapsed().as_secs_f64();
    let status_str = response.status().as_u16().to_string();

    metrics::counter!(
        "io_http_requests_total",
        "service" => "api-gateway",
        "method" => method.clone(),
        "path"   => path.clone(),
        "status" => status_str,
    )
    .increment(1);

    metrics::histogram!(
        "io_http_request_duration_seconds",
        "service" => "api-gateway",
        "method"  => method,
        "path"    => path,
    )
    .record(duration_secs);

    response
}
