# 36. Observability

## Overview

Observability for Inside/Operations covers three pillars: **health checks**, **metrics**, and **distributed tracing**. Two new shared crates (`io-health`, `io-observability`) provide uniform instrumentation across all 11 services. Every service exposes the same health endpoints, the same metrics endpoint, and the same structured logging format — no per-service custom wiring.

Metrics are stored in TimescaleDB (not an external metrics database), but instrumentation uses Prometheus-format naming and types so Prometheus can be added later with zero code changes. The internal metrics collector is a stopgap; the architecture is designed to be replaced by Prometheus scraping when operational maturity warrants it.

### Design Principles

1. **Liveness checks must never cascade** — The `/health/live` endpoint never checks dependencies. A database outage must not cause a load balancer to kill the process that would recover once the database returns.
2. **Prometheus-compatible from day one** — Every service exposes `/metrics` in Prometheus text exposition format. Whether the internal collector or Prometheus reads it is an operational choice, not a code change.
3. **Structured everything** — Logs are JSON. Metrics have consistent labels. Traces use W3C `traceparent`. No unstructured text to grep through.
4. **Opt-in complexity** — Health checks and metrics work out of the box. Distributed tracing is disabled by default and enabled per-deployment when needed.
5. **No new infrastructure required** — The base deployment uses PostgreSQL/TimescaleDB that already exists. Jaeger and Prometheus are optional add-ons.

---

## Shared Crates

### io-health Crate

Three-endpoint health check pattern implemented once, mounted by all 11 services.

#### Endpoints

| Endpoint | Purpose | Checks Dependencies | Used By |
|----------|---------|---------------------|---------|
| `GET /health/live` | Process alive | **No** — always returns 200 if the process is running | systemd watchdog, load balancers |
| `GET /health/ready` | Service can handle requests | **Yes** — checks critical deps per service | Internal metrics collector, orchestrators |
| `GET /health/startup` | Initialization complete | **Yes** — one-time probe | Orchestrators deciding when to route traffic |

#### Liveness

`GET /health/live` returns `200 OK` with a minimal body:

```json
{ "status": "alive" }
```

This endpoint **never** checks databases, Redis, OPC connections, or any external resource. If the Tokio runtime is running and Axum can respond, it returns 200. This prevents cascading health check failures — if PostgreSQL goes down, the service stays alive and can recover when the database returns.

#### Readiness

`GET /health/ready` checks each service's critical dependencies and returns structured JSON:

```json
{
  "status": "ready",
  "service": "api-gateway",
  "version": "1.2.3",
  "uptime_seconds": 86400,
  "checks": {
    "database": { "status": "ok", "latency_ms": 2 },
    "redis": { "status": "ok", "latency_ms": 1 },
    "opc_source_1": { "status": "timeout", "latency_ms": 5000 }
  }
}
```

Status values:
- **`ready`** — All checks pass
- **`degraded`** — At least one non-critical check is failing, but the service can still handle requests (e.g., one of three OPC sources is down)
- **`not_ready`** — A critical dependency is down (e.g., database unreachable). Service should not receive new requests.

Each check reports:
- `status`: `ok`, `timeout`, `error`
- `latency_ms`: Time taken to perform the check
- `error` (optional): Error message when status is not `ok`

#### Startup

`GET /health/startup` returns `503 Service Unavailable` until the service has completed its initialization sequence:

1. Database connection pool established
2. Migration version verified (not necessarily run — just checked)
3. Configuration loaded from database
4. Cache warm-up complete (if applicable)
5. Background tasks spawned

Once all init steps complete, returns `200 OK`. After that first 200, this endpoint always returns 200 for the lifetime of the process.

#### Health Check Trait

Each service defines its own dependency checks by implementing the `HealthCheckable` trait:

```rust
pub trait HealthCheckable: Send + Sync {
    fn name(&self) -> &str;
    fn check(&self) -> impl Future<Output = HealthStatus>;
    fn critical(&self) -> bool { true }  // if false, failure = degraded not not_ready
}
```

A service registers its checks at startup:

