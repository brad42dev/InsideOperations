//! Background task that scrapes all service `/metrics` endpoints every
//! IO_METRICS_INTERVAL seconds (default 15) and batch-inserts the resulting
//! samples into `io_metrics.samples`.
//!
//! Configuration (all optional, shown with defaults):
//!   IO_METRICS_COLLECTOR_ENABLED=true   — set to "false" or "0" to disable
//!   IO_METRICS_INTERVAL=15              — collection interval in seconds
//!   IO_METRICS_TIMEOUT=5               — per-service HTTP timeout in seconds
//!   IO_METRICS_BATCH_SIZE=1000          — max rows per INSERT batch

use futures::future::join_all;
use sqlx::PgPool;
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// All 11 backend services: (short name, metrics URL).
/// The API Gateway's own metrics are scraped via obs.prometheus_handle.render()
/// directly in main.rs — we deliberately skip a localhost HTTP round-trip.
const SERVICE_ENDPOINTS: &[(&str, &str)] = &[
    ("data-broker", "http://127.0.0.1:3001/metrics"),
    ("opc-service", "http://127.0.0.1:3002/metrics"),
    ("event-service", "http://127.0.0.1:3003/metrics"),
    ("parser-service", "http://127.0.0.1:3004/metrics"),
    ("archive-service", "http://127.0.0.1:3005/metrics"),
    ("import-service", "http://127.0.0.1:3006/metrics"),
    ("alert-service", "http://127.0.0.1:3007/metrics"),
    ("email-service", "http://127.0.0.1:3008/metrics"),
    ("auth-service", "http://127.0.0.1:3009/metrics"),
    ("recognition-service", "http://127.0.0.1:3010/metrics"),
];

/// A single parsed Prometheus metric sample.
struct Sample {
    metric_name: String,
    /// JSON object of label key→value pairs, e.g. `{"instance":"opc-service"}`
    labels: serde_json::Value,
    value: f64,
}

/// Main loop. Call from `tokio::spawn`.
pub async fn run(db: PgPool, http_client: reqwest::Client) {
    let interval_secs: u64 = std::env::var("IO_METRICS_INTERVAL")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(15);
    let timeout_secs: u64 = std::env::var("IO_METRICS_TIMEOUT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5);
    let batch_size: usize = std::env::var("IO_METRICS_BATCH_SIZE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1000);

    info!(
        interval_secs,
        timeout_secs,
        batch_size,
        "Metrics collector started"
    );

    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        collect_once(&db, &http_client, timeout_secs, batch_size).await;
    }
}

/// Single collection pass: scrape all services in parallel, parse, batch-insert.
async fn collect_once(
    db: &PgPool,
    client: &reqwest::Client,
    timeout_secs: u64,
    batch_size: usize,
) {
    let timeout = Duration::from_secs(timeout_secs);
    let now = chrono::Utc::now();

    // Spawn one future per service.
    let tasks: Vec<_> = SERVICE_ENDPOINTS
        .iter()
        .map(|(name, url)| {
            let client = client.clone();
            let name = *name;
            let url = *url;
            async move {
                match tokio::time::timeout(timeout, client.get(url).send()).await {
                    Ok(Ok(resp)) => match resp.text().await {
                        Ok(body) => {
                            let mut samples = Vec::new();
                            parse_prometheus_text(&body, name, &mut samples);
                            (name, Ok(samples))
                        }
                        Err(e) => {
                            warn!(service = name, error = %e, "Failed to read metrics response body");
                            (name, Err(()))
                        }
                    },
                    Ok(Err(e)) => {
                        warn!(service = name, error = %e, "Failed to reach metrics endpoint");
                        (name, Err(()))
                    }
                    Err(_) => {
                        warn!(service = name, "Metrics endpoint timed out");
                        (name, Err(()))
                    }
                }
            }
        })
        .collect();

    let results = join_all(tasks).await;

    let mut all_samples: Vec<Sample> = Vec::new();

    for (name, outcome) in results {
        match outcome {
            Ok(mut samples) => {
                debug!(service = name, count = samples.len(), "Scraped metrics");
                all_samples.append(&mut samples);
            }
            Err(()) => {
                // Record unreachable service as a synthetic health metric.
                all_samples.push(Sample {
                    metric_name: "io_service_health".to_string(),
                    labels: serde_json::json!({
                        "service": name,
                        "status": "unreachable"
                    }),
                    value: 1.0,
                });
            }
        }
    }

    if all_samples.is_empty() {
        return;
    }

    // Batch-insert in chunks of `batch_size`.
    let mut inserted = 0usize;
    for chunk in all_samples.chunks(batch_size) {
        match insert_batch(db, chunk, now).await {
            Ok(n) => inserted += n,
            Err(e) => error!(error = %e, "Failed to insert metrics batch"),
        }
    }

    debug!(total = inserted, "Metrics batch insert complete");
}

/// Parse Prometheus text exposition format into `Sample` entries.
///
/// Handles:
/// - Comment lines (`#`)
/// - Lines with no labels: `metric_name value`
/// - Lines with labels:    `metric_name{key="val",...} value [timestamp]`
fn parse_prometheus_text(text: &str, service: &str, out: &mut Vec<Sample>) {
    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Split off optional trailing timestamp (epoch ms): "name{...} value ts"
        // We ignore the timestamp and use server-side now.
        let (metric_part, value_str) = match split_metric_line(line) {
            Some(parts) => parts,
            None => continue,
        };

        let value: f64 = match value_str.parse() {
            Ok(v) => v,
            Err(_) => continue, // Skip NaN / +Inf / -Inf etc.
        };

        // Parse name and labels from metric_part.
        let (metric_name, labels) = parse_name_and_labels(metric_part, service);

        out.push(Sample {
            metric_name,
            labels,
            value,
        });
    }
}

