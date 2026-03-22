---
id: OPC-BACKEND-002
title: Implement A&C operator methods: Acknowledge, Enable, Disable, TimedShelve, OneShotShelve, Unshelve
unit: OPC-BACKEND
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When an operator acknowledges, shelves, enables, or disables an OPC UA alarm, the UI sends a request to the I/O backend which must then call the corresponding OPC UA method on the SimBLAH server. Without this, alarms can never be acknowledged or shelved from the I/O console — operators would need to use a separate OPC UA client tool. Six methods are missing: Acknowledge, Enable, Disable, TimedShelve, OneShotShelve, Unshelve.

## Spec Excerpt (verbatim)

> "All 7 A&C methods must be implemented: Acknowledge, ConditionRefresh, Enable, Disable, TimedShelve, OneShotShelve, Unshelve. Missing any A&C method means alarms cannot be properly acknowledged or shelved."
> — docs/SPEC_MANIFEST.md, OPC-BACKEND §Architectural non-negotiables #3

> "Both paths dispatch to the same underlying alarm handler functions."
> — opc-server-protocol-spec.md, §Methods — Dual-Namespace Dispatch

Method NodeIds from the spec:
| Method | ns=1 NodeId | Standard ns=0 i= | Input arguments |
|---|---|---|---|
| Acknowledge | `alarm-method:Acknowledge` | 9111 | EventId (ByteString), Comment (LocalizedText) |
| Enable | `alarm-method:Enable` | 9027 | — |
| Disable | `alarm-method:Disable` | 9028 | — |
| TimedShelve | `alarm-method:TimedShelve` | 9213, 2949 | ShelvingTime (Double, ms) |
| OneShotShelve | `alarm-method:OneShotShelve` | 9212, 2948 | — |
| Unshelve | `alarm-method:Unshelve` | 9211, 2947 | — |

The Dual-Namespace Dispatch note: SimBLAH handles ns=1 method calls directly. For maximum client compatibility, call methods via ns=1 NodeIds when possible (these are discovered from the server's address space).

## Where to Look in the Codebase

Primary files:
- `services/opc-service/src/driver.rs` — add helper functions to invoke each method on a live session
- `services/opc-service/src/main.rs` — add HTTP endpoints (POST `/internal/alarm/:source_id/acknowledge`, etc.) that look up the session and call through
- `services/opc-service/src/state.rs` — `AppState` needs to carry a reference to live sessions so HTTP handlers can reach them

## Verification Checklist

- [ ] `AppState` carries an `Arc<Mutex<HashMap<Uuid, Arc<RwLock<Session>>>>>` or equivalent so HTTP handlers can reach live OPC sessions by source_id
- [ ] POST `/internal/alarm/:source_id/acknowledge` exists and calls `session.call((condition_obj_id, method_id, Some(vec![event_id_variant, comment_variant])))`
- [ ] POST `/internal/alarm/:source_id/shelve` with `shelve_type` (timed/oneshot/unshelve) and optional `shelving_time_ms` exists
- [ ] POST `/internal/alarm/:source_id/enable` and `/internal/alarm/:source_id/disable` exist
- [ ] Method NodeIds used are the ns=1 string NodeIds from the spec (`ns=1;s="alarm-method:Acknowledge"` etc.) with ns=0 numeric IDs as documented fallbacks
- [ ] Responses return appropriate HTTP status codes (204 on success, 404 if source not connected, 422 if method call returns a non-Good OPC status code with the status code in the body)

## Assessment

- **Status**: ❌ Missing
- **Current state**: The opc-service has no HTTP endpoints beyond `/internal/reconnect/:source_id` and health/metrics. The session map is not stored in `AppState` — sessions live only inside the per-source `run_source` async task with no external reference. There is no code in any service (opc-service, api-gateway, event-service) that calls OPC UA methods on behalf of operator UI actions.

## Fix Instructions

This is a multi-step feature.

**Step 1 — Share live sessions via AppState**

In `services/opc-service/src/state.rs`, add a session registry:

```rust
pub type SessionRegistry = Arc<std::sync::Mutex<HashMap<Uuid, Arc<RwLock<Session>>>>>;
```

Add `sessions: SessionRegistry` to `AppState`. In `main.rs`, create the registry and pass it to `AppState`. In `driver.rs`'s `run_source`, after the session is established, insert it into the registry; remove it when the driver task exits.

**Step 2 — Add internal HTTP endpoints**

In `main.rs`, add routes:
- `POST /internal/alarm/:source_id/acknowledge` — body: `{ "condition_node_id": "alarm:<point_name>", "event_id": "<hex>", "comment": "..." }`
- `POST /internal/alarm/:source_id/enable` — body: `{ "condition_node_id": "alarm:<point_name>" }`
- `POST /internal/alarm/:source_id/disable` — same
- `POST /internal/alarm/:source_id/shelve` — body: `{ "condition_node_id": "alarm:<point_name>", "type": "timed|oneshot|unshelve", "shelving_time_ms": 3600000 }`

**Step 3 — Implement method call helper in driver.rs**

Add a function `pub fn call_alarm_method(session: &Session, condition_node_id: &str, method_name: &str, args: Option<Vec<Variant>>) -> opcua::types::StatusCode`. The condition object NodeId is `ns=1;s="<condition_node_id>"`. The method NodeId is `ns=1;s="alarm-method:<method_name>"`.

```rust
let obj_id = NodeId::new(1u16, UAString::from(condition_node_id));
let method_id = NodeId::new(1u16, UAString::from(format!("alarm-method:{}", method_name)));
session.call((obj_id, method_id, args))
```

**Step 4 — Wire the HTTP handlers**

Each handler looks up the source_id in the session registry. If not found, return 404. Lock the session, call `call_alarm_method`, map the OPC status to HTTP status (Good = 204, any bad status = 422 with status code in body as JSON).

Do NOT:
- Use ns=0 numeric NodeIds as the primary dispatch path — SimBLAH's ns=1 NodeIds are simpler and always available for conditions created by the server
- Block the Tokio runtime with the synchronous session call — wrap it in `tokio::task::spawn_blocking`
- Store the session `Arc` in a `Mutex` inside the HTTP handler (race condition with driver reconnect) — instead, clone the Arc from the registry under the lock, then release the lock before calling spawn_blocking
