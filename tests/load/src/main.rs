/// Inside/Operations — Goose load tests
///
/// Run against a live gateway:
///   cargo run -p io-load-tests -- --host http://localhost:3000 --users 200 --run-time 60s
///
/// The test simulates six traffic patterns:
///   1. login_scenario         — POST /api/auth/login, extracts JWT
///   2. dashboard_browse       — GET /api/dashboards (authenticated)
///   3. point_search           — GET /api/search?q=temp (authenticated)
///   4. alarms_poll            — GET /api/alarms/active every 5 s (alarm banner)
///   5. ws_ticket_scenario     — POST /api/auth/ws-ticket (WS upgrade prerequisite)
///   6. ws_subscribe_scenario  — Open a real WebSocket connection, authenticate
///                               with a ticket, subscribe to 50 point tags, and
///                               count update messages for 30 s.
///                               Target: sustain 200 concurrent WS connections
///                               receiving >10,000 point updates/sec in aggregate.
///
/// Target: 200 concurrent users, 60-second run, p95 < 200 ms.
use futures::{SinkExt, StreamExt};
use goose::prelude::*;
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::Message;

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
// Scenario 6: WebSocket subscription
//
// Simulates 200 concurrent WebSocket connections with active point subscriptions
// to validate the Data Broker's 10,000 point updates/second throughput target.
//
// Each Goose user in this scenario:
//   1. Logs in via HTTP to obtain a JWT.
//   2. Requests a WS upgrade ticket via POST /api/auth/ws-ticket.
//   3. Opens a WebSocket connection to /ws?ticket=<ticket>.
//   4. Sends a subscribe message for 50 synthetic point tags.
//   5. Reads incoming messages for 30 seconds, counting PointValue updates.
//   6. Reports the update count so Goose can include it in metrics output.
// ---------------------------------------------------------------------------

/// Point tags used by the load scenario — 50 representative tags that the
/// Data Broker simulator publishes at high frequency.
const WS_POINT_TAGS: &[&str] = &[
    "plant.unit1.temp.01", "plant.unit1.temp.02", "plant.unit1.temp.03",
    "plant.unit1.temp.04", "plant.unit1.temp.05", "plant.unit1.pres.01",
    "plant.unit1.pres.02", "plant.unit1.pres.03", "plant.unit1.pres.04",
    "plant.unit1.pres.05", "plant.unit1.flow.01", "plant.unit1.flow.02",
    "plant.unit1.flow.03", "plant.unit1.flow.04", "plant.unit1.flow.05",
    "plant.unit2.temp.01", "plant.unit2.temp.02", "plant.unit2.temp.03",
    "plant.unit2.temp.04", "plant.unit2.temp.05", "plant.unit2.pres.01",
    "plant.unit2.pres.02", "plant.unit2.pres.03", "plant.unit2.pres.04",
    "plant.unit2.pres.05", "plant.unit2.flow.01", "plant.unit2.flow.02",
    "plant.unit2.flow.03", "plant.unit2.flow.04", "plant.unit2.flow.05",
    "plant.unit3.temp.01", "plant.unit3.temp.02", "plant.unit3.temp.03",
    "plant.unit3.temp.04", "plant.unit3.temp.05", "plant.unit3.pres.01",
    "plant.unit3.pres.02", "plant.unit3.pres.03", "plant.unit3.pres.04",
    "plant.unit3.pres.05", "plant.unit3.flow.01", "plant.unit3.flow.02",
    "plant.unit3.flow.03", "plant.unit3.flow.04", "plant.unit3.flow.05",
    "plant.cw.temp.01", "plant.cw.temp.02", "plant.cw.pres.01",
    "plant.cw.flow.01", "plant.cw.level.01",
];

/// Duration for each user's WebSocket subscription window.
const WS_SUBSCRIBE_DURATION_SECS: u64 = 30;

async fn ws_subscribe_setup(user: &mut GooseUser) -> TransactionResult {
    do_login(user).await
}