/// Split `"name{...} value [ts]"` → `Some(("name{...}", "value"))`.
fn split_metric_line(line: &str) -> Option<(&str, &str)> {
    // The value (and optional timestamp) follow the last `}` or the first space.
    let sep_pos = if let Some(brace_end) = line.rfind('}') {
        // e.g. `http_requests_total{method="GET"} 42`
        let after_brace = &line[brace_end + 1..];
        let spaces = after_brace.len() - after_brace.trim_start().len();
        if spaces == 0 {
            return None;
        }
        brace_end + 1 + spaces
    } else {
        // e.g. `go_goroutines 42`
        match line.find(' ') {
            Some(p) => p + 1,
            None => return None,
        }
    };

    let metric_part = &line[..sep_pos.saturating_sub(1)];
    let rest = &line[sep_pos..];
    // Take first token (the actual value), discard optional trailing timestamp.
    let value_str = rest.split_whitespace().next()?;
    Some((metric_part.trim(), value_str))
}

/// Parse `"metric_name{k="v",...}"` → `(String, serde_json::Value)`.
/// Injects `"service"` label to identify the origin.
fn parse_name_and_labels(metric_part: &str, service: &str) -> (String, serde_json::Value) {
    let mut map = serde_json::Map::new();
    map.insert(
        "service".to_string(),
        serde_json::Value::String(service.to_string()),
    );

    if let Some(brace_start) = metric_part.find('{') {
        let name = metric_part[..brace_start].to_string();
        let labels_str = &metric_part[brace_start + 1..];
        let labels_str = labels_str.trim_end_matches('}');

        // Naive label parser: key="value" pairs separated by commas.
        // Does not handle escaped quotes inside values — sufficient for Prometheus text format.
        for pair in split_labels(labels_str) {
            if let Some(eq) = pair.find('=') {
                let key = pair[..eq].trim().to_string();
                let raw_val = pair[eq + 1..].trim();
                let val = raw_val
                    .trim_start_matches('"')
                    .trim_end_matches('"')
                    .to_string();
                map.insert(key, serde_json::Value::String(val));
            }
        }
        (name, serde_json::Value::Object(map))
    } else {
        (metric_part.to_string(), serde_json::Value::Object(map))
    }
}

/// Split label string on commas, respecting quoted values.
fn split_labels(s: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0;
    let mut in_quotes = false;
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        match chars[i] {
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => {
                parts.push(&s[start..i]);
                start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    if start < s.len() {
        parts.push(&s[start..]);
    }
    parts
}

/// Insert a batch of samples into `io_metrics.samples`.
async fn insert_batch(
    db: &PgPool,
    samples: &[Sample],
    ts: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<usize> {
    if samples.is_empty() {
        return Ok(0);
    }

    // Build a VALUES clause. SQLx does not support bulk-insert via macros, so we
    // construct the query manually with positional parameters.
    //
    // Schema: io_metrics.samples(ts, metric_name, labels, value)
    let mut query =
        String::from("INSERT INTO io_metrics.samples (ts, metric_name, labels, value) VALUES ");

    let mut params_idx = 1usize;
    let mut first = true;
    for _ in samples {
        if !first {
            query.push(',');
        }
        first = false;
        query.push_str(&format!(
            "(${}, ${}, ${}, ${})",
            params_idx,
            params_idx + 1,
            params_idx + 2,
            params_idx + 3
        ));
        params_idx += 4;
    }
    query.push_str(" ON CONFLICT DO NOTHING");

    let mut q = sqlx::query(&query);
    for s in samples {
        q = q.bind(ts).bind(&s.metric_name).bind(&s.labels).bind(s.value);
    }

    q.execute(db).await?;
    Ok(samples.len())
}
