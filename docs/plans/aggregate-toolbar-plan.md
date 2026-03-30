# Aggregate + Duration Toolbar — Implementation Plan

**Date:** 2026-03-30
**Scope:** Add Duration label, Bucket Size, and Aggregate Type controls to ChartToolbar and ChartConfigPanel Options tab. Wire through backend. Responsive label/value shrinking.

---

## What Already Exists (do not redo)

- `ChartConfig` already has `aggregateType`, `aggregateSize`, `aggregateSizeUnit` fields
- `ChartOptionsForm.tsx` has partial aggregate UI but with wrong chart set and no per-chart filtering
- Backend `HistoryQuery` has `resolution` + `agg` params — keep for backward compat
- Continuous aggregates precompute avg/min/max/sum/count at 1m / 5m / 15m / 1h / 1d
- `AggregateType` union type already includes: avg, sum, last, first, max, min, median, range, stddev, count

---

## Per-Chart Aggregate Map (research output)

### Charts with duration + aggregate controls

| ChartTypeId | Chart Name | Valid Aggregates (ordered: most natural first) |
|---|---|---|
| 1 | Live Trend | avg, min, max, first, last, median, sum |
| 2 | Historical Trend | avg, min, max, first, last, median, sum |
| 3 | Multi-Axis Trend | avg, min, max, first, last, median, sum |
| 4 | Step Chart | last, first, avg, min, max |
| 5 | Bar / Column | sum, avg, max, min, count |
| 17 | Heatmap | avg, sum, count |
| 22 | Stacked Area | sum, avg, min, max, first, last |
| 36 | Scorecard Table | avg, min, max, sum, count, first, last |

### Charts with duration control only (compute own statistics — no aggregate selector)

ChartTypeIds: 13, 14, 16, 19, 20, 24, 25, 26, 29, 30, 31, 35, 37, 38, 39

### Charts with gear button only (no duration, no aggregate)

ChartTypeIds: 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 23, 27, 28, 32, 33, 34

---

## Bucket Size Options

```
Label       Short   Seconds
---------   -----   -------
1 sec       1s      1
5 sec       5s      5
10 sec      10s     10
30 sec      30s     30
1 min       1m      60
5 min       5m      300
15 min      15m     900
1 hr        1h      3600
1 day       1d      86400
```

**Filter rule:** Only show bucket if `10 ≤ durationSeconds / bucketSeconds ≤ 3000`

Examples:
- 5 years (157,680,000s): only 1d valid (1825 points)
- 1 week (604,800s): 5m, 15m, 1h, 1d valid
- 1 hour (3600s): 1s, 5s, 10s, 30s, 1m, 5m valid (not 15m/1h/1d — too few points)
- 30 min (1800s): 1s, 5s, 10s, 30s, 1m valid

**Default bucket:** Auto-select the best bucket for the duration (same logic as current seedResolution).

---

## Backend Architecture (archive-service)

### Source table selection by bucket_seconds

```
bucket_seconds   Source table              Notes
-1 / absent      (use resolution param)   Backward compat
< 60             points_history_raw       time_bucket(Ns, timestamp)
60               points_history_1m        direct or time_bucket
300              points_history_5m        direct or time_bucket
900              points_history_15m       direct or time_bucket
3600             points_history_1h        direct or time_bucket
86400            points_history_1d        direct
other (e.g 120)  points_history_1m        time_bucket(120s, bucket)
```

### Aggregate → SQL expression

Precomputed aggregates (fastest — direct column read when bucket matches table):
- avg → `avg`
- min → `min`
- max → `max`
- sum → `sum`
- count → `count`

On-demand aggregates (computed with time_bucket() from source table):
- first → `first(value_col, time_col)`
- last  → `last(value_col, time_col)`
- stddev → `stddev(value_col)`
- range → `max(value_col) - min(value_col)` (or max-min from precomputed)
- median → `percentile_disc(0.5) WITHIN GROUP (ORDER BY value_col)`

### Fast path vs. compute path

**Fast path** (direct column from precomputed table):
Condition: `bucket_seconds` is exactly 60/300/900/3600/86400 AND `aggregate_function` is avg/min/max/sum/count

**Compute path** (time_bucket on source):
All other combinations. Source table = finest precomputed table where `source_bucket_seconds <= bucket_seconds`.

### New HistoryQuery params

```rust
pub struct HistoryQuery {
    // ... existing fields ...
    pub bucket_seconds: Option<i64>,          // NEW: explicit bucket size
    pub aggregate_function: Option<String>,    // NEW: avg|min|max|sum|count|first|last|median|stddev|range
}
```

### Response format

When `bucket_seconds` is set: return rows with `value` field set to the single aggregate result (backward compatible — TrendPane already prefers `row.value` then falls back to `row.avg`).

When `bucket_seconds` is absent: existing behavior unchanged.

### Valid aggregate_function values (expand from current avg/sum/min/max/count)

Add: first, last, median, stddev, range

### Validation

- Expand `validate_agg_type` to accept the new types
- avg/median/stddev/range still respect the aggregation_types bitmask (bit 0)
- sum still respects bit 1
- first/last/min/max/count always permitted

---

## Frontend Changes

### Phase 1: New shared file — `chart-aggregate-config.ts`

New file at `frontend/src/shared/components/charts/chart-aggregate-config.ts`

