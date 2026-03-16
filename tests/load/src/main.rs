/// Inside/Operations — Goose load tests
///
/// Run against a live gateway:
///   cargo run -p io-load-tests -- --host http://localhost:3000 --users 200 --run-time 60s
///
/// The test simulates five common traffic patterns:
///   1. login_scenario         — POST /api/auth/login, extracts JWT
///   2. dashboard_browse       — GET /api/dashboards (authenticated)
///   3. point_search           — GET /api/search?q=temp (authenticated)
///   4. alarms_poll            — GET /api/alarms/active every 5 s (alarm banner)
///   5. ws_ticket_scenario     — POST /api/auth/ws-ticket (WS upgrade prerequisite)
///
/// Target: 200 concurrent users, 60-second run, p95 < 200 ms.
use goose::prelude::*;
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// Shared user state: stores the JWT obtained during login
// ---------------------------------------------------------------------------

/// Per-user session data stored in GooseUser session storage.
#[derive(Debug, Clone, Default)]
struct UserSession {
    token: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper: extract the stored token as an owned String
// ---------------------------------------------------------------------------

fn get_token(user: &GooseUser) -> String {
    user.get_session_data::<UserSession>()
        .and_then(|s| s.token.clone())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Helper: perform login and stash the token in session storage
// ---------------------------------------------------------------------------

async fn do_login(user: &mut GooseUser) -> TransactionResult {
    let payload = json!({
        "username": "admin",
        "password": "Admin1234!"
    });

    let request_builder = user
        .get_request_builder(&GooseMethod::Post, "/api/auth/login")?
        .header("content-type", "application/json")
        .body(payload.to_string());

    let goose_request = GooseRequest::builder()
        .set_request_builder(request_builder)
        .expect_status_code(200)
        .build();

    let response = user.request(goose_request).await?;

    // Extract the access token from the response body and store it
    if let Ok(body) = response.response.expect("login must succeed").text().await {
        if let Ok(v) = serde_json::from_str::<Value>(&body) {
            let token = v
                .pointer("/data/access_token")
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());
            user.set_session_data(UserSession { token });
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Scenario 1: Login
// Simulates a user logging in to obtain a JWT. The token is stored in the
// session for use by subsequent transactions in the same scenario.
// ---------------------------------------------------------------------------

async fn login_transaction(user: &mut GooseUser) -> TransactionResult {
    do_login(user).await
}

fn login_scenario() -> Scenario {
    scenario!("login_scenario")
        .register_transaction(transaction!(login_transaction).set_name("POST /api/auth/login"))
}

// ---------------------------------------------------------------------------
// Scenario 2: Dashboard browse
// Authenticates once then repeatedly fetches the dashboard list.
// ---------------------------------------------------------------------------

async fn dashboard_browse_setup(user: &mut GooseUser) -> TransactionResult {
    do_login(user).await
}

async fn dashboard_browse_transaction(user: &mut GooseUser) -> TransactionResult {
    let token = get_token(user);
    let rb = user
        .get_request_builder(&GooseMethod::Get, "/api/dashboards")?
        .header("Authorization", format!("Bearer {}", token));
    let request = GooseRequest::builder().set_request_builder(rb).build();
    user.request(request).await?;
    Ok(())
}

fn dashboard_browse_scenario() -> Scenario {
    scenario!("dashboard_browse")
        .register_transaction(
            transaction!(dashboard_browse_setup)
                .set_name("setup: login")
                .set_on_start(),
        )
        .register_transaction(
            transaction!(dashboard_browse_transaction).set_name("GET /api/dashboards"),
        )
}

// ---------------------------------------------------------------------------
// Scenario 3: Point search
// Authenticates once then searches for points by name.
// ---------------------------------------------------------------------------

async fn point_search_setup(user: &mut GooseUser) -> TransactionResult {
    do_login(user).await
}

async fn point_search_transaction(user: &mut GooseUser) -> TransactionResult {
    let token = get_token(user);
    let rb = user
        .get_request_builder(&GooseMethod::Get, "/api/search?q=temp")?
        .header("Authorization", format!("Bearer {}", token));
    let request = GooseRequest::builder().set_request_builder(rb).build();
    user.request(request).await?;
    Ok(())
}

fn point_search_scenario() -> Scenario {
    scenario!("point_search")
        .register_transaction(
            transaction!(point_search_setup)
                .set_name("setup: login")
                .set_on_start(),
        )
        .register_transaction(
            transaction!(point_search_transaction).set_name("GET /api/search?q=temp"),
        )
}

// ---------------------------------------------------------------------------
// Scenario 4: Alarms poll
// Simulates the alarm banner polling GET /api/alarms/active every 5 seconds.
// The wait is modelled by Goose's think-time after each transaction.
// ---------------------------------------------------------------------------

async fn alarms_poll_setup(user: &mut GooseUser) -> TransactionResult {
    do_login(user).await
}

async fn alarms_poll_transaction(user: &mut GooseUser) -> TransactionResult {
    let token = get_token(user);
    let rb = user
        .get_request_builder(&GooseMethod::Get, "/api/alarms/active")?
        .header("Authorization", format!("Bearer {}", token));
    let request = GooseRequest::builder().set_request_builder(rb).build();
    user.request(request).await?;
    Ok(())
}

fn alarms_poll_scenario() -> Scenario {
    // think-time of 5 s simulates the polling interval
    scenario!("alarms_poll")
        .register_transaction(
            transaction!(alarms_poll_setup)
                .set_name("setup: login")
                .set_on_start(),
        )
        .register_transaction(
            transaction!(alarms_poll_transaction).set_name("GET /api/alarms/active"),
        )
        // 5 s minimum wait between polls — models the alarm banner interval
        .set_wait_time(
            std::time::Duration::from_secs(4),
            std::time::Duration::from_secs(6),
        )
        .unwrap()
}

// ---------------------------------------------------------------------------
// Scenario 5: WebSocket ticket
// Authenticates then requests a WebSocket upgrade ticket (required before
// opening the real-time WebSocket connection to the Data Broker).
// ---------------------------------------------------------------------------

async fn ws_ticket_setup(user: &mut GooseUser) -> TransactionResult {
    do_login(user).await
}

async fn ws_ticket_transaction(user: &mut GooseUser) -> TransactionResult {
    let token = get_token(user);
    let rb = user
        .get_request_builder(&GooseMethod::Post, "/api/auth/ws-ticket")?
        .header("Authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body("{}");
    let request = GooseRequest::builder().set_request_builder(rb).build();
    user.request(request).await?;
    Ok(())
}

fn ws_ticket_scenario() -> Scenario {
    scenario!("ws_ticket_scenario")
        .register_transaction(
            transaction!(ws_ticket_setup)
                .set_name("setup: login")
                .set_on_start(),
        )
        .register_transaction(
            transaction!(ws_ticket_transaction).set_name("POST /api/auth/ws-ticket"),
        )
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<(), GooseError> {
    GooseAttack::initialize()?
        .register_scenario(login_scenario())
        .register_scenario(dashboard_browse_scenario())
        .register_scenario(point_search_scenario())
        .register_scenario(alarms_poll_scenario())
        .register_scenario(ws_ticket_scenario())
        .execute()
        .await?;

    Ok(())
}
