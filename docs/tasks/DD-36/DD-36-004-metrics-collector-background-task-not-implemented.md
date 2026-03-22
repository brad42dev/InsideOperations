---
id: DD-36-004
title: Implement API Gateway metrics collector background task
unit: DD-36
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The API Gateway should run a Tokio background task that polls all 11 services' `/metrics` endpoints every 15 seconds, parses the Prometheus text format, and batch-inserts rows into `io_metrics.samples`. This is what feeds the System Health Metrics tab charts. Without it the `io_metrics.samples` hypertable remains empty and all time-series charts have no data.

## Spec Excerpt (verbatim)

> The API Gateway runs a background Tokio task that collects metrics from all services and writes them to TimescaleDB.
>
> Every 15 seconds:
>     ├── 1. Poll GET /metrics on all 11 services (parallel, 5s timeout each)
>     ├── 2. Parse Prometheus text format responses
>     ├── 3. Batch INSERT into io_metrics.samples
>     └── 4. For unreachable services: Record io_service_health{...} = 1
>
> | Parameter | Default | Env Var |
> |-----------|---------|---------|
> | Collection interval | 15 seconds | `IO_METRICS_INTERVAL` |
> | Per-service timeout | 5 seconds | `IO_METRICS_TIMEOUT` |
> | Batch size | 1000 rows | `IO_METRICS_BATCH_SIZE` |
> | Collector enabled | true | `IO_METRICS_COLLECTOR_ENABLED` |
>
> — design-docs/36_OBSERVABILITY.md, §Metrics Collection

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` — main startup; no `tokio::spawn` for a metrics collector exists
- `services/api-gateway/src/config.rs` — config struct; no `metrics_interval`, `metrics_timeout`, `metrics_batch_size`, or `metrics_collector_enabled` fields
- `.env.example:189-197` — env vars documented but no code reads them
- `migrations/20260314000031_metrics.up.sql` — schema target for collected data (correct)

## Verification Checklist

- [ ] `services/api-gateway/src/` contains a `metrics_collector.rs` module (or equivalent name)
- [ ] The collector is spawned in `main.rs` before the server starts listening
- [ ] Collector reads `IO_METRICS_COLLECTOR_ENABLED` from env; if false, it does not start
- [ ] Collector reads `IO_METRICS_INTERVAL` (default 15s), `IO_METRICS_TIMEOUT` (default 5s), `IO_METRICS_BATCH_SIZE` (default 1000)
- [ ] Scrapes all 11 service `/metrics` endpoints in parallel with per-service timeout
- [ ] Parses Prometheus text format (counter, gauge, histogram lines) into `(metric_name, labels_jsonb, value)` tuples
- [ ] Batch-inserts into `io_metrics.samples` with current timestamp
- [ ] For unreachable services, records `io_service_health{service="<name>",status="unreachable"} = 1`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No collector module exists. `IO_METRICS_COLLECTOR_ENABLED` appears in `.env.example` and `systemd/io-environment.conf` but no Rust code reads or acts on it. The `io_metrics.samples` table will remain empty indefinitely.

## Fix Instructions

Create `services/api-gateway/src/metrics_collector.rs`:

```rust
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::{info, warn};

const SERVICE_ENDPOINTS: &[(&str, &str)] = &[
    ("api-gateway",         "http://127.0.0.1:3000/metrics"),
    ("data-broker",         "http://127.0.0.1:3001/metrics"),
    ("opc-service",         "http://127.0.0.1:3002/metrics"),
    ("event-service",       "http://127.0.0.1:3003/metrics"),
    ("parser-service",      "http://127.0.0.1:3004/metrics"),
    ("archive-service",     "http://127.0.0.1:3005/metrics"),
    ("import-service",      "http://127.0.0.1:3006/metrics"),
    ("alert-service",       "http://127.0.0.1:3007/metrics"),
    ("email-service",       "http://127.0.0.1:3008/metrics"),
    ("auth-service",        "http://127.0.0.1:3009/metrics"),
    ("recognition-service", "http://127.0.0.1:3010/metrics"),
];

