# Discrete Point Type Support — Implementation Plan

## Overview

Add first-class support for OPC UA discrete point types (Boolean/TwoState and
Enum/MultiState) throughout the full stack: crawl and store the type metadata,
expose it via the API, translate raw numeric values to human-readable strings
everywhere they are displayed, and enforce point-type compatibility in chart
selection.

---

## Current State (as-audited)

### Database (`points_metadata`)
- `data_type VARCHAR(50)` exists — OPC service already writes `"Boolean"` or
  `"String"` for discrete nodes, `"Float"`, `"Int32"`, etc. for analog.
- `min_value` / `max_value` exist for analog EU range.
- **No `point_category` column** — no formal discrete/analog classification.
- **No enum string table** — `TrueState`/`FalseState`/`EnumStrings` are merged
  into `source_raw` JSONB on `points_metadata_versions` only, never promoted to
  a queryable column or dedicated table.

### OPC Service
- `driver.rs` already: detects `TwoStateDiscreteType`, `MultiStateDiscreteType`,
  `MultiStateValueDiscreteType` via `HasTypeDefinition` during browse.
- Writes `data_type = "Boolean"` / `"String"` for these nodes.
- Calls `harvest_discrete_metadata()` second pass which reads `EnumStrings`,
  `TrueState`, `FalseState` property nodes and merges them into `source_raw`
  JSONB via `db::merge_point_source_raw()`.
- **Gap**: enum strings never land in a queryable/serveable structure — buried
  in `source_raw` only.

### API Gateway (`/api/v1/points/:id`)
- Returns `data_type`, `eu_range_low`, `eu_range_high`.
- **Does not return** `point_category`, `enum_strings`, `true_state`,
  `false_state`.

### Frontend
- `useWebSocket.ts` `PointValue` carries `value: number` — always numeric.
- `SceneRenderer.tsx` `applyPointValue()` calls `formatValue(value, cfg.valueFormat)`
  which formats numbers only — no string label resolution.
- `TextReadout`, `DigitalStatus`, `AnalogBar`, `FillGauge` display elements all
  receive raw numeric `value: number`.
- `ChartTypePicker` has no compatibility filtering by point type.
- `chart-definitions.ts` has no `acceptedPointTypes` field.

---

## Target State

1. **DB**: `point_category` enum column on `points_metadata`. New
   `point_enum_labels` table for string lookups (indexed by `point_id` +
   `index`). Boolean points get two rows (0 = FalseState label, 1 = TrueState
   label).

2. **OPC Service**: Promote harvested discrete metadata from `source_raw` JSON
   blob into the new structured columns/table after the second pass.

3. **API**: `/api/v1/points/:id` and `/api/v1/points` list return `point_category`
   + resolved `enum_labels` array. WebSocket point update messages remain
   numeric (UInt32/Boolean raw values) — translation is done client-side from
   metadata.

4. **Frontend — value resolution**: A `usePointMeta` hook (or extension of
   existing `pointsApi.getMeta`) returns the `enum_labels` map. A shared
   `resolvePointLabel(value, meta)` utility translates numeric → string when
   the point is discrete. Every place that renders a point value uses this.

5. **Frontend — chart compatibility**: `chart-definitions.ts` gets
   `acceptedPointTypes: PointTypeCategory[]` on every definition. The
   `ChartTypePicker` filters lists by point type when a point context is
   provided, and filters point pickers by chart type when a chart is already
   selected.

6. **Frontend — display elements**: `TextReadout`, `DigitalStatus`, `AnalogBar`,
   `FillGauge`, `Sparkline`, `AlarmIndicator` in `SceneRenderer.applyPointValue`
   and their static React variants all call `resolvePointLabel` before rendering.
   Shapes with value bindings in the SVG scene graph go through the same path.

---

## Detailed Steps

---

### Step 1 — Database Migration

**File**: new migration `20260401000046_point_discrete_types.up.sql`

