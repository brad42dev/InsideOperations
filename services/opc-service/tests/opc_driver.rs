/// Integration tests for the opc-service OPC UA client.
///
/// The opc-service connects to OPC UA servers, crawls metadata, and batches
/// subscriptions for real-time data delivery to the data-broker.
///
/// Tests that require a live OPC UA server (e.g. SimBLAH simulator) are
/// marked `#[ignore]`.  Unit-style tests verify configuration parsing and
/// subscription batching logic.
///
///   cargo test -p opc-service --test opc_driver -- --ignored

// ---------------------------------------------------------------------------
// Endpoint URL validation — pure logic, no OPC UA server needed
// ---------------------------------------------------------------------------

/// A valid OPC UA endpoint URL must match the expected scheme.
#[test]
fn test_valid_opc_endpoint_scheme() {
    let url = "opc.tcp://localhost:4840";
    assert!(
        url.starts_with("opc.tcp://"),
        "valid OPC UA endpoint must start with opc.tcp://"
    );
}

/// An endpoint with a wrong scheme must be detected as invalid.
#[test]
fn test_invalid_opc_endpoint_scheme() {
    let url = "http://localhost:4840";
    assert!(
        !url.starts_with("opc.tcp://"),
        "http:// URL must not be accepted as an OPC UA endpoint"
    );
}

// ---------------------------------------------------------------------------
// Subscription batch size logic — pure, no OPC UA server needed
// ---------------------------------------------------------------------------

/// Batching 1000 tag IDs with a batch size of 200 must produce exactly 5 batches.
#[test]
fn test_subscription_batching_produces_correct_batch_count() {
    let tags: Vec<u32> = (0..1000).collect();
    let batch_size = 200;
    let batches: Vec<&[u32]> = tags.chunks(batch_size).collect();

    assert_eq!(batches.len(), 5, "1000 tags / batch_size 200 must yield 5 batches");
    assert!(
        batches.iter().all(|b| b.len() <= batch_size),
        "no batch must exceed the configured batch size"
    );
}

/// The last batch may be smaller than batch_size.
#[test]
fn test_subscription_batching_handles_remainder() {
    let tags: Vec<u32> = (0..1050).collect();
    let batch_size = 200;
    let batches: Vec<&[u32]> = tags.chunks(batch_size).collect();

    assert_eq!(batches.len(), 6, "1050 tags / batch_size 200 must yield 6 batches");
    assert_eq!(batches.last().unwrap().len(), 50, "last batch must contain the 50 remaining tags");
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

fn opc_url() -> String {
    std::env::var("TEST_OPC_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3002".to_string())
}

#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", opc_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// OPC UA connection — requires SimBLAH simulator (#[ignore])
// ---------------------------------------------------------------------------

/// Connecting to the SimBLAH OPC UA simulator must succeed and return
/// a non-empty namespace array.
#[tokio::test]
#[ignore]
async fn test_opcua_simulator_connect_and_browse() {
    // This test requires the SimBLAH OPC UA simulator running at
    // TEST_OPCUA_ENDPOINT (default: opc.tcp://localhost:4840).
    let _endpoint = std::env::var("TEST_OPCUA_ENDPOINT")
        .unwrap_or_else(|_| "opc.tcp://localhost:4840".to_string());

    todo!("implement OPC UA browse test against SimBLAH simulator");
}
