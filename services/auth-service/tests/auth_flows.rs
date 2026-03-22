/// Integration tests for the auth-service authentication flows.
///
/// Database-backed tests use `#[sqlx::test]` which creates an isolated
/// transaction per test, automatically rolling back on completion.
///
/// To run against a real PostgreSQL instance set `DATABASE_URL` (or
/// `TEST_DATABASE_URL`) before running:
///
///   DATABASE_URL=postgres://... cargo test -p auth-service --test auth_flows
///
/// Tests that require a fully running auth-service HTTP stack are marked
/// `#[ignore]` and can be run with `-- --ignored`.
use io_auth::{build_claims, generate_access_token, validate_token, hash_password, verify_password, Claims};
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// JWT token lifecycle — pure unit-style, no DB needed
// ---------------------------------------------------------------------------

/// A freshly minted token must be accepted by validate_token.
#[tokio::test]
async fn test_valid_access_token_round_trips() {
    let secret = "auth-service-test-secret";
    let claims = build_claims(
        "00000000-0000-0000-0000-000000000010",
        "alice",
        vec!["users.view".to_string(), "alarms.view".to_string()],
    );

    let token = generate_access_token(&claims, secret)
        .expect("token generation must succeed");

    let decoded = validate_token(&token, secret)
        .expect("valid token must be accepted");

    assert_eq!(decoded.sub, claims.sub);
    assert_eq!(decoded.username, claims.username);
    assert_eq!(decoded.permissions, claims.permissions);
}

/// An expired token must be rejected.
#[tokio::test]
async fn test_expired_token_is_rejected() {
    let secret = "auth-service-test-secret";
    let now = chrono::Utc::now().timestamp();
    let expired = Claims {
        sub: "00000000-0000-0000-0000-000000000011".to_string(),
        username: "bob".to_string(),
        permissions: vec![],
        iat: now - 1000,
        exp: now - 500, // 500 s in the past
    };

    let token = generate_access_token(&expired, secret)
        .expect("should encode even with past exp");

    let result = validate_token(&token, secret);
    assert!(result.is_err(), "expired token must be rejected");
}

/// A token signed with the wrong secret must be rejected.
#[tokio::test]
async fn test_wrong_secret_token_is_rejected() {
    let claims = build_claims("00000000-0000-0000-0000-000000000012", "carol", vec![]);
    let token = generate_access_token(&claims, "correct-secret")
        .expect("should generate token");

    let result = validate_token(&token, "wrong-secret");
    assert!(result.is_err(), "token signed with wrong secret must be rejected");
}

// ---------------------------------------------------------------------------
// Password hashing — pure, no DB needed
// ---------------------------------------------------------------------------

/// Correct password must verify against its hash.
#[test]
fn test_correct_password_verifies() {
    let password = "SuperSecret123!";
    let hash = hash_password(password).expect("hashing must succeed");
    let ok = verify_password(password, &hash).expect("verify must not error");
    assert!(ok, "correct password must verify as true");
}

/// Wrong password must not verify.
#[test]
fn test_wrong_password_does_not_verify() {
    let hash = hash_password("CorrectPassword1!").expect("hashing must succeed");
    let ok = verify_password("WrongPassword1!", &hash).expect("verify must not error");
    assert!(!ok, "wrong password must verify as false");
}

/// Two hash calls on the same password must produce different PHC strings
/// (different salts) yet both verify correctly.
#[test]
fn test_password_hashes_are_salted_uniquely() {
    let password = "SaltTest99!";
    let hash1 = hash_password(password).expect("hash1 must succeed");
    let hash2 = hash_password(password).expect("hash2 must succeed");

    assert_ne!(hash1, hash2, "distinct salt must produce distinct hashes");

    assert!(verify_password(password, &hash1).unwrap(), "hash1 must verify");
    assert!(verify_password(password, &hash2).unwrap(), "hash2 must verify");
}

// ---------------------------------------------------------------------------
// Local login flow — requires running auth-service HTTP stack (#[ignore])
// ---------------------------------------------------------------------------

fn auth_service_url() -> String {
    std::env::var("TEST_AUTH_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3009".to_string())
}

/// POST /auth/login with correct credentials must return 200 + access_token.
#[tokio::test]
#[ignore]
async fn test_local_login_correct_credentials_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/auth/login", auth_service_url());

    let resp = client
        .post(&url)
        .json(&json!({
            "username": std::env::var("TEST_ADMIN_USER").unwrap_or_else(|_| "admin".to_string()),
            "password": std::env::var("TEST_ADMIN_PASS").unwrap_or_else(|_| "Admin1234!".to_string())
        }))
        .send()
        .await
        .expect("login request must succeed");

    assert_eq!(resp.status(), reqwest::StatusCode::OK, "correct credentials must return 200");

    let body: Value = resp.json().await.expect("response must be JSON");
    assert!(
        body.pointer("/data/access_token").is_some(),
        "response must contain data.access_token"
    );
}

/// POST /auth/login with wrong password must return 401.
#[tokio::test]
#[ignore]
async fn test_local_login_wrong_password_returns_401() {
    let client = reqwest::Client::new();
    let url = format!("{}/auth/login", auth_service_url());

    let resp = client
        .post(&url)
        .json(&json!({
            "username": "admin",
            "password": "completely_wrong_password_xyz987"
        }))
        .send()
        .await
        .expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::UNAUTHORIZED,
        "wrong password must return 401"
    );
}

/// POST /auth/refresh with a valid refresh token must return 200 + new access_token.
#[tokio::test]
#[ignore]
async fn test_token_refresh_with_valid_token_returns_200() {
    let client = reqwest::Client::new();
    let login_url = format!("{}/auth/login", auth_service_url());

    // First log in to get a refresh token.
    let login_resp = client
        .post(&login_url)
        .json(&json!({
            "username": std::env::var("TEST_ADMIN_USER").unwrap_or_else(|_| "admin".to_string()),
            "password": std::env::var("TEST_ADMIN_PASS").unwrap_or_else(|_| "Admin1234!".to_string())
        }))
        .send()
        .await
        .expect("login must succeed");

    let login_body: Value = login_resp.json().await.expect("login response must be JSON");
    let refresh_token = login_body
        .pointer("/data/refresh_token")
        .and_then(|v| v.as_str())
        .expect("login must return refresh_token");

    // Now exchange the refresh token.
    let refresh_url = format!("{}/auth/refresh", auth_service_url());
    let resp = client
        .post(&refresh_url)
        .json(&json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .expect("refresh request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "valid refresh token must return 200"
    );

    let body: Value = resp.json().await.expect("refresh response must be JSON");
    assert!(
        body.pointer("/data/access_token").is_some(),
        "refresh response must contain data.access_token"
    );
}

/// POST /auth/refresh with a garbage token must return 401.
#[tokio::test]
#[ignore]
async fn test_token_refresh_with_invalid_token_returns_401() {
    let client = reqwest::Client::new();
    let url = format!("{}/auth/refresh", auth_service_url());

    let resp = client
        .post(&url)
        .json(&json!({ "refresh_token": "not-a-valid-refresh-token-xyz" }))
        .send()
        .await
        .expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::UNAUTHORIZED,
        "invalid refresh token must return 401"
    );
}
