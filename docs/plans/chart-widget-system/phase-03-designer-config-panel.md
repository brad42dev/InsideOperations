# Phase 03 — Designer Right Panel Config Integration

**Goal:** Convert `ChartConfigPanel` to a controlled component, wire it into `DesignerRightPanel.tsx` for selected `WidgetNode`s, and debounce edits into a single undo entry.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phases 00, 01, 02 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartConfigPanel.tsx` — full file. You'll refactor or wrap this.
- `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` — focus on lines 1–100 (imports + entry component), then search for `WidgetContentTab` (~line 2943) and the calls to it (~lines 5444). Phase 01 stubbed `WidgetContentTab` — this phase replaces it.
- `/home/io/io-dev/io/frontend/src/shared/graphics/commands.ts` — `ChangeWidgetConfigCommand` (around line 1547) is the undo unit.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-defaults.ts` — `makeDefaultChartConfig` from Phase 01.

## Context

`ChartConfigPanel` exists today as a full-screen modal (rendered via `createPortal` inside the file). It takes `initialConfig`, calls `onSave(config)` on save, `onClose()` on close. It has its own internal state, save modal, and "Save as template" / "Publish" UI.

For the designer's right panel, we want:
1. **Controlled** — props `{ value, onChange, embedded? }`. No internal state buffering (the right panel passes the live `WidgetNode.config` and gets back updates).
2. **No template chrome when embedded** — when `embedded: true`, hide "Save as template", "Publish", and the close-the-modal-style header. The panel renders inline as a tab body in the right panel.
3. **Tabs visible** — Type / Points / Scaling / Options tabs work the same; just rendered in the right panel layout, not as a modal.

When the user changes anything, we don't push every keystroke as a `ChangeWidgetConfigCommand` — that would create thousands of undo entries for a slider drag. Instead, debounce 250ms: collect changes, after 250ms of inactivity push **one** `ChangeWidgetConfigCommand` whose `prevConfig` is the value at the start of the debounce window.

If the user changes the chart type (Type tab), the new `chartType` may have incompatible slots (e.g. switching from chart01 with 3 series to chart20 which is single-point). `makeDefaultChartConfig(newId)` returns a fresh config, but we should preserve compatible fields where possible: keep `points` slots whose `role` exists in the new chart's slot definition, preserve `legend`, `scaling.type`, `durationMinutes`. Drop incompatible.

## Changes

### 1. `frontend/src/shared/components/charts/ChartConfigPanel.tsx` — refactor to controlled

The current API is:
```ts
interface ChartConfigPanelProps {
  initialConfig: ChartConfig;
  onSave: (config: ChartConfig) => void;
  onClose: () => void;
  context?: ChartContext;
  onSaveChart?: (...) => void;
  canPublish?: boolean;
}
```

**1a.** Change to a discriminated union of two modes — **modal** (existing) and **embedded** (new). Keep backward compat for callers that already use the modal mode.

```ts
interface ChartConfigPanelModalProps {
  mode?: "modal";
  initialConfig: ChartConfig;
  onSave: (config: ChartConfig) => void;
  onClose: () => void;
  context?: ChartContext;
  onSaveChart?: (
    config: ChartConfig,
    name: string,
    description: string,
    publish: boolean,
  ) => void;
  canPublish?: boolean;
}

interface ChartConfigPanelEmbeddedProps {
  mode: "embedded";
  value: ChartConfig;
  onChange: (next: ChartConfig) => void;
  context?: ChartContext;
}

type ChartConfigPanelProps =
  | ChartConfigPanelModalProps
  | ChartConfigPanelEmbeddedProps;
```

**1b.** Inside the component, branch the rendering. The internal `config` state is a buffered copy in modal mode; in embedded mode, it's the prop `value`. When embedded:

- Skip the `createPortal` call — render the panel body inline (no modal chrome).
- Skip the close button, the "Save" / "Publish" buttons, and the SaveChartModal.
- All edits call `onChange` directly with the new config.

A clean refactor: extract the **panel body** (the tabs + tab contents) into a separate component, e.g. `ChartConfigPanelBody`, which takes `{ value, onChange, context, hideTemplateActions }`. Then both the modal mode (which wraps it in a portal + chrome) and the embedded mode (which renders it inline) share the body. This avoids duplicating the tab logic.

The simpler path if extraction is invasive: add an `embedded` flag inside the existing component that gates the `createPortal` and chrome. Both are acceptable; aim for minimal diff.

