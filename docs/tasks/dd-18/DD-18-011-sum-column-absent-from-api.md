---
id: DD-18-011
title: Add sum column to aggregate API responses
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The archive service's history API should return the `sum` aggregate column for all non-raw resolutions. The continuous-aggregate views all compute `sum(value)`, but the current `HistoryRow` response struct omits the field entirely and the SQL queries never select it. Clients requesting sum-permitted points (e.g., flow rate, production count) have no way to retrieve total volume or production over a time range.

## Spec Excerpt (verbatim)

> All continuous aggregates compute avg, min, max, sum, and count for every point. […] The application selectively exposes results based on `aggregation_types`.
> — design-docs/18_TIMESERIES_DATA.md, §Aggregate Column Usage by Point Type

> **Flow Rate (GPM)**: avg ✅, min/max ✅, sum ✅ — total flow volume over a period is also meaningful.
> — design-docs/18_TIMESERIES_DATA.md, §Aggregate Column Usage by Point Type

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs:71–86` — `HistoryRow` struct; `sum` field is absent
- `services/archive-service/src/handlers/history.rs:281–309` — 1m aggregate query; `sum` not in SELECT
- `services/archive-service/src/handlers/history.rs:311–340` — 5m aggregate query; same
- `services/archive-service/src/handlers/history.rs:342–403` — 1h aggregate query; same
- `services/archive-service/src/handlers/history.rs:373–403` — 15m; same
- `services/archive-service/src/handlers/history.rs:404–434` — 1d; same
- `services/archive-service/src/handlers/history.rs:570–739` — batch history handler; same pattern

## Verification Checklist

- [ ] `HistoryRow` struct has a `pub sum: Option<f64>` field with `#[serde(skip_serializing_if = "Option::is_none")]`
- [ ] All 6 aggregate-resolution queries (1m/5m/15m/1h/1d in both single-point and batch handlers) include `sum` in the SELECT clause
- [ ] Aggregate `HistoryRow` construction sets `sum: r.get("sum")`
- [ ] Raw-resolution `HistoryRow` construction sets `sum: None`

## Assessment

- **Status**: ❌ Missing
- **If missing**: `HistoryRow` has no `sum` field. All 12 aggregate-resolution SQL queries (6 resolutions × single + batch) select only `avg, min, max, count`. The `sum` column is computed in all 5 continuous-aggregate views but is unreachable via the API.

## Fix Instructions

1. **`services/archive-service/src/handlers/history.rs`** — add `sum` to `HistoryRow`:
   ```rust
   #[serde(skip_serializing_if = "Option::is_none")]
   pub sum: Option<f64>,
   ```

2. Update every aggregate SELECT in `get_point_history` (lines ~281, 311, 373, 342, 404) and `get_batch_history` (lines ~570–720) to add `, sum` after `count`:
   ```sql
   SELECT bucket AS timestamp, avg, min, max, count, sum
   FROM points_history_1m
   ...
   ```

3. Update every aggregate `HistoryRow` construction (for all 5 tiers in both handlers) to set `sum: r.get("sum")`.

4. Raw-resolution `HistoryRow` constructions already have `avg: None` etc.; add `sum: None` there too.

Do NOT:
- Add `sum` to the raw-resolution query — raw rows have no `sum` column
- Make `sum` required (keep it `Option<f64>` with `skip_serializing_if`)
- Change the aggregation-type validation logic in this task (that is a separate gap)
