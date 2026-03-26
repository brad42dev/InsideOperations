---
id: DD-18-016
title: Rolling average endpoint must check aggregation_types bitmask
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The rolling average endpoint (`GET /history/points/:point_id/rolling`) should verify that the point permits averaging (bit 0 of `aggregation_types`) before computing and returning the result. Currently the handler computes and returns a rolling average for any point regardless of whether averaging is semantically valid for that point type (e.g., accumulators, discrete valve positions). This produces meaningless numbers without any error signal to the client.

## Spec Excerpt (verbatim)

> Rolling averages are available for any point where the `aggregation_types` bitmask permits averaging. No separate configuration is needed per rolling window size.
> — design-docs/18_TIMESERIES_DATA.md, §Availability

> If a client requests an `avg` trend for a point that does not permit averaging, return a 400 error with a clear message.
> — design-docs/18_TIMESERIES_DATA.md, §Aggregation Type Validation

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs:746–869` — `get_point_rolling` handler; no `aggregation_types` check before any query
- `services/archive-service/src/handlers/history.rs:155–192` — `validate_agg_type` helper (already handles the avg check correctly for `agg = Some("avg")`)

## Verification Checklist

- [ ] `get_point_rolling` looks up `aggregation_types` for the requested `point_id`
- [ ] If bit 0 (`allow avg`) is not set, the handler returns a 400 `IoError::BadRequest` before executing any SQL
- [ ] The error message clearly states the point does not permit averaging
- [ ] When averaging is permitted, the existing rolling window logic is unchanged

## Assessment

- **Status**: ❌ Missing
- **If missing**: `handlers/history.rs:746–869` — `get_point_rolling` calls `parse_window_seconds` then immediately queries the database. No `aggregation_types` check exists anywhere in the function.

## Fix Instructions

1. In `get_point_rolling` (`handlers/history.rs:746`), after `parse_window_seconds` and before the source-table selection block, add:
   ```rust
   // Enforce aggregation_types: rolling average requires averaging to be permitted.
   let agg_types: i32 = sqlx::query_scalar(
       "SELECT aggregation_types FROM points_metadata WHERE id = $1",
   )
   .bind(point_id)
   .fetch_optional(&state.db)
   .await?
   .unwrap_or(0);

   if (agg_types & 1) == 0 {
       return Err(IoError::BadRequest(
           "This point does not permit averaging (aggregation_types bit 0 not set)".to_string(),
       ));
   }
   ```

2. No other changes to the handler are needed.

Do NOT:
- Change the source-table selection thresholds (< 300s → raw, ≤ 3600s → 1m, etc.)
- Add a bitmask check for min/max/count — rolling endpoint computes avg only, and min/max are always permitted
- Reuse `validate_agg_type` for this check — that helper requires an `Option<String>` and is designed for the `agg` param; a direct bitmask check is cleaner here
