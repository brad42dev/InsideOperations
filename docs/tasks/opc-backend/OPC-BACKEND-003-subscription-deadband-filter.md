---
id: OPC-BACKEND-003
title: Apply PercentDeadband 1% filter on AnalogItemType subscriptions to reduce OPC traffic
unit: OPC-BACKEND
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When creating OPC UA monitored items for AnalogItemType nodes that have EURange configured, the subscription should set a DataChangeFilter with 1% PercentDeadband. This suppresses minor noise fluctuations on analog signals without losing real process changes. For all other nodes (boolean, string, nodes without EURange), use AbsoluteDeadband 0 (report any change). This reduces subscription traffic by 30-60% on typical DCS deployments per the design doc.

## Spec Excerpt (verbatim)

> "Set data change filter: PercentDeadband 1% for confirmed AnalogItemType nodes with EURange; AbsoluteDeadband 0 (any-change) for all others. Reduces OPC subscription traffic by ~30–60% on typical analog-heavy DCS without missing real process changes. Servers that lack EURange for a given node return BadDeadbandFilterInvalid — fall back to AbsoluteDeadband 0 for that point."
> — 17_OPC_INTEGRATION.md, §Subscription Management → Create Subscriptions

## Where to Look in the Codebase

Primary files:
- `services/opc-service/src/driver.rs` lines 1137-1155 — `create_subscriptions`, specifically the `MonitoredItemCreateRequest` construction and `MonitoringParameters`
- `services/opc-service/src/driver.rs` lines 683-695 — `analog_nodes` HashSet tracking which nodes are AnalogItemType

## Verification Checklist

- [ ] `MonitoringParameters::filter` is set to `DataChangeFilter { deadband_type: DeadbandType::Percent, deadband_value: 1.0 }` for nodes present in `analog_nodes` that also have a non-None `eu_range_low`/`eu_range_high`
- [ ] All other nodes use `DataChangeFilter { deadband_type: DeadbandType::None, deadband_value: 0.0 }` (AbsoluteDeadband 0) or an empty default filter
- [ ] When a monitored item returns `BadDeadbandFilterInvalid`, the code falls back to recreating that item with AbsoluteDeadband 0
- [ ] The EURange values harvested by `harvest_analog_metadata` are accessible (via a map or directly from the analog metadata store) at subscription time so the code knows which analog nodes actually have EURange

## Assessment

- **Status**: ⚠️ Partial (missing filter)
- **Current state**: `driver.rs` line 1152 sets `filter: Default::default()` for all items regardless of node type. The `analog_nodes` HashSet is available at subscription creation time (passed into `create_subscriptions` via `node_map`, though `analog_nodes` itself is not currently passed as a parameter). EU range data is only written to the DB, not retained in memory for subscription-time use.

## Fix Instructions

**Step 1 — Pass analog_nodes into create_subscriptions**

Change the signature of `create_subscriptions` at line 1082 to accept `analog_nodes: &HashSet<NodeId>` and a map of `eu_ranges: &HashMap<NodeId, (f64, f64)>` (low, high from the harvested metadata).

To build `eu_ranges`, modify `harvest_analog_metadata` to also return the EU ranges for analog nodes (return `HashMap<NodeId, (f64, f64)>`), then pass that into `create_subscriptions`.

**Step 2 — Build per-node DataChangeFilter**

Inside `create_subscriptions`, when building the `MonitoredItemCreateRequest` for each node, determine the filter:

```rust
use opcua::types::{DataChangeFilter, DeadbandType};

let filter = if let Some(&(low, high)) = eu_ranges.get(node_id) {
    if (high - low).abs() > f64::EPSILON {
        DataChangeFilter {
            trigger: DataChangeTrigger::StatusValue,
            deadband_type: DeadbandType::Percent as u32,
            deadband_value: 1.0,
        }
    } else {
        DataChangeFilter::default() // EURange is degenerate — no deadband
    }
} else {
    DataChangeFilter::default() // AbsoluteDeadband 0
};
```

Set `requested_parameters.filter` to the ExtensionObject-encoded version of this filter (use `ExtensionObject::from_encodable` with `ObjectId::DataChangeFilter_Encoding_DefaultBinary`).

**Step 3 — Handle BadDeadbandFilterInvalid fallback**

After `create_monitored_items`, check each result. If status code is `BadDeadbandFilterInvalid`, collect those item indices and call `create_monitored_items` again with those items using `DataChangeFilter::default()` (AbsoluteDeadband 0). Log a warning per affected node.

Do NOT:
- Apply PercentDeadband to boolean (`TwoStateDiscreteType`) or string (`MultiStateDiscreteType`) nodes — deadband is only meaningful for numeric values
- Use `eu_range_low == eu_range_high == 0.0` as a valid EURange — treat that as degenerate and skip the deadband
- Re-harvest EU ranges a second time at subscription creation; use the data already collected by `harvest_analog_metadata`