```rust
let health = HealthRegistry::new("data-broker", env!("CARGO_PKG_VERSION"));
health.register(DatabaseCheck::new(pool.clone()));
health.register(RedisCheck::new(redis.clone()));
health.register(OpcCheck::new(opc_client.clone()).critical(false));

// Mount all three endpoints
app.merge(health.routes());
```

The crate ships with built-in check implementations for common dependencies:
- `DatabaseCheck` — `SELECT 1` against the connection pool
- `RedisCheck` — `PING` against the Redis connection
- `UnixSocketCheck` — connect + health ping for inter-service UDS connections

Service-specific checks (OPC sources, email providers, etc.) implement `HealthCheckable` directly.

---

### io-observability Crate

Unified initialization for tracing, metrics, and health. Each service calls a single function in `main()`:

```rust
#[tokio::main]
async fn main() {
    let obs = io_observability::init(ObservabilityConfig {
        service_name: "data-broker",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",          // overridden by IO_LOG_LEVEL env var
        metrics_enabled: true,      // always true in practice
        tracing_enabled: false,     // overridden by IO_TRACING_ENABLED env var
        otlp_endpoint: None,        // overridden by IO_OTLP_ENDPOINT env var
    }).expect("observability init failed");

    // obs.metrics_handle — PrometheusHandle for /metrics endpoint
    // obs.shutdown_guard — drops to flush pending traces on shutdown
}
```

#### What `init()` Sets Up

1. **Structured logging**: `tracing-subscriber` (MIT) with JSON formatter. Every log line includes timestamp, level, service name, span context, and structured fields. The `EnvFilter` layer respects `IO_LOG_LEVEL` for runtime log level changes without restart.

2. **Metrics endpoint**: `metrics` crate (MIT) facade initialized with `metrics-exporter-prometheus` (MIT). Returns a `PrometheusHandle` that the service mounts as `GET /metrics`. The endpoint returns Prometheus text exposition format.

3. **Span-to-metric bridging**: `metrics-tracing-context` (MIT) automatically adds tracing span fields as metric labels. A span named `http_request` with field `method = "GET"` automatically enriches any metrics recorded inside that span.

4. **Distributed tracing** (optional): When `IO_TRACING_ENABLED=true`, initializes `tracing-opentelemetry` (MIT) + `opentelemetry` (Apache 2.0) with OTLP exporter. Injects W3C `traceparent` headers on outgoing requests, extracts them on incoming requests.

#### Crate Dependencies

| Crate | License | Purpose |
|-------|---------|---------|
| `tracing` | MIT | Structured logging facade |
| `tracing-subscriber` | MIT | Log formatting, filtering, layered subscribers |
| `tracing-opentelemetry` | MIT | Bridge tracing spans to OpenTelemetry (optional) |
| `metrics` | MIT | Metrics facade (counters, gauges, histograms) |
| `metrics-exporter-prometheus` | MIT | Prometheus text format exposition |
| `metrics-tracing-context` | MIT | Bridge span fields to metric labels |
| `opentelemetry` | Apache 2.0 | Distributed tracing SDK (optional) |
| `opentelemetry-otlp` | Apache 2.0 | OTLP trace exporter (optional) |

---

## Metrics System

### Instrumentation

All services use the `metrics` crate facade. The facade is zero-cost when no exporter is registered and adds negligible overhead with the Prometheus exporter. Developers instrument code with simple macros:

```rust
use metrics::{counter, gauge, histogram};

// In an HTTP middleware
counter!("io_http_requests_total", "service" => "api-gateway", "method" => method, "path" => path, "status" => status);
histogram!("io_http_request_duration_seconds", duration.as_secs_f64(), "service" => "api-gateway", "method" => method, "path" => path);

// In a connection manager
gauge!("io_db_pool_active", pool.active() as f64, "service" => "data-broker");
```

### Naming Conventions

