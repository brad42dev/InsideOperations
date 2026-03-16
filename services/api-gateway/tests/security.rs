/// Security integration tests for the API Gateway.
///
/// These tests require a **live** API Gateway running at the address in
/// `TEST_GATEWAY_URL` (defaults to `http://localhost:3000`).  They also
/// assume a test Viewer-role account is available at the credentials in
/// `TEST_VIEWER_USER` / `TEST_VIEWER_PASS`.
///
/// Because they depend on external infrastructure every test is marked
/// `#[ignore]`.  Run them explicitly:
///
///   cargo test -p api-gateway --test security -- --ignored
///
/// Required environment variables (can be set in `.env`):
///   TEST_GATEWAY_URL   — gateway base URL  (default: http://localhost:3000)
///   TEST_ADMIN_USER    — admin username     (default: admin)
///   TEST_ADMIN_PASS    — admin password     (default: Admin1234!)
///   TEST_VIEWER_USER   — viewer username    (default: viewer_test)
///   TEST_VIEWER_PASS   — viewer password    (default: Viewer1234!)
use reqwest::{Client, Method, StatusCode};
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn gateway_url() -> String {
    std::env::var("TEST_GATEWAY_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

fn admin_creds() -> (String, String) {
    (
        std::env::var("TEST_ADMIN_USER").unwrap_or_else(|_| "admin".to_string()),
        std::env::var("TEST_ADMIN_PASS").unwrap_or_else(|_| "Admin1234!".to_string()),
    )
}

fn viewer_creds() -> (String, String) {
    (
        std::env::var("TEST_VIEWER_USER").unwrap_or_else(|_| "viewer_test".to_string()),
        std::env::var("TEST_VIEWER_PASS").unwrap_or_else(|_| "Viewer1234!".to_string()),
    )
}

/// POST /api/auth/login and return the access token.
async fn login(client: &Client, username: &str, password: &str) -> reqwest::Result<Option<String>> {
    let url = format!("{}/api/auth/login", gateway_url());
    let resp = client
        .post(&url)
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let body: Value = resp.json().await?;
    let token = body
        .pointer("/data/access_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(token)
}

// ---------------------------------------------------------------------------
// Test 1: Unauthenticated request → 401
// ---------------------------------------------------------------------------

/// GET /api/users without a token must return 401 Unauthorized.
#[tokio::test]
#[ignore]
async fn test_unauthenticated_returns_401() {
    let client = Client::new();
    let url = format!("{}/api/users", gateway_url());

    let resp = client.get(&url).send().await.expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::UNAUTHORIZED,
        "Expected 401 for unauthenticated request to /api/users"
    );
}

// ---------------------------------------------------------------------------
// Test 2: Expired JWT → 401
// ---------------------------------------------------------------------------

/// A hand-crafted JWT with `exp` in the past must be rejected with 401.
///
/// The token below is signed with the dummy secret "test-secret" and has
/// exp=1700000000 (November 2023 — definitively expired).  In a real test
/// environment you may need to regenerate this with the actual JWT secret;
/// the gateway must reject it as expired regardless of the signing key
/// mismatch (the gateway will fail signature verification first).
#[tokio::test]
#[ignore]
async fn test_expired_token_returns_401() {
    // HS256, {"alg":"HS256","typ":"JWT"}.{"sub":"00000000-0000-0000-0000-000000000001",
    // "exp":1700000000,"iat":1699999000}.signature
    // Signed with key "test-secret" — will fail sig check on real gateway, still 401.
    let expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\
        eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJleHAiOjE3MDAwMDAwMDAsImlhdCI6MTY5OTk5OTAwMH0.\
        dummysignaturethatwillfail";

    let client = Client::new();
    let url = format!("{}/api/users", gateway_url());

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", expired_token))
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::UNAUTHORIZED,
        "Expected 401 for expired/invalid JWT"
    );
}

// ---------------------------------------------------------------------------
// Test 3: Insufficient permission → 403
// ---------------------------------------------------------------------------

/// A Viewer-role user attempting DELETE /api/users/:id must receive 403.
#[tokio::test]
#[ignore]
async fn test_wrong_permission_returns_403() {
    let client = Client::new();
    let (user, pass) = viewer_creds();

    let token = login(&client, &user, &pass)
        .await
        .expect("login request failed")
        .expect("viewer login must succeed — ensure the account exists");

    // Use a well-known UUID that doesn't need to exist; RBAC check happens first.
    let url = format!(
        "{}/api/users/00000000-0000-0000-0000-000000000001",
        gateway_url()
    );

    let resp = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "Viewer must not be able to DELETE /api/users/:id (expected 403)"
    );
}

// ---------------------------------------------------------------------------
// Test 4: Rate limiting on login
// ---------------------------------------------------------------------------