Exports:
- `CHART_AGGREGATE_TYPES: Partial<Record<ChartTypeId, AggregateType[]>>` — per-chart valid aggregates
- `CHART_HAS_DURATION: Set<ChartTypeId>` — charts that show duration control
- `BUCKET_OPTIONS: { seconds, label, labelShort }[]` — all bucket options
- `getValidBuckets(durationSeconds: number): typeof BUCKET_OPTIONS` — filtered list
- `defaultBucketSeconds(durationMinutes: number): number` — auto-select best bucket
- `bucketToResolution(bucketSeconds: number): string` — map to API resolution string for fast path
- `AGGREGATE_LABELS: Record<AggregateType, { full: string; short: string }>` — display names

### Phase 2: Backend — `history.rs`

1. Add `bucket_seconds: Option<i64>` and `aggregate_function: Option<String>` to `HistoryQuery`
2. Add same to `BatchHistoryRequest`
3. Expand `validate_agg_type` for new agg types
4. Add `fn pick_source_table(bucket_seconds: i64) -> (&'static str, i64, &'static str)` returning (table, table_bucket_sec, time_col)
5. Add `async fn query_with_bucket(...)` that builds SQL for both fast path and compute path
6. In `get_point_history`: if `bucket_seconds` is Some, use new path; else use existing resolution path
7. Same for `get_batch_history`

### Phase 3: Frontend API — `points.ts`

Add `bucket_seconds?: number` and `aggregate_function?: string` to both `history()` and `getHistory()` param types.

### Phase 4: `ChartToolbar.tsx`

New props:
```typescript
aggregates?: AggregateType[]       // if absent/empty: no aggregate selector
bucketSeconds?: number             // current bucket, undefined = auto
onBucketChange?: (s: number | undefined) => void
aggregateType?: AggregateType      // current aggregate
onAggregateChange?: (a: AggregateType) => void
```

New UI elements:
- `Duration:` label before existing value/unit controls
- Bucket size `<select>` (filtered by duration, "Auto" as default option)
- Aggregate type `<select>` (only if `aggregates` prop is non-empty)

Responsive behavior (via ResizeObserver on toolbar div):
- Wide (> 560px): full labels — "Duration", "Bucket Size", "Aggregate"
- Medium (400–560px): short labels — "Dur", "Bucket", "Agg"
- Narrow (< 400px): short labels + abbreviated option values (e.g. "1m" not "1 min")
  - Note: native `<select>` shows same text in trigger and list. Custom dropdown for abbreviated trigger + full list is a follow-up enhancement.

### Phase 5: `ChartOptionsForm.tsx`

Replace current flat `AGGREGATE_CHARTS` set with import from `chart-aggregate-config.ts`.
Add Duration section (currently only in toolbar, should also be in Options tab):
- Duration value + unit (already exists — confirm it's wired correctly)
- Bucket size dropdown (using `getValidBuckets` from new shared file)
- Aggregate type dropdown (using `CHART_AGGREGATE_TYPES[chartType]`)

Fix: current AGGREGATE_CHARTS includes chart types that shouldn't have aggregate selectors (e.g. 6, 18, 19, 20, 24, 25, 26, 29, 30) — replace with correct per-chart map.

### Phase 6: `TrendPane.tsx`

New state:
```typescript
const [bucketSeconds, setBucketSeconds] = useState<number | undefined>(undefined) // undefined = auto
const [aggregateType, setAggregateType] = useState<AggregateType>('avg')
```

Persist both to localStorage like `durationMinutes` is.

Pass to ChartToolbar:
```tsx
<ChartToolbar
  ...existing...
  aggregates={CHART_AGGREGATE_TYPES[1]}  // Live Trend = chart type 1
  bucketSeconds={bucketSeconds}
  onBucketChange={setBucketSeconds}
  aggregateType={aggregateType}
  onAggregateChange={setAggregateType}
/>
```

Update history calls:
```typescript
pointsApi.history(id, {
  start: ..., end: ...,
  bucket_seconds: bucketSeconds ?? defaultBucketSeconds(durationMinutes),
  aggregate_function: aggregateType,
  limit: seedLimit(durationMinutes),
  // resolution: removed — bucket_seconds takes over
})
```

Update `seedQuery` queryKey to include `[bucketSeconds, aggregateType]`.

### Phase 7: Dashboard widget consumers

`TrendChartWidget.tsx` and `AlarmRateTrendWidget.tsx`:
- Read `chartConfig.aggregateType` and `chartConfig.aggregateSize` / `aggregateSizeUnit`
- Pass to ChartToolbar
- Pass to API calls

---

## Aggregate Labels (full → short)

```
avg    → Average      / Avg
min    → Minimum      / Min
max    → Maximum      / Max
sum    → Sum          / Sum
count  → Count        / Count
first  → First        / First
last   → Last         / Last
median → Median       / Med
stddev → Std Dev      / σ
range  → Range        / Rng
```

---

## Implementation Order

1. `chart-aggregate-config.ts` — all other phases import from here
2. `history.rs` — backend, independent
3. `points.ts` — frontend API, depends on nothing
4. `ChartToolbar.tsx` — UI, imports from phase 1
5. `ChartOptionsForm.tsx` — imports from phase 1
6. `TrendPane.tsx` — wires phases 3+4+5
7. Dashboard widgets — last, after toolbar is stable

---

## Out of Scope (follow-ups)

- Custom dropdown component for abbreviated trigger + full dropdown list at narrow widths
- Adding `first`/`last` to continuous aggregate tables (new migration) — currently computed on-demand
- Caching layer for repeated queries (Redis/LRU)
- Increasing batch limit from 50 to 100