**1c.** Update existing callers of `ChartConfigPanel` (the ones using modal mode). Search:
```bash
grep -rn "ChartConfigPanel" frontend/src/ --include="*.tsx" --include="*.ts"
```

For each caller that uses the existing (modal) API, either leave them alone (if you preserved backward compat by making `mode` optional/defaulting to `"modal"`) or add `mode="modal"` to the props. They should keep working unchanged.

### 2. `frontend/src/pages/designer/DesignerRightPanel.tsx`

**2a.** Add an import:

```ts
import ChartConfigPanel from "../../shared/components/charts/ChartConfigPanel";
import { makeDefaultChartConfig } from "../../shared/components/charts/chart-defaults";
import { CHART_SLOTS } from "../../shared/components/charts/chart-config-types";
```

**2b.** Replace the stubbed `WidgetContentTab` (Phase 01 left it as a placeholder) with a real implementation:

```tsx
function WidgetContentTab({ node }: { node: WidgetNode }) {
  // Local debounce state — accumulate edits, flush as one undo command.
  const startConfigRef = useRef<ChartConfig>(node.config);
  const pendingRef = useRef<ChartConfig | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  // Track when the selected node changes so we reset the debounce baseline.
  useEffect(() => {
    startConfigRef.current = node.config;
    pendingRef.current = null;
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [node.id]);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    flushTimerRef.current = null;
    if (!pending) return;
    if (
      JSON.stringify(pending) === JSON.stringify(startConfigRef.current)
    ) {
      return; // no-op
    }
    executeCmd(
      new ChangeWidgetConfigCommand(node.id, pending, startConfigRef.current),
    );
    startConfigRef.current = pending;
  }, [node.id]);

  // Flush on unmount / node change so partial edits aren't lost.
  useEffect(() => {
    return () => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flush();
    };
  }, [flush]);

  const handleChange = useCallback(
    (next: ChartConfig) => {
      pendingRef.current = next;
      // Reflect immediately on the node so the chart updates live (without
      // pushing an undo entry every keystroke). We use a transient command —
      // a no-undo update — by writing through the scene store directly, OR
      // we accept that the chart re-renders only on debounce flush. The
      // simpler/cheaper path: write through the scene store directly (no
      // command), then on flush issue one ChangeWidgetConfigCommand to
      // record the diff for undo.
      useSceneStore.getState().updateNodeTransient(node.id, { config: next });

      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = window.setTimeout(flush, 250);
    },
    [node.id, flush],
  );

  return (
    <ChartConfigPanel
      mode="embedded"
      value={node.config}
      onChange={handleChange}
      context="designer"
    />
  );
}
```

The `useSceneStore.getState().updateNodeTransient(...)` is a no-undo write so the chart updates live during a slider drag. If `updateNodeTransient` doesn't exist, **add it** to the scene store: a method that updates a node's fields without pushing to the history stack. Look at how the scene store is structured (`grep -n "useSceneStore" frontend/src/shared/graphics/`); the existing `updateNode` likely goes through a command. Add the transient sibling.

If adding a transient mutator is too invasive, an acceptable fallback: skip the live preview during debounce — just commit on the 250ms timer. The chart will only update after the user pauses for 250ms. Document this in the function comment.

**2c.** Find the call site that decides which tab body to render for a `widget` node (around line 5444 — `case "widget": return <WidgetContentTab node={...} />`). Confirm `WidgetContentTab` is rendered for the selected widget when its tab is the "Content" tab. The existing tab structure may have multiple tabs (Layout, Style, Content) — this content tab is the one we replace.

**2d.** Type-switch behavior. Inside `ChartConfigPanel`'s Type tab, when the user picks a different `chartType`, the panel currently calls `setConfig({...config, chartType: newId})`. We need it to call `makeDefaultChartConfig(newId)` and then merge compatible fields. Add a helper at the top of the file:

```ts
function migrateConfigToType(
  prev: ChartConfig,
  newType: ChartTypeId,
): ChartConfig {
  const fresh = makeDefaultChartConfig(newType);
  const newSlots = CHART_SLOTS[newType] ?? [];
  const validRoles = new Set(newSlots.map((s) => s.id));
  const compatPoints = prev.points.filter((p) => validRoles.has(p.role));
  return {
    ...fresh,
    points: compatPoints,
    legend: prev.legend ?? fresh.legend,
    scaling: { ...fresh.scaling, ...prev.scaling, type: prev.scaling?.type ?? "auto" },
    durationMinutes: prev.durationMinutes ?? fresh.durationMinutes,
    aggregateType: prev.aggregateType,
    aggregateSize: prev.aggregateSize,
    aggregateSizeUnit: prev.aggregateSizeUnit,
  };
}
```