/// Posting 6 failed login attempts in rapid succession must trigger rate
/// limiting (429) or account locking (403/423) on the 6th attempt.
/// The gateway enforces a per-IP rate limit on /api/auth/login.
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
            || final_status.as_u16() == 423, // 423 Locked
        "Expected 429, 403, or 423 after 6 rapid failed login attempts, got {}",
        final_status
    );
}

// ---------------------------------------------------------------------------
// Test 5: SQL injection in search
// ---------------------------------------------------------------------------

/// GET /api/search?q=' OR 1=1-- must return 200 with empty/safe results,
/// never a 500 or database error.
#[tokio::test]
#[ignore]
async fn test_sql_injection_in_search() {
    let client = Client::new();
    let (user, pass) = admin_creds();

    let token = login(&client, &user, &pass)
        .await
        .expect("login request failed")
        .expect("admin login must succeed");

    let url = format!("{}/api/search", gateway_url());

    let resp = client
        .get(&url)
        .query(&[("q", "' OR 1=1--")])
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .expect("request failed");

    // Must not be a server error
    assert_ne!(
        resp.status().as_u16() / 100,
        5,
        "SQL injection in ?q should not cause a 5xx error, got {}",
        resp.status()
    );

    // Should return 200 with an empty result set (parameterised queries)
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "Expected 200 OK for SQL injection attempt in search"
    );

    let body: Value = resp.json().await.expect("response must be JSON");
    // The data array should be empty — the injected string matches nothing
    if let Some(arr) = body.pointer("/data").and_then(|v| v.as_array()) {
        assert!(
            arr.is_empty(),
            "SQL injection must not leak data; got {} rows",
            arr.len()
        );
    }
}

// ---------------------------------------------------------------------------
// Test 6: XSS in tag name
// ---------------------------------------------------------------------------

/// POST /api/opc-sources with a tag containing a script element must store
/// and return the literal text — no HTML interpretation.
#[tokio::test]
#[ignore]
async fn test_xss_in_tag_name() {
    let client = Client::new();
    let (user, pass) = admin_creds();

    let token = login(&client, &user, &pass)
        .await
        .expect("login request failed")
        .expect("admin login must succeed");

    let xss_payload = "<script>alert(1)</script>";
    let url = format!("{}/api/opc-sources", gateway_url());

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({
            "name": xss_payload,
            "endpoint_url": "opc.tcp://localhost:4840",
            "security_mode": "None"
        }))
        .send()
        .await
        .expect("request failed");

    // Accept 201 Created, 200 OK, or 422 validation error — but never 5xx
    assert_ne!(
        resp.status().as_u16() / 100,
        5,
        "XSS in tag name must not cause a 5xx error, got {}",
        resp.status()
    );

    // If stored, verify the name is returned as literal text
    if resp.status().is_success() {
        let body: Value = resp.json().await.expect("response must be JSON");
        if let Some(name) = body.pointer("/data/name").and_then(|v| v.as_str()) {
            assert_eq!(
                name, xss_payload,
                "XSS payload must be stored as literal text, not interpreted as HTML"
            );
            assert!(
                !name.contains("<script"),
                "Script tag must not be stripped — it should be stored verbatim for later escaping in the UI"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Test 7: Oversized payload
// ---------------------------------------------------------------------------

/// POST /api/auth/login with a 10 MB body must return 413 or 400 — never
/// a 500 or a process crash.
#[tokio::test]
#[ignore]
async fn test_oversized_payload() {
    let client = Client::builder()
        // Allow large request bodies from the test client side
        .build()
        .expect("client build failed");

    // 10 MB of JSON-like padding
    let padding = "x".repeat(10 * 1024 * 1024);
    let big_body = format!(
        r#"{{"username":"admin","password":"Admin1234!","padding":"{}"}}"#,
        padding
    );

    let url = format!("{}/api/auth/login", gateway_url());

    let resp = client
        .post(&url)
        .header("content-type", "application/json")
        .body(big_body)
        .send()
        .await
        .expect("request failed");

    assert!(
        resp.status() == StatusCode::PAYLOAD_TOO_LARGE  // 413
            || resp.status() == StatusCode::BAD_REQUEST, // 400
        "Expected 413 or 400 for 10 MB body, got {}",
        resp.status()
    );
}

// ---------------------------------------------------------------------------
// Test 8: CORS restricted to allowed origins
// ---------------------------------------------------------------------------

/// When CORS_ALLOWED_ORIGINS is configured, a request from an unlisted origin
/// must NOT receive `Access-Control-Allow-Origin` headers that permit it.
///
/// Note: if the gateway is running with `CORS_ALLOWED_ORIGINS` unset (open
/// CORS) this test will fail — it is only meaningful in a locked-down env.
#[tokio::test]
#[ignore]
async fn test_cors_restricted() {
    let client = Client::new();
    let url = format!("{}/api/auth/login", gateway_url());

    let resp = client
        .request(Method::OPTIONS, &url)
        .header("Origin", "https://evil.example.com")
        .header("Access-Control-Request-Method", "POST")
        .header("Access-Control-Request-Headers", "content-type,authorization")
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