All metrics follow Prometheus naming best practices:
- **Prefix**: `io_` for all Inside/Operations metrics
- **Snake_case**: `io_http_requests_total`, not `io.http.requests.total`
- **Counters**: `_total` suffix (e.g., `io_http_requests_total`)
- **Durations**: `_seconds` suffix, values in seconds as float (e.g., `io_http_request_duration_seconds`)
- **Gauges**: No suffix convention (e.g., `io_ws_connections`, `io_db_pool_active`)
- **Info metrics**: Gauge pinned to `1` with metadata labels (e.g., `io_service_info{version="1.2.3", build_hash="abc123"}`)

### Prometheus-Format Endpoint

Each service exposes `GET /metrics` returning Prometheus text exposition format:

```
# HELP io_http_requests_total Total HTTP requests
# TYPE io_http_requests_total counter
io_http_requests_total{service="api-gateway",method="GET",path="/api/points",status="200"} 14523
io_http_requests_total{service="api-gateway",method="GET",path="/api/points",status="500"} 3

# HELP io_http_request_duration_seconds HTTP request latency
# TYPE io_http_request_duration_seconds histogram
io_http_request_duration_seconds_bucket{service="api-gateway",method="GET",path="/api/points",le="0.01"} 12000
...
```

This endpoint exists on every service regardless of whether Prometheus is deployed. It serves two purposes:
1. The internal metrics collector (API Gateway background task) reads it
2. If Prometheus is added later, it scrapes these endpoints directly — zero code changes

The `/metrics` endpoint is unauthenticated but only listens on the service's internal address (Unix domain socket or localhost). It is not exposed through the API Gateway's public routes.

---

### TimescaleDB Storage

Metrics are written to a dedicated `io_metrics` schema in the existing PostgreSQL/TimescaleDB instance. No additional database infrastructure required.

#### Schema

```sql
CREATE SCHEMA io_metrics;

CREATE TABLE io_metrics.samples (
    time        TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL,
    labels      JSONB NOT NULL DEFAULT '{}',
    value       DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('io_metrics.samples', 'time');

-- Index for querying specific metrics
CREATE INDEX idx_samples_metric_time
    ON io_metrics.samples (metric_name, time DESC);

-- GIN index for label filtering
CREATE INDEX idx_samples_labels
    ON io_metrics.samples USING GIN (labels);
```

#### Retention and Aggregation

```sql
-- Raw samples retained for 30 days
SELECT add_retention_policy('io_metrics.samples', INTERVAL '30 days');

-- 5-minute continuous aggregate for long-term trends
CREATE MATERIALIZED VIEW io_metrics.samples_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    metric_name,
    labels,
    avg(value) AS avg_value,
    max(value) AS max_value,
    min(value) AS min_value,
    count(*) AS sample_count
FROM io_metrics.samples
GROUP BY bucket, metric_name, labels;

-- Refresh policy: materialize data older than 10 minutes
SELECT add_continuous_aggregate_policy('io_metrics.samples_5m',
    start_offset    => INTERVAL '1 hour',
    end_offset      => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '5 minutes');

-- 5-minute aggregate retained for 1 year
SELECT add_retention_policy('io_metrics.samples_5m', INTERVAL '1 year');

-- Enable compression on raw samples after 7 days
ALTER TABLE io_metrics.samples SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'metric_name',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('io_metrics.samples', INTERVAL '7 days');
```

#### Storage Estimates

At 15-second collection intervals across 11 services, each exposing ~20 metric series on average:

- **Raw samples**: ~220 rows/interval x 4/min x 60 min x 24 hr = ~1.27M rows/day
- **Compressed**: TimescaleDB compression typically achieves 10-20x ratio on metric data
- **30-day raw**: ~38M rows before compression, ~2-4M equivalent after compression
- **5-minute aggregates**: ~63K rows/day, ~23M rows/year

---

### Metrics Collection

The API Gateway runs a background Tokio task that collects metrics from all services and writes them to TimescaleDB.

#### Collection Flow

```
Every 15 seconds:
    │
    ├── 1. Poll GET /metrics on all 11 services (parallel, 5s timeout each)
    │       ├── Via Unix domain socket (primary)
    │       └── Via localhost TCP (fallback)
    │
    ├── 2. Parse Prometheus text format responses
    │       └── Extract metric name, labels, value, type
    │
    ├── 3. Batch INSERT into io_metrics.samples
    │       └── Single INSERT with multiple VALUES rows
    │
    └── 4. For unreachable services:
            └── Record io_service_health{service="<name>", status="unreachable"} = 1
```

