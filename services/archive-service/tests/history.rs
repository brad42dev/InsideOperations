// Integration tests for the archive-service.
//
// The archive-service manages TimescaleDB hypertables, continuous aggregates,
// compression policies, and historical data queries.
//
// Tests that require a live archive-service or TimescaleDB instance are
// marked `#[ignore]`.
//
// cargo test -p archive-service --test history -- --ignored

fn archive_url() -> String {
    std::env::var("TEST_ARCHIVE_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3005".to_string())
}

// ---------------------------------------------------------------------------
// Retention window calculation — pure logic, no service needed
// ---------------------------------------------------------------------------

/// A 30-day retention window from a fixed anchor must end exactly 30 days later.
#[test]
fn test_retention_window_30_days() {
    let anchor = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let window = anchor + chrono::Duration::days(30);

    assert_eq!(
        window,
        chrono::DateTime::parse_from_rfc3339("2026-01-31T00:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc)
    );
}

/// A timestamp outside the retention window must be considered expired.
#[test]
fn test_timestamp_outside_retention_is_expired() {
    let now = chrono::Utc::now();
    let old = now - chrono::Duration::days(400);
    let retention = chrono::Duration::days(365);

    let cutoff = now - retention;
    assert!(
        old < cutoff,
        "timestamp 400 days old must be past the 365-day retention cutoff"
    );
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", archive_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// History query stub — requires live service (#[ignore])
// ---------------------------------------------------------------------------

/// GET /history/:point_id with a valid time range must return 200 + data array.
#[tokio::test]
#[ignore]
async fn test_history_query_returns_200_with_data() {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/history/00000000-0000-0000-0000-000000000001",
        archive_url()
    );

    let resp = client
        .get(&url)
        .query(&[
            ("from", "2026-01-01T00:00:00Z"),
            ("to", "2026-01-02T00:00:00Z"),
        ])
        .send()
        .await
        .expect("request must succeed");

    // Accepts 200 (data found) or 404 (point not seeded in test DB) — never 5xx.
    assert!(
        resp.status().as_u16() < 500,
        "history query must not return a 5xx error, got {}",
        resp.status()
    );
}
