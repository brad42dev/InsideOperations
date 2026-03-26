---
id: DD-33-006
title: Add service-level integration test suites and declare test crate dependencies in workspace
unit: DD-33
status: pending
priority: high
depends-on: [DD-33-005]
---

## What This Feature Should Do

Each of the eleven services must have a `tests/` directory with integration tests that exercise real HTTP endpoints, real database operations, and service-specific behavior against a real PostgreSQL + TimescaleDB container. The workspace must declare the necessary test crate dependencies (criterion, wiremock, testcontainers, fake, assert-json-diff) so they are available consistently across all services.

## Spec Excerpt (verbatim)

> Each of the 11 services has its own integration test suite covering service-specific behavior...
>
> **Database setup:** Each integration test suite gets a fresh database created from migrations + seed data. Tests run inside a transaction that rolls back on completion (via `sqlx::test`) where possible.
>
> | Crate | Purpose |
> |-------|---------|
> | `criterion` | Micro-benchmarks |
> | `wiremock` | HTTP mock server for external API calls |
> | `testcontainers` | Spin up Docker containers (PostgreSQL, TimescaleDB) in tests |
> | `fake` | Generate realistic test data |
> | `assert-json-diff` | Structured JSON comparison |
> — 33_TESTING_STRATEGY.md, §Service-Level Tests + §Test Libraries

## Where to Look in the Codebase

Primary files:
- `Cargo.toml` (root) — `[workspace.dependencies]` section (line 30) — add test crate entries here
- `services/api-gateway/tests/security.rs` — only integration test file; all 8 tests are `#[ignore]`; needs expansion and should be un-ignored for CI
- `services/data-broker/` — no `tests/` directory
- `services/auth-service/` — no `tests/` directory
- (all other services) — no `tests/` directories

## Verification Checklist

- [ ] `criterion`, `wiremock`, `testcontainers`, `fake`, `assert-json-diff` declared under `[workspace.dependencies]` in root `Cargo.toml`
- [ ] Each of the 11 services has a `tests/` directory with at least one integration test file
- [ ] `services/api-gateway/tests/security.rs` tests are not all `#[ignore]` — at least the JWT validation tests run in CI without a live server (use `axum::serve` with a test listener)
- [ ] `services/auth-service/tests/` tests login flow (local auth) against a real PostgreSQL transaction via `sqlx::test`
- [ ] `services/data-broker/tests/` tests WebSocket subscription registration and point fanout with at least 2 concurrent clients
- [ ] `services/event-service/tests/` tests all 7 ISA-18.2 alarm state transitions
- [ ] Integration tests that need a database use `#[sqlx::test]` for transaction rollback isolation

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Only `services/api-gateway/tests/security.rs` exists; it requires a live running gateway at `TEST_GATEWAY_URL` and all 8 tests are marked `#[ignore]`. No other service has any integration tests. `criterion`, `wiremock`, `testcontainers`, `fake`, and `assert-json-diff` are all absent from `Cargo.toml`.

## Fix Instructions (if needed)

### 1. Add test crate workspace dependencies in root `Cargo.toml`

Under `[workspace.dependencies]`:
```toml
criterion = { version = "0.5", features = ["async_tokio"] }
wiremock = "0.6"
testcontainers = { version = "0.21", features = ["blocking"] }
testcontainers-modules = { version = "0.10", features = ["postgres"] }
fake = { version = "2", features = ["derive", "chrono", "uuid"] }
assert-json-diff = "2"
```

### 2. Convert api-gateway security tests to in-process tests

Refactor `services/api-gateway/tests/security.rs` to start an in-process Axum server rather than requiring an external gateway:
```rust
// Use axum::serve with tokio::net::TcpListener on port 0 (OS assigns port)
// No #[ignore] needed — runs entirely in-process
#[sqlx::test]
async fn test_unauthenticated_returns_401(pool: PgPool) {
    let app = build_app(pool);  // extract app builder from main.rs
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(axum::serve(listener, app).into_future());
    // ... test logic
}
```

### 3. Create auth-service integration tests

Create `services/auth-service/tests/auth_flows.rs`:
- Test local login with correct credentials → 200 + access_token
- Test local login with wrong password → 401
- Test token refresh with valid refresh token → 200 + new access_token
- Test token refresh with expired refresh token → 401
- Use `#[sqlx::test]` for database isolation

### 4. Create data-broker WebSocket tests

Create `services/data-broker/tests/ws_subscription.rs`:
- Test that a subscription registration results in fanout to N clients
- Test backpressure: slow consumer should not block fast consumers
- Use `testcontainers` to start TimescaleDB for the subscription registry

### 5. Create event-service alarm state tests

Create `services/event-service/tests/alarm_state.rs`:
- Test all 7 ISA-18.2 state transitions with real database transactions
- Test deduplication: same event arriving twice should not create two records

Do NOT:
- Keep integration tests as `#[ignore]` — they must run in CI (the nightly `integration-tests` job already has a PostgreSQL service container)
- Create tests that depend on real OPC UA servers or real SMTP servers — use `wiremock` for those
- Use `tokio::time::sleep` for timing-dependent tests — inject time as a parameter