#### Configuration

| Parameter | Default | Env Var |
|-----------|---------|---------|
| Collection interval | 15 seconds | `IO_METRICS_INTERVAL` |
| Per-service timeout | 5 seconds | `IO_METRICS_TIMEOUT` |
| Batch size | 1000 rows | `IO_METRICS_BATCH_SIZE` |
| Collector enabled | true | `IO_METRICS_COLLECTOR_ENABLED` |

Set `IO_METRICS_COLLECTOR_ENABLED=false` when Prometheus is handling collection.

---

### Standard Metrics (All Services)

Every service emits these metrics via the Axum middleware and connection pool instrumentation provided by `io-observability`:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `io_http_requests_total` | Counter | `service`, `method`, `path`, `status` | Total HTTP requests |
| `io_http_request_duration_seconds` | Histogram | `service`, `method`, `path` | Request latency |
| `io_http_requests_in_flight` | Gauge | `service` | Currently processing requests |
| `io_db_pool_size` | Gauge | `service` | Connection pool max size |
| `io_db_pool_active` | Gauge | `service` | Active database connections |
| `io_db_pool_idle` | Gauge | `service` | Idle database connections |
| `io_db_query_duration_seconds` | Histogram | `service`, `query_type` | Database query latency |
| `io_service_uptime_seconds` | Gauge | `service` | Seconds since service start |
| `io_service_info` | Gauge (always 1) | `service`, `version`, `build_hash` | Service metadata |

The `path` label uses route templates (`/api/points/:id`), not actual paths with IDs, to prevent label cardinality explosion.

---

### Service-Specific Metrics

Each service emits additional metrics relevant to its domain:

#### Data Broker (Port 3001)

| Metric | Type | Description |
|--------|------|-------------|
| `io_ws_connections` | Gauge | Active WebSocket connections |
| `io_ws_subscriptions` | Gauge | Active point subscriptions |
| `io_ws_messages_sent_total` | Counter | Total WebSocket messages delivered |
| `io_ws_backpressure_drops_total` | Counter | Messages dropped due to slow clients |

#### OPC Service (Port 3002)

| Metric | Type | Description |
|--------|------|-------------|
| `io_opc_sources_connected` | Gauge | Connected OPC UA sources |
| `io_opc_points_subscribed` | Gauge | Total points with active subscriptions |
| `io_opc_updates_received_total` | Counter | Point value updates received from OPC |
| `io_opc_reconnections_total` | Counter | OPC source reconnection attempts |

#### API Gateway (Port 3000)

| Metric | Type | Description |
|--------|------|-------------|
| `io_auth_logins_total` | Counter | Successful login attempts |
| `io_auth_failures_total` | Counter | Failed login attempts (by reason) |
| `io_active_sessions` | Gauge | Active authenticated sessions |

#### Event Service (Port 3003)

| Metric | Type | Description |
|--------|------|-------------|
| `io_events_ingested_total` | Counter | Events written to the event store |
| `io_alarms_active` | Gauge | Currently active alarms |

#### Archive Service (Port 3005)

| Metric | Type | Description |
|--------|------|-------------|
| `io_timeseries_inserts_total` | Counter | Rows inserted into time-series hypertables |
| `io_compression_ratio` | Gauge | Current TimescaleDB compression ratio |
| `io_retention_rows_dropped_total` | Counter | Rows removed by retention policies |

#### Alert Service (Port 3007)

| Metric | Type | Description |
|--------|------|-------------|
| `io_alert_dispatched_total` | Counter | Alerts dispatched (by channel, severity) |
| `io_alert_acknowledged_total` | Counter | Alerts acknowledged |
| `io_alert_escalated_total` | Counter | Alerts that triggered escalation |

#### Email Service (Port 3008)

