# Phase 00 — Type Contract Foundation

**Goal:** Extend the chart type ID space (40–59), add slot/definition stubs, and add a `CONTENT_WIDGET_IDS` set so later phases can land without breaking type-checking.

## Read first (required)

Before writing any code, read these files:

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md` — feature overview + decisions.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — full file. You're extending this.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts` — first 60 lines define `ChartDefinition` interface. The file is large; read enough to see how an entry is shaped, then jump to the end of `CHART_DEFINITIONS` array.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — full file. You'll add stub entries to `RENDERERS`.

## Context

This is the very first phase of the Chart Widget System feature. The widget system in the Designer is being collapsed into the existing chart system: `WidgetNode.config` will be typed as `ChartConfig`, and every "widget" will actually be a chart. Later phases need ID slots reserved for the new chart types (40–49) and for content widgets (50–59) that don't have data points (text, clock, iframe, camera stream, etc.).

This phase only does type plumbing — no renderer files exist yet, no UI changes. The goal is `tsc --noEmit` clean while reserving the ID space and adding a `requiresPoints` flag to `ChartDefinition` so the config UI can later hide the point selector for content widgets.

The codebase reserves chart IDs as a discriminated union (`ChartTypeId`). Since `CHART_SLOTS` is `Record<ChartTypeId, SlotDefinition[]>`, the moment you add a new ID to the union you must add a `CHART_SLOTS` entry — TypeScript will refuse to compile otherwise. Same for the `RENDERERS` map (it can use `as const` and lazy stubs).

## Changes

### 1. `frontend/src/shared/components/charts/chart-config-types.ts`

**1a.** Extend the `ChartTypeId` union to include 40–59. Add the new IDs as additional union members with a comment block:

```ts
export type ChartTypeId =
  | 1
  | 2
  // ... existing through 39 ...
  | 39 // Attribute Control Chart (p/np/c/u)
  // ── New chart types (Phase 05d/05e) ──
  | 40 // Accumulated Run / Production vs. Target
  | 41 // Status Map / Fleet Status Grid
  | 42 // (reserved)
  | 43 // (reserved)
  | 44 // (reserved)
  | 45 // (reserved)
  | 46 // (reserved)
  | 47 // (reserved)
  | 48 // (reserved)
  | 49 // (reserved)
  // ── Content widgets (Phase 06a–07c) ──
  | 50 // Text / Markdown
  | 51 // Header / Divider
  | 52 // Clock / Elapsed Timer
  | 53 // Logs Viewer
  | 54 // IFrame / Embed
  | 55 // Camera Stream
  | 56; // (reserved for future content widget)
```

**1b.** Add a `CONTENT_WIDGET_IDS` constant just after `XY_SCALE_CHARTS` / `ORIENTABLE_CHARTS`:

```ts
/**
 * Content widgets — chart types that don't bind to point data and shouldn't
 * be walked by point extractors. Used by GraphicPane.tsx to skip these when
 * collecting point IDs to subscribe to.
 */
export const CONTENT_WIDGET_IDS: Set<ChartTypeId> = new Set<ChartTypeId>([
  50, 51, 52, 53, 54, 55, 56,
]);
```

**1c.** Add stub entries to `CHART_SLOTS` for IDs 40–56. Use empty arrays for content widgets (50–56) and stub slot arrays for new chart types. Pattern:

```ts
// Append inside CHART_SLOTS:
40: [
  { id: "actual", label: "Actual", multi: false, required: true },
  { id: "target", label: "Target", multi: false, required: true },
],
41: [
  { id: "item", label: "Items", multi: true, required: true, maxPoints: 64 },
],
42: [],
43: [],
44: [],
45: [],
46: [],
47: [],
48: [],
49: [],
50: [],
51: [],
52: [],
53: [],
54: [],
55: [],
56: [],
```

### 2. `frontend/src/shared/components/charts/chart-definitions.ts`

**2a.** Add `requiresPoints?: boolean` to the `ChartDefinition` interface. Place it just after `acceptedPointTypes`:

```ts
export interface ChartDefinition {
  id: ChartTypeId;
  // ... existing fields ...
  acceptedPointTypes: PointTypeCategory[];
  /** Whether this chart needs at least one point bound to render. Default: true. Content widgets set false. */
  requiresPoints?: boolean;
  /** Hide from palette / picker until the renderer lands. Default: undefined (= shown). */
  available?: boolean;
}
```

The `available?: boolean` field is also added so we can ship stubs without showing them in the picker until the renderer is implemented. (Search the file — if `available` already exists, leave it alone.)

**2b.** Append stub entries to the end of `CHART_DEFINITIONS`. They must satisfy the `ChartDefinition` shape but be marked `available: false`:

