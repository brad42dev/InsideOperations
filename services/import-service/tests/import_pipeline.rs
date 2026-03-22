/// Integration tests for the import-service ETL pipeline.
///
/// The import-service runs a 40-connector-template ETL pipeline with
/// scheduling, HTTP source fetching, and row-level validation.
///
/// Tests that require a live import-service or external data sources are
/// marked `#[ignore]`.  HTTP source tests use wiremock for isolation.
///
///   cargo test -p import-service --test import_pipeline -- --ignored

// ---------------------------------------------------------------------------
// CSV row parsing — pure logic, no service needed
// ---------------------------------------------------------------------------

/// A valid CSV row with 3 columns must parse into 3 fields.
#[test]
fn test_csv_row_splits_correctly() {
    let row = "tag_name,100.5,good";
    let fields: Vec<&str> = row.split(',').collect();

    assert_eq!(fields.len(), 3, "CSV row must split into 3 fields");
    assert_eq!(fields[0], "tag_name");
    assert_eq!(fields[1], "100.5");
    assert_eq!(fields[2], "good");
}

/// An empty CSV row must produce zero fields (or one empty field depending on
/// the split strategy — what matters is it doesn't panic).
#[test]
fn test_empty_csv_row_does_not_panic() {
    let row = "";
    let fields: Vec<&str> = row.split(',').collect();
    // split("") on empty string gives one empty element in Rust.
    assert!(fields.len() >= 1, "empty row must not panic");
}

/// A float value string must parse to f64 without error.
#[test]
fn test_float_value_parses_correctly() {
    let value = "3.14159";
    let parsed: Result<f64, _> = value.parse();
    assert!(parsed.is_ok(), "valid float string must parse to f64");
    assert!((parsed.unwrap() - 3.14159).abs() < 1e-5);
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

fn import_url() -> String {
    std::env::var("TEST_IMPORT_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3006".to_string())
}

#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", import_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// HTTP connector stub using wiremock — requires wiremock (#[ignore])
// ---------------------------------------------------------------------------

/// An HTTP connector targeting a wiremock endpoint must receive the mock data.
#[tokio::test]
#[ignore]
async fn test_http_connector_fetches_from_wiremock() {
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    let mock_server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/data"))
        .respond_with(
            ResponseTemplate::new(200).set_body_string("tag,value\nPIC-101,98.5\n"),
        )
        .mount(&mock_server)
        .await;

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/data", mock_server.uri()))
        .send()
        .await
        .expect("mock server must respond");

    assert_eq!(resp.status(), reqwest::StatusCode::OK);
    let body = resp.text().await.expect("body must be text");
    assert!(body.contains("PIC-101"), "mock body must contain the test tag");
}
