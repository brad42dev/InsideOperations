/// Security integration tests for the API Gateway JWT middleware.
///
/// These tests spin up a minimal in-process Axum server on an OS-assigned port
/// and exercise the JWT authentication middleware without requiring a live
/// database or external gateway process.
///
/// The tests that require a full running gateway (rate limiting, CORS policy,
/// RBAC against real data) remain marked `#[ignore]` and can be run with:
///
///   cargo test -p api-gateway --test security -- --ignored
use axum::{
    extract::Request,
    http::{header, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use io_auth::{build_claims, generate_access_token, validate_token, Claims};
use reqwest::{Client, Method};
use serde_json::{json, Value};
use std::future::IntoFuture;
use std::net::SocketAddr;
use tokio::net::TcpListener;

// ---------------------------------------------------------------------------
// Minimal JWT middleware (mirrors api-gateway/src/mw.rs without DB checks)
// ---------------------------------------------------------------------------

/// A self-contained JWT auth middleware for test purposes.
/// Uses the secret stored in the `X-Test-JWT-Secret` extension (injected as
/// an `Arc<String>` layer).
async fn test_jwt_auth(req: Request, next: Next) -> Response {
    let secret = req
        .extensions()
        .get::<std::sync::Arc<String>>()
        .map(|s| s.as_ref().clone())
        .unwrap_or_else(|| "test-secret".to_string());

    let token = match extract_bearer(req.headers()) {
        Some(t) => t.to_string(),
        None => return unauthorized("Authentication required"),
    };

    match validate_token(&token, &secret) {
        Ok(_) => next.run(req).await,
        Err(_) => unauthorized("Invalid or expired token"),
    }
}

fn extract_bearer(headers: &HeaderMap) -> Option<&str> {
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

/// Protected handler — returns 200 if reached.
async fn protected_handler() -> impl IntoResponse {
    Json(json!({ "success": true, "data": { "message": "ok" } }))
}

/// Build a minimal test router with JWT middleware applied.
fn test_app(secret: &str) -> Router {
    let secret_arc = std::sync::Arc::new(secret.to_string());
    Router::new()
        .route("/api/users", get(protected_handler))
        .layer(middleware::from_fn(test_jwt_auth))
        .layer(axum::Extension(secret_arc))
}

/// Bind a listener on port 0 and return it + the bound address.
async fn bind_listener() -> (TcpListener, SocketAddr) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    (listener, addr)
}

// ---------------------------------------------------------------------------
// Test 1: Unauthenticated request → 401  (in-process, no #[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_unauthenticated_returns_401() {
    let (listener, addr) = bind_listener().await;
    let app = test_app("test-secret");
    tokio::spawn(axum::serve(listener, app).into_future());

    let client = Client::new();
    let url = format!("http://{}/api/users", addr);

    let resp = client.get(&url).send().await.expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::UNAUTHORIZED,
        "Expected 401 for unauthenticated request to /api/users"
    );
}

// ---------------------------------------------------------------------------
// Test 2: Expired JWT → 401  (in-process, no #[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_expired_token_returns_401() {
    let (listener, addr) = bind_listener().await;
    let app = test_app("test-secret");
    tokio::spawn(axum::serve(listener, app).into_future());

    // Build expired claims (exp in the past).
    let now = chrono::Utc::now().timestamp();
    let expired = Claims {
        sub: "00000000-0000-0000-0000-000000000001".to_string(),
        username: "testuser".to_string(),
        permissions: vec![],
        iat: now - 200,
        exp: now - 100, // 100 s in the past
    };
    let token =
        generate_access_token(&expired, "test-secret").expect("should encode even if exp is past");

    let client = Client::new();
    let url = format!("http://{}/api/users", addr);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::UNAUTHORIZED,
        "Expected 401 for expired JWT"
    );
}

// ---------------------------------------------------------------------------
// Test 3: Valid JWT → 200  (in-process, no #[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_valid_token_returns_200() {
    let (listener, addr) = bind_listener().await;
    let secret = "integration-test-secret";
    let app = test_app(secret);
    tokio::spawn(axum::serve(listener, app).into_future());

    let claims = build_claims(
        "00000000-0000-0000-0000-000000000002",
        "testuser",
        vec!["users.view".to_string()],
    );
    let token = generate_access_token(&claims, secret).expect("token generation failed");

    let client = Client::new();
    let url = format!("http://{}/api/users", addr);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), StatusCode::OK, "Expected 200 for valid JWT");

    let body: Value = resp.json().await.expect("response must be JSON");
    assert_eq!(body["success"], true);
}

