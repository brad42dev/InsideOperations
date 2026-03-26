---
id: DD-36-005
title: Wire optional OpenTelemetry distributed tracing in io-observability
unit: DD-36
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When `IO_TRACING_ENABLED=true`, the `io_observability::init()` function should initialize OpenTelemetry with an OTLP exporter, register a `tracing-opentelemetry` bridge layer, and propagate W3C `traceparent` headers on inter-service calls. Currently the `tracing_enabled` field in `ObservabilityConfig` is accepted but completely ignored.

## Spec Excerpt (verbatim)

> **Distributed tracing** (optional): When `IO_TRACING_ENABLED=true`, initializes `tracing-opentelemetry` (MIT) + `opentelemetry` (Apache 2.0) with OTLP exporter. Injects W3C `traceparent` headers on outgoing requests, extracts them on incoming requests.
>
> | Env Var | Default | Description |
> |---------|---------|-------------|
> | `IO_TRACING_ENABLED` | `false` | Enable OpenTelemetry trace export |
> | `IO_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC endpoint (Jaeger) |
> | `IO_TRACE_SAMPLE_RATE` | `0.1` | Fraction of traces to sample (0.0–1.0) |
>
> — design-docs/36_OBSERVABILITY.md, §Distributed Tracing (Optional)

## Where to Look in the Codebase

Primary files:
- `crates/io-observability/src/lib.rs:6-13` — `ObservabilityConfig` struct has `tracing_enabled: bool` field
- `crates/io-observability/src/lib.rs:71-112` — `init()` function; reads `tracing_enabled` from config struct but never uses it
- `Cargo.toml:44` — workspace dependencies; `tracing-opentelemetry`, `opentelemetry`, `opentelemetry-otlp` are absent

## Verification Checklist

- [ ] `Cargo.toml` workspace dependencies include `tracing-opentelemetry` (MIT), `opentelemetry` (Apache 2.0), `opentelemetry-otlp` (Apache 2.0) — all behind a feature flag
- [ ] `crates/io-observability/Cargo.toml` has an `opentelemetry` feature that enables the OTel crates
- [ ] `io_observability::init()` reads `IO_TRACING_ENABLED` from env (overrides config field); if true, initializes OTLP pipeline
- [ ] `IO_OTLP_ENDPOINT` env var (default `http://localhost:4317`) is used as the OTLP gRPC endpoint
- [ ] `IO_TRACE_SAMPLE_RATE` env var (default `0.1`) configures the sampler
- [ ] `ObservabilityHandle` carries an optional `shutdown_guard` that flushes pending spans on drop

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `tracing_enabled` field declared but never read. No OTel crates in workspace. `ObservabilityHandle` has no `shutdown_guard` field.

## Fix Instructions

This is lower priority (tracing is disabled by default and only needed for debugging). Implement behind a Cargo feature flag so it adds zero binary size when not enabled.

**Step 1 — Add to `Cargo.toml` workspace (behind feature):**
```toml
tracing-opentelemetry = { version = "0.26", optional = true }
opentelemetry         = { version = "0.26", optional = true }
opentelemetry-otlp    = { version = "0.26", features = ["grpc-tonic"], optional = true }
opentelemetry_sdk     = { version = "0.26", optional = true }
```

**Step 2 — Add `opentelemetry` feature to `crates/io-observability/Cargo.toml`:**
```toml
[features]
opentelemetry = ["dep:tracing-opentelemetry", "dep:opentelemetry", "dep:opentelemetry-otlp", "dep:opentelemetry_sdk"]
```

**Step 3 — In `init()`, add OTel initialization when tracing is enabled:**
```rust
#[cfg(feature = "opentelemetry")]
if config.tracing_enabled || std::env::var("IO_TRACING_ENABLED").as_deref() == Ok("true") {
    use opentelemetry_otlp::WithExportConfig;
    let endpoint = std::env::var("IO_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:4317".to_string());
    let sample_rate: f64 = std::env::var("IO_TRACE_SAMPLE_RATE")
        .ok().and_then(|v| v.parse().ok()).unwrap_or(0.1);

    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter().tonic().with_endpoint(endpoint)
        )
        .with_trace_config(
            opentelemetry_sdk::trace::Config::default()
                .with_sampler(opentelemetry_sdk::trace::Sampler::TraceIdRatioBased(sample_rate))
                .with_resource(opentelemetry_sdk::Resource::new(vec![
                    opentelemetry::KeyValue::new("service.name", config.service_name),
                ]))
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)?;

    // Bridge tracing spans into OpenTelemetry.
    // The OTel layer is added to the subscriber in addition to the JSON formatter.
    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    // Re-init subscriber with OTel layer — note: requires reworking the subscriber init
    // to collect layers before calling .try_init().
}
```

Note: the subscriber `.try_init()` call at `lib.rs:84` makes it difficult to add layers conditionally after the fact. Refactor `init()` to build the full layer stack before calling `try_init()`.

Do NOT enable the `opentelemetry` feature in services by default — it should be opt-in at build time. The `IO_TRACING_ENABLED` env var controls runtime enablement for deployments that were compiled with the feature.