```sql
-- 1a. Add point_category to points_metadata
ALTER TABLE points_metadata
  ADD COLUMN point_category VARCHAR(20) NOT NULL DEFAULT 'analog'
    CHECK (point_category IN ('analog', 'boolean', 'discrete_enum'));

-- Backfill from existing data_type values written by OPC service
UPDATE points_metadata SET point_category = 'boolean'
  WHERE data_type = 'Boolean';
UPDATE points_metadata SET point_category = 'discrete_enum'
  WHERE data_type = 'String';

-- 1b. Enum label lookup table
CREATE TABLE point_enum_labels (
  point_id   UUID NOT NULL REFERENCES points_metadata(id) ON DELETE CASCADE,
  idx        SMALLINT NOT NULL,        -- 0-based index matching OPC UInt32 value
  label      TEXT NOT NULL,
  PRIMARY KEY (point_id, idx)
);

CREATE INDEX idx_point_enum_labels_point_id ON point_enum_labels(point_id);

-- 1c. Also add to points_metadata_versions for historical correctness
ALTER TABLE points_metadata_versions
  ADD COLUMN point_category VARCHAR(20);
```

Also add `point_category` to the trigger that syncs versions → metadata
(`trg_sync_point_metadata_from_version` in `20260314000002_functions`), or
handle it in the OPC service upsert directly.

---

### Step 2 — OPC Service: Promote to Structured Storage

**Files**: `services/opc-service/src/db.rs`, `driver.rs`

#### 2a. New DB function in `db.rs`

```rust
/// Upsert the point_category column and enum label rows for a discrete point.
pub async fn upsert_discrete_labels(
    db: &DbPool,
    point_id: Uuid,
    category: &str,          // "boolean" | "discrete_enum"
    labels: &[(i16, String)], // (index, label) pairs
) -> anyhow::Result<()>
```

Implementation:
- `UPDATE points_metadata SET point_category = $2 WHERE id = $1`
- Bulk `INSERT INTO point_enum_labels(point_id, idx, label) VALUES ... ON CONFLICT (point_id, idx) DO UPDATE SET label = EXCLUDED.label`

#### 2b. Call from `harvest_discrete_metadata()` in `driver.rs`

After the existing `merge_point_source_raw()` call, also call
`upsert_discrete_labels()`:
- For `TwoStateDiscreteType`: category = `"boolean"`, labels =
  `[(0, false_state_text), (1, true_state_text)]` (default `"False"`/`"True"`
  if properties absent).
- For `MultiStateDiscreteType` / `MultiStateValueDiscreteType`: category =
  `"discrete_enum"`, labels = `EnumStrings` array mapped to `(index, text)`.

Also set `point_category` during the initial `upsert_point_from_source()` so
newly discovered discrete points are classified immediately (before the second
pass harvests labels).

---

### Step 3 — API Gateway: Expose Discrete Metadata

**File**: `services/api-gateway/src/handlers/points.rs`

#### 3a. `GET /api/v1/points/:id` (detail endpoint)

Add to the SQL query:
```sql
SELECT pm.id, pm.tagname, ..., pm.point_category,
       COALESCE(
         json_agg(json_build_object('idx', pel.idx, 'label', pel.label)
                  ORDER BY pel.idx)
         FILTER (WHERE pel.point_id IS NOT NULL),
         '[]'
       ) AS enum_labels
FROM points_metadata pm
LEFT JOIN point_enum_labels pel ON pel.point_id = pm.id
WHERE pm.id = $1
GROUP BY pm.id
```

Add to JSON response:
```json
{
  "point_category": "discrete_enum",
  "enum_labels": [
    { "idx": 0, "label": "Stopped" },
    { "idx": 1, "label": "Running" },
    { "idx": 2, "label": "Fault" }
  ]
}
```

#### 3b. `GET /api/v1/points` (list/search endpoint)

Add `point_category` to list results (no enum_labels needed in list — too
verbose). Allows ChartTypePicker point picker to filter by category.

#### 3c. `PointDetail` TypeScript interface (`frontend/src/api/points.ts`)

```typescript
export interface EnumLabel { idx: number; label: string; }

export interface PointDetail {
  id: string;
  name: string;
  description: string | null;
  engineering_unit: string | null;
  data_type: string;
  source_id: string;
  source_name: string;
  eu_range_low: number | null;
  eu_range_high: number | null;
  point_category: "analog" | "boolean" | "discrete_enum";
  enum_labels: EnumLabel[];  // empty array for analog
}
```

