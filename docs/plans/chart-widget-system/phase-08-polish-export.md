# Phase 08 — Polish and Export Coverage

**Goal:** Verify the whole chart-widget feature behaves end-to-end: undo/redo, copy/paste, thumbnail and video export pipelines wait for `data-chart-ready`, zoom/pan stays smooth, subscription dedup is correct. Fix any gaps found.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- All earlier phases (00 through 07c) must be complete.
- `/home/io/io-dev/io/services/video-export-service/` — server-side Playwright render. Find the wait-for-ready logic; we extend it.
- `/home/io/io-dev/io/frontend/src/shared/graphics/SceneRenderer.tsx` — the chart wrapper rendering from Phase 02.
- `/home/io/io-dev/io/frontend/src/shared/clipboard/` — search for clipboard payload helpers used elsewhere; widget copy-paste reuses them.
- `/home/io/io-dev/io/frontend/src/shared/graphics/commands.ts` — `AddNodeCommand`, `DeleteNodesCommand`, `DuplicateNodesCommand`, `PasteNodesCommand`.
- The plan in `/home/io/io-dev/io/docs/plans/universal-copy-paste-fix-plan.md` for context on copy-paste — phases 1–4 are done; the rest are not. Don't expand that plan here; just ensure widget copy-paste works for the basic single-graphic case.

## Context

Phases 00–07c built the feature; this phase verifies it. Each subsection below has acceptance checks. If a check fails, fix it within this phase. Most fixes will be one- or two-line tweaks (e.g. add `data-chart-ready` to a renderer that forgot, or fix a bufferKey scoping bug).

## Changes

### 1. Undo / redo verification

**1a.** Place a Trend widget. Configure 1 point. Ctrl+Z → widget removed. Ctrl+Shift+Z (or Ctrl+Y) → widget restored with the point still bound. Check that the `AddNodeCommand`'s undo also reverts any side effects (selection state).

**1b.** Configure: edit a slider in Options. Wait 250ms (Phase 03 debounce). Ctrl+Z → reverts to previous value, not the entire widget removal. Confirm the debounced flush logic in Phase 03 produced one `ChangeWidgetConfigCommand`.

**1c.** Chart-type swap: place a chart01 widget, then in Type tab swap to chart20. Ctrl+Z → reverts to chart01 with its previous config. Confirm `migrateConfigToType` (Phase 03) preserved compatible fields.

If any of these fail, fix in the relevant phase's command/handler. Common cause: missing `clone()` or shallow merge in the command's `execute`/`undo`.

### 2. Copy / paste

**2a.** Place and configure a Trend widget. Select it. Ctrl+C, then Ctrl+V. New widget appears with the same `ChartConfig` but a new `id` (UUID). The copy's `bufferKey` is `graph:<id>:widget:<new uuid>` — distinct from the original.

**2b.** The two widgets show the same data (same point IDs subscribed) — verify subscription dedup at `wsManager`: the underlying WebSocket subscription has refcount 2, not two separate subscriptions. `pgrep -af "data-broker"` and check broker logs / metrics if in doubt.

**2c.** Cross-graphic paste: copy widget from graphic A, switch to graphic B, paste. New widget in B with fresh bufferKey scoped to B. Original in A still works.

If copy-paste produces widgets with stale bufferKeys, fix the paste handler to regenerate the bufferKey based on the new node id and current graphicId. Search `PasteNodesCommand` for any logic that mishandles widget nodes.

### 3. `data-chart-ready` audit

Every renderer must set `data-chart-ready="true"` on its outermost rendered element after first paint so the export pipeline can wait.

**3a.** Audit all renderers:

```bash
grep -L "data-chart-ready" frontend/src/shared/components/charts/renderers/*.tsx
```

Files **not** matching — chart-existing (chart01-chart39) renderers may need this added if they don't already have it. Look at chart01 first to see whether it already does (uPlot's wrapper might). For renderers that don't, add a small `useEffect` near mount:

```tsx
const wrapperRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  // Mark after first paint so the export pipeline can wait on this selector.
  queueMicrotask(() => wrapperRef.current?.setAttribute("data-chart-ready", "true"));
}, []);
```

For chart types with multiple async steps (e.g. ECharts setOption + render), set the attribute in the chart instance's `finished` callback if available.

**3b.** **video-export-service**: find the server-side waiter. Likely:
```bash
grep -rn "data-chart-ready\|waitForSelector\|waitFor" services/video-export-service/ | head
```

The service should `await page.locator('[data-widget="true"]').all()` (count widget hit-rects in SVG) then for each, wait for the matching overlay div to have `data-chart-ready="true"`. The overlay div has `data-node-id` matching the widget node id (Phase 02). Wait pattern:

```ts
const widgets = await page.locator('[data-widget="true"]').all();
for (const w of widgets) {
  const id = await w.getAttribute("data-node-id");
  if (id) {
    await page.locator(`[data-node-id="${id}"][data-chart-ready="true"]`).waitFor({ timeout: 30_000 });
  }
}
```

Add or update this logic in the export service's render step.

