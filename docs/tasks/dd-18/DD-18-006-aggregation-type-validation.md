---
id: DD-18-006
title: Implement aggregation type validation in history API
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Before returning aggregate data for a point, the archive service must check the point's `aggregation_types` bitmask in `points_metadata`. If the client requests a column that the point does not permit (e.g. requesting `avg` for an accumulator point, or `sum` for a temperature point), the API must return HTTP 400 with a descriptive error message. This prevents semantically meaningless calculations from reaching the UI.

## Spec Excerpt (verbatim)

> "Before returning aggregate results, the API must check the point's aggregation_types field:
> - If a client requests an avg trend for a point that does not permit averaging, return a 400 error with a clear message
> - If a client requests a sum for a point that does not permit summing, return a 400 error
> - The min, max, and count columns are generally available for all points"
> — 18_TIMESERIES_DATA.md, §Aggregation Type Validation

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs` — `get_point_history` handler (line 116) and `get_batch_history` handler (line 328)
- `migrations/20260314000011_points_data.up.sql` — `aggregation_types` column definition (lines 18–23): Bit 0 (value 1) = allow averaging; Bit 1 (value 2) = allow sum/totaling; Bit 2 (value 4) = allow accumulation

## Verification Checklist

- [ ] `get_point_history` queries `points_metadata.aggregation_types` for the requested point before executing aggregate queries
- [ ] If `resolution` is "1m"/"5m"/"15m"/"1h"/"1d" and caller passes `agg=avg` but bit 0 of `aggregation_types` is 0, handler returns HTTP 400
- [ ] If caller passes `agg=sum` but bit 1 of `aggregation_types` is 0, handler returns HTTP 400
- [ ] Error message is descriptive (e.g. "Point does not permit averaging; check aggregation_types")
- [ ] Raw resolution bypasses aggregation type checks (raw returns value+quality, not agg columns)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `get_point_history` and `get_batch_history` execute aggregate queries without any `aggregation_types` lookup. There is no `agg` query parameter and no 400 path for invalid aggregation requests.

## Fix Instructions (if needed)

**1. Add optional `agg` query parameter to `HistoryQuery` and `BatchHistoryRequest`:**

```rust
#[serde(default)]
pub agg: Option<String>, // "avg", "sum", "min", "max", "count"
```

**2. Before executing any non-raw query, look up the point's `aggregation_types`:**

```rust
let agg_types: i32 = sqlx::query_scalar(
    "SELECT aggregation_types FROM points_metadata WHERE id = $1"
)
.bind(point_id)
.fetch_optional(&state.db)
.await?
.unwrap_or(0);

if let Some(ref agg) = params.agg {
    match agg.as_str() {
        "avg" if (agg_types & 1) == 0 => {
            return Err(IoError::BadRequest(
                "This point does not permit averaging (aggregation_types bit 0 not set)".to_string()
            ));
        }
        "sum" if (agg_types & 2) == 0 => {
            return Err(IoError::BadRequest(
                "This point does not permit summing (aggregation_types bit 1 not set)".to_string()
            ));
        }
        _ => {}
    }
}
```

**3. For batch requests**, perform the same check for each `point_id` in the batch before querying.

The bitmask is defined in migrations/20260314000011_points_data.up.sql:18–23:
- Bit 0 (value 1): allow averaging
- Bit 1 (value 2): allow sum/totaling
- Bit 2 (value 4): allow accumulation

Do NOT:
- Enforce aggregation types at the database level — spec explicitly states enforcement is at the API/UI layer
- Block `min`, `max`, or `count` — these are always available regardless of `aggregation_types`
- Skip this check for the rolling average endpoint (DD-18-005) — rolling avg requires bit 0