---

### Step 4 — Frontend: Shared Resolution Utility

**New file**: `frontend/src/shared/utils/resolvePointLabel.ts`

```typescript
import type { PointDetail, EnumLabel } from "../../api/points";

export type PointCategory = "analog" | "boolean" | "discrete_enum";

export function resolvePointLabel(
  value: number | null,
  category: PointCategory,
  enumLabels: EnumLabel[],
): string | null {
  if (value === null) return null;
  if (category === "boolean") {
    // OPC UA: 0 = false, non-zero = true
    const idx = value === 0 ? 0 : 1;
    return enumLabels.find(l => l.idx === idx)?.label
      ?? (value === 0 ? "False" : "True");
  }
  if (category === "discrete_enum") {
    const idx = Math.round(value);
    return enumLabels.find(l => l.idx === idx)?.label ?? String(idx);
  }
  return null; // analog — caller formats numerically
}
```

---

### Step 5 — Frontend: Point Metadata Cache

**File**: `frontend/src/api/points.ts`

`pointsApi.getMeta(id)` already fetches `PointDetail`. Extend it to include the
new fields (Step 3c above). No new API call needed — same endpoint.

A new React hook for convenient consumption:

**New file**: `frontend/src/shared/hooks/usePointMeta.ts`

```typescript
// Fetches PointDetail (with enum_labels) for one or more point IDs.
// Caches via TanStack Query (5-minute staleTime).
export function usePointMeta(pointIds: string[]): Map<string, PointDetail>
```

---

### Step 6 — Frontend: Display Elements (Graphics)

All six display element types need discrete value support. The changes divide
into two paths:

#### 6a. Static React components (used in Designer preview + Chart renderers)

Files: `TextReadout.tsx`, `DigitalStatus.tsx`, `AnalogBar.tsx`, `FillGauge.tsx`,
`Sparkline.tsx`, `AlarmIndicator.tsx`

Add `pointMeta?: PointDetail` prop to each. In the render body, before calling
`formatValue(value, cfg.valueFormat)`, call `resolvePointLabel()`. If a string
label is returned, use it directly; skip numeric formatting.

#### 6b. DOM mutation path (`SceneRenderer.applyPointValue`)

`applyPointValue` currently receives `pv: WsPointValue` which only has
`value: number`. It needs access to point metadata for enum resolution.

**Approach**: Pass a `metaMap: Map<string, PointDetail>` into `applyPointValue`
(already available in `SceneRenderer` since it fetches point metadata for the
scene). For each element update, look up `metaMap.get(pointId)` and resolve
label before formatting.

In `SceneRenderer`, the existing `pointValues` prop + WebSocket subscription
already give us point IDs. We add a `usePointMeta(allPointIds)` call to get the
metadata map, passing it into `applyPointValue`.

#### 6c. Key rendering changes per element type

| Element | Change |
|---------|--------|
| `text_readout` | If discrete, show label string instead of formatted number. Hide units for discrete. |
| `digital_status` | Already designed for discrete — uses `TrueState`/`FalseState` label from config. Wire to enum_labels as source of truth instead of static config. |
| `analog_bar` | If discrete enum, optionally show label below bar OR disable bar (meaningless for enum). For boolean, bar at 0% or 100% with FalseState/TrueState label. |
| `fill_gauge` | Same as analog_bar — boolean makes visual sense (0/100%), enum does not. Show label in center text. |
| `sparkline` | Discrete values as step function; tooltip shows label not number. |
| `alarm_indicator` | No change — alarm logic already works on numeric quality/priority. |

---

### Step 7 — Frontend: Chart Type Compatibility

#### 7a. `chart-definitions.ts`

Add `acceptedPointTypes` field to `ChartDefinition`:

```typescript
export type PointTypeCategory = "analog" | "boolean" | "discrete_enum" | "any";

export interface ChartDefinition {
  // ...existing fields...
  acceptedPointTypes: PointTypeCategory[];
}
```

Populate for all 39 chart types. Key decisions:

| Category | Charts |
|----------|--------|
| `["any"]` | Live Trend (01), Historical Trend (02), Multi-Axis (03) |
| `["analog"]` | Scatter (13), Regression (25), Histogram (20), Box Plot (19), Waterfall (21), Pareto (18), CUSUM (29), EWMA (30), Q-Q (31), Surface 3D (34), Correlation Matrix (26), Parallel Coord (37), X-bar/R (38) |
| `["boolean", "discrete_enum"]` | State Timeline (35), Attribute Control (39) |
| `["analog", "boolean"]` | Step Chart (04), Bar (05), Fill Gauge (11), Analog Bar (10), Bullet (23), Shewhart (24) |
| `["any"]` | KPI Card (07), Sparkline (09), Alarm Indicator (12), Data Table (15), Batch Comparison (16), Heatmap (17), Stacked Area (22), Sankey (27), Treemap (28), Funnel (32), Radar (33), Scorecard (36), Pie/Donut (06), Gauge (08), Event Timeline (14) |

#### 7b. `ChartTypePicker` — chart-first flow

**File**: `frontend/src/shared/components/charts/ChartTypePicker.tsx`

Props change:
```typescript
interface ChartTypePickerProps {
  selectedType: ChartTypeId;
  onSelect: (type: ChartTypeId) => void;
  context?: ChartContext;
  /** When provided, dims/hides charts incompatible with these point types */
  pointTypes?: PointTypeCategory[];
}
```

In the list rendering, check `isCompatible(def, pointTypes)`:
- `acceptedPointTypes` includes `"any"` → always compatible
- Intersection of `def.acceptedPointTypes` and `pointTypes` non-empty → compatible
- Otherwise → grey out with tooltip "Not compatible with selected point type(s)"

Don't hard-hide — dim with `opacity: 0.4` and disable click. User can still
see all chart types.

#### 7c. Data Points tab — point-first filtering

**File**: `frontend/src/shared/components/charts/ChartConfigPanel.tsx`
(specifically the Data Points tab point picker/search)

When `config.chartType` is known, pass `acceptedPointTypes` from the chart
definition into the point search component so incompatible points appear dimmed
or filtered. Implement in the point picker's filter/search results rendering.

#### 7d. Drag-onto-pane flow

**File**: `frontend/src/pages/console/panes/TrendPane.tsx` (or wherever the
drag handler lives)

When a point is dragged onto a new/empty pane:
- Look up the point's `point_category` from the point metadata
- Pre-set `pointTypes` on the ChartTypePicker when it opens

This requires the drag payload to include or trigger a fetch of `point_category`.

---

### Step 8 — Charts: Discrete-Aware Rendering

Charts that display value labels on axes (Step Chart, State Timeline) need to
resolve enum labels on the Y axis and in tooltips.

**File**: `frontend/src/shared/components/charts/TimeSeriesChart.tsx`

Add optional `enumLabels?: Map<string, EnumLabel[]>` prop (keyed by pointId).
When building uPlot axes, if a series' point is discrete, provide a custom
`values` formatter that maps numeric ticks → string labels.

**Chart 35 (State Timeline)**: Renders colored bands per state. Uses enum labels
as band labels. Requires enum_labels from point metadata.

**Chart 04 (Step Chart)**: Already step-rendered. Add Y-axis label resolution.

**Chart 14 (Event Timeline)**: Already event-based. No change needed.

---

## File Change Summary

### Backend (Rust)
| File | Change |
|------|--------|
| `migrations/20260401000046_point_discrete_types.up.sql` | NEW — add `point_category` column + `point_enum_labels` table |
| `migrations/20260401000046_point_discrete_types.down.sql` | NEW — rollback |
| `services/opc-service/src/db.rs` | Add `upsert_discrete_labels()` function |
| `services/opc-service/src/driver.rs` | Call `upsert_discrete_labels()` after `harvest_discrete_metadata()`; set `point_category` in initial upsert |
| `services/api-gateway/src/handlers/points.rs` | Add `point_category` + `enum_labels` to both GET detail and list endpoints |