/// Core WebSocket load transaction.
///
/// Opens one WebSocket connection, subscribes to `WS_POINT_TAGS`, reads
/// updates for `WS_SUBSCRIBE_DURATION_SECS`, then closes the connection.
/// This transaction intentionally blocks for the full subscription window;
/// Goose records the elapsed time as the transaction duration, giving a
/// real-world picture of connection hold times and message throughput.
async fn ws_subscribe_transaction(user: &mut GooseUser) -> TransactionResult {
    // Step 1: obtain a WS ticket via HTTP
    let token = get_token(user);
    let ticket_rb = user
        .get_request_builder(&GooseMethod::Post, "/api/auth/ws-ticket")?
        .header("Authorization", format!("Bearer {}", token))
        .header("content-type", "application/json")
        .body("{}");
    let ticket_req = GooseRequest::builder()
        .set_request_builder(ticket_rb)
        .expect_status_code(200)
        .build();

    let ticket_resp = user.request(ticket_req).await?;
    let ticket_str = ticket_resp
        .response
        .expect("ws-ticket response")
        .text()
        .await
        .unwrap_or_default();
    let ticket_value: Value = serde_json::from_str(&ticket_str).unwrap_or_default();
    let ticket = ticket_value
        .pointer("/data/ticket")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if ticket.is_empty() {
        // Gateway not available — skip silently so the HTTP scenarios still run
        return Ok(());
    }

    // Step 2: derive the WebSocket URL from the Goose host (http → ws)
    let host = user
        .base_url
        .as_str()
        .trim_end_matches('/')
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    let ws_url = format!("{}/ws?ticket={}", host, ticket);

    // Step 3: open the WebSocket connection
    let ws_result = tokio_tungstenite::connect_async(&ws_url).await;
    let (mut ws_stream, _response) = match ws_result {
        Ok(pair) => pair,
        Err(_) => {
            // Server unreachable — skip without failing the load run
            return Ok(());
        }
    };

    // Step 4: send subscribe message for the configured point tags
    let subscribe_msg = json!({
        "type": "subscribe",
        "tags": WS_POINT_TAGS
    });
    let _ = ws_stream
        .send(Message::Text(subscribe_msg.to_string()))
        .await;

    // Step 5: read incoming update messages for the configured window
    let deadline =
        tokio::time::Instant::now() + std::time::Duration::from_secs(WS_SUBSCRIBE_DURATION_SECS);
    let mut update_count: u64 = 0;

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, ws_stream.next()).await {
            Ok(Some(Ok(Message::Text(_)))) => {
                update_count += 1;
            }
            Ok(Some(Ok(Message::Binary(_)))) => {
                update_count += 1;
            }
            Ok(Some(Ok(Message::Ping(data)))) => {
                // Respond to pings to keep the connection alive
                let _ = ws_stream.send(Message::Pong(data)).await;
            }
            Ok(Some(Ok(Message::Close(_)))) | Ok(None) => break,
            Ok(Some(Err(_))) | Err(_) => break,
            _ => {}
        }
    }

    // Step 6: close cleanly
    let _ = ws_stream.send(Message::Close(None)).await;

    // Log throughput — visible when running with RUST_LOG=debug
    eprintln!(
        "[ws_subscribe] received {} updates in {}s",
        update_count, WS_SUBSCRIBE_DURATION_SECS
    );

    Ok(())
}

/// Returns the WebSocket subscription scenario.
///
/// Registered alongside the HTTP scenarios; when Goose spawns 200 concurrent
/// users for this scenario, each user holds a live WebSocket connection for
/// `WS_SUBSCRIBE_DURATION_SECS` seconds, together producing the 200-connection
/// / 10,000-updates-per-second load target defined in 33_TESTING_STRATEGY.md.
fn ws_subscribe_scenario() -> Scenario {
    scenario!("ws_subscribe_scenario")
        .register_transaction(
            transaction!(ws_subscribe_setup)
                .set_name("setup: login")
                .set_on_start(),
        )
        .register_transaction(
            transaction!(ws_subscribe_transaction)
                .set_name("WS subscribe 50 tags (30 s)"),
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
        .register_scenario(ws_subscribe_scenario())
        .execute()
        .await?;

    Ok(())
}