Wherever the type-switch handler is in the panel, call `migrateConfigToType(currentConfig, newId)` instead of a naïve merge. Apply this in both modal and embedded modes (it's in the shared body).

### 3. Hide point selector for content widgets

In `ChartConfigPanel`, look up the `ChartDefinition` for the current `config.chartType`. If `def.requiresPoints === false`, the **Points** tab should be hidden (from the `BASE_TABS` array), and the type picker should still allow selecting it.

Add to the tab filter logic (around line 113 where `TABS = SCALING_TAB_CHARTS.has(...)`):

```ts
const def = CHART_DEFINITIONS.find((d) => d.id === config.chartType);
let TABS = SCALING_TAB_CHARTS.has(config.chartType)
  ? BASE_TABS
  : BASE_TABS.filter((t) => t.id !== "scaling");
if (def?.requiresPoints === false) {
  TABS = TABS.filter((t) => t.id !== "points");
}
```

This makes content widget chart types (50–55) skip the Points tab. The Options tab remains where their `extras` controls live; phases 06a–07c add the per-type Options controls.

### 4. ChartTypePicker filter (only `available !== false` shown)

Search for `ChartTypePicker` (likely at `frontend/src/shared/components/charts/ChartTypePicker.tsx`). Where it iterates over `CHART_DEFINITIONS`, add a filter `def.available !== false`. This hides chart types whose renderer hasn't shipped yet (the stubs from Phase 00).

If the picker is also used for end-of-list "coming soon" entries, leave existing logic and just gate by `available`. New types ship with `available: true` in their respective phases.

## Gotchas

- **Debounce flush on unmount**: if the user clicks away from the widget mid-drag, the cleanup must flush the pending command or the change is lost. The cleanup `useEffect` covers this — verify by selecting widget A, dragging a slider, immediately clicking widget B. The undo stack should show one `ChangeWidgetConfigCommand` for widget A.
- **`startConfigRef.current` is the prev for the next undo**. After flush, advance it to the just-committed state. Otherwise consecutive debounce flushes all reference the original state and undo replays incorrectly.
- **Don't push `ChangeWidgetConfigCommand` on every keystroke** — undo becomes useless. The 250ms debounce is the contract.
- **Don't break the modal callers** of `ChartConfigPanel`. Default `mode` to `"modal"` if absent.
- **The right panel may be wider than the modal expected**. The panel body uses internal flex/scroll; verify it doesn't overflow by testing a narrow right panel.
- **Designer uses Mode B selection** — the right panel reads `useUiStore().selectedNodes`. Don't introduce `useNodeMarquee`/`useNodeClick`.
- **`createPortal` for any dropdowns inside the panel body** (e.g. point selector dropdown) — required because the right panel may live inside react-grid-layout (CSS transforms break `position: fixed`).
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` exits 0.
2. `cd frontend && pnpm build` exits 0.
3. `cd frontend && pnpm test` exits 0.
4. **Manual:** Open Designer, place a Trend widget. Right panel shows the embedded `ChartConfigPanel` body in the Content tab. Tabs (Type, Points, Scaling, Options) all work.
5. Add a point in the Points tab — the chart in the canvas updates live after 250ms.
6. Drag a slider in Options — the chart updates live (or after 250ms if you opted for the simpler flush-only path).
7. After two distinct edits separated by >250ms, undo (Ctrl+Z) reverts each one independently. After a single rapid edit burst, one undo reverts the whole burst.
8. Switch chart type from Trend (chart01) to Histogram (chart20) — points compatible with Histogram are preserved (the `point` slot is single, so chart01's first series moves into it if role-compatible; otherwise points are dropped). The chart re-renders.
9. Place a content widget (chart50, Text) — the Points tab is hidden in the right panel. (You'll need Phase 04 to land for the palette to actually offer chart50; for this phase, manually edit a saved doc to set `chartType: 50` and verify the Points tab disappears.)
10. The existing modal `ChartConfigPanel` callers still work (open from Trend pane "Configure" button, etc.).

## Phase dependencies

- **Depends on:** Phase 02.
- **Gates:** Phase 04 (palette drops new widgets that auto-open this panel).
