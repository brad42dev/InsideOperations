---
id: DD-36-002
title: Add path label (route template) to HTTP metrics in api-gateway middleware
unit: DD-36
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The spec requires `io_http_requests_total` and `io_http_request_duration_seconds` to carry a `path` label that uses route templates (e.g. `/api/points/:id`) — not raw request paths — to prevent label cardinality explosion. Currently neither metric carries a `path` label at all, making it impossible to do per-endpoint analysis in the System Health metrics charts.

## Spec Excerpt (verbatim)

> | `io_http_requests_total` | Counter | `service`, `method`, `path`, `status` | Total HTTP requests |
> | `io_http_request_duration_seconds` | Histogram | `service`, `method`, `path` | Request latency |
>
> The `path` label uses route templates (`/api/points/:id`), not actual paths with IDs, to prevent label cardinality explosion.
>
> — design-docs/36_OBSERVABILITY.md, §Standard Metrics (All Services)

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/mw.rs:271-296` — `metrics_middleware` function; currently records only `service`, `method`, `status` for the counter and `service`, `method` for the histogram

## Verification Checklist

- [ ] `io_http_requests_total` counter in `metrics_middleware` includes a `path` label
- [ ] `io_http_request_duration_seconds` histogram in `metrics_middleware` includes a `path` label
- [ ] The `path` label value is a route template string (e.g. `/api/points/:id`), not a raw URI path with concrete IDs
- [ ] The `path` label does not cause cardinality explosion — UUIDs and numeric IDs are replaced by `:id` or equivalent parameter names
- [ ] Other services that implement their own HTTP middleware follow the same pattern

## Assessment

- **Status**: ⚠️ Partial — `path` label is absent from both metrics
- **If partial/missing**: `mw.rs:280-293` emits `io_http_requests_total{service,method,status}` and `io_http_request_duration_seconds{service,method}`, both missing the `path` dimension.

## Fix Instructions

Axum does not inject the matched route template into the request by default. Use the `MatchedPath` extractor from Axum to retrieve it. Modify `metrics_middleware` in `services/api-gateway/src/mw.rs`:

```rust
use axum::extract::MatchedPath;

pub async fn metrics_middleware(req: Request, next: Next) -> Response {
    let method = req.method().to_string();
    // Extract the route template before passing the request to the handler.
    let path = req
        .extensions()
        .get::<MatchedPath>()
        .map(|p| p.as_str().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let start = Instant::now();

    let response = next.run(req).await;

    let duration_secs = start.elapsed().as_secs_f64();
    let status_str = response.status().as_u16().to_string();

    metrics::counter!(
        "io_http_requests_total",
        "service" => "api-gateway",
        "method" => method.clone(),
        "path"   => path.clone(),
        "status" => status_str,
    )
    .increment(1);

    metrics::histogram!(
        "io_http_request_duration_seconds",
        "service" => "api-gateway",
        "method"  => method,
        "path"    => path,
    )
    .record(duration_secs);

    response
}
```

Note: `MatchedPath` is set by Axum's router before calling middleware layers. Since `metrics_middleware` is the **outermost** layer (added last in `main.rs`), it runs before routing completes, which means `MatchedPath` will **not** be available at this point. The correct fix is either:
1. Move `metrics_middleware` to be an inner layer (added before `with_state`), so it runs after routing.
2. Or use a tower `Service` wrapper that intercepts after routing.

Option 1 is simpler. Change `main.rs` to apply `metrics_middleware` inside the `api` router block (before `.with_state()`), so routing has already matched when metrics run.

Do NOT use raw `req.uri().path()` as the `path` label — this will create one label value per unique URL containing an ID, causing cardinality explosion in Prometheus.