### Frontend (TypeScript/React)
| File | Change |
|------|--------|
| `src/api/points.ts` | Add `point_category`, `enum_labels` to `PointDetail`; add `EnumLabel` type |
| `src/shared/utils/resolvePointLabel.ts` | NEW — label resolution utility |
| `src/shared/hooks/usePointMeta.ts` | NEW — multi-point metadata hook |
| `src/shared/graphics/SceneRenderer.tsx` | Pass metaMap into `applyPointValue`; resolve labels for text_readout, digital_status, analog_bar, fill_gauge, sparkline |
| `src/shared/graphics/displayElements/TextReadout.tsx` | Accept `pointMeta` prop; use `resolvePointLabel` |
| `src/shared/graphics/displayElements/DigitalStatus.tsx` | Wire to enum_labels |
| `src/shared/graphics/displayElements/AnalogBar.tsx` | Discrete label display |
| `src/shared/graphics/displayElements/FillGauge.tsx` | Discrete label display |
| `src/shared/graphics/displayElements/Sparkline.tsx` | Step + label tooltip |
| `src/shared/components/charts/chart-definitions.ts` | Add `acceptedPointTypes` to all 39 definitions |
| `src/shared/components/charts/ChartTypePicker.tsx` | Add `pointTypes` prop; dim incompatible charts |
| `src/shared/components/charts/ChartConfigPanel.tsx` | Filter point picker by chart's `acceptedPointTypes` |
| `src/shared/components/charts/TimeSeriesChart.tsx` | Add `enumLabels` prop; discrete Y-axis formatting |
| `src/shared/components/charts/renderers/chart04-step-chart.tsx` | Pass enum labels to TimeSeriesChart |
| `src/shared/components/charts/renderers/chart35-state-timeline.tsx` | Use enum labels for band labels |
| `pages/console/panes/TrendPane.tsx` | Pass point types to ChartTypePicker on drag-drop |

---

## OPC Boolean Convention (confirmed)

OPC UA standard: `false = 0`, `true = 1`. Same as every other system.
- `TrueState` label applies when `value == 1` (non-zero)
- `FalseState` label applies when `value == 0`
- Default fallback if properties absent: `"True"` / `"False"`

No inversion needed anywhere.

---

## Implementation Order

1. **DB migration** (unblocks everything)
2. **OPC service** `upsert_discrete_labels` (populates the data)
3. **API gateway** endpoint changes + TypeScript `PointDetail` type update
4. **`resolvePointLabel` utility + `usePointMeta` hook** (unblocks frontend)
5. **Display elements** (TextReadout, DigitalStatus, AnalogBar, FillGauge, Sparkline)
6. **SceneRenderer** `applyPointValue` enum resolution
7. **`chart-definitions.ts`** `acceptedPointTypes` field
8. **ChartTypePicker** point-type filtering (both directions)
9. **Chart renderers** enum Y-axis labels (Step, State Timeline, others)

Steps 1–3 are backend-only and can be done together. Steps 4–9 are
frontend-only and can proceed once Step 3 is deployed (or mocked).

---

## Open Questions / Decisions

1. **`aggregation_types`**: Discrete points should have `aggregation_types = 0`
   (no averaging, no sum). Already handled? The OPC service currently uses a
   bitmask — confirm it sets 0 for boolean/enum nodes.

2. **History storage**: `points_history_raw.value` is `DOUBLE PRECISION`.
   Enum UInt32 values (0, 1, 2...) store fine as doubles. Boolean 0/1 also fine.
   No schema change needed for history — but continuous aggregates (`avg`, `min`,
   `max`) are meaningless for discrete points. Consider adding a
   `WHERE point_category = 'analog'` guard on the materialized views refresh, or
   just accept that avg(0,1,0,1) = 0.5 exists in the DB and ignore it in the UI.

3. **`MultiStateValueDiscreteType`**: Uses `EnumValues` property (not
   `EnumStrings`) with `(value, displayName)` pairs — values are not necessarily
   0-based sequential. The OPC service already detects this type. The `idx`
   column in `point_enum_labels` should store the actual OPC value (not
   positional index) for this type. Make sure `upsert_discrete_labels` handles
   both patterns.

4. **Re-crawl needed**: Existing SimBLAH points already have `data_type =
   "Boolean"/"String"` but `point_enum_labels` will be empty until a re-crawl
   runs. Need a one-time re-harvest or re-trigger of `harvest_discrete_metadata`
   for all existing sources after the migration.
