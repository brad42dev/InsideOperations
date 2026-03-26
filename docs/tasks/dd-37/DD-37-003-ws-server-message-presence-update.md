---
id: DD-37-003
title: Add PresenceUpdate variant to WsServerMessage and fix StatusReport field type
unit: DD-37
status: pending
priority: medium
depends-on: [DD-37-002]
---

## What This Feature Should Do

The `WsServerMessage` enum in `io-bus` is missing the `PresenceUpdate` variant defined
in the spec. This variant is required for the Shifts module and muster dashboard to
receive badge/presence events. Additionally, `StatusReport.render_fps` is declared as
`f64` in Rust but the spec requires `f32`.

## Spec Excerpt (verbatim)

> ```rust
> pub enum WsServerMessage {
>     ...
>     PresenceUpdate(WsPresenceUpdate),
>     Ping(WsEmpty),
>     ServerRestarting(WsEmpty),
> }
> ```
>
> | Message Type | Handler Store/Hook | Action |
> |---|---|---|
> | `presence_update` | `usePresenceStore` (Zustand) | Update user presence state. Muster dashboard and Shifts module consume this. |
> — 37_IPC_CONTRACTS.md, §13 and §17

And for StatusReport:
> ```rust
> StatusReport {
>     render_fps: f32,
>     pending_updates: u32,
>     last_batch_process_ms: u32,
> },
> ```
> — 37_IPC_CONTRACTS.md, §13

## Where to Look in the Codebase

Primary files:
- `crates/io-bus/src/lib.rs:233-302` — `WsServerMessage` and `WsClientMessage` enums
- `frontend/src/shared/types/ipc.ts:221-244` — TypeScript counterparts (correct)

## Verification Checklist

- [ ] `WsServerMessage` has a `PresenceUpdate(WsPresenceUpdate)` tuple variant
- [ ] `WsPresenceUpdate` struct exists with fields `user_id: Uuid`, `presence_state: String`, `badge_event_type: Option<String>`, `timestamp: String`
- [ ] `WsServerMessage` has `Ping` and `ServerRestarting` variants (check that they serialize as `{"type":"ping","payload":{}}`)
- [ ] `WsClientMessage::StatusReport.render_fps` is `f32`, not `f64`
- [ ] `WsClientMessage::StatusReport.last_batch_process_ms` is `u32`, not `u64`

## Assessment

- **Status**: ⚠️ Partial
- **If partial/missing**: `PresenceUpdate` variant entirely absent from `WsServerMessage` (line 235-278). `StatusReport.render_fps` is `f64` at line 297, spec requires `f32`. `last_batch_process_ms` is `u64` at line 299, spec requires `u32`.

## Fix Instructions (if needed)

In `crates/io-bus/src/lib.rs`:

1. Add `WsPresenceUpdate` struct (before `WsServerMessage`):
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct WsPresenceUpdate {
       pub user_id: Uuid,
       pub presence_state: String,    // "on_site", "off_site"
       pub badge_event_type: Option<String>,
       pub timestamp: String,         // RFC 3339
   }
   ```

2. Add `PresenceUpdate(WsPresenceUpdate)` to `WsServerMessage` between `ExportProgress` and `ServerRestarting`.

3. For `Ping` and `ServerRestarting` — check if they exist. The current enum has only `Ping` as a unit variant (no payload). The spec requires `Ping(WsEmpty)` and `ServerRestarting(WsEmpty)`. Add:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize, Default)]
   pub struct WsEmpty {}
   ```
   And change the variants to `Ping(WsEmpty)` and `ServerRestarting(WsEmpty)`.

4. Fix `WsClientMessage::StatusReport`:
   ```rust
   StatusReport {
       render_fps: f32,          // was f64
       pending_updates: u32,
       last_batch_process_ms: u32,  // was u64
   },
   ```

Do NOT:
- Change `AlertNotification`, `AlertAcknowledged`, `ExportNotification`, `ExportProgress` variants — those use `payload: serde_json::Value` which is an acceptable interim until DD-37-001 domain types are added
- Add a separate `WsEmpty` if a unit struct already exists elsewhere in the codebase
