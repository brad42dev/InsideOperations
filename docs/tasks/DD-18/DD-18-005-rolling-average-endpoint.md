---
id: DD-18-005
title: Implement rolling average endpoint for archive service
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The archive service must provide a rolling average query: given a point ID and a window duration (e.g. "5 minutes", "1 hour"), return the trailing-window avg, min, max, and sample count from now. Unlike continuous aggregates which align to fixed clock boundaries, rolling averages always represent "the last N from now." The implementation must select the most efficient source (raw table for short windows, aggregate views for longer windows).

## Spec Excerpt (verbatim)

> "Rolling averages are always computed on-the-fly via SQL queries against the raw data or the smallest appropriate continuous aggregate. They are never pre-stored."
> "The API accepts arbitrary window durations and selects the most efficient data source (raw table or smallest fitting continuous aggregate)."
> "Performance Considerations:
> - Small windows (< 5 minutes): Query raw data directly
> - Medium windows (5 minutes - 1 hour): Use 1-minute aggregates as source
> - Large windows (1 hour - 1 day): Use 5-minute or 15-minute aggregates
> - Very large windows (> 1 day): Use 1-hour aggregates"
> — 18_TIMESERIES_DATA.md, §Rolling Averages

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs` — add new handler here
- `services/archive-service/src/main.rs` — register route here (lines 50–66)

## Verification Checklist

- [ ] Route `GET /history/points/:point_id/rolling` exists in main.rs
- [ ] Handler accepts `window` query parameter (duration string, e.g. "5m", "1h", "30m")
- [ ] Small windows (<5min) query `points_history_raw` with `WHERE quality = 'Good'`
- [ ] Medium windows (5min–1h) query `points_history_1m` aggregate
- [ ] Large windows (1h–1d) query `points_history_5m` or `points_history_15m` aggregate
- [ ] Very large windows (>1d) query `points_history_1h` aggregate
- [ ] Returns `rolling_avg`, `rolling_min`, `rolling_max`, `sample_count` fields
- [ ] Returns null/zero with explanation when no data in window

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No rolling average handler or route exists anywhere in `services/archive-service/src/`. The spec dedicates a full section to this feature including example SQL queries.

## Fix Instructions (if needed)

**1. Add handler in `services/archive-service/src/handlers/history.rs`:**

Add query parameter struct:
```rust
#[derive(Debug, Deserialize)]
pub struct RollingQuery {
    pub window: String, // e.g. "5m", "1h", "2d"
}
```

Add response struct:
```rust
#[derive(Debug, Serialize)]
pub struct RollingResponse {
    pub point_id: Uuid,
    pub window: String,
    pub rolling_avg: Option<f64>,
    pub rolling_min: Option<f64>,
    pub rolling_max: Option<f64>,
    pub sample_count: i64,
}
```

Parse the window string into a `chrono::Duration` (support "Nm", "Nh", "Nd" suffixes). Select source table based on window size:
- `< 5 minutes`: query `points_history_raw` with `WHERE quality = 'Good' AND timestamp >= NOW() - $window`
- `5 minutes to 1 hour`: query `points_history_1m` with `WHERE bucket >= NOW() - $window` (avg of avg, min of min, max of max, sum of count)
- `1 hour to 1 day`: query `points_history_15m`
- `> 1 day`: query `points_history_1h`

Reference SQL from spec §Rolling Averages.

**2. Register route in `services/archive-service/src/main.rs` at line 54:**

```rust
.route(
    "/history/points/:point_id/rolling",
    get(handlers::history::get_point_rolling),
)
```

Do NOT:
- Pre-store rolling averages — they must always be computed on demand
- Return rolling values for points whose `aggregation_types` bitmask forbids averaging — check bit 0 first (see DD-18-006)
