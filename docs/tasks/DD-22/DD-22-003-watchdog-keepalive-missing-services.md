---
id: DD-22-003
title: Wire sd_notify watchdog keepalive into all 9 remaining services
unit: DD-22
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Every service has `WatchdogSec=30s` in its systemd unit. This means systemd will restart a service if it stops sending `WATCHDOG=1` notifications within 30 seconds. The `io-observability` crate already provides `start_watchdog_keepalive()` which spawns a background task sending the notification every 10 seconds. Without calling this method, the watchdog timeout becomes a silent time-bomb — if a service hangs (deadlock, blocked executor), systemd will kill and restart it, but only after 30 seconds of silence. That behavior only works if the notification loop is actually running.

Currently only `api-gateway` and `auth-service` call `start_watchdog_keepalive()`. The other 9 services have `WatchdogSec=30s` in their unit files but never notify systemd, making the watchdog ineffective.

## Spec Excerpt (verbatim)

> All 11 services support systemd watchdog integration. Each service periodically notifies systemd via `sd_notify("WATCHDOG=1")`. If the notification stops (service hung, deadlocked, or unresponsive), systemd restarts the service automatically.
>
> Add to each service's systemd unit `[Service]` section:
> WatchdogSec=30
>
> The service must notify systemd at least every 30 seconds. The recommended notification interval is half the watchdog timeout (every 15 seconds).
> — design-docs/22_DEPLOYMENT_GUIDE.md, §Deployment Hardening — Systemd Watchdog

## Where to Look in the Codebase

Primary files:
- `/home/io/io-dev/io/services/data-broker/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/opc-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/event-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/parser-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/archive-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/import-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/alert-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/email-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/services/recognition-service/src/main.rs` — missing watchdog call
- `/home/io/io-dev/io/crates/io-observability/src/lib.rs` — implementation of `start_watchdog_keepalive()`

Reference (working examples):
- `/home/io/io-dev/io/services/api-gateway/src/main.rs:76` — `obs.start_watchdog_keepalive();`
- `/home/io/io-dev/io/services/auth-service/src/main.rs:46` — `obs.start_watchdog_keepalive();`

## Verification Checklist

For each of the 9 services listed above, read the `main.rs` file:

- [ ] `io-observability` is already in the service's `Cargo.toml` under `[dependencies]` (it is — all 11 services already have it)
- [ ] An `obs` (or equivalent `ServiceObservability` / `Observability`) instance is constructed in `main()`
- [ ] `obs.start_watchdog_keepalive()` is called on that instance before the service starts accepting work
- [ ] The call happens after the Tokio runtime is active (i.e., inside an `#[tokio::main]` async fn or after `Runtime::new()`)

## Assessment

- **Status**: ❌ Missing in 9 services
- All 9 affected services already import and use `io-observability` (they all call `obs.metrics_router()`). The fix is a single-line addition in each `main.rs`.

## Fix Instructions

For each of the 9 affected service `main.rs` files, find the location where the `obs` variable is created and `metrics_router()` is called. Add `obs.start_watchdog_keepalive();` immediately before the Axum server starts or at the earliest point where the Tokio runtime is active.

Pattern to follow (from `api-gateway/src/main.rs:76`):
```rust
let obs = ServiceObservability::new("io-<service-name>", env!("CARGO_PKG_VERSION"));
obs.start_watchdog_keepalive();   // <-- add this line
// ...rest of startup
```

Each service already constructs an `obs` instance for `metrics_router()`. The addition is one line per service.

Services requiring the fix:
1. `services/data-broker/src/main.rs`
2. `services/opc-service/src/main.rs`
3. `services/event-service/src/main.rs`
4. `services/parser-service/src/main.rs`
5. `services/archive-service/src/main.rs`
6. `services/import-service/src/main.rs`
7. `services/alert-service/src/main.rs`
8. `services/email-service/src/main.rs`
9. `services/recognition-service/src/main.rs`

Do NOT:
- Modify `io-observability/src/lib.rs` — the implementation is correct
- Add the call outside the async Tokio context — it spawns a Tokio task and will panic if called before the runtime is active
- Change the `systemd` feature-flag logic in `io-observability` — the no-op stub on non-systemd builds is intentional
