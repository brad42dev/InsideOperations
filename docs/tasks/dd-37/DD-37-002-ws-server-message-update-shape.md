---
id: DD-37-002
title: Fix WsServerMessage::Update to use WsBatchUpdate with abbreviated point fields
unit: DD-37
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The WebSocket `update` message from the Data Broker to frontend clients carries batched
point values. The spec defines this as a `payload`-wrapped `WsBatchUpdate` containing
an array of `WsPointValue` structs with abbreviated field names (`id`, `v`, `q`, `t`)
for bandwidth efficiency. The current implementation sends a flat, single-point struct
with full field names, which disagrees with the TypeScript definition in `ipc.ts` and
produces the wrong JSON on the wire.

## Spec Excerpt (verbatim)

> ```rust
> #[derive(Serialize)]
> #[serde(tag = "type", content = "payload")]
> #[serde(rename_all = "snake_case")]
> pub enum WsServerMessage {
>     Update(WsBatchUpdate),
>     ...
> }
>
> pub struct WsBatchUpdate {
>     pub points: Vec<WsPointValue>,
> }
>
> pub struct WsPointValue {
>     pub id: Uuid,       // point_id
>     pub v: f64,         // value
>     pub q: String,      // "good", "uncertain", "bad"
>     pub t: i64,         // epoch_ms
> }
> ```
> Note: WebSocket point updates use abbreviated field names (`id`, `v`, `q`, `t`) for
> bandwidth efficiency.
> — 37_IPC_CONTRACTS.md, §13

## Where to Look in the Codebase

Primary files:
- `crates/io-bus/src/lib.rs:233-278` — current `WsServerMessage` enum definition; `Update` variant at line 237
- `frontend/src/shared/types/ipc.ts:157-166` — TypeScript `WsBatchUpdate` and `WsPointValue` (correct, matches spec)

## Verification Checklist

- [ ] `WsServerMessage` enum has `#[serde(tag = "type", content = "payload")]` (not just `tag`)
- [ ] `Update` variant is `Update(WsBatchUpdate)` (tuple variant), not a struct variant with inline fields
- [ ] `WsBatchUpdate` struct exists with `points: Vec<WsPointValue>` field
- [ ] `WsPointValue` struct has fields `id: Uuid`, `v: f64`, `q: String`, `t: i64` (abbreviated names)
- [ ] Serialized JSON for an update message is `{"type":"update","payload":{"points":[{"id":"...","v":1.5,"q":"good","t":1234567890}]}}`

## Assessment

- **Status**: ❌ Wrong
- **If partial/missing**: Current `Update` variant at line 237 is `Update { point_id: Uuid, value: f64, quality: String, timestamp: String }`. This produces `{"type":"update","point_id":"...","value":1.5,...}` — no `payload` wrapper, no batch array, full field names, timestamp is RFC 3339 string not epoch_ms integer.

## Fix Instructions (if needed)

In `crates/io-bus/src/lib.rs`:

1. Change the serde attributes on `WsServerMessage` from:
   ```rust
   #[serde(tag = "type", rename_all = "snake_case")]
   ```
   to:
   ```rust
   #[serde(tag = "type", content = "payload")]
   #[serde(rename_all = "snake_case")]
   ```

2. Replace the `Update` struct variant with a tuple variant:
   ```rust
   Update(WsBatchUpdate),
   ```

3. Add these two new structs before `WsServerMessage`:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct WsBatchUpdate {
       pub points: Vec<WsPointValue>,
   }

   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct WsPointValue {
       pub id: Uuid,
       pub v: f64,
       pub q: String,   // "good", "uncertain", "bad"
       pub t: i64,      // epoch milliseconds
   }
   ```

4. Find all call sites that construct `WsServerMessage::Update { point_id, value, quality, timestamp }`
   in the services (search `services/data-broker/`) and update them to build a `WsBatchUpdate`.
   The Data Broker accumulates updates into a batch; it should have been using this batch type already.

5. Update the unit test at line 442 to use the new tuple variant:
   ```rust
   let msg = WsServerMessage::Update(WsBatchUpdate {
       points: vec![WsPointValue { id: Uuid::nil(), v: 1.23, q: "good".to_string(), t: 0 }],
   });
   ```

Do NOT:
- Change `WsServerMessage` variants other than `Update` (they correctly use inline struct syntax since they don't need the bandwidth optimization)
- Remove the `rename_all = "snake_case"` attribute — it's still needed for the other variants
- Use full field names (`point_id`, `value`, `quality`, `timestamp`) in `WsPointValue` — the spec explicitly uses abbreviated names for bandwidth efficiency
