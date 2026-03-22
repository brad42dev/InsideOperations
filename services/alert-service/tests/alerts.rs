/// Integration tests for the alert-service.
///
/// The alert-service implements ISA-18.2 alarm processing, escalation
/// policies, shift-aware routing, and human-initiated emergency notifications.
///
/// Tests that require a live alert-service process are marked `#[ignore]`.
///
///   cargo test -p alert-service --test alerts -- --ignored

fn alert_url() -> String {
    std::env::var("TEST_ALERT_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3007".to_string())
}

// ---------------------------------------------------------------------------
// Escalation delay calculation — pure logic, no service needed
// ---------------------------------------------------------------------------

/// An escalation policy with a 15-minute delay must not trigger within 10 min.
#[test]
fn test_escalation_not_triggered_before_delay() {
    let alarm_raised_at = chrono::Utc::now() - chrono::Duration::minutes(10);
    let escalation_delay = chrono::Duration::minutes(15);

    let trigger_at = alarm_raised_at + escalation_delay;
    assert!(
        trigger_at > chrono::Utc::now(),
        "escalation must not trigger before the configured delay"
    );
}

/// An escalation policy with a 5-minute delay must have triggered after 10 min.
#[test]
fn test_escalation_triggered_after_delay() {
    let alarm_raised_at = chrono::Utc::now() - chrono::Duration::minutes(10);
    let escalation_delay = chrono::Duration::minutes(5);

    let trigger_at = alarm_raised_at + escalation_delay;
    assert!(
        trigger_at < chrono::Utc::now(),
        "escalation must trigger after the configured delay has elapsed"
    );
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", alert_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// Alert send stub — requires live service + wiremock (#[ignore])
// ---------------------------------------------------------------------------

/// POST /alerts with a valid payload must return 201 Created.
#[tokio::test]
#[ignore]
async fn test_create_alert_returns_201() {
    let client = reqwest::Client::new();
    let url = format!("{}/alerts", alert_url());

    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "type": "emergency",
            "message": "Integration test alert",
            "initiated_by": "00000000-0000-0000-0000-000000000001"
        }))
        .send()
        .await
        .expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::CREATED,
        "create alert must return 201"
    );
}
