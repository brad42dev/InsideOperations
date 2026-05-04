# Chart Widget System — Implementation Master Plan

## Feature overview

This feature unifies the Designer's standalone "widget" system and the chart system into a single architecture. Currently the Designer has 8 stub widget types (`trend`, `table`, `gauge`, etc.) with parallel `WidgetConfig` types that render only as placeholders. Meanwhile the charts module already has 39 fully-implemented chart renderers, a complete `ChartConfig` type, and `ChartConfigPanel` for editing. The widget system has been a placeholder layer that never delivered value.

We're collapsing them. After this work, every widget placed on a graphic stores a `ChartConfig` directly (no adapter, no parallel types), and the Designer mounts the same `<ChartRenderer>` used elsewhere — but in the HTML overlay layer SceneRenderer already creates, not via SVG `foreignObject`. New chart types (Accumulated Run, Status Map), new chart extensions (band/envelope, deviation mode, bubble scatter, pivot tables), content widgets (text, header, clock, iframe, logs), and a Camera Stream widget with go2rtc relay are all added on top of this foundation.

## How to use this plan

For each phase, run a fresh Claude Sonnet session with this exact instruction:

```
Read /home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md then read phase-XX-name.md and implement it.
```

Each phase file is fully self-contained. Sonnet should not need any other prompt context. Phases must be done in dependency order (see graph below). After each phase, verify the acceptance criteria before moving on.

## Phase dependency graph

```
phase-00 (type contract foundation)
  └── phase-01 (WidgetNode unification)
        └── phase-02 (SceneRenderer chart mounting)
              └── phase-03 (Designer right panel)
                    └── phase-04 (Designer palette + drop)
                          ├── phase-05a (Trend extensions)
                          ├── phase-05b (Scatter bubble)
                          ├── phase-05c (Data table pivot)
                          ├── phase-05d (Accumulated Run chart40)
                          ├── phase-05e (Status Map chart41)
                          ├── phase-06a (Text + Header widgets)
                          ├── phase-06b (Clock + IFrame widgets)
                          ├── phase-06c (Logs Viewer widget)
                          └── phase-07a (Camera backend)
                                └── phase-07b (Camera Settings UI)
                                      └── phase-07c (Camera widget chart55)
                                            └── phase-08 (Polish + export)
```

Phases 05a–06c are independent of each other and can run in any order or in parallel after phase-04 lands. All other branches must serialize.

## Phase table

| # | File | Goal | Complexity | Depends on |
|---|------|------|-----------|------------|
| 00 | `phase-00-type-contract.md` | Extend ChartTypeId, add CONTENT_WIDGET_IDS, slot stubs, definition stubs | S | — |
| 01 | `phase-01-widget-node-types.md` | Replace WidgetType/WidgetConfig with ChartTypeId/ChartConfig | M | 00 |
| 02 | `phase-02-scene-renderer-wiring.md` | Mount ChartRenderer in HTML overlay; extend point extractor; bufferKey | M | 01 |
| 03 | `phase-03-designer-config-panel.md` | Convert ChartConfigPanel to controlled, wire to right panel, debounce undo | M | 02 |
| 04 | `phase-04-designer-placement-ux.md` | Replace WIDGET_TYPES tiles with chart-definition-driven palette + drop handler | M | 03 |
| 05a | `phase-05a-trend-extensions.md` | Band/envelope + deviation mode + setpoint slot on chart01 | M | 04 |
| 05b | `phase-05b-scatter-bubble.md` | Optional size slot on chart13; bubble mode | S | 04 |
| 05c | `phase-05c-datatable-pivot.md` | Pivot mode for chart15 | M | 04 |
| 05d | `phase-05d-accumulated-run.md` | New chart40 — cumulative actual vs target | M | 04 |
| 05e | `phase-05e-status-map.md` | New chart41 — fleet status grid | M | 04 |
| 06a | `phase-06a-text-header-widgets.md` | chart50 (Text/Markdown) + chart51 (Header/Divider) | S | 04 |
| 06b | `phase-06b-clock-iframe-widgets.md` | chart52 (Clock/Elapsed) + chart54 (IFrame) | S | 04 |
| 06c | `phase-06c-logs-viewer-widget.md` | chart53 (Logs Viewer) | M | 04 |
| 07a | `phase-07a-camera-backend.md` | DB tables, Rust API, RBAC perms, go2rtc sidecar, nginx proxy | XL | 04 |
| 07b | `phase-07b-camera-settings-ui.md` | Settings tab for managing streams | M | 07a |
| 07c | `phase-07c-camera-stream-widget.md` | chart55 with Happy Eyeballs connection | L | 07b |
| 08 | `phase-08-polish-export.md` | Undo/redo, copy/paste, data-chart-ready, exports, perf | M | 07c (and prefer all 05x/06x done) |

Complexity legend: S = small (<2h), M = medium (2–6h), L = large (1 day), XL = (multi-day).

## Key architectural decisions (quick reference)

### Widget = ChartConfig
- `ChartConfig` from `frontend/src/shared/components/charts/chart-config-types.ts` is the universal widget config.
- `WidgetNode.config: ChartConfig` and `WidgetNode.chartType: ChartTypeId` (denormalized).
- The old `WidgetType` enum and 8 `*WidgetConfig` types are **deleted** — they were stubs, no migration needed.

