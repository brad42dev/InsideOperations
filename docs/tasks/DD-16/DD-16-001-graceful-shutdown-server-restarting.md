---
id: DD-16-001
title: Implement graceful shutdown with server_restarting broadcast and 5-second drain
unit: DD-16
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the data broker receives SIGTERM or SIGINT, it should broadcast a `{"type":"server_restarting"}` message to every connected WebSocket client so clients begin their reconnection backoff immediately. The broker then stops accepting new connections, waits up to 5 seconds for in-flight operations to complete, and force-closes any remaining connections.

## Spec Excerpt (verbatim)

> Server sends `{ "type": "server_restarting" }` message to all clients
> Clients begin reconnection backoff immediately
> Server stops accepting new connections
> Server waits max 5 seconds, then force-closes remaining connections
> Broker restart recovery (cache warm-up, subscription batching) handles the reconnection wave
> — design-docs/16_REALTIME_WEBSOCKET.md, §Connection Management / Graceful Shutdown

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/main.rs:136–157` — `shutdown_signal()` detects ctrl-c/SIGTERM but does no broadcast; Axum's `with_graceful_shutdown` just stops accepting new connections
- `services/data-broker/src/state.rs` — `AppState` holds `connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>` — the connections map needed to broadcast
- `crates/io-bus/src/lib.rs:277` — `WsServerMessage::ServerRestarting` variant already defined and serializable

## Verification Checklist

- [ ] On SIGTERM/SIGINT, broker iterates all entries in `state.connections` and sends `WsServerMessage::ServerRestarting` to each client's mpsc sender before stopping
- [ ] After sending `server_restarting`, broker calls `axum::serve(...).with_graceful_shutdown(...)` (or equivalent) to stop accepting new connections
- [ ] Broker enforces a maximum 5-second wait before force-closing connections (`tokio::time::timeout(Duration::from_secs(5), ...)` or equivalent)
- [ ] `WsServerMessage::ServerRestarting` serializes to `{"type":"server_restarting"}` (verify with serde tag attribute)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `shutdown_signal()` at `main.rs:136` detects the OS signal but only returns — it does not broadcast to clients. Axum's `with_graceful_shutdown` at line 130 stops accepting new connections automatically but there is no 5-second drain timer and no `ServerRestarting` broadcast.

## Fix Instructions

In `services/data-broker/src/main.rs`:

1. Refactor `shutdown_signal()` to accept the `AppState` (or just the `connections` Arc) so it can broadcast before returning, OR create a separate shutdown task.

Recommended pattern: replace the `with_graceful_shutdown(shutdown_signal())` call with a shutdown task that:

```rust
async fn graceful_shutdown(connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>) {
    // Wait for OS signal
    let ctrl_c = async { signal::ctrl_c().await.expect("ctrl_c handler") };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("sigterm handler")
            .recv()
            .await
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }

    tracing::info!("Shutdown signal received — broadcasting server_restarting");

    // Broadcast to all connected clients
    for entry in connections.iter() {
        let _ = entry.value().try_send(WsServerMessage::ServerRestarting);
    }

    // Give clients up to 5 seconds to receive and act on the message
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    tracing::info!("Graceful shutdown drain complete");
}
```

2. Pass `Arc::clone(&connections)` to the shutdown future:

```rust
axum::serve(listener, app)
    .with_graceful_shutdown(graceful_shutdown(Arc::clone(&connections)))
    .await?;
```

The `WsServerMessage::ServerRestarting` variant is already in `crates/io-bus/src/lib.rs:277` and serializes as `{"type":"server_restarting"}` via the `#[serde(tag = "type", rename_all = "snake_case")]` attribute.

Do NOT:
- Remove or replace `with_graceful_shutdown` — axum's graceful shutdown is what prevents new connections from being accepted
- Sleep longer than 5 seconds (spec says max 5s)
- Try to await all client senders to drain — just sleep 5s and let axum close
