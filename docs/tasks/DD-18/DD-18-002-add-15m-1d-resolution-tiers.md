---
id: DD-18-002
title: Add 15m and 1d resolution tiers to archive REST API
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The archive service must expose the `points_history_15m` and `points_history_1d` continuous aggregate views through the history API. Clients querying 1–7 day ranges should use 15m; clients querying >30-day ranges should use 1d. Both resolution strings must be accepted by the single-point and batch endpoints.

## Spec Excerpt (verbatim)

> "Resolution Selection: Choose aggregate table based on query time range for fixed-period historical queries:
> - < 1 hour: Use points_history_raw or points_history_1m
> - 1 hour - 1 day: Use points_history_5m
> - 1-7 days: Use points_history_15m
> - 8-30 days: Use points_history_1h
> - > 30 days: Use points_history_1d"
> — 18_TIMESERIES_DATA.md, §Query Optimization

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs` — resolution match arms at line 141 (single-point) and line 365 (batch); error message at lines 268 and 488 lists only "raw, 1m, 5m, 1h"

The `points_history_15m` and `points_history_1d` views already exist in the database (created in `migrations/20260314000011_points_data.up.sql:127–164`).

## Verification Checklist

- [ ] `resolution=15m` is accepted and queries `points_history_15m` for both single-point and batch handlers
- [ ] `resolution=1d` is accepted and queries `points_history_1d` for both single-point and batch handlers
- [ ] The error message for unknown resolution lists all six valid values: raw, 1m, 5m, 15m, 1h, 1d
- [ ] The `sum` column is NOT returned in `HistoryRow` for aggregate queries (it is not currently included — confirm no regression)
- [ ] Both views return avg, min, max, count columns same as 1m and 1h

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: The match arm at history.rs:141 and 365 only handles "raw", "1m", "5m", "1h". Requests for "15m" or "1d" fall through to the error arm (lines 266–271 and 486–491).

## Fix Instructions (if needed)

In `services/archive-service/src/handlers/history.rs`, add two match arms for each resolution match block (single-point at ~line 204 and batch at ~line 425):

```rust
"15m" => {
    let agg_rows = sqlx::query(
        "SELECT bucket AS timestamp, avg, min, max, count \
         FROM points_history_15m \
         WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
         ORDER BY bucket \
         LIMIT $4",
    )
    .bind(point_id)
    .bind(start)
    .bind(end)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;
    // map same as 1m arm
}
"1d" => {
    // same pattern using points_history_1d
}
```

Update the error message strings at lines 268 and 488 to:
```
"Unknown resolution '{}'. Valid values: raw, 1m, 5m, 15m, 1h, 1d"
```

Do NOT:
- Add a `sum` field to `HistoryRow` — not in the current response struct and not required by the API consumer
- Change the query structure for existing 1m/5m/1h arms