### Chart type ID ranges
- 1–39 — existing chart types (already implemented).
- 40–49 — new chart types (40 = Accumulated Run, 41 = Status Map).
- 50–59 — content widgets: 50 Text/Markdown, 51 Header/Divider, 52 Clock/Elapsed, 53 Logs Viewer, 54 IFrame, 55 Camera Stream.
- `CONTENT_WIDGET_IDS = new Set<ChartTypeId>([50,51,52,53,54,55,56])` — extractors skip these.
- `ChartDefinition.requiresPoints?: boolean` — `false` for content widgets so config UI hides point selector.

### Rendering
- Charts render in the **HTML overlay layer** that `SceneRenderer.tsx` already creates (`overflow:hidden`, `pointerEvents:none` on the wrapper). **No SVG `foreignObject`.**
- Each chart wrapper div is positioned with `canvasToScreen(node.transform.position, vp)` and sized as `node.width * vp.zoom × node.height * vp.zoom`.
- `pointer-events: none` on the wrapper in **designer mode** (so the interactionRef FSM hits the SVG underneath); `pointer-events: auto` in **viewer mode** (Console/Process/Reports).
- The SVG keeps a transparent `<rect>` placeholder per widget for hit-testing, selection rings, and alignment guides.
- `bufferKey` format: `graphic:${graphicId}:widget:${node.id}` — prevents cross-graphic buffer collisions in `useTimeSeriesBuffer`.

### Designer flow
- Drag chart-type tile from left palette → `io:chart-widget-drop` CustomEvent (replaces `io:widget-drop`) → `DesignerCanvas` creates `WidgetNode` with `makeDefaultChartConfig(chartType)` → auto-select node → right panel opens config tab.
- `ChartConfigPanel` is controlled: `{ value: ChartConfig, onChange: (next: ChartConfig) => void, embedded?: boolean }`. When `embedded`, hide chrome unsuitable for the right panel (e.g. "Save as template" button).
- Edits debounced 250ms into one `ChangeWidgetConfigCommand` for clean undo/redo.

### Chart extensions (not new IDs)
- **Band/envelope** → optional `band-high` and `band-low` slots on chart01; `extras.showBands?: boolean`.
- **Deviation mode** → optional `setpoint` slot on chart01; `extras.deviationMode?: boolean`.
- **Bubble** → optional `size` slot on chart13; renderer drives `symbolSize`.
- **Pivot table** → `extras.pivotMode?: boolean` and `extras.pivotConfig?` on chart15.
- **OEE preset** → just a saved-template config of chart21 (Waterfall). No code change.
- **Cpk/Cp** → already in chart20. Just expose spec limits in extras config.

### Camera streams
- `VideoStream` rows in PostgreSQL `video_streams` table.
- Three visibility tiers: `public`, `managed` (admin-only add, anyone views), `private` (ACL via `video_stream_access`).
- go2rtc as Docker sidecar; reverse-proxied at `/go2rtc/` via nginx (no CORS).
- Happy Eyeballs: widget tries direct stream at t=0, relay at t+1s, first-frame-wins.
- Access enforcement at `/api/video-streams/:id/token` — token endpoint is the gate, not just placement-time.

### Out of scope
- Dashboard module overhaul (later).
- Reports module overhaul (later).
- Legacy widget data migration — old widgets just show empty placeholders until re-edited.
- PTZ camera control, Gantt chart, Image Display widget — deferred.

## Codebase gotchas (apply to every phase)

- **`position: fixed` breaks inside react-grid-layout** (CSS transforms eat it). Use `createPortal(el, document.body)`.
- **`BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"`** required for any `cargo build` that touches `samael` (auth crates). Set the env var before backend builds.
- **`tagname` (no underscore)** in `point_meta` and `PointMeta` API. Never `tag_name`.
- **Designer uses Mode B selection** (interactionRef FSM in `DesignerCanvas`). Do NOT add `useNodeMarquee`/`useNodeClick` to widget code in designer. The viewer-side (Console/Process) uses Mode A — that's separate.
- **Verify with `pnpm test` and `pnpm build`**, not just `tsc --noEmit`. Compile alone misses runtime/import bugs.
- **`cargo clippy -- -D warnings`** must be clean for any Rust change.
- **Real-time updates bypass React** — point values mutate the SVG DOM directly. Charts in the HTML overlay use their own data hooks (`useTimeSeriesBuffer`, `useWebSocket`) that already handle this.
- **`graphicScope` is in `doc.metadata.graphicScope`**, not `doc.scope`.

## Running checklist

- [x] Phase 00 — Type contract foundation
- [x] Phase 01 — WidgetNode type unification
- [x] Phase 02 — SceneRenderer chart mounting
- [x] Phase 03 — Designer right panel config integration
- [x] Phase 04 — Designer palette and drag-drop placement
- [x] Phase 05a — Trend extensions (band/envelope + deviation)
- [x] Phase 05b — XY Scatter bubble extension
- [x] Phase 05c — Data table pivot mode
- [x] Phase 05d — Accumulated Run (chart40)
- [x] Phase 05e — Status Map (chart41)
- [x] Phase 06a — Text + Header widgets (chart50, chart51)
- [x] Phase 06b — Clock + IFrame widgets (chart52, chart54)
- [x] Phase 06c — Logs Viewer widget (chart53)
- [x] Phase 07a — Camera stream backend
- [x] Phase 07b — Camera streams Settings UI
- [x] Phase 07c — Camera Stream widget (chart55)
- [x] Phase 08 — Polish and export coverage