| Metric | Type | Description |
|--------|------|-------------|
| `io_email_queue_depth` | Gauge | Emails pending in send queue |
| `io_email_sent_total` | Counter | Emails successfully sent |
| `io_email_failures_total` | Counter | Email send failures (by reason) |

#### Auth Service (Port 3009)

| Metric | Type | Description |
|--------|------|-------------|
| `io_tokens_issued_total` | Counter | JWT tokens issued (access + refresh) |
| `io_mfa_challenges_total` | Counter | MFA challenges initiated |

#### Recognition Service (Port 3010)

| Metric | Type | Description |
|--------|------|-------------|
| `io_recognition_inferences_total` | Counter | Model inference requests |
| `io_recognition_duration_seconds` | Histogram | Inference latency per model |

#### Import Service (Port 3006)

| Metric | Type | Description |
|--------|------|-------------|
| `io_import_runs_total` | Counter | Import jobs executed |
| `io_import_errors_total` | Counter | Import job failures |
| `io_import_rows_processed_total` | Counter | Total rows processed across imports |

#### Parser Service (Port 3004)

| Metric | Type | Description |
|--------|------|-------------|
| `io_imports_parsed_total` | Counter | Files parsed |
| `io_parse_duration_seconds` | Histogram | File parse latency |

---

## Shell Status Indicator

### User-Facing Popover (All Authenticated Users)

A small status dot in the top navigation bar, right side near the user profile avatar. The dot provides at-a-glance system health without requiring admin privileges or navigating to Settings.

#### Status Dot States

| Color | Condition | Meaning |
|-------|-----------|---------|
| Green | All checks pass | Services healthy, WebSocket connected, OPC data flowing |
| Yellow | Non-critical degradation | Some checks failing, WebSocket reconnecting, or partial OPC stale |
| Red | Critical | WebSocket disconnected >30s, or all OPC sources offline |
| Gray | Unknown | Initial connection not yet established |

The dot pulses briefly on state transitions to draw attention.

#### Popover Content

Clicking the dot opens a compact popover with plain-language status:

```
┌──────────────────────────────────────┐
│  System Status                       │
│                                      │
│  ● WebSocket    Connected            │
│  ● OPC Data     Flowing (3/3)        │
│  ● Server       Reachable            │
│                                      │
│  Last update: 2 seconds ago          │
│                                      │
│  ▸ Open System Health  (admin only)  │
└──────────────────────────────────────┘
```

