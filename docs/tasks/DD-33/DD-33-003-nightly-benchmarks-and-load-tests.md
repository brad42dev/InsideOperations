---
id: DD-33-003
title: Add criterion benchmark job and Goose load test job to nightly CI
unit: DD-33
status: pending
priority: medium
depends-on: [DD-33-006]
---

## What This Feature Should Do

The nightly CI run must execute criterion micro-benchmarks on hot paths and run the Goose load test suite targeting 200 concurrent users and 10,000 point updates/second. Neither of these currently fires in any CI workflow even though a partial Goose binary exists.

## Spec Excerpt (verbatim)

> **Nightly** | Scheduled (daily) | Full E2E suite, performance benchmarks (`criterion`), load tests (Goose), security tests | < 60 minutes
>
> **Load tests** with Goose (Apache-2.0):
> - 200 concurrent WebSocket connections with active subscriptions
> - 10,000 point updates/second throughput through the Data Broker
> - API response time under load (target: p95 < 200ms)
> — 33_TESTING_STRATEGY.md, §CI Pipeline + §Performance Tests

## Where to Look in the Codebase

Primary files:
- `.github/workflows/nightly.yml` — needs `benchmarks` and `load-tests` jobs added
- `tests/load/src/main.rs` — Goose binary exists with HTTP scenarios; missing WebSocket load scenario
- `Cargo.toml` — no `criterion` in workspace.dependencies; no `benches/` in any crate

## Verification Checklist

- [ ] nightly.yml contains a `benchmarks` job that runs `cargo bench --workspace`
- [ ] At least one service or crate contains a `benches/` directory with a `criterion` benchmark
- [ ] `criterion` is declared in `[workspace.dependencies]` in root `Cargo.toml`
- [ ] nightly.yml contains a `load-tests` job that runs the Goose binary against a deployed gateway
- [ ] The Goose load test includes a WebSocket connection scenario (not just HTTP endpoints)
- [ ] `tests/load/src/main.rs` includes a scenario that sustains 200 concurrent WS connections

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: nightly.yml has `security-audit` and `e2e-critical` jobs but no `benchmarks` or `load-tests` job. `tests/load/src/main.rs` has 5 HTTP scenarios (login, dashboard browse, point search, alarms poll, ws-ticket) but no WebSocket subscription scenario. No `benches/` directory exists anywhere. `criterion` not in Cargo.toml.

## Fix Instructions (if needed)

### 1. Add criterion to workspace

In root `Cargo.toml` under `[workspace.dependencies]`:
```toml
criterion = { version = "0.5", features = ["async_tokio"] }
```

### 2. Create first benchmark (start with io-models serialization)

Create `crates/io-models/benches/serialization.rs`:
```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_point_value_serialize(c: &mut Criterion) {
    // benchmark serde_json serialization of PointValue
    c.bench_function("point_value_serialize", |b| {
        // ...
    });
}

criterion_group!(benches, bench_point_value_serialize);
criterion_main!(benches);
```

Add to `crates/io-models/Cargo.toml`:
```toml
[[bench]]
name = "serialization"
harness = false

[dev-dependencies]
criterion = { workspace = true }
```

### 3. Add benchmarks job to nightly.yml

```yaml
benchmarks:
  name: Performance benchmarks
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
    - name: Install system dependencies
      run: sudo apt-get update -qq && sudo apt-get install -y libxmlsec1-dev libxmlsec1-openssl libxml2-dev
    - name: Run criterion benchmarks
      run: cargo bench --workspace 2>&1 | tee bench-results.txt
    - uses: actions/upload-artifact@v4
      with:
        name: benchmark-results
        path: bench-results.txt
```

### 4. Add WebSocket load scenario to tests/load/src/main.rs

Add a scenario that uses `tokio-tungstenite` to open 200 WS connections, authenticate with a ticket, then subscribe to a list of point tags and count update messages. The target: receive >10,000 point updates/sec across all connections.

### 5. Add load-tests job to nightly.yml

```yaml
load-tests:
  name: Goose load tests
  runs-on: ubuntu-24.04
  # Requires a running gateway — only useful in staging, mark as manual trigger
  if: github.event_name == 'workflow_dispatch'
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
    - name: Run load tests
      run: |
        cargo run -p io-load-tests -- \
          --host ${{ vars.STAGING_URL }} \
          --users 200 \
          --run-time 60s \
          --report-file load-report.html
    - uses: actions/upload-artifact@v4
      with:
        name: load-report
        path: load-report.html
```

Do NOT:
- Run Goose load tests against the ephemeral CI database (it cannot handle sustained load); gate this on `workflow_dispatch` or a staging environment
- Skip the WebSocket scenario — the HTTP-only scenarios in the existing Goose binary do not cover the 10k points/sec requirement