pub async fn run(db: PgPool, http_client: reqwest::Client) {
    let interval_secs: u64 = std::env::var("IO_METRICS_INTERVAL")
        .ok().and_then(|v| v.parse().ok()).unwrap_or(15);
    let timeout_secs: u64 = std::env::var("IO_METRICS_TIMEOUT")
        .ok().and_then(|v| v.parse().ok()).unwrap_or(5);
    let batch_size: usize = std::env::var("IO_METRICS_BATCH_SIZE")
        .ok().and_then(|v| v.parse().ok()).unwrap_or(1000);

    let mut interval = tokio::time::interval(
        std::time::Duration::from_secs(interval_secs)
    );
    info!("Metrics collector started (interval={}s)", interval_secs);

    loop {
        interval.tick().await;
        collect_once(&db, &http_client, timeout_secs, batch_size).await;
    }
}

async fn collect_once(db: &PgPool, client: &reqwest::Client, timeout_secs: u64, batch_size: usize) {
    let now = chrono::Utc::now();

    // Scrape all services in parallel.
    let scrape_futures: Vec<_> = SERVICE_ENDPOINTS.iter().map(|(name, url)| {
        let client = client.clone();
        let url = url.to_string();
        let name = *name;
        async move {
            let result = client.get(&url)
                .timeout(std::time::Duration::from_secs(timeout_secs))
                .send()
                .await;
            (name, result)
        }
    }).collect();

    let results = futures::future::join_all(scrape_futures).await;

    // Collect all (metric_name, labels, value) rows.
    let mut rows: Vec<(String, serde_json::Value, f64)> = Vec::new();

    for (service_name, result) in results {
        match result {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(text) = resp.text().await {
                    parse_prometheus_text(&text, service_name, &mut rows);
                }
            }
            _ => {
                warn!(service = service_name, "Failed to scrape /metrics");
                rows.push((
                    "io_service_health".to_string(),
                    serde_json::json!({"service": service_name, "status": "unreachable"}),
                    1.0,
                ));
            }
        }
    }

    // Batch insert in chunks of batch_size.
    for chunk in rows.chunks(batch_size) {
        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO io_metrics.samples (time, metric_name, labels, value) "
        );
        query_builder.push_values(chunk, |mut b, (name, labels, value)| {
            b.push_bind(now)
             .push_bind(name)
             .push_bind(labels)
             .push_bind(value);
        });
        if let Err(e) = query_builder.build().execute(db).await {
            warn!(error = %e, "Failed to insert metrics batch");
        }
    }
}

/// Parse Prometheus text exposition format lines into (metric_name, labels_json, value) tuples.
/// Skips comment lines (# HELP, # TYPE) and empty lines.
fn parse_prometheus_text(text: &str, _service: &str, out: &mut Vec<(String, serde_json::Value, f64)>) {
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }

        // Format: metric_name{label="val",...} value [timestamp]
        let (name_and_labels, value_str) = match line.rfind(' ') {
            Some(pos) => (&line[..pos], line[pos+1..].split_whitespace().next().unwrap_or("")),
            None => continue,
        };

        let value: f64 = match value_str.parse() {
            Ok(v) => v,
            Err(_) => continue,
        };

        let (metric_name, labels) = if let Some(brace_pos) = name_and_labels.find('{') {
            let name = &name_and_labels[..brace_pos];
            let label_str = name_and_labels[brace_pos+1..].trim_end_matches('}');
            let mut map = serde_json::Map::new();
            for pair in label_str.split(',') {
                if let Some(eq) = pair.find('=') {
                    let k = pair[..eq].trim();
                    let v = pair[eq+1..].trim().trim_matches('"');
                    map.insert(k.to_string(), serde_json::Value::String(v.to_string()));
                }
            }
            (name.to_string(), serde_json::Value::Object(map))
        } else {
            (name_and_labels.to_string(), serde_json::json!({}))
        };

        out.push((metric_name, labels, value));
    }
}
```

In `services/api-gateway/src/main.rs`, add `mod metrics_collector;` and spawn before the server starts:

```rust
// After building `state` and `app`, before `axum::serve(...)`:
let enabled = std::env::var("IO_METRICS_COLLECTOR_ENABLED")
    .map(|v| v != "false" && v != "0")
    .unwrap_or(true);
if enabled {
    let db2 = state.db.clone();
    let client2 = state.http_client.clone();
    tokio::spawn(metrics_collector::run(db2, client2));
}
```

Add `futures` to `services/api-gateway/Cargo.toml` if not already present (it is an MIT-licensed crate).

Do NOT poll the API Gateway's own `/metrics` endpoint via HTTP — use the local `PrometheusHandle` directly or simply include a self-scrape using `obs.prometheus_handle.render()` to avoid a loopback HTTP round-trip.
