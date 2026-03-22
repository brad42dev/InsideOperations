---
id: DD-36-003
title: Implement missing standard metrics across all services
unit: DD-36
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The spec requires every service to emit six standard metrics beyond the HTTP counter/histogram: an in-flight requests gauge, three DB connection pool gauges, a DB query latency histogram, and a service uptime gauge. None of these are emitted by any service. Without them the System Health metrics tab cannot show pool utilization or latency percentiles.

## Spec Excerpt (verbatim)

> Every service emits these metrics via the Axum middleware and connection pool instrumentation provided by `io-observability`:
>
> | Metric | Type | Labels | Description |
> |--------|------|--------|-------------|
> | `io_http_requests_in_flight` | Gauge | `service` | Currently processing requests |
> | `io_db_pool_size` | Gauge | `service` | Connection pool max size |
> | `io_db_pool_active` | Gauge | `service` | Active database connections |
> | `io_db_pool_idle` | Gauge | `service` | Idle database connections |
> | `io_db_query_duration_seconds` | Histogram | `service`, `query_type` | Database query latency |
> | `io_service_uptime_seconds` | Gauge | `service` | Seconds since service start |
> | `io_service_info` | Gauge (always 1) | `service`, `version`, `build_hash` | Service metadata |
>
> — design-docs/36_OBSERVABILITY.md, §Standard Metrics (All Services)

## Where to Look in the Codebase

Primary files:
- `crates/io-observability/src/lib.rs` — `init()` sets `io_service_info` (lines 94-99) but omits `build_hash` label and spawns no uptime task
- `services/api-gateway/src/mw.rs:271-296` — `metrics_middleware` — missing `io_http_requests_in_flight` tracking
- `crates/io-db/src/lib.rs` — pool creation; should wrap with pool metric instrumentation
- Every service `main.rs` — no DB pool or uptime metrics

## Verification Checklist

- [ ] `io_http_requests_in_flight` gauge is incremented on request entry and decremented on response in `metrics_middleware`
- [ ] `io_service_uptime_seconds` gauge is updated periodically (e.g. every 15s via a spawned task) in `io_observability::init()`
- [ ] `io_service_info` gauge carries `build_hash` label in addition to `service` and `version`
- [ ] `io_db_pool_size`, `io_db_pool_active`, `io_db_pool_idle` gauges are updated periodically using SQLx pool state in services that have a `db` pool
- [ ] `io_db_query_duration_seconds` histogram is recorded for database queries (at minimum for the `SELECT 1` health check — ideally via a wrapper in `crates/io-db`)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `io_service_info` is emitted but missing `build_hash` label (`lib.rs:94-99`). All other five metrics are absent from all services.

## Fix Instructions

**1. Add `io_service_uptime_seconds` and fix `io_service_info` in `io_observability::init()`:**

```rust
// After setting up metrics, spawn an uptime gauge update task.
let start = std::time::Instant::now();
let svc = config.service_name;
tokio::spawn(async move {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(15));
    loop {
        interval.tick().await;
        metrics::gauge!("io_service_uptime_seconds", "service" => svc)
            .set(start.elapsed().as_secs_f64());
    }
});

// Fix io_service_info to include build_hash.
// Use env!("CARGO_PKG_VERSION") for version; build_hash from an optional env var.
let build_hash = std::env::var("IO_BUILD_HASH").unwrap_or_else(|_| "unknown".to_string());
metrics::gauge!(
    "io_service_info",
    "service" => config.service_name,
    "version" => config.service_version,
    "build_hash" => build_hash,  // static label — set once, gauge stays at 1.0
)
.set(1.0);
```

**2. Add `io_http_requests_in_flight` to `metrics_middleware`:**

```rust
pub async fn metrics_middleware(req: Request, next: Next) -> Response {
    metrics::gauge!("io_http_requests_in_flight", "service" => "api-gateway").increment(1.0);
    // ... existing code ...
    let response = next.run(req).await;
    metrics::gauge!("io_http_requests_in_flight", "service" => "api-gateway").decrement(1.0);
    // ... emit counter/histogram ...
    response
}
```

**3. Add DB pool metrics to each service.** The cleanest approach is a helper in `crates/io-db` that takes a `&sqlx::PgPool` and a service name, then spawns a task that polls pool state every 15 seconds. SQLx `PgPool` exposes `.size()` (total) and via `pool.options()` the `max_connections`. For active/idle, use `pool.num_idle()`.

```rust
// In crates/io-db/src/lib.rs
pub fn spawn_pool_metrics(pool: sqlx::PgPool, service_name: &'static str) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
        loop {
            interval.tick().await;
            let total = pool.size() as f64;
            let idle  = pool.num_idle() as f64;
            metrics::gauge!("io_db_pool_size",   "service" => service_name).set(total);
            metrics::gauge!("io_db_pool_idle",   "service" => service_name).set(idle);
            metrics::gauge!("io_db_pool_active", "service" => service_name).set(total - idle);
        }
    });
}
```

Call `io_db::spawn_pool_metrics(db.clone(), "api-gateway")` in each service `main.rs` after pool creation.

Do NOT record `io_db_query_duration_seconds` for every individual query without a query-type label — use high-level categories like `"read"`, `"write"`, `"health"` to avoid cardinality explosion.