**3c.** **Thumbnail export** (server-side Playwright). Same waiter pattern. Find:
```bash
grep -rn "thumbnail" services/ | head
```

If a separate handler renders thumbnails, it gets the same waiter logic.

### 4. Zoom / pan performance

Pan and zoom in the designer with a graphic containing 5+ chart widgets. Frame rate should be ≥55fps (verify with Chrome DevTools Performance panel). The chart wrapper's `left`/`top`/`width`/`height` update with the viewport — if React re-renders the entire chart on every pan tick, perf collapses.

If perf is bad: the issue is likely that `<ChartRenderer>` re-runs `<RendererComponent>` on every pan tick because `config` or `bufferKey` is being recreated. Memoize them in `SceneRenderer.tsx`:

```tsx
const widgetEntries = widgetNodes.map((node) => ({
  node,
  config: node.config,
  bufferKey: `graphic:${graphicId ?? "unknown"}:widget:${node.id}`,
}));
```

…and consider `React.memo`ing the wrapper, keyed on `node.id`, so the chart-mounting layer doesn't re-render when only `screenPos` changes (let the wrapping `<div>` consume the new `screenPos` while the inner `<ChartRenderer>` stays mounted).

### 5. Subscription dedup

Open a graphic with two widgets subscribing to the same point. Check the data-broker logs / metrics: there should be **one** server-side subscription, not two. The wsManager's refcount handles this, but verify with grep:

```bash
grep -rn "subscribe\|refcount" frontend/src/shared/hooks/useWsWorker.ts
```

If refcount is missing, that's a regression. Fix — but it predates this plan and shouldn't have been introduced here.

### 6. `position: fixed` audit

Each new renderer (40, 41, 50, 51, 52, 53, 54, 55) plus extension changes (chart01, chart13, chart15) must not use `position: fixed` for any overlay or dropdown. Audit:

```bash
grep -rn "position: ['\"]fixed['\"]\|position:fixed" frontend/src/shared/components/charts/
```

For each match, replace the floating element with `createPortal(el, document.body)` per the project gotcha (CSS transforms in react-grid-layout break `position: fixed`).

### 7. Final build + test pass

```bash
cd frontend && pnpm exec tsc --noEmit && pnpm build && pnpm test
```

```bash
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build
cargo clippy --workspace -- -D warnings
cargo test --workspace
```

All clean.

### 8. Update `docs/PROJECT_REFERENCE.md`

Per `CLAUDE.md`: "Update that file when any of it changes". The chart-widget system is now a major frontend module. Add a brief section listing:

- Chart system unified with widgets (single `ChartConfig` source).
- 41 chart types + 6 content widgets.
- Camera Streams system (Settings tab, go2rtc relay, ACL).

Keep it short — 3–6 lines.

## Gotchas

- **Don't add new features in phase 08.** Only fixes and verification. If you find a missing capability, write a follow-up plan; don't bolt it on here.
- **`data-chart-ready` race condition**: setting the attribute too early (before chart actually renders pixels) breaks the export pipeline (it captures a blank frame). Use `queueMicrotask` so the attribute is set after the current render cycle, or hook into the chart library's "finished" callback if it has one (ECharts: `instance.on('finished', ...)`).
- **Chrome DevTools Performance**: enable "FPS meter" in Rendering settings to see real numbers. Don't trust feel.
- **Tests**: `pnpm test` may flake on chart renderers because they expect a real DOM. The vitest config likely uses jsdom — ECharts and uPlot may not measure the canvas correctly there. If chart tests fail and they're new, scope them down or skip with a TODO.
- **Backend `cargo clippy`** must pass `--workspace`. A camera-streams handler with a `let _ = ...` warning fails clippy.
- **Designer Mode B selection**: confirm widget interaction still goes through `interactionRef` FSM, not `useNodeMarquee`/`useNodeClick`. Place 3 widgets, marquee-select with a drag — all 3 should select.
- **Console pane aspect ratio**: graphics in console panes preserve aspect ratio on resize. Verify a graphic with widgets doesn't break this (it shouldn't — wrappers use `vp.zoom` for sizing).

## Acceptance criteria

1. All checks in sections 1–6 pass.
2. `cd frontend && pnpm build && pnpm test` exit 0.
3. `cargo build && cargo clippy --workspace -- -D warnings && cargo test --workspace` (with `BINDGEN_EXTRA_CLANG_ARGS`) exit 0.
4. Server-side video export of a graphic with 5 chart widgets renders all 5 charts correctly (no blank frames, no chart placeholders).
5. Thumbnail of a graphic with widgets shows the actual rendered charts, not placeholder rects.
6. Zoom/pan a graphic with 8 widgets in designer — Performance panel shows ≥55fps consistently.
7. `docs/PROJECT_REFERENCE.md` updated with the new architecture summary.
8. Running checklist in `MASTER.md` can be marked off — all phases complete.

## Phase dependencies

- **Depends on:** All earlier phases (00–07c). Recommended to do 05a–06c (chart extensions and content widgets) before this phase, but technically only 07c is a hard prerequisite for the export verification of camera widgets.
- **Gates:** Nothing — this is the final phase.