```ts
  // ── New chart types (renderers ship in Phase 05d/05e) ──────────────────────
  {
    id: 40,
    name: "Accumulated Run",
    category: "Production",
    tier: "mid",
    library: "ECharts",
    realTime: true,
    acceptedPointTypes: ["analog"],
    description:
      "Cumulative actual vs. target line over the live window. Production engineers see plan vs. actual at a glance.",
    benefits: ["Real-time production tracking", "Resets per shift/day/week"],
    downsides: ["Requires a target source (point or constant)"],
    available: false,
  },
  {
    id: 41,
    name: "Status Map",
    category: "Status",
    tier: "mid",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      "2D grid of equipment items colored by current state — fleet status at a glance.",
    benefits: ["See dozens of asset states in one view", "Click drills to detail"],
    downsides: ["Loses temporal context"],
    available: false,
  },
  // ── Content widgets (renderers ship in Phase 06a–07c) ──────────────────────
  {
    id: 50,
    name: "Text / Markdown",
    category: "Content",
    tier: "initial",
    library: "Custom",
    realTime: false,
    acceptedPointTypes: ["any"],
    description: "Static text or markdown — annotations, notes, instructions.",
    benefits: ["Embed context inside the graphic"],
    downsides: [],
    requiresPoints: false,
    available: false,
  },
  {
    id: 51,
    name: "Header / Divider",
    category: "Content",
    tier: "initial",
    library: "Custom",
    realTime: false,
    acceptedPointTypes: ["any"],
    description: "Section header for organizing a graphic.",
    benefits: ["Visual structure"],
    downsides: [],
    requiresPoints: false,
    available: false,
  },
  {
    id: 52,
    name: "Clock / Elapsed",
    category: "Content",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description: "Wall clock or elapsed timer from an event start.",
    benefits: ["Operator time awareness"],
    downsides: [],
    requiresPoints: false,
    available: false,
  },
  {
    id: 53,
    name: "Logs Viewer",
    category: "Content",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description: "Scrolling list of recent alarms or events.",
    benefits: ["Live event feed inside the graphic"],
    downsides: [],
    requiresPoints: false,
    available: false,
  },
  {
    id: 54,
    name: "IFrame / Embed",
    category: "Content",
    tier: "initial",
    library: "Custom",
    realTime: false,
    acceptedPointTypes: ["any"],
    description: "Embed an external page or dashboard.",
    benefits: ["Bring third-party content inline"],
    downsides: ["Subject to CSP frame-src; iframes can be heavy"],
    requiresPoints: false,
    available: false,
  },
  {
    id: 55,
    name: "Camera Stream",
    category: "Content",
    tier: "mid",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description: "Live RTSP/RTMP/WebRTC video stream from a configured camera.",
    benefits: ["Visual confirmation alongside data"],
    downsides: ["Requires Camera Streams configured in Settings"],
    requiresPoints: false,
    available: false,
  },
```

(IDs 42–49 and 56 are reserved without entries — they exist in the union for forward compatibility but have no `ChartDefinition` yet.)

### 3. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Add stub entries to `RENDERERS` for IDs 40, 41, 50, 51, 52, 53, 54, 55. Since the renderer files do not exist yet, **comment out** these entries. Add a comment block above explaining when each lands:

```ts
const RENDERERS = {
  1: lazy(() => import("./renderers/chart01-live-trend")),
  // ... existing 1–39 unchanged ...
  39: lazy(() => import("./renderers/chart39-attribute-control")),

  // ── New chart types — uncomment as renderers land ──
  // 40: lazy(() => import("./renderers/chart40-accumulated-run")), // Phase 05d
  // 41: lazy(() => import("./renderers/chart41-status-map")),       // Phase 05e

  // ── Content widgets — uncomment as renderers land ──
  // 50: lazy(() => import("./renderers/chart50-text-markdown")),    // Phase 06a
  // 51: lazy(() => import("./renderers/chart51-header-divider")),   // Phase 06a
  // 52: lazy(() => import("./renderers/chart52-clock-timer")),      // Phase 06b
  // 53: lazy(() => import("./renderers/chart53-logs-viewer")),      // Phase 06c
  // 54: lazy(() => import("./renderers/chart54-iframe-embed")),     // Phase 06b
  // 55: lazy(() => import("./renderers/chart55-camera-stream")),    // Phase 07c
} as const;
```

The existing fallback in `ChartRenderer` (`UnknownChart`) will render for any `chartType` not in `RENDERERS` — IDs 40+ until those renderers ship. That's fine.

## Gotchas

- **Don't add a renderer file** in this phase. Phases 05x/06x/07c create them. If you create a stub file here, later phases will collide.
- **Don't change `ChartConfig` shape** in this phase. Just IDs and slot stubs. `extras: Record<string, unknown>` already permits any payload — content widgets store `text`, `url`, `streamId`, etc. there at render time, no type change needed yet.
- **Verify with `pnpm exec tsc --noEmit`** in `frontend/`. The compile will catch missing `CHART_SLOTS` keys (the `Record<ChartTypeId, SlotDefinition[]>` type forces exhaustiveness).
- **Don't run `pnpm build` and trust it** without also running `pnpm test` — past experience shows tests catch import/route bugs that build misses.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` exits 0 (no type errors).
2. `cd frontend && pnpm build` exits 0.
3. `cd frontend && pnpm test` exits 0 (no regressions).
4. Grep confirms: `grep -n "CONTENT_WIDGET_IDS" frontend/src/shared/components/charts/chart-config-types.ts` matches.
5. Grep confirms: `grep -n "id: 40\|id: 41\|id: 50\|id: 55" frontend/src/shared/components/charts/chart-definitions.ts` matches all four.
6. The current Designer still works exactly as before — placing trend/table/gauge widgets still shows existing placeholders. Nothing breaks because no consumer of `ChartTypeId` was modified to handle the new IDs (they all default-fall-through).

## Phase dependencies

- **Depends on:** None. This is the first phase.
- **Gates:** All subsequent phases.
