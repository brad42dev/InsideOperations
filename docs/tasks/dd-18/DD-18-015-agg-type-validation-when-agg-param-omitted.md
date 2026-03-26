---
id: DD-18-015
title: Enforce aggregation-type bitmask on aggregate response content
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a client requests an aggregate resolution (1m/5m/15m/1h/1d) without specifying the `agg` query parameter, the API should still enforce the point's `aggregation_types` bitmask by omitting (or nulling) disallowed columns in the response. Currently `validate_agg_type` short-circuits to `Ok(())` when `agg` is `None`, so a client that omits the parameter receives all aggregate columns—including `avg` and `sum` for points that do not permit those operations. This violates the spec requirement that the application "selectively exposes results based on `aggregation_types`."

## Spec Excerpt (verbatim)

> Before returning aggregate results, the API must check the point's `aggregation_types` field:
> - If a client requests an `avg` trend for a point that does not permit averaging, return a 400 error
> - If a client requests a `sum` for a point that does not permit summing, return a 400 error
> The application enforces these constraints at the API and UI layers, not at the database level.
> — design-docs/18_TIMESERIES_DATA.md, §Aggregation Type Validation

> All continuous aggregates compute avg, min, max, sum, and count for every point. However, not all columns are semantically valid for all points. The `aggregation_types` field on `points_metadata` controls which aggregate operations the application layer will expose.
> — design-docs/18_TIMESERIES_DATA.md, §Aggregate Column Usage by Point Type

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs:155–192` — `validate_agg_type`; returns `Ok(())` immediately when `agg` is `None` (line 160–162)
- `services/archive-service/src/handlers/history.rs:243–246` — call site in `get_point_history`; only called when `resolution != "raw"`
- `services/archive-service/src/handlers/history.rs:534–537` — call site in `get_batch_history`; same condition
- `services/archive-service/src/handlers/history.rs:62–86` — `HistoryRow` struct

## Verification Checklist

- [ ] When `agg` is `None` and resolution is aggregate, `avg` is set to `None` in the response if bit 0 of `aggregation_types` is not set
- [ ] When `agg` is `None` and resolution is aggregate, `sum` is set to `None` in the response if bit 1 of `aggregation_types` is not set
- [ ] When `agg` is explicitly `"avg"` and bit 0 is not set, the existing 400 error is still returned (do not change existing behavior)
- [ ] `min`, `max`, and `count` are always present in aggregate responses (no bitmask gate)

## Assessment

- **Status**: ⚠️ Partial
- **If partial**: Explicit `agg=avg`/`agg=sum` requests are correctly rejected. But when `agg` is omitted, all columns are returned unconditionally regardless of `aggregation_types`. The spec requires selective exposure.

## Fix Instructions

The cleanest approach is to look up `aggregation_types` once per point and then null out disallowed columns in the `HistoryRow` values after the query, rather than returning a 400:

1. In `get_point_history`, after the `validate_agg_type` call (line 245) and before/after constructing `rows`, look up `aggregation_types` for the point when resolution is not raw:
   ```rust
   let agg_types: i32 = sqlx::query_scalar(
       "SELECT aggregation_types FROM points_metadata WHERE id = $1"
   )
   .bind(point_id)
   .fetch_optional(&state.db)
   .await?
   .unwrap_or(0);
   let allow_avg = (agg_types & 1) != 0;
   let allow_sum = (agg_types & 2) != 0;
   ```

2. When constructing `HistoryRow` for aggregate resolutions, apply the mask:
   ```rust
   HistoryRow {
       avg: if allow_avg { r.get("avg") } else { None },
       sum: if allow_sum { r.get("sum") } else { None },
       min: r.get("min"),
       max: r.get("max"),
       count: r.get("count"),
       ...
   }
   ```

3. Apply the same pattern in `get_batch_history` (each point already iterates individually, so look up `agg_types` per point_id inside the loop before constructing rows).

4. Do NOT change the existing `validate_agg_type` 400-error behavior — it remains correct for explicit `agg=avg`/`agg=sum` requests.

Do NOT:
- Return a 400 when `agg` is omitted and a column is disallowed — just null it out (the client asked for all columns; the server filters based on permissions)
- Look up `aggregation_types` on every row — look it up once per point per request
- Remove the existing `validate_agg_type` early-return for `min`/`max`/`count`