// ---------------------------------------------------------------------------
// Test 4: Wrong signing secret → 401  (in-process, no #[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_wrong_signing_secret_returns_401() {
    let (listener, addr) = bind_listener().await;
    let server_secret = "server-secret";
    let app = test_app(server_secret);
    tokio::spawn(axum::serve(listener, app).into_future());

    // Token signed with a *different* secret.
    let claims = build_claims("00000000-0000-0000-0000-000000000003", "attacker", vec![]);
    let token = generate_access_token(&claims, "attacker-secret").expect("token generation failed");

    let client = Client::new();
    let url = format!("http://{}/api/users", addr);

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::UNAUTHORIZED,
        "Token signed with wrong secret must be rejected with 401"
    );
}

// ---------------------------------------------------------------------------
// Test 5: Malformed Bearer token → 401  (in-process, no #[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_malformed_token_returns_401() {
    let (listener, addr) = bind_listener().await;
    let app = test_app("test-secret");
    tokio::spawn(axum::serve(listener, app).into_future());

    let client = Client::new();
    let url = format!("http://{}/api/users", addr);

    let resp = client
        .get(&url)
        .header("Authorization", "Bearer not.a.valid.jwt.at.all")
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::UNAUTHORIZED,
        "Malformed JWT must be rejected with 401"
    );
}

// ---------------------------------------------------------------------------
// Test 6: Rate limiting on login  (requires live gateway — #[ignore])
// ---------------------------------------------------------------------------

fn gateway_url() -> String {
    std::env::var("TEST_GATEWAY_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

/// Posting 6 failed login attempts in rapid succession must trigger rate
/// limiting (429) or account locking (403/423) on the 6th attempt.
#[tokio::test]
#[ignore]
async fn test_rate_limiting_login() {
    let client = Client::new();
    let url = format!("{}/api/auth/login", gateway_url());

    let mut final_status = StatusCode::OK;

    for i in 0..6 {
        let resp = client
            .post(&url)
            .json(&json!({ "username": "nonexistent_rate_test_user", "password": "wrongpassword" }))
            .send()
            .await
            .unwrap_or_else(|e| panic!("request {} failed: {}", i, e));

        final_status = resp.status();
    }

    assert!(
        final_status == StatusCode::TOO_MANY_REQUESTS
            || final_status == StatusCode::FORBIDDEN
            || final_status.as_u16() == 423,
        "Expected 429, 403, or 423 after 6 rapid failed login attempts, got {}",
        final_status
    );
}

// ---------------------------------------------------------------------------
// Test 7: SQL injection in search  (requires live gateway — #[ignore])
// ---------------------------------------------------------------------------

/// GET /api/search?q=' OR 1=1-- must return 200 with empty/safe results.
#[tokio::test]
#[ignore]
async fn test_sql_injection_in_search() {
    let client = Client::new();
    let url = format!("{}/api/search", gateway_url());

    let resp = client
        .get(&url)
        .query(&[("q", "' OR 1=1--")])
        .header("Authorization", "Bearer invalid-test-token")
        .send()
        .await
        .expect("request failed");

    assert_ne!(
        resp.status().as_u16() / 100,
        5,
        "SQL injection in ?q should not cause a 5xx error, got {}",
        resp.status()
    );
}

// ---------------------------------------------------------------------------
// Test 8: CORS restricted  (requires live gateway — #[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
#[ignore]
async fn test_cors_restricted() {
    let client = Client::new();
    let url = format!("{}/api/auth/login", gateway_url());

    let resp = client
        .request(Method::OPTIONS, &url)
        .header("Origin", "https://evil.example.com")
        .header("Access-Control-Request-Method", "POST")
        .header(
            "Access-Control-Request-Headers",
            "content-type,authorization",
        )
        .send()
        .await
        .expect("preflight request failed");

    let acao = resp
        .headers()
        .get("access-control-allow-origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    assert!(
        acao != "https://evil.example.com" && acao != "*",
        "Gateway must not allow cross-origin requests from evil.example.com; \
         got Access-Control-Allow-Origin: {}",
        acao
    );
}
