/// Integration tests for the parser-service.
///
/// The parser-service processes SVG, DXF, and DCS-native file formats.
/// These tests verify the HTTP API contract and basic parsing behaviour.
///
/// Tests that require a live parser-service process are marked `#[ignore]`.
///
///   cargo test -p parser-service --test parsing -- --ignored

fn parser_url() -> String {
    std::env::var("TEST_PARSER_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3004".to_string())
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

/// GET /health/live must return 200 when the service is running.
#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", parser_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// SVG parse validation — pure logic, no service needed
// ---------------------------------------------------------------------------

/// An SVG string must round-trip through roxmltree without error.
#[test]
fn test_valid_svg_parses_without_error() {
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="blue"/>
    </svg>"#;

    let result = roxmltree::Document::parse(svg);
    assert!(result.is_ok(), "valid SVG must parse without error");
}

/// A malformed XML string must return a parse error.
#[test]
fn test_malformed_xml_returns_parse_error() {
    let bad_xml = r#"<svg><unclosed>"#;
    let result = roxmltree::Document::parse(bad_xml);
    assert!(result.is_err(), "malformed XML must return a parse error");
}