Status items:
- **WebSocket**: Connected / Reconnecting (attempt #N) / Disconnected
- **OPC Data**: Flowing (N/M sources) / Stale (N sources) / Offline
- **Server**: Reachable / Unreachable
- **Last update**: Relative timestamp of last received data

The "Open System Health" link is only visible to users with `system:monitor` permission and navigates to the full admin dashboard.

#### Frontend Implementation

The status indicator is driven by data the frontend already has:
- WebSocket connection state from the Data Broker connection
- OPC data freshness from point-level stale detection (doc 16)
- Server reachability from periodic API Gateway health ping (every 30s)

No additional API calls are needed for the basic popover. The frontend evaluates the worst-case status across these three sources to determine the dot color.

---

### Settings > System Health (Admin Only)

Full system health page in the Settings module, available to users with `system:monitor` permission. Provides deep operational visibility into all 11 services and supporting infrastructure.

#### Services Tab

| Column | Source |
|--------|--------|
| Service name | Static config |
| Status (Ready / Degraded / Not Ready / Unreachable) | `GET /health/ready` |
| Uptime | `io_service_uptime_seconds` metric |
| Version | `io_service_info` metric labels |
| Response time (p50, p95) | `io_http_request_duration_seconds` histogram |
| Request rate (req/s) | `io_http_requests_total` counter rate |
| Error rate (%) | `io_http_requests_total` where status >= 500 |
| Last check | Timestamp of last health check |

Auto-refreshes every 15 seconds (matches collection interval). Services in Degraded or Not Ready state are highlighted with ISA-101 advisory (yellow) or warning (orange) colors.

#### Database Tab

- Connection pool utilization per service (active / idle / max)
- Active query count and longest-running query
- Current migration version
- Disk usage (total, data, indexes, WAL)
- TimescaleDB compression stats (compressed vs. uncompressed chunk count, compression ratio)
- Retention policy status (last run, rows removed)
- Replication lag (if streaming replication is configured)

#### OPC Sources Tab

Per-source detail:
- Connection status (Connected / Reconnecting / Disconnected)
- Subscribed point count
- Update rate (updates/s)
- Last successful update timestamp
- Reconnection count and last reconnection time
- Error history (last 10 errors with timestamps)

#### WebSocket Tab

- Active connections (total and per-user breakdown)
- Total active subscriptions
- Message rate (messages/s sent)
- Backpressure events (drops in last hour)
- Queue depth per connection (histogram)
- Connection duration distribution

#### Jobs Tab

| Queue | Columns |
|-------|---------|
| Email | Pending / Sent / Failed / Retry (last 24h totals + current queue depth) |
| Alerts | Pending / Dispatched / Acknowledged / Escalated (last 24h) |
| Exports | Active / Queued / Completed / Failed (last 24h) |
| Imports | Running / Scheduled / Completed / Failed (last 24h) |

#### Metrics Tab

Interactive time-series charts using the same uPlot infrastructure as Dashboards (doc 32). Queries data from `io_metrics.samples` and `io_metrics.samples_5m`.

Default charts:
- **Request Rate**: Stacked by service, 1-minute resolution
- **Request Latency (p95)**: Per-service lines, 1-minute resolution
- **Error Rate**: Per-service, 5-minute resolution
- **WebSocket Connections**: Over time, 1-minute resolution
- **OPC Update Rate**: Per-source, 1-minute resolution
- **Database Pool Utilization**: Per-service, 5-minute resolution

Time range selector: Last 1h / 6h / 24h / 7d / 30d. Automatically switches from raw samples to 5-minute aggregates for ranges >24h.

---

## Distributed Tracing (Optional)

OpenTelemetry integration for cross-service request correlation. Disabled by default — only enable when debugging cross-service latency or complex request flows.

### How It Works

When enabled, every incoming HTTP request that lacks a `traceparent` header gets a new trace ID. The trace ID propagates across inter-service calls via the W3C `traceparent` header:

```
Client request (no traceparent)
    │
    ▼
API Gateway (generates trace ID: abc123)
    │  traceparent: 00-abc123-span1-01
    ▼
Data Broker (continues trace abc123)
    │  traceparent: 00-abc123-span2-01
    ▼
OPC Service (continues trace abc123)
```

Each service emits spans for:
- Incoming HTTP requests (automatic via middleware)
- Outgoing HTTP calls to other services (automatic via client middleware)
- Database queries (manual instrumentation in io-db crate)
- Significant business logic (manual `#[instrument]` annotations)

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `IO_TRACING_ENABLED` | `false` | Enable OpenTelemetry trace export |
| `IO_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC endpoint (Jaeger) |
| `IO_TRACE_SAMPLE_RATE` | `0.1` | Fraction of traces to sample (0.0–1.0) |

### Jaeger

Jaeger (Apache 2.0) is the recommended trace backend. It provides a web UI for searching and visualizing traces. Deploy it only when actively debugging — it is not required for normal operation.

Jaeger all-in-one is sufficient for I/O's scale:

```bash
# Example: run Jaeger in Docker for debugging
docker run -d --name jaeger \
  -p 4317:4317 \    # OTLP gRPC
  -p 16686:16686 \  # Jaeger UI
  jaegertracing/all-in-one:latest
```

### When to Enable

- Debugging slow API responses that span multiple services
- Tracking down where a request fails in a multi-service chain
- Understanding the actual execution flow of complex operations (e.g., import → parse → validate → write)
- Performance profiling during load testing

Do not run tracing in production permanently — the overhead is low but non-zero, and the trace data requires storage.

---

## Prometheus Future On-Ramp

The architecture is designed so Prometheus can replace the internal metrics collector with zero code changes.

### Current State (Internal Collector)

```
┌──────────┐    GET /metrics     ┌─────────────┐   INSERT    ┌────────────┐
│ Service 1 │ ◄──────────────── │ API Gateway  │ ──────────► │ TimescaleDB │
│ Service 2 │ ◄──────────────── │ (collector   │             │ io_metrics  │
│ ...       │ ◄──────────────── │  task)       │             │ schema      │
│ Service 11│ ◄──────────────── │              │             │             │
└──────────┘                    └─────────────┘             └────────────┘
```

### Future State (Prometheus)

```
┌──────────┐    GET /metrics     ┌─────────────┐
│ Service 1 │ ◄──────────────── │ Prometheus   │ ──── PromQL queries
│ Service 2 │ ◄──────────────── │              │
│ ...       │ ◄──────────────── │              │ ──── Alertmanager rules
│ Service 11│ ◄──────────────── │              │
└──────────┘                    └─────────────┘
                                       │
                                       ▼ (optional)
                                ┌─────────────┐
                                │   Grafana    │
                                └─────────────┘
```

### Migration Steps

1. Deploy Prometheus, configure it to scrape all 11 service `/metrics` endpoints
2. Set `IO_METRICS_COLLECTOR_ENABLED=false` to disable the internal collector
3. Prometheus becomes the metrics store; PromQL becomes available for alerting rules
4. The Settings > System Health page queries either TimescaleDB or Prometheus (configurable backend)
5. If Grafana is ever acceptable (AGPL licensing concern would need resolution), it connects to Prometheus directly

The switch is purely operational. No service code changes, no redeployment of services, no data migration needed. The internal collector and Prometheus can even run simultaneously during a transition period.

---

## RBAC Permissions

Two new permissions under the `settings` module:

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `system:monitor` | View System Health page and all tabs | Admin, Supervisor |
| `system:metrics` | Access raw metrics data and export | Admin |

The shell status indicator popover is available to all authenticated users — no permission required. It shows only connection-level status, not service internals.

---

## Cross-References

- **Doc 01 (Technology Stack)**: `io-health` and `io-observability` shared crates. Crate additions: `metrics`, `metrics-exporter-prometheus`, `metrics-tracing-context`, `opentelemetry`, `opentelemetry-otlp`, `tracing-opentelemetry`.
- **Doc 02 (System Architecture)**: Health endpoints (`/health/live`, `/health/ready`, `/health/startup`) and `/metrics` endpoint on all services. Metrics collector as API Gateway background task. Inter-service health polling.
- **Doc 03 (Security/RBAC)**: Two new permissions (`system:monitor`, `system:metrics`). Updated permission count.
- **Doc 04 (Database Design)**: `io_metrics` schema DDL — `samples` hypertable, `samples_5m` continuous aggregate, retention and compression policies, indexes.
- **Doc 06 (Frontend Shell)**: Status indicator dot in top nav bar. Popover component. Connection loss behavior integration.
- **Doc 15 (Settings Module)**: System Health admin page — Services, Database, OPC Sources, WebSocket, Jobs, and Metrics tabs.
- **Doc 22 (Deployment Guide)**: Optional Jaeger deployment. Prometheus future on-ramp instructions. Environment variable reference for observability configuration.
- **Doc 32 (Shared UI Components)**: Metrics tab charts use uPlot time-series charting infrastructure.

---

## Change Log

- **v0.2**: Fixed service port numbers throughout Service-Specific Metrics section to match doc 37 canonical assignments (API Gateway 3000, Data Broker 3001, OPC 3002, Event 3003, Parser 3004, Archive 3005, Import 3006). Fixed permission notation from dot-syntax (`settings.system.view`) to canonical colon-syntax (`system:monitor`, `system:metrics`) per doc 37 Section 18.
- **v0.1**: Initial specification. Three-pillar observability (health checks, metrics, distributed tracing). Two shared crates (`io-health`, `io-observability`). Prometheus-format instrumentation with TimescaleDB storage. Shell status indicator popover for all users. Settings > System Health admin dashboard with six tabs. Optional OpenTelemetry/Jaeger distributed tracing. Prometheus future on-ramp architecture. Two new RBAC permissions.
