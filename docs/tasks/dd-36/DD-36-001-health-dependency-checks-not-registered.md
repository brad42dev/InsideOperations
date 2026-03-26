---
id: DD-36-001
title: Register dependency health checks in all 11 services
unit: DD-36
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Every service's `/health/ready` endpoint should actively probe its critical dependencies (database, inter-service sockets, OPC connections) and report their individual status with latency. Right now every service returns `{"status":"ready","checks":{}}` with an empty checks map, which defeats the purpose of the readiness probe and will mislead load balancers and orchestrators.

## Spec Excerpt (verbatim)

> Each service registers its checks at startup:
> ```rust
> let health = HealthRegistry::new("data-broker", env!("CARGO_PKG_VERSION"));
> health.register(DatabaseCheck::new(pool.clone()));
> health.register(RedisCheck::new(redis.clone()));
> health.register(OpcCheck::new(opc_client.clone()).critical(false));
> ```
> The crate ships with built-in check implementations for common dependencies:
> - `DatabaseCheck` — `SELECT 1` against the connection pool
> - `RedisCheck` — `PING` against the Redis connection
> - `UnixSocketCheck` — connect + health ping for inter-service UDS connections
>
> — design-docs/36_OBSERVABILITY.md, §io-health Crate

## Where to Look in the Codebase

Primary files:
- `crates/io-health/src/lib.rs` — `PgDatabaseCheck` is implemented but `RedisCheck` and `UnixSocketCheck` are absent
- `services/api-gateway/src/main.rs:74-75` — health registry created, `mark_startup_complete()` called, but no `.register()` calls
- `services/data-broker/src/main.rs:113-114` — same pattern, no `.register()`
- `services/opc-service/src/main.rs` — same
- All other service `main.rs` files — same pattern throughout

## Verification Checklist

- [ ] `crates/io-health/src/lib.rs` exports `PgDatabaseCheck`, `UnixSocketCheck` (connect + ping), and at minimum a stub `RedisCheck` (even if unused by most services)
- [ ] `services/api-gateway/src/main.rs` calls `health.register(PgDatabaseCheck::new(db.clone()))` before `health.into_router()`
- [ ] `services/data-broker/src/main.rs` calls `health.register(PgDatabaseCheck::new(db.clone()))` and a `UnixSocketCheck` for the UDS the broker consumes
- [ ] Every service with a `db` pool registers a `PgDatabaseCheck`
- [ ] A service with a non-critical dependency (e.g. OPC service's connection to OPC sources) registers it with `.critical(false)` so failure yields `degraded`, not `not_ready`
- [ ] `GET /health/ready` on any running service returns `"checks"` with at least one named entry (not empty `{}`)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `PgDatabaseCheck` exists in `crates/io-health/src/lib.rs:199-234` but is never called by any service. `HealthRegistry` is instantiated but `register()` is never invoked. All `/health/ready` responses return `{"status":"ready","checks":{}}`.

## Fix Instructions

**Step 1 — Add `UnixSocketCheck` to `crates/io-health/src/lib.rs`:**

```rust
pub struct UnixSocketCheck {
    path: String,
    name: String,
}

impl UnixSocketCheck {
    pub fn new(path: impl Into<String>) -> Self {
        let path = path.into();
        let name = format!("uds:{}", path);
        Self { path, name }
    }
}

#[async_trait]
impl HealthCheckable for UnixSocketCheck {
    fn name(&self) -> &str { &self.name }
    fn critical(&self) -> bool { false }  // UDS availability is non-critical by default
    async fn check(&self) -> HealthStatus {
        let start = Instant::now();
        match tokio::net::UnixStream::connect(&self.path).await {
            Ok(_) => HealthStatus { status: CheckStatus::Ok, latency_ms: start.elapsed().as_millis() as u64, error: None },
            Err(e) => HealthStatus { status: CheckStatus::Error, latency_ms: start.elapsed().as_millis() as u64, error: Some(e.to_string()) },
        }
    }
}
```

**Step 2 — Register checks in each service `main.rs`:**

For every service that has a `db` pool (api-gateway, data-broker, opc-service, event-service, archive-service, auth-service, email-service, alert-service, import-service, recognition-service, parser-service), add before `health.into_router()`:

```rust
health.register(io_health::PgDatabaseCheck::new(db.clone()));
```

For `data-broker` also add (non-critical, so failure = degraded not not_ready):
```rust
// opc_broker_sock is the UDS path data-broker reads OPC updates from
health.register(io_health::UnixSocketCheck::new(cfg.opc_broker_sock.clone()).non_critical());
```

**Step 3 — Add a `.non_critical()` builder method to `PgDatabaseCheck` and `UnixSocketCheck`** so callsites can override the default `critical()` return value without a wrapper type.

Do NOT register checks that block the ready endpoint for a long time — each check has a 5-second timeout already enforced by the `handle_ready` handler. The check implementations themselves should have their own short internal timeout (1-2s) to avoid worst-case 5s per check serial stacking.
