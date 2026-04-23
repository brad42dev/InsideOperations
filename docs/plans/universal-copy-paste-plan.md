# Universal Copy and Paste — Implementation Plan

> **Status:** Phase 12 complete. All phases done.
> **Scope:** Every context in the I/O frontend that has selectable content gains a unified copy/paste model with smart extraction, a dual-slot clipboard, and a "Paste as…" taxonomy.
> **Audience:** This document is written so any single phase can be executed cold by a fresh agent with no prior conversation context. Each phase is self-contained. Every phase reader must first read the Preamble, then jump to their phase section.

---

## Preamble — Full System Design

### What this feature delivers

Today, copy/paste in I/O is designer-only (`frontend/src/shared/graphics/clipboardStore.ts`), operates on `SceneNode[]`, and writes a JSON payload to the system clipboard tagged `source: "io-designer"`. Selection is also fragmented: `selectedNodeIds: Set<NodeId>` in `frontend/src/store/designer/uiStore.ts` for designer; `selectedPaneIds: Set<string>` in `frontend/src/store/selectionStore.ts` for console panes; no selection concept at all elsewhere.

This plan unifies all of that into a single model:

1. **Universal selection** — every context (designer, console pane title bars, console pane contents, alarm rows, logbook rows, forensics hits, expression tiles, table cells) uses the same selection mechanics, the same store, and the same overlay rendering.
2. **Dual-slot clipboard** — system clipboard (via `navigator.clipboard`) is the current slot; one in-memory "previous" slot is kept in a Zustand store.
3. **Smart extraction at paste time** — Ctrl+V silently extracts only what the target context accepts. Chart pasted as source → only points flow; shape-with-bindings pasted into a chart → only the points; same payload pasted into a text field → rendered text.
4. **Paste-as menu** — right-click offers explicit paste modes (Points, Shapes, Style, Style + Layout, Table, Text, New Graphic, Temporary Graphic, Most Recent Alarm(s)). Incompatible modes are greyed out with a context-aware tooltip.

### Keyboard shortcuts

| Shortcut | Effect |
|---|---|
| `Ctrl+C` | Copy selection. Writes JSON payload to system clipboard AND advances IO slot history (previous = old current, current = new copy). |
| `Ctrl+X` | Cut. Same as Ctrl+C followed by delete, where the target context supports deletion. |
| `Ctrl+V` | Paste from system clipboard. Silent smart extraction into target. |
| `Ctrl+Alt+V` | Paste from IO "previous" slot. Same smart extraction. |
| `Ctrl+A` | Select all within the current context zone (see Selection Zones). |
| `Ctrl+Click` | Add / remove from selection. |
| `Shift+Click` | Add to selection (no deselect). |
| `Click + drag` | Marquee select (fully contained only). |
| `Ctrl+Click + drag` | Add marquee to existing selection. |
| `Alt+Click + drag` | Deselect elements fully contained in marquee. |

### Right-click menu structure

Universal sections, present in every right-click menu that targets content:

```
Cut                              Ctrl+X
Copy                             Ctrl+C
Paste                            Ctrl+V        [greyed if incompatible, tooltip explains]
Paste Previous                   Ctrl+Alt+V    [greyed if previous slot is empty or incompatible]
──────────
Paste as…                    ▸
  Points                                        [greyed unless clipboard has points]
  Shapes                                        [greyed unless clipboard has shapes]
  Style                                         [greyed unless clipboard has style]
  Style + Layout                                [greyed unless clipboard has style + layout]
  Table                                         [greyed unless target accepts table]
  Text                                          [always available when clipboard non-empty]
  New Graphic                                   [designer contexts only]
  Temporary Graphic                             [console empty pane only]
  Most Recent Alarm(s)                          [greyed unless clipboard has points]
Paste Previous as…           ▸                  [same submenu, sourced from previous slot]
```

### The IO clipboard payload (v2)

A single JSON shape travels through `navigator.clipboard` for every copy. Any existing v1 designer clipboard is read with a migration path; new copies always emit v2.

```typescript
interface IOClipboardPayload {
  source: "io-clipboard";
  version: "2.0";
  createdAt: string;            // ISO 8601
  originContext: OriginContext; // "designer" | "console-pane" | "chart" | "table" | "alarm-list" | "logbook" | "forensics" | "expression-builder" | "external"
  originGraphicId?: string;     // if originContext === "designer"
  originPaneId?: string;        // if a pane context
  contents: IOClipboardContents;
}

interface IOClipboardContents {
  nodes?: SceneNode[];                     // designer shapes/primitives
  expressions?: Record<string, GraphicExpression>;
  points?: PortablePointRef[];             // tagname-based references (resolved on paste)
  alarms?: PortableAlarmRef[];
  chartConfigs?: ChartConfig[];
  paneConfigs?: PaneConfig[];
  tableRows?: TableRowSnapshot[];
  logEntries?: LogEntrySnapshot[];
  expressionTiles?: ExpressionTileClip[];
  style?: StyleSnapshot;                   // extracted visual props for "Paste as Style"
  layout?: LayoutSnapshot;                 // sidecar positions, display element configs
  textRepresentation: string;              // pre-computed "<Title> - <PointName> - <Value> <EU>"
  originalBounds?: { x: number; y: number; width: number; height: number };
}
```

See **Appendix A** for every sub-type.

### Smart extraction algorithm (Ctrl+V)

At paste time, the target registers a `PasteTarget` (see `frontend/src/shared/clipboard/pasteTargetRegistry.ts`) declaring what it accepts. The paste engine runs:

1. Read clipboard. If not `io-clipboard/2.0`, attempt external fallback (treat as plain text → text field paste; image → image paste into designer).
2. Target's `accepts(payload): PasteMode[]` returns the list of modes the target can do with this payload.
3. Engine picks the most specific compatible mode (priority: "native" > "shapes" > "points" > "table" > "text").
4. Engine calls `target.applyPaste(payload, mode)`.
5. Target handles overflow internally (e.g. chart already has 8 of 8 slots — target validates and surfaces error).

### Selection model

- **Global selection store** (`frontend/src/store/selectionStore.ts` replaces the existing pane-only store). Holds `Map<SelectionZoneId, Set<SelectableEntityId>>`.
- **Selection zones** are hierarchical. Top-level zones: `designer`, `console`, `alarm-list`, `logbook`, `forensics`, `reports`, `expression-builder`. Inside `console`, each pane is its own sub-zone (`console/pane/<paneId>`).
- **Active zone** — the zone that owns keyboard focus. Ctrl+A, Ctrl+C, Ctrl+V all operate against the active zone. Zone activation follows DOM focus + last click.
- **Selection persists across navigation** — navigating from console to designer does NOT clear selection. Clearing is explicit (Escape, or click on empty space inside the active zone).
- **Selectable atoms per context**:
  - Designer: `SceneNode`
  - Console: pane (when title bar is the target), pane content (chart series row, table cell/row, alarm row) when the target is inside the pane body
  - Alarm list: individual alarm rows
  - Logbook: log entry rows, individual cells
  - Forensics: points and time-range hits
  - Expression builder: individual tiles (`ExpressionTile`)
  - Table data: cell (smallest), row if no cells selected
  - Shapes in live views (console graphic pane): existing hover zones become selectable

### Conflict resolution for interactive elements

A selectable element (e.g. a chart series row) may also be interactive (click opens a detail dialog). To resolve conflicts:

1. Interactive elements trigger their normal action on plain click.
2. To **select** an interactive element: click the non-interactive area (whitespace around it), or marquee-select it, or right-click → "Select".
3. Ctrl+Click always selects, never triggers the interactive action.

### Selection indicators

Each zone renders a selection overlay — a transparent positioned `<div>` layer drawn on top of its content. Two visual styles, chosen per context in the zone's config:

- **Soft glow** — CSS `box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15), 0 0 12px 2px var(--accent)` applied to the overlay tile.
- **Selection box** — CSS `outline: 2px solid var(--accent); outline-offset: -1px;` on the overlay tile.

Both use the same container pattern. For zones inside `react-grid-layout`, use `createPortal(overlay, document.body)` — `position: fixed` is broken inside rgl.

### Paste-as modes — full taxonomy

| Mode | What transfers | Valid targets |
|---|---|---|
| `points` | `PortablePointRef[]` only | Charts, tables, logbook, forensics, expression builder, alarm filter, any point picker |
| `shapes` | `SceneNode[]` with bindings stripped | Designer |
| `style` | `StyleSnapshot` (fill, stroke, font, opacity, borderRadius) | Any styled element (designer node, pane, chart area) |
| `style+layout` | `style` + `layout` (sidecar positions, display element configs) | Designer |
| `table` | `tableRows` OR synthesized from `points` + metadata | Table panes, logbook, reports |
| `text` | `textRepresentation` — dash-separated text adapted to what's present | Any text-accepting field |
| `new-graphic` | Entire contents dropped into a freshly created graphic document | Designer home |
| `temporary-graphic` | Contents assembled into a session-only ad-hoc graphic in a console pane | Console empty pane |
| `most-recent-alarms` | Uses clipboard's points as filter criteria against `alarm_events` history | Forensics, reports |

### Text-representation rule

The `textRepresentation` field is pre-computed at copy time by walking whatever is rendered on the source element, in display order, joined with ` - `:

- `<Title> - <PointName> - <DisplayName> - <Value> <EU>`
- If only a value is rendered: `<Value>`
- If a shape has a title zone + two text zones: join all three.
- Format adapts — omit fields that are absent; never emit empty dashes.

### RBAC

Live data bindings respect existing RBAC at data-fetch time — no special clipboard-layer RBAC. Static/text paste is unrestricted. The expression-builder aggregate-hides-blocked-data edge case is out of scope for this plan.

### Overflow handling

Paste ALL items into the target — do not truncate silently. The target's existing validation (e.g. "Max 8 series" on charts) surfaces the overflow error via its normal toast/dialog path. If the target has no validation, all items land and the user sees them.

### Phasing

1. Type system + unified clipboard payload types
2. Global selection store
3. Unified clipboard store + extraction utilities
4. Paste target registry + right-click menu infrastructure
5. Selection UI layer
6. Designer full implementation
7. Console full implementation
8. Expression builder integration
9. Universal paste-as menu (remaining modes)
10. Remaining contexts: alarm viewer, logbook, forensics, reports
11. Paste Previous slot + Ctrl+Alt+V + "Paste Previous as…"
12. Polish: overflow validation, tooltip copy, acceptance testing

---

## Phase 1 — Type System and Clipboard Payload Types

### Goal
Define every new type required by the feature in one place. No UI changes, no behavior changes, no imports from these new types yet. This is the bedrock every subsequent phase depends on. After this phase the project compiles cleanly with the new type module exporting all clipboard, selection, and paste-target shapes.

### Context for this phase
- `frontend/src/shared/types/graphics.ts` already defines `ClipboardData` (the v1 designer-only shape) — keep it; do not delete. New types live alongside.
- `frontend/src/shared/types/expression.ts` defines `ExpressionTile`, `ExprNode`, `ExpressionAst` — used by the `expressionTiles` clip content.
- `frontend/src/api/points.ts` defines `PointMeta`, `PointDetail`. Import as type-only.
- `frontend/src/api/alarms.ts` defines `AlarmDefinition`, `AlarmEvent`.
- `frontend/src/pages/console/types.ts` defines `WorkspaceLayout`, `PaneConfig`, `ChartConfig`, `ChartPointSlot`.
- No prior phase exists. This is the first phase.

### Files to create

**`frontend/src/shared/clipboard/types.ts`** — new module. Export every type listed in Appendix A. In particular:

```typescript
import type {
  SceneNode,
  GraphicExpression,
} from "../types/graphics";
import type { ChartConfig, PaneConfig } from "../../pages/console/types";
import type { ExpressionTile } from "../types/expression";

export type OriginContext =
  | "designer"
  | "console-pane"
  | "chart"
  | "table"
  | "alarm-list"
  | "logbook"
  | "forensics"
  | "expression-builder"
  | "external";

export type PasteMode =
  | "native"
  | "points"
  | "shapes"
  | "style"
  | "style+layout"
  | "table"
  | "text"
  | "new-graphic"
  | "temporary-graphic"
  | "most-recent-alarms";

export interface PortablePointRef {
  tagname: string;
  displayName?: string;
  unit?: string;
  dataType?: string;
  pointCategory?: string;
  euRangeLow?: number;
  euRangeHigh?: number;
}

export interface PortableAlarmRef {
  tagname: string;
  severity?: string;
  priority?: number;
  lastEventAt?: string;
}

export interface TableRowSnapshot {
  columns: string[];
  values: (string | number | null)[];
  sourceRefs?: { tagname?: string; rowId?: string };
}

export interface LogEntrySnapshot {
  id: string;
  timestamp: string;
  tagname: string;
  value: string | number | null;
  unit?: string;
  createdBy?: string;
  notes?: string;
}

export interface ExpressionTileClip {
  tiles: ExpressionTile[];        // full subtree, any number of roots
  connectorHints?: Array<{ fromTileId: string; toTileId: string }>;
}

export interface StyleSnapshot {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  borderRadius?: number;
  backgroundColor?: string;
}

export interface LayoutSnapshot {
  sidecarPositions?: Record<string, { x: number; y: number; rotation?: number }>;
  displayElementConfigs?: Record<string, unknown>; // opaque blob per element id
}

export interface IOClipboardContents {
  nodes?: SceneNode[];
  expressions?: Record<string, GraphicExpression>;
  points?: PortablePointRef[];
  alarms?: PortableAlarmRef[];
  chartConfigs?: ChartConfig[];
  paneConfigs?: PaneConfig[];
  tableRows?: TableRowSnapshot[];
  logEntries?: LogEntrySnapshot[];
  expressionTiles?: ExpressionTileClip[];
  style?: StyleSnapshot;
  layout?: LayoutSnapshot;
  textRepresentation: string;
  originalBounds?: { x: number; y: number; width: number; height: number };
}

export interface IOClipboardPayload {
  source: "io-clipboard";
  version: "2.0";
  createdAt: string;
  originContext: OriginContext;
  originGraphicId?: string;
  originPaneId?: string;
  contents: IOClipboardContents;
}

// ----- Selection types -----

export type SelectionZoneId =
  | "designer"
  | "console"
  | `console/pane/${string}`
  | "alarm-list"
  | "logbook"
  | "forensics"
  | "reports"
  | "expression-builder";

export type SelectableEntityKind =
  | "scene-node"
  | "pane"
  | "chart-series-row"
  | "table-cell"
  | "table-row"
  | "alarm-row"
  | "log-entry"
  | "expression-tile"
  | "forensics-hit";

export interface SelectableEntity {
  id: string;                       // locally unique within zone
  zoneId: SelectionZoneId;
  kind: SelectableEntityKind;
  // Opaque payload used by copy handlers — the kind determines its shape.
  payload?: unknown;
}

export type SelectionIndicatorStyle = "soft-glow" | "selection-box";

export interface SelectionZoneConfig {
  zoneId: SelectionZoneId;
  indicatorStyle: SelectionIndicatorStyle;
  /** When true, Ctrl+A selects every registered entity in this zone. */
  supportsSelectAll: boolean;
}

// ----- Paste target registry types -----

export interface PasteTarget {
  /** Unique id; typically the DOM element or zone id. */
  id: string;
  /** Zone this target belongs to. */
  zoneId: SelectionZoneId;
  /** Priority when multiple targets resolve — highest wins. */
  priority: number;
  /** Inspect payload; return which modes this target can fulfill, best first. */
  accepts(payload: IOClipboardPayload | null): PasteMode[];
  /** Render an action. Engine calls this once `accepts` returns a mode. */
  applyPaste(payload: IOClipboardPayload, mode: PasteMode): Promise<void> | void;
  /** Tooltip shown on greyed "Paste" menu items. */
  describeRejection?(payload: IOClipboardPayload | null): string;
}

// ----- Legacy compatibility helpers -----

import type { ClipboardData } from "../types/graphics";

/** Detect v1 designer clipboard shape. */
export function isLegacyDesignerClipboard(
  value: unknown,
): value is ClipboardData {
  const v = value as ClipboardData | null | undefined;
  return !!v && (v as { source?: unknown }).source === "io-designer";
}

/** Narrow unknown → IOClipboardPayload v2. */
export function isIOClipboardPayload(
  value: unknown,
): value is IOClipboardPayload {
  const v = value as IOClipboardPayload | null | undefined;
  return (
    !!v &&
    v.source === "io-clipboard" &&
    v.version === "2.0" &&
    !!v.contents &&
    typeof v.contents.textRepresentation === "string"
  );
}
```

**`frontend/src/shared/clipboard/index.ts`** — barrel file re-exporting everything from `./types`. This is the canonical import path for downstream phases.

### Files to modify

**`frontend/src/shared/types/graphics.ts`** — add at the very bottom (after the existing `ClipboardData` interface):

```typescript
/**
 * @deprecated Use IOClipboardPayload from shared/clipboard/types.
 * Retained for read-compatibility with v1 clipboards already written to the
 * system clipboard by earlier builds.
 */
export interface ClipboardDataV1 extends ClipboardData {}
```

Do not remove or change the existing `ClipboardData` definition.

### Implementation notes
- All new types must be `export type` / `export interface`, no classes, no runtime code beyond the two narrowing helpers.
- Do not import from any file outside `shared/types`, `api/`, and `pages/console/types`. The clipboard module must remain a leaf in the dependency graph at this phase.
- Do NOT export anything from a `shared/clipboard/store` file yet — that comes in Phase 3.
- Do NOT touch `clipboardStore.ts` yet.
- Do NOT wire any behavior.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds with no new errors.
- `cd frontend && pnpm lint` is clean.
- `grep -r "from \"@/shared/clipboard\"" frontend/src` returns no hits (nothing consumes these types yet).
- `frontend/src/shared/clipboard/types.ts` exists and exports every symbol listed above.
- `isIOClipboardPayload({ source: "io-clipboard", version: "2.0", contents: { textRepresentation: "" } } as unknown)` returns `true` when tested manually in a scratch file (optional sanity check).

---

## Phase 2 — Global Selection Store

### Goal
Introduce a single Zustand store that tracks selection state across every zone in the app (`designer`, `console`, each console pane, `alarm-list`, `logbook`, `forensics`, `reports`, `expression-builder`). The two existing selection stores (`designer/uiStore.selectedNodeIds` and `selectionStore.selectedPaneIds`) continue to work; this new store layers over them and becomes the source of truth for clipboard operations. Downstream phases migrate the existing stores to delegate here.

### Context for this phase
- Phase 1 created `frontend/src/shared/clipboard/types.ts` with `SelectionZoneId`, `SelectableEntity`, `SelectableEntityKind`, `SelectionIndicatorStyle`, `SelectionZoneConfig`. Import from `@/shared/clipboard`.
- `frontend/src/store/designer/uiStore.ts` holds `selectedNodeIds: Set<NodeId>` and `setSelectedNodeIds(ids)` / `toggleNodeSelection(id)` / `clearSelection()`. Do NOT modify this file in this phase — just ensure the new store can coexist. Migration is a later-phase concern.
- `frontend/src/store/selectionStore.ts` holds `selectedPaneIds: Set<string>` today. This file will be **renamed in effect** — we write the new global store to `frontend/src/store/globalSelectionStore.ts` and leave the old one alone. Phase 7 will migrate console-pane selection to the new store.

### Files to create

**`frontend/src/store/globalSelectionStore.ts`** — new module.

```typescript
import { create } from "zustand";
import type {
  SelectionZoneId,
  SelectableEntity,
  SelectionZoneConfig,
} from "../shared/clipboard";

interface ZoneState {
  config: SelectionZoneConfig;
  selected: Map<string, SelectableEntity>; // entity.id -> entity
  anchor: string | null;                    // last-clicked id, for shift-range (optional)
}

interface GlobalSelectionState {
  zones: Map<SelectionZoneId, ZoneState>;
  activeZone: SelectionZoneId | null;

  // --- zone lifecycle ---
  registerZone(config: SelectionZoneConfig): void;
  unregisterZone(zoneId: SelectionZoneId): void;
  setActiveZone(zoneId: SelectionZoneId | null): void;

  // --- selection ops (scoped to a zone) ---
  select(zoneId: SelectionZoneId, entity: SelectableEntity, mode?: "replace" | "add" | "toggle" | "remove"): void;
  selectMany(zoneId: SelectionZoneId, entities: SelectableEntity[], mode?: "replace" | "add" | "toggle" | "remove"): void;
  selectAll(zoneId: SelectionZoneId, entities: SelectableEntity[]): void;
  clearZone(zoneId: SelectionZoneId): void;
  clearAll(): void;

  // --- queries ---
  getSelection(zoneId: SelectionZoneId): SelectableEntity[];
  getActiveSelection(): { zoneId: SelectionZoneId; entities: SelectableEntity[] } | null;
  isSelected(zoneId: SelectionZoneId, entityId: string): boolean;
  selectionCount(zoneId: SelectionZoneId): number;
}

export const useGlobalSelectionStore = create<GlobalSelectionState>((set, get) => ({
  zones: new Map(),
  activeZone: null,

  registerZone(config) {
    set((s) => {
      const next = new Map(s.zones);
      if (!next.has(config.zoneId)) {
        next.set(config.zoneId, {
          config,
          selected: new Map(),
          anchor: null,
        });
      } else {
        // Update config if already registered (e.g., indicator style change).
        const existing = next.get(config.zoneId)!;
        next.set(config.zoneId, { ...existing, config });
      }
      return { zones: next };
    });
  },

  unregisterZone(zoneId) {
    set((s) => {
      const next = new Map(s.zones);
      next.delete(zoneId);
      return {
        zones: next,
        activeZone: s.activeZone === zoneId ? null : s.activeZone,
      };
    });
  },

  setActiveZone(zoneId) {
    set({ activeZone: zoneId });
  },

  select(zoneId, entity, mode = "replace") {
    set((s) => {
      const zone = s.zones.get(zoneId);
      if (!zone) return {};
      const nextSelected = new Map(zone.selected);
      if (mode === "replace") {
        nextSelected.clear();
        nextSelected.set(entity.id, entity);
      } else if (mode === "add") {
        nextSelected.set(entity.id, entity);
      } else if (mode === "toggle") {
        if (nextSelected.has(entity.id)) nextSelected.delete(entity.id);
        else nextSelected.set(entity.id, entity);
      } else if (mode === "remove") {
        nextSelected.delete(entity.id);
      }
      const nextZones = new Map(s.zones);
      nextZones.set(zoneId, { ...zone, selected: nextSelected, anchor: entity.id });
      return { zones: nextZones };
    });
  },

  selectMany(zoneId, entities, mode = "replace") {
    set((s) => {
      const zone = s.zones.get(zoneId);
      if (!zone) return {};
      const nextSelected = new Map(zone.selected);
      if (mode === "replace") nextSelected.clear();
      for (const e of entities) {
        if (mode === "remove") nextSelected.delete(e.id);
        else if (mode === "toggle") {
          if (nextSelected.has(e.id)) nextSelected.delete(e.id);
          else nextSelected.set(e.id, e);
        } else nextSelected.set(e.id, e);
      }
      const nextZones = new Map(s.zones);
      nextZones.set(zoneId, {
        ...zone,
        selected: nextSelected,
        anchor: entities.length ? entities[entities.length - 1].id : zone.anchor,
      });
      return { zones: nextZones };
    });
  },

  selectAll(zoneId, entities) {
    get().selectMany(zoneId, entities, "replace");
  },

  clearZone(zoneId) {
    set((s) => {
      const zone = s.zones.get(zoneId);
      if (!zone) return {};
      const nextZones = new Map(s.zones);
      nextZones.set(zoneId, { ...zone, selected: new Map(), anchor: null });
      return { zones: nextZones };
    });
  },

  clearAll() {
    set((s) => {
      const nextZones = new Map<SelectionZoneId, ZoneState>();
      for (const [id, zone] of s.zones) {
        nextZones.set(id, { ...zone, selected: new Map(), anchor: null });
      }
      return { zones: nextZones };
    });
  },

  getSelection(zoneId) {
    const zone = get().zones.get(zoneId);
    return zone ? Array.from(zone.selected.values()) : [];
  },

  getActiveSelection() {
    const { activeZone, zones } = get();
    if (!activeZone) return null;
    const zone = zones.get(activeZone);
    if (!zone) return null;
    return { zoneId: activeZone, entities: Array.from(zone.selected.values()) };
  },

  isSelected(zoneId, entityId) {
    const zone = get().zones.get(zoneId);
    return !!zone && zone.selected.has(entityId);
  },

  selectionCount(zoneId) {
    const zone = get().zones.get(zoneId);
    return zone ? zone.selected.size : 0;
  },
}));
```

**`frontend/src/store/useSelectionZone.ts`** — React hook helper.

```typescript
import { useEffect } from "react";
import type { SelectionZoneConfig } from "../shared/clipboard";
import { useGlobalSelectionStore } from "./globalSelectionStore";

/**
 * Register a selection zone on mount and unregister on unmount.
 * Returns selectors for the zone's current selection plus action helpers.
 */
export function useSelectionZone(config: SelectionZoneConfig) {
  const register = useGlobalSelectionStore((s) => s.registerZone);
  const unregister = useGlobalSelectionStore((s) => s.unregisterZone);

  useEffect(() => {
    register(config);
    return () => unregister(config.zoneId);
    // Intentionally re-register only if zoneId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.zoneId]);

  const selection = useGlobalSelectionStore(
    (s) => s.zones.get(config.zoneId)?.selected,
  );
  return {
    selection: selection ? Array.from(selection.values()) : [],
    isSelected: (id: string) =>
      useGlobalSelectionStore.getState().isSelected(config.zoneId, id),
  };
}
```

### Files to modify

None. Old stores remain untouched in this phase.

### Implementation notes
- Use a `Map` (not `Set`) per zone so the store holds the full `SelectableEntity` payload, not just the id. Downstream code needs the payload for copy handlers (shape node, chart series row data, etc.).
- Do NOT apply `zundo` / temporal wrapper to this store — selection should not participate in undo/redo.
- This store is intentionally decoupled from the old `uiStore.selectedNodeIds` in designer. Phase 6 migrates designer to push into both (old for backward compatibility during migration; new for clipboard ops) and Phase 7 does the same for console panes.
- The `anchor` field is scaffolded for future shift-range selection in list contexts but is not required reading for any phase in this plan.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- `useGlobalSelectionStore.getState()` returns an object with all expected methods (verify in dev console if desired).
- `useSelectionZone({ zoneId: "designer", indicatorStyle: "selection-box", supportsSelectAll: true })` in a test component triggers `registerZone` on mount and `unregisterZone` on unmount (add a console.log in the store's set calls to verify once).
- No existing behavior is changed: designer selection still works, console pane selection still works.

---

## Phase 3 — Unified Clipboard Store and Extraction Utilities

### Goal
Replace the designer-only `frontend/src/shared/graphics/clipboardStore.ts` with a universal clipboard store that holds **current** and **previous** IO clipboard slots, reads/writes the system clipboard in v2 format, and exposes smart extraction utilities (`extractAs(payload, mode)`) callable by any paste target. Legacy v1 clipboards are read and migrated on the fly.

### Context for this phase
- Phase 1 provided `IOClipboardPayload`, `IOClipboardContents`, `PasteMode`, `isIOClipboardPayload`, `isLegacyDesignerClipboard` in `@/shared/clipboard`.
- Phase 2 provided the selection store (not yet integrated here — this phase is independent of selection).
- `frontend/src/shared/graphics/clipboardStore.ts` exists and is imported by `DesignerCanvas.tsx` and possibly commands. Do NOT delete it yet — deprecate by replacing its implementation with a thin adapter that forwards to the new store.

### Files to create

**`frontend/src/shared/clipboard/clipboardStore.ts`** — new universal store.

```typescript
import { create } from "zustand";
import type { IOClipboardPayload, PasteMode } from "./types";
import { isIOClipboardPayload, isLegacyDesignerClipboard } from "./types";
import { migrateLegacyClipboard } from "./migrateLegacyClipboard";

interface ClipboardStoreState {
  current: IOClipboardPayload | null;    // mirror of last write to system clipboard
  previous: IOClipboardPayload | null;   // one step back, in-memory only

  writeToClipboard(payload: IOClipboardPayload): Promise<void>;
  readFromSystemClipboard(): Promise<IOClipboardPayload | null>;
  getCurrent(): IOClipboardPayload | null;
  getPrevious(): IOClipboardPayload | null;
  clear(): void;
}

export const useIOClipboardStore = create<ClipboardStoreState>((set, get) => ({
  current: null,
  previous: null,

  async writeToClipboard(payload) {
    // Advance history: previous = old current, current = new payload
    set((s) => ({ previous: s.current, current: payload }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      // swallow — store still holds current payload for Ctrl+V fallback
    }
  },

  async readFromSystemClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return get().current;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return null; // non-JSON system clipboard (plain text) — caller handles
      }
      if (isIOClipboardPayload(parsed)) return parsed;
      if (isLegacyDesignerClipboard(parsed)) return migrateLegacyClipboard(parsed);
      return null; // foreign JSON
    } catch {
      return get().current;
    }
  },

  getCurrent() {
    return get().current;
  },

  getPrevious() {
    return get().previous;
  },

  clear() {
    set({ current: null, previous: null });
  },
}));
```

**`frontend/src/shared/clipboard/migrateLegacyClipboard.ts`** — convert v1 → v2.

```typescript
import type { ClipboardData } from "../types/graphics";
import type { IOClipboardPayload } from "./types";
import { computeTextRepresentation } from "./extract";

export function migrateLegacyClipboard(v1: ClipboardData): IOClipboardPayload {
  return {
    source: "io-clipboard",
    version: "2.0",
    createdAt: new Date().toISOString(),
    originContext: "designer",
    originGraphicId: v1.sourceGraphicId,
    contents: {
      nodes: v1.nodes,
      expressions: v1.expressions,
      originalBounds: v1.originalBounds,
      textRepresentation: computeTextRepresentation({ nodes: v1.nodes }),
    },
  };
}
```

**`frontend/src/shared/clipboard/extract.ts`** — extraction utilities.

```typescript
import type {
  IOClipboardPayload,
  IOClipboardContents,
  PasteMode,
  PortablePointRef,
  StyleSnapshot,
  LayoutSnapshot,
  TableRowSnapshot,
} from "./types";
import type { SceneNode } from "../types/graphics";

/** Does the payload contain usable data of the given kind? */
export function hasKind(payload: IOClipboardPayload | null, mode: PasteMode): boolean {
  if (!payload) return false;
  const c = payload.contents;
  switch (mode) {
    case "points":
      return !!c.points?.length || !!extractPointsFromNodes(c.nodes ?? []).length;
    case "shapes":
      return !!c.nodes?.length;
    case "style":
      return !!c.style || !!extractStyleFromNodes(c.nodes ?? []);
    case "style+layout":
      return !!c.style && !!c.layout;
    case "table":
      return !!c.tableRows?.length || !!c.points?.length;
    case "text":
      return !!c.textRepresentation;
    case "most-recent-alarms":
      return !!c.points?.length;
    case "new-graphic":
    case "temporary-graphic":
    case "native":
      return true;
  }
}

/** Produce a list of points from either explicit points or bound nodes. */
export function extractPoints(payload: IOClipboardPayload): PortablePointRef[] {
  const explicit = payload.contents.points ?? [];
  if (explicit.length) return explicit;
  return extractPointsFromNodes(payload.contents.nodes ?? []);
}

export function extractPointsFromNodes(nodes: SceneNode[]): PortablePointRef[] {
  const out: PortablePointRef[] = [];
  const seen = new Set<string>();
  const visit = (n: SceneNode) => {
    // DisplayElement children are the typical host of bindings.
    // Cast to any to peek at binding fields; types already allow this at runtime.
    const binding = (n as unknown as { binding?: { pointTag?: string; displayName?: string; unit?: string } }).binding;
    if (binding?.pointTag && !seen.has(binding.pointTag)) {
      seen.add(binding.pointTag);
      out.push({
        tagname: binding.pointTag,
        displayName: binding.displayName,
        unit: binding.unit,
      });
    }
    const children = (n as unknown as { children?: SceneNode[] }).children;
    if (Array.isArray(children)) children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

/** Collapse the first node with style into a StyleSnapshot. */
export function extractStyleFromNodes(nodes: SceneNode[]): StyleSnapshot | undefined {
  for (const n of nodes) {
    const s = (n as unknown as { style?: StyleSnapshot }).style;
    if (s && Object.keys(s).length) return s;
  }
  return undefined;
}

/** Strip bindings from a list of nodes — for Paste as Shapes. */
export function stripBindings<T extends SceneNode>(nodes: T[]): T[] {
  return JSON.parse(JSON.stringify(nodes), (k, v) => {
    if (k === "binding") return undefined;
    if (k === "expressionId") return undefined;
    return v;
  });
}

/** Build a tableRows list from points if no explicit table snapshot exists. */
export function synthesizeTableFromPoints(points: PortablePointRef[]): TableRowSnapshot[] {
  return points.map((p) => ({
    columns: ["Tagname", "Display Name", "Unit"],
    values: [p.tagname, p.displayName ?? "", p.unit ?? ""],
    sourceRefs: { tagname: p.tagname },
  }));
}

/** Compute a dash-joined human text representation from any subset of contents. */
export function computeTextRepresentation(contents: Partial<IOClipboardContents>): string {
  const parts: string[] = [];
  const firstPoint = contents.points?.[0] ?? extractPointsFromNodes(contents.nodes ?? [])[0];
  if (firstPoint?.displayName) parts.push(firstPoint.displayName);
  if (firstPoint?.tagname) parts.push(firstPoint.tagname);
  // Further enrichments happen at copy-site; this is the safe baseline.
  return parts.filter(Boolean).join(" - ");
}
```

**`frontend/src/shared/clipboard/buildPayload.ts`** — helper used by copy handlers across contexts.

```typescript
import type {
  IOClipboardPayload,
  IOClipboardContents,
  OriginContext,
} from "./types";

export interface BuildPayloadInput {
  originContext: OriginContext;
  originGraphicId?: string;
  originPaneId?: string;
  contents: Omit<IOClipboardContents, "textRepresentation"> & {
    textRepresentation?: string;
  };
}

export function buildIOClipboardPayload(
  input: BuildPayloadInput,
): IOClipboardPayload {
  const textRepresentation = input.contents.textRepresentation ?? "";
  return {
    source: "io-clipboard",
    version: "2.0",
    createdAt: new Date().toISOString(),
    originContext: input.originContext,
    originGraphicId: input.originGraphicId,
    originPaneId: input.originPaneId,
    contents: { ...input.contents, textRepresentation },
  };
}
```

### Files to modify

**`frontend/src/shared/clipboard/index.ts`** — re-export the new modules:

```typescript
export * from "./types";
export * from "./clipboardStore";
export * from "./extract";
export * from "./buildPayload";
```

**`frontend/src/shared/graphics/clipboardStore.ts`** — convert to a thin compatibility shim. Replace entire file contents with:

```typescript
/**
 * @deprecated Compatibility shim. New code must use
 * `@/shared/clipboard` (useIOClipboardStore).
 *
 * This file preserves the v1 designer-only API used by existing callers
 * (DesignerCanvas, commands) until Phase 6 migrates them.
 */
import { create } from "zustand";
import type { ClipboardData, SceneNode } from "../types/graphics";
import { useIOClipboardStore } from "../clipboard";
import { buildIOClipboardPayload } from "../clipboard";
import { computeTextRepresentation, extractPointsFromNodes } from "../clipboard";

interface ClipboardState {
  data: ClipboardData | null;
  copy: (nodes: SceneNode[], sourceGraphicId: string) => void;
  clear: () => void;
}

function computeBounds(nodes: SceneNode[]) {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const { x, y } = n.transform.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  data: null,
  copy(nodes, sourceGraphicId) {
    const bounds = computeBounds(nodes);
    const legacy: ClipboardData = {
      source: "io-designer",
      version: "1.0",
      sourceGraphicId,
      nodes: JSON.parse(JSON.stringify(nodes)),
      expressions: {},
      originalBounds: bounds,
    };
    set({ data: legacy });

    // Forward to the universal store + system clipboard in v2 format.
    const payload = buildIOClipboardPayload({
      originContext: "designer",
      originGraphicId: sourceGraphicId,
      contents: {
        nodes: legacy.nodes,
        expressions: legacy.expressions,
        originalBounds: bounds,
        textRepresentation: computeTextRepresentation({ nodes: legacy.nodes }),
        points: extractPointsFromNodes(legacy.nodes),
      },
    });
    void useIOClipboardStore.getState().writeToClipboard(payload);
  },
  clear() {
    set({ data: null });
  },
}));

export async function readClipboard(fallback: ClipboardData | null): Promise<ClipboardData | null> {
  const payload = await useIOClipboardStore.getState().readFromSystemClipboard();
  if (payload?.contents.nodes?.length) {
    return {
      source: "io-designer",
      version: "1.0",
      sourceGraphicId: payload.originGraphicId ?? "",
      nodes: payload.contents.nodes,
      expressions: payload.contents.expressions ?? {},
      originalBounds: payload.contents.originalBounds ?? { x: 0, y: 0, width: 0, height: 0 },
    };
  }
  return fallback;
}
```

### Implementation notes
- The legacy shim keeps `DesignerCanvas.tsx` and `commands.ts` working without changes in this phase. Phase 6 cuts over designer fully.
- `writeToClipboard` never throws — it silently fails if the browser denies clipboard access (happens when the page isn't focused or in insecure contexts). The in-memory slot still advances.
- Do NOT read `navigator.clipboard` synchronously anywhere; always `await`.
- The store is a singleton module-level Zustand store — not put on React context — so non-React code (commands, keyboard handlers, right-click menu items) can call `useIOClipboardStore.getState()` directly.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- In designer, selecting a shape and pressing Ctrl+C still works and still places a v1-shaped `ClipboardData` in `useClipboardStore.getState().data`, AND `useIOClipboardStore.getState().current` is a v2 `IOClipboardPayload` with `originContext: "designer"`.
- `await navigator.clipboard.readText()` after Ctrl+C returns a JSON string that parses to `{ source: "io-clipboard", version: "2.0", ... }`.
- Pasting in designer still works.

---

## Phase 4 — Paste Target Registry and Right-Click Menu Infrastructure

### Goal
Provide the runtime plumbing every subsequent phase uses: a module-level registry where any UI component can register a `PasteTarget`, the engine that resolves `accepts()` against the current clipboard, and a reusable `<ClipboardContextMenu>` component that renders the universal Cut/Copy/Paste/Paste as… structure with proper greying and tooltips. The menu itself performs no context-specific work — it calls into registered targets.

### Context for this phase
- Phase 1 types: `PasteTarget`, `PasteMode`, `IOClipboardPayload`.
- Phase 2 selection store: `useGlobalSelectionStore` with `activeZone` and `getActiveSelection()`.
- Phase 3 clipboard store: `useIOClipboardStore` with `current`, `previous`, `writeToClipboard`, `readFromSystemClipboard`.
- The app already uses Radix for menus (see `frontend/src/pages/console/ConsolePageGrid.tsx` and similar). Reuse the existing Radix DropdownMenu / ContextMenu components wrapped in the app's design tokens.
- `position: fixed` is broken inside react-grid-layout — use `createPortal(el, document.body)` for menus rendered inside a pane.

### Files to create

**`frontend/src/shared/clipboard/pasteTargetRegistry.ts`** — non-React registry.

```typescript
import type { IOClipboardPayload, PasteMode, PasteTarget, SelectionZoneId } from "./types";

const targets = new Map<string, PasteTarget>();

export function registerPasteTarget(target: PasteTarget): () => void {
  targets.set(target.id, target);
  return () => {
    if (targets.get(target.id) === target) targets.delete(target.id);
  };
}

/** Return the highest-priority target registered for a zone, if any. */
export function findTargetForZone(zoneId: SelectionZoneId): PasteTarget | null {
  let best: PasteTarget | null = null;
  for (const t of targets.values()) {
    if (t.zoneId !== zoneId) continue;
    if (!best || t.priority > best.priority) best = t;
  }
  return best;
}

/** List every target in a zone (for debug / fallback resolution). */
export function listTargetsForZone(zoneId: SelectionZoneId): PasteTarget[] {
  return Array.from(targets.values())
    .filter((t) => t.zoneId === zoneId)
    .sort((a, b) => b.priority - a.priority);
}

export function resolveModes(
  target: PasteTarget,
  payload: IOClipboardPayload | null,
): PasteMode[] {
  return target.accepts(payload);
}

/** Best single mode for silent Ctrl+V — first in the target's accepts list. */
export function pickDefaultMode(
  target: PasteTarget,
  payload: IOClipboardPayload | null,
): PasteMode | null {
  const modes = target.accepts(payload);
  return modes[0] ?? null;
}
```

**`frontend/src/shared/clipboard/usePasteTarget.ts`** — React hook.

```typescript
import { useEffect } from "react";
import type { PasteTarget } from "./types";
import { registerPasteTarget } from "./pasteTargetRegistry";

export function usePasteTarget(target: PasteTarget | null) {
  useEffect(() => {
    if (!target) return;
    return registerPasteTarget(target);
  }, [target]);
}
```

**`frontend/src/shared/clipboard/usePasteEngine.ts`** — orchestration hook.

```typescript
import { useCallback } from "react";
import { useIOClipboardStore } from "./clipboardStore";
import { useGlobalSelectionStore } from "../../store/globalSelectionStore";
import { findTargetForZone, pickDefaultMode } from "./pasteTargetRegistry";
import type { PasteMode } from "./types";

export function usePasteEngine() {
  const read = useIOClipboardStore((s) => s.readFromSystemClipboard);
  const getPrevious = useIOClipboardStore((s) => s.getPrevious);

  const pasteDefault = useCallback(async (): Promise<boolean> => {
    const payload = await read();
    const zoneId = useGlobalSelectionStore.getState().activeZone;
    if (!zoneId) return false;
    const target = findTargetForZone(zoneId);
    if (!target || !payload) return false;
    const mode = pickDefaultMode(target, payload);
    if (!mode) return false;
    await target.applyPaste(payload, mode);
    return true;
  }, [read]);

  const pastePrevious = useCallback(async (): Promise<boolean> => {
    const payload = getPrevious();
    const zoneId = useGlobalSelectionStore.getState().activeZone;
    if (!zoneId) return false;
    const target = findTargetForZone(zoneId);
    if (!target || !payload) return false;
    const mode = pickDefaultMode(target, payload);
    if (!mode) return false;
    await target.applyPaste(payload, mode);
    return true;
  }, [getPrevious]);

  const pasteAs = useCallback(async (mode: PasteMode, source: "current" | "previous" = "current"): Promise<boolean> => {
    const payload = source === "current" ? await read() : getPrevious();
    const zoneId = useGlobalSelectionStore.getState().activeZone;
    if (!zoneId || !payload) return false;
    const target = findTargetForZone(zoneId);
    if (!target) return false;
    if (!target.accepts(payload).includes(mode)) return false;
    await target.applyPaste(payload, mode);
    return true;
  }, [read, getPrevious]);

  return { pasteDefault, pastePrevious, pasteAs };
}
```

**`frontend/src/shared/clipboard/ClipboardContextMenu.tsx`** — reusable menu block.

```tsx
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useEffect, useState } from "react";
import { useIOClipboardStore } from "./clipboardStore";
import { findTargetForZone } from "./pasteTargetRegistry";
import { usePasteEngine } from "./usePasteEngine";
import type { IOClipboardPayload, PasteMode, SelectionZoneId } from "./types";

interface Props {
  zoneId: SelectionZoneId;
  onCopy: () => void;
  onCut?: () => void;
  /** Additional items rendered BELOW the universal section. */
  children?: React.ReactNode;
}

const PASTE_AS_ORDER: { mode: PasteMode; label: string }[] = [
  { mode: "points", label: "Points" },
  { mode: "shapes", label: "Shapes" },
  { mode: "style", label: "Style" },
  { mode: "style+layout", label: "Style + Layout" },
  { mode: "table", label: "Table" },
  { mode: "text", label: "Text" },
  { mode: "new-graphic", label: "New Graphic" },
  { mode: "temporary-graphic", label: "Temporary Graphic" },
  { mode: "most-recent-alarms", label: "Most Recent Alarm(s)" },
];

export function ClipboardContextMenu({ zoneId, onCopy, onCut, children }: Props) {
  const [currentPayload, setCurrentPayload] = useState<IOClipboardPayload | null>(null);
  const previous = useIOClipboardStore((s) => s.previous);
  const { pasteDefault, pastePrevious, pasteAs } = usePasteEngine();

  useEffect(() => {
    void useIOClipboardStore.getState().readFromSystemClipboard().then(setCurrentPayload);
  }, []);

  const target = findTargetForZone(zoneId);
  const currentModes = target && currentPayload ? target.accepts(currentPayload) : [];
  const previousModes = target && previous ? target.accepts(previous) : [];

  const pasteDisabled = !target || !currentPayload || currentModes.length === 0;
  const pastePrevDisabled = !target || !previous || previousModes.length === 0;

  return (
    <ContextMenu.Content className="io-context-menu">
      <ContextMenu.Item onSelect={() => onCut?.()} disabled={!onCut}>
        Cut <span className="shortcut">Ctrl+X</span>
      </ContextMenu.Item>
      <ContextMenu.Item onSelect={onCopy}>
        Copy <span className="shortcut">Ctrl+C</span>
      </ContextMenu.Item>
      <ContextMenu.Item
        onSelect={() => void pasteDefault()}
        disabled={pasteDisabled}
        title={pasteDisabled ? rejectionText(target, currentPayload) : undefined}
      >
        Paste <span className="shortcut">Ctrl+V</span>
      </ContextMenu.Item>
      <ContextMenu.Item
        onSelect={() => void pastePrevious()}
        disabled={pastePrevDisabled}
        title={pastePrevDisabled ? rejectionText(target, previous) : undefined}
      >
        Paste Previous <span className="shortcut">Ctrl+Alt+V</span>
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger>Paste as…</ContextMenu.SubTrigger>
        <ContextMenu.SubContent>
          {PASTE_AS_ORDER.map(({ mode, label }) => {
            const available = currentModes.includes(mode);
            return (
              <ContextMenu.Item
                key={mode}
                disabled={!available}
                onSelect={() => void pasteAs(mode, "current")}
                title={!available ? `Clipboard has no ${label.toLowerCase()} data` : undefined}
              >
                {label}
              </ContextMenu.Item>
            );
          })}
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger disabled={!previous}>Paste Previous as…</ContextMenu.SubTrigger>
        <ContextMenu.SubContent>
          {PASTE_AS_ORDER.map(({ mode, label }) => {
            const available = previousModes.includes(mode);
            return (
              <ContextMenu.Item
                key={mode}
                disabled={!available}
                onSelect={() => void pasteAs(mode, "previous")}
              >
                {label}
              </ContextMenu.Item>
            );
          })}
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
      {children ? (
        <>
          <ContextMenu.Separator />
          {children}
        </>
      ) : null}
    </ContextMenu.Content>
  );
}

function rejectionText(
  target: ReturnType<typeof findTargetForZone>,
  payload: IOClipboardPayload | null,
): string {
  if (!payload) return "Clipboard is empty";
  if (!target) return "Nothing here accepts a paste";
  const custom = target.describeRejection?.(payload);
  return custom ?? "Clipboard contains no usable data for this target";
}
```

### Files to modify

**`frontend/src/shared/clipboard/index.ts`** — append:

```typescript
export * from "./pasteTargetRegistry";
export * from "./usePasteTarget";
export * from "./usePasteEngine";
export { ClipboardContextMenu } from "./ClipboardContextMenu";
```

### Implementation notes
- `ContextMenu.Content` needs a `ContextMenu.Root` + `ContextMenu.Trigger` wrapping it in consumer code — the component here only provides the content. Callers are responsible for wrapping: `<ContextMenu.Root><ContextMenu.Trigger asChild>…</ContextMenu.Trigger><ClipboardContextMenu zoneId="…" onCopy={…} /></ContextMenu.Root>`.
- If the consumer is inside react-grid-layout, they must render `<ContextMenu.Portal>` (Radix already portals correctly — no custom `createPortal` needed for the menu content).
- The registry is intentionally in module scope (not React state) so non-React code paths (keyboard handlers) can read it synchronously.
- If two targets register for the same zone with the same priority, "best" is whichever was most recently inserted — acceptable. Callers should pick unique priorities where ordering matters.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- Importing `ClipboardContextMenu` and using it inside a dummy component renders with all nine Paste-as entries, all greyed out (no target registered), each with a tooltip on hover.
- Registering a stub target with `registerPasteTarget({ id: "t1", zoneId: "designer", priority: 10, accepts: () => ["points"], applyPaste: () => {} })` + setting active zone to `"designer"` + right-clicking → "Paste as → Points" becomes enabled; others stay greyed.

---

## Phase 5 — Selection UI Layer

### Goal
Build the cross-context visual layer that renders selection indicators on top of any selectable content. Provides:

- A `<SelectionOverlay zoneId={...}>` component that positions indicators over selected entities.
- A `useSelectableItem({ zoneId, entity, ref })` hook that wires up click/ctrl-click/shift-click behavior on any element.
- A `<MarqueeLayer zoneId={...}>` component that renders a drag rectangle and resolves contained entities to selection updates.

None of these wire up specific contexts — that's Phases 6–10. This phase delivers the reusable primitives.

### Context for this phase
- Phase 2 global selection store.
- Phase 1 types: `SelectableEntity`, `SelectionZoneConfig`, `SelectionIndicatorStyle`.
- `position: fixed` is broken inside react-grid-layout — use `createPortal(el, document.body)` for overlays that need to escape rgl transforms. For designer (not inside rgl), regular absolute positioning is fine.

### Files to create

**`frontend/src/shared/clipboard/selection/useSelectableItem.ts`**

```typescript
import { useCallback } from "react";
import type { SelectableEntity, SelectionZoneId } from "../types";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";

interface Opts {
  zoneId: SelectionZoneId;
  entity: SelectableEntity;
  /** If true, plain click runs the interactive handler instead of selecting.
   *  Ctrl+Click still selects. Right-click "Select" still selects. */
  interactive?: boolean;
  onInteractiveClick?: (e: React.MouseEvent) => void;
}

export function useSelectableItem({ zoneId, entity, interactive, onInteractiveClick }: Opts) {
  const select = useGlobalSelectionStore((s) => s.select);
  const setActive = useGlobalSelectionStore((s) => s.setActiveZone);
  const isSelected = useGlobalSelectionStore((s) =>
    s.zones.get(zoneId)?.selected.has(entity.id) ?? false,
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setActive(zoneId);
      if (e.button !== 0) return;
      if (interactive && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onInteractiveClick?.(e);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        select(zoneId, entity, "toggle");
      } else if (e.shiftKey) {
        select(zoneId, entity, "add");
      } else {
        select(zoneId, entity, "replace");
      }
      e.stopPropagation();
    },
    [zoneId, entity, interactive, onInteractiveClick, select, setActive],
  );

  return { onMouseDown, isSelected };
}
```

**`frontend/src/shared/clipboard/selection/SelectionOverlay.tsx`**

```tsx
import { CSSProperties } from "react";
import type { SelectionZoneId } from "../types";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  zoneId: SelectionZoneId;
  /** Resolve an entity id to its current bounding rect in the overlay's coordinate system. */
  rectOf: (entityId: string) => Rect | null;
  /** Forwarded to the overlay root. */
  className?: string;
  style?: CSSProperties;
}

export function SelectionOverlay({ zoneId, rectOf, className, style }: Props) {
  const entities = useGlobalSelectionStore(
    (s) => Array.from(s.zones.get(zoneId)?.selected.keys() ?? []),
  );
  const indicatorStyle = useGlobalSelectionStore(
    (s) => s.zones.get(zoneId)?.config.indicatorStyle ?? "selection-box",
  );

  return (
    <div
      className={["io-selection-overlay", className].filter(Boolean).join(" ")}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
      data-zone={zoneId}
    >
      {entities.map((id) => {
        const r = rectOf(id);
        if (!r) return null;
        return (
          <div
            key={id}
            data-indicator={indicatorStyle}
            style={{
              position: "absolute",
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
            }}
          />
        );
      })}
    </div>
  );
}
```

**`frontend/src/shared/clipboard/selection/selection.css`**

```css
.io-selection-overlay [data-indicator="selection-box"] {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
  border-radius: 2px;
}
.io-selection-overlay [data-indicator="soft-glow"] {
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.15),
    0 0 12px 2px var(--accent);
  border-radius: 4px;
}
```

**`frontend/src/shared/clipboard/selection/MarqueeLayer.tsx`**

```tsx
import { useCallback, useRef, useState } from "react";
import type { SelectableEntity, SelectionZoneId } from "../types";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  zoneId: SelectionZoneId;
  /** Return every selectable entity currently mounted in this zone, with its rect. */
  enumerate: () => Array<{ entity: SelectableEntity; rect: Rect }>;
  containerRef: React.RefObject<HTMLElement>;
}

export function MarqueeLayer({ zoneId, enumerate, containerRef }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const modeRef = useRef<"add" | "toggle" | "remove" | "replace">("replace");
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const selectMany = useGlobalSelectionStore((s) => s.selectMany);
  const clearZone = useGlobalSelectionStore((s) => s.clearZone);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (e.target !== containerRef.current) return; // only empty-area drags
      const bounds = containerRef.current!.getBoundingClientRect();
      startRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      modeRef.current = e.altKey
        ? "remove"
        : e.ctrlKey || e.metaKey
          ? "add"
          : "replace";
      setRect({ top: startRef.current.y, left: startRef.current.x, width: 0, height: 0 });
    },
    [containerRef],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!startRef.current) return;
      const bounds = containerRef.current!.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      const left = Math.min(startRef.current.x, x);
      const top = Math.min(startRef.current.y, y);
      const width = Math.abs(x - startRef.current.x);
      const height = Math.abs(y - startRef.current.y);
      setRect({ top, left, width, height });
    },
    [containerRef],
  );

  const onMouseUp = useCallback(() => {
    if (!rect) return;
    const contained = enumerate()
      .filter(({ rect: r }) => fullyContained(r, rect))
      .map(({ entity }) => entity);
    if (modeRef.current === "replace") {
      if (contained.length === 0) clearZone(zoneId);
      else selectMany(zoneId, contained, "replace");
    } else if (modeRef.current === "add") {
      selectMany(zoneId, contained, "add");
    } else if (modeRef.current === "remove") {
      selectMany(zoneId, contained, "remove");
    }
    startRef.current = null;
    setRect(null);
  }, [rect, enumerate, selectMany, clearZone, zoneId]);

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        startRef.current = null;
        setRect(null);
      }}
    >
      {rect ? (
        <div
          style={{
            position: "absolute",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            background: "rgba(80, 180, 255, 0.08)",
            border: "1px dashed var(--accent)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

function fullyContained(inner: Rect, outer: Rect): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height
  );
}
```

**`frontend/src/shared/clipboard/selection/useSelectionKeybinds.ts`**

```typescript
import { useEffect } from "react";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";
import { usePasteEngine } from "../usePasteEngine";
import { useIOClipboardStore } from "../clipboardStore";
import { findTargetForZone } from "../pasteTargetRegistry";

/**
 * Global keyboard handler for Ctrl+C / Ctrl+V / Ctrl+Alt+V / Ctrl+A / Escape.
 * Mount ONCE at the app root.
 */
export function useSelectionKeybinds(
  copyHandlers: Record<string, () => void | Promise<void>>,
) {
  const { pasteDefault, pastePrevious } = usePasteEngine();

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      // Skip when typing in inputs — let native clipboard work.
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      const zoneId = useGlobalSelectionStore.getState().activeZone;
      if (!zoneId) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "c") {
        const handler = copyHandlers[zoneId];
        if (handler) {
          e.preventDefault();
          await handler();
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        await pasteDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        await pastePrevious();
      } else if (e.key === "Escape") {
        useGlobalSelectionStore.getState().clearZone(zoneId);
      }
      // Ctrl+A is zone-specific — target must register a copyHandler that triggers select-all,
      // or each zone can mount its own useEffect for Ctrl+A. We do NOT implement a global handler
      // because "all" is context-dependent.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pasteDefault, pastePrevious, copyHandlers]);
}
```

### Files to modify

**`frontend/src/shared/clipboard/index.ts`** — add:

```typescript
export { SelectionOverlay } from "./selection/SelectionOverlay";
export { MarqueeLayer } from "./selection/MarqueeLayer";
export { useSelectableItem } from "./selection/useSelectableItem";
export { useSelectionKeybinds } from "./selection/useSelectionKeybinds";
```

**`frontend/src/App.tsx`** (or equivalent top-level layout file) — import and mount the CSS:

```typescript
import "@/shared/clipboard/selection/selection.css";
```

Also mount the global keyboard handler once at the root by calling `useSelectionKeybinds({})` with an empty initial handlers map. Later phases will register per-zone copy handlers by passing into this map (the map itself is defined per-zone by registering context-specific callbacks in a context or module-level registry — see Phase 6 notes).

### Implementation notes
- `MarqueeLayer` assumes the zone's container has `position: relative` and the container's `getBoundingClientRect()` is its own bounds. Verify per consumer.
- For console panes (inside rgl), `rectOf` in `SelectionOverlay` should use `offsetParent`-relative coordinates OR portal to `document.body` with viewport-space rects — see the "`position: fixed` in rgl" gotcha in CLAUDE.md. Phase 7 makes that decision per-pane.
- `useSelectionKeybinds` explicitly skips keydowns fired inside inputs — native copy/paste must still work when editing text fields.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- A storybook-style standalone test (or dev-mode scratch route) can render `<SelectionOverlay zoneId="designer" rectOf={...} />` and the overlay appears above selected items in the global store.
- `MarqueeLayer` drag creates a visible rectangle; releasing selects fully-contained items and clears the rect.
- Pressing Ctrl+C outside any input with no copy handler registered does nothing (no crash).

---

## Phase 6 — Designer Full Implementation

### Goal
Cut designer over from its legacy `useClipboardStore` + `uiStore.selectedNodeIds` selection to the universal stack from Phases 1–5. Register designer's `PasteTarget` supporting `native` (shapes with bindings), `points`, `shapes` (no bindings), `style`, `style+layout`, `text`, and `new-graphic`. Implement cross-document paste (pasting shapes from one graphic into another — remapping expression IDs). Wire the Ctrl+C / Ctrl+V / Ctrl+Alt+V flow through `useSelectionKeybinds`. Wire right-click → `ClipboardContextMenu` with all modes.

### Context for this phase
- Phases 1–5 delivered: `IOClipboardPayload`, `useIOClipboardStore`, `useGlobalSelectionStore`, `registerPasteTarget`, `ClipboardContextMenu`, `SelectionOverlay`, `MarqueeLayer`, `useSelectionKeybinds`, `useSelectableItem`.
- Designer state: `frontend/src/store/designer/uiStore.ts` (`selectedNodeIds: Set<NodeId>`), `frontend/src/store/designer/sceneStore.ts`, `frontend/src/store/designer/historyStore.ts` (command pattern, `PasteNodesCommand`, `DuplicateNodesCommand`, ~40 commands in `frontend/src/shared/graphics/commands.ts`).
- Keyboard handlers: `frontend/src/pages/designer/DesignerCanvas.tsx` lines ~5507–5556 (Ctrl+C/V today).
- `GraphicDocument.expressions` is keyed by expression id — cross-document paste must remap any expression ids that collide with the destination document.

### Files to create

**`frontend/src/pages/designer/clipboard/designerPasteTarget.ts`**

```typescript
import type {
  IOClipboardPayload,
  PasteMode,
  PasteTarget,
} from "@/shared/clipboard";
import {
  extractPoints,
  extractStyleFromNodes,
  hasKind,
  stripBindings,
} from "@/shared/clipboard";
import { useSceneStore } from "@/store/designer/sceneStore";
import { useHistoryStore } from "@/store/designer/historyStore";
import { PasteNodesCommand } from "@/shared/graphics/commands";
import type { GraphicExpression, SceneNode } from "@/shared/types/graphics";
import { v4 as uuid } from "uuid";

export function createDesignerPasteTarget(): PasteTarget {
  return {
    id: "designer",
    zoneId: "designer",
    priority: 10,
    accepts(payload) {
      if (!payload) return [];
      const modes: PasteMode[] = [];
      if (payload.contents.nodes?.length) modes.push("native", "shapes");
      if (hasKind(payload, "points")) modes.push("points");
      if (hasKind(payload, "style")) modes.push("style");
      if (hasKind(payload, "style+layout")) modes.push("style+layout");
      if (payload.contents.textRepresentation) modes.push("text");
      modes.push("new-graphic");
      return modes;
    },
    async applyPaste(payload, mode) {
      const scene = useSceneStore.getState();
      const history = useHistoryStore.getState();
      switch (mode) {
        case "native":
        case "shapes": {
          const nodes = mode === "shapes"
            ? stripBindings(payload.contents.nodes ?? [])
            : (payload.contents.nodes ?? []);
          const remapped = remapExpressionIds(nodes, payload.contents.expressions ?? {});
          history.execute(new PasteNodesCommand(remapped.nodes, remapped.expressions));
          return;
        }
        case "points": {
          // Create a simple text_block per point — smallest meaningful paste-as-points.
          const points = extractPoints(payload);
          const nodes: SceneNode[] = points.map((p, i) => createPointTextBlock(p, i));
          history.execute(new PasteNodesCommand(nodes, {}));
          return;
        }
        case "style": {
          const snap = payload.contents.style ?? extractStyleFromNodes(payload.contents.nodes ?? []);
          if (!snap) return;
          scene.applyStyleToSelection(snap);
          return;
        }
        case "style+layout": {
          if (payload.contents.style) scene.applyStyleToSelection(payload.contents.style);
          if (payload.contents.layout) scene.applyLayoutToSelection(payload.contents.layout);
          return;
        }
        case "text": {
          const node = createTextBlock(payload.contents.textRepresentation);
          history.execute(new PasteNodesCommand([node], {}));
          return;
        }
        case "new-graphic": {
          // Emit event; Designer home listens and creates + navigates.
          window.dispatchEvent(
            new CustomEvent("io-designer:new-graphic-from-clipboard", { detail: payload }),
          );
          return;
        }
      }
    },
    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      return "Clipboard has no designer-compatible data";
    },
  };
}

function remapExpressionIds(
  nodes: SceneNode[],
  expressions: Record<string, GraphicExpression>,
): { nodes: SceneNode[]; expressions: Record<string, GraphicExpression> } {
  const destExpr = useSceneStore.getState().doc.expressions;
  const idMap = new Map<string, string>();
  const nextExpressions: Record<string, GraphicExpression> = {};
  for (const [oldId, def] of Object.entries(expressions)) {
    if (destExpr[oldId]) {
      const newId = uuid();
      idMap.set(oldId, newId);
      nextExpressions[newId] = def;
    } else {
      nextExpressions[oldId] = def;
    }
  }
  const patch = (n: SceneNode): SceneNode => {
    const copy = JSON.parse(JSON.stringify(n)) as SceneNode;
    walk(copy, (x) => {
      const b = (x as unknown as { binding?: { expressionId?: string } }).binding;
      if (b?.expressionId && idMap.has(b.expressionId)) {
        b.expressionId = idMap.get(b.expressionId)!;
      }
    });
    return copy;
  };
  return { nodes: nodes.map(patch), expressions: nextExpressions };
}

function walk(node: SceneNode, fn: (n: SceneNode) => void) {
  fn(node);
  const children = (node as unknown as { children?: SceneNode[] }).children;
  if (Array.isArray(children)) children.forEach((c) => walk(c, fn));
}

function createPointTextBlock(p: { tagname: string; displayName?: string; unit?: string }, i: number): SceneNode {
  return {
    id: uuid(),
    type: "text_block",
    transform: {
      position: { x: 40, y: 40 + i * 28 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: "none",
    },
    visible: true,
    locked: false,
    opacity: 1,
    // text_block-specific fields — match your local TextBlock type
    text: p.displayName ?? p.tagname,
  } as unknown as SceneNode;
}

function createTextBlock(text: string): SceneNode {
  return {
    id: uuid(),
    type: "text_block",
    transform: { position: { x: 60, y: 60 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: "none" },
    visible: true,
    locked: false,
    opacity: 1,
    text,
  } as unknown as SceneNode;
}
```

**`frontend/src/pages/designer/clipboard/designerCopyHandler.ts`**

```typescript
import { buildIOClipboardPayload, computeTextRepresentation, extractPointsFromNodes, useIOClipboardStore } from "@/shared/clipboard";
import { useSceneStore } from "@/store/designer/sceneStore";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";

export async function copyDesignerSelection(): Promise<void> {
  const selected = useGlobalSelectionStore.getState().getSelection("designer");
  if (selected.length === 0) return;
  const scene = useSceneStore.getState();
  const nodes = selected
    .map((e) => scene.findNodeById(e.id))
    .filter((n): n is NonNullable<typeof n> => !!n);
  if (nodes.length === 0) return;
  const doc = scene.doc;
  // Pick only the expressions referenced by copied nodes.
  const usedExpressionIds = new Set<string>();
  const walk = (ns: typeof nodes) => {
    for (const n of ns) {
      const b = (n as unknown as { binding?: { expressionId?: string } }).binding;
      if (b?.expressionId) usedExpressionIds.add(b.expressionId);
      const children = (n as unknown as { children?: typeof ns }).children;
      if (Array.isArray(children)) walk(children);
    }
  };
  walk(nodes);
  const expressions = Object.fromEntries(
    Array.from(usedExpressionIds).map((id) => [id, doc.expressions[id]]).filter(([, v]) => v),
  );
  const payload = buildIOClipboardPayload({
    originContext: "designer",
    originGraphicId: doc.id,
    contents: {
      nodes: JSON.parse(JSON.stringify(nodes)),
      expressions,
      points: extractPointsFromNodes(nodes),
      textRepresentation: computeTextRepresentation({ nodes }),
      originalBounds: computeBounds(nodes),
    },
  });
  await useIOClipboardStore.getState().writeToClipboard(payload);
}

function computeBounds(nodes: Array<{ transform: { position: { x: number; y: number } } }>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const { x, y } = n.transform.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

### Files to modify

**`frontend/src/pages/designer/DesignerCanvas.tsx`**

- Near existing `useEffect` that registers Ctrl+C/V handlers (lines ~5507–5556): delete those handlers entirely. The global `useSelectionKeybinds` now owns them.
- Near the top of the component, add zone registration:
  ```tsx
  useSelectionZone({ zoneId: "designer", indicatorStyle: "selection-box", supportsSelectAll: true });
  usePasteTarget(designerPasteTargetRef.current);
  ```
  Where `designerPasteTargetRef = useRef(createDesignerPasteTarget())`.
- Wire the focus/activeZone: on mousedown inside the canvas container, call `useGlobalSelectionStore.getState().setActiveZone("designer")`.
- Where the existing canvas renders shape handles / selection rectangles, ADD `<SelectionOverlay zoneId="designer" rectOf={rectForNode} />` over the SVG. `rectForNode(id)` reads the node's bounding box in screen coordinates.
- Replace the existing uiStore selection calls so that every click/ctrl-click/shift-click on a node also updates `useGlobalSelectionStore`. Dual-writing is acceptable during migration; keep `uiStore.selectedNodeIds` working for code that still reads it, and mirror into global store.
- Right-click menu on a node / on empty canvas → wrap the existing context menu content with `<ClipboardContextMenu zoneId="designer" onCopy={copyDesignerSelection} onCut={...}>{existingItems}</ClipboardContextMenu>`.

**`frontend/src/pages/designer/DesignerHome.tsx`** (or equivalent landing page)

- Add a `useEffect` listening for the `"io-designer:new-graphic-from-clipboard"` custom event: create a new empty graphic, then pipe the payload's nodes/expressions into it before navigating.

**`frontend/src/App.tsx`** (or root) — update the `useSelectionKeybinds` call:

```typescript
useSelectionKeybinds({
  designer: copyDesignerSelection,
  // Other zones added in later phases.
});
```

### Implementation notes
- `PasteNodesCommand` already exists — reuse as-is. Confirm its signature accepts `(nodes, expressions)`. If not, extend it rather than inventing a new command.
- Do NOT delete the legacy `useClipboardStore` (from `shared/graphics/clipboardStore.ts`) — it's still a shim used by commands. Phase 12 may remove it once audit confirms no stragglers.
- For `applyStyleToSelection` / `applyLayoutToSelection` methods on the scene store: if they do not exist, add them. They iterate `getSelection("designer")` and patch each matching node's style-relevant fields. Use an `ApplyStyleCommand` (new, simple — calls `sceneStore.updateNode(id, patch)` for each id) and push it through history.
- Cross-document paste: when `payload.originGraphicId !== currentGraphicId`, run `remapExpressionIds` before `PasteNodesCommand`. Within the same document, `payload.contents.expressions` is still passed — the command should deduplicate and use existing expressions by id when present.
- Expression remapping: all nodes may also reference expressions via `DisplayElementBinding.expressionKey` (tag-style). Walk those too and remap.
- Ctrl+A in designer: register a local keydown listener (not through `useSelectionKeybinds`) that calls `selectAll("designer", allSceneNodeEntities)`.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds and `pnpm lint` is clean.
- In designer: Ctrl+C on selection writes a v2 payload; Ctrl+V pastes; Ctrl+Alt+V pastes the previous slot (empty on first use).
- Right-click on a shape: menu shows Cut/Copy/Paste/Paste Previous/Paste as…/Paste Previous as…; incompatible modes are greyed with tooltip.
- Paste as Shapes strips bindings (verify by inspecting pasted node's `binding` field is absent / empty).
- Paste as Style with a selection in the destination applies only style props.
- Paste as New Graphic creates a new empty graphic with the payload's nodes in it.
- Copying from Graphic A, navigating to Graphic B, pasting — collision-free; any expression-id collisions have been remapped. Verify by inspecting `sceneStore.doc.expressions` keys.
- Selection indicator renders over each selected shape with the selection-box style.

---

## Phase 7 — Console Full Implementation

### Goal
Make every console pane fully selection-aware. The console zone now supports:
- Pane-level selection (title-bar click = select pane, drag title bar = move pane as today).
- Pane-content selection: chart series row, table cell, table row, alarm row.
- Click+drag in a pane body = marquee select contents (not drag-to-move pane).
- Ctrl+V into a chart pane with points on clipboard = add points as series (silent smart extraction).
- Ctrl+V into an empty area of the workspace = create a **Temporary Graphic** pane holding the pasted contents; the pane has its own right-click → "Paste into Temporary Graphic" and a "Save as graphic…" action that persists it.

### Context for this phase
- Phases 1–6 are complete. Designer already registers its target and copy handler.
- Old store `frontend/src/store/selectionStore.ts` with `selectedPaneIds: Set<string>` still exists. This phase migrates it to a thin wrapper over the global store.
- Console workspace layout: `frontend/src/store/workspaceStore.ts` (zundo temporal). Pane types: `frontend/src/pages/console/types.ts` — `PaneConfig`, `ChartConfig`, `ChartPointSlot`.
- Each pane is rendered by `frontend/src/pages/console/panes/*` — `TrendPane.tsx`, `TablePane.tsx`, `AlarmPane.tsx`, `GraphicPane.tsx`. Right-click menus already exist on some.
- `position: fixed` inside react-grid-layout is broken. Portal selection overlays to `document.body` and compute rects from `getBoundingClientRect()`.

### Files to create

**`frontend/src/pages/console/clipboard/consoleCopyHandler.ts`**

```typescript
import { buildIOClipboardPayload, computeTextRepresentation, useIOClipboardStore } from "@/shared/clipboard";
import { useGlobalSelectionStore } from "@/store/globalSelectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { PaneConfig } from "@/pages/console/types";

export async function copyConsoleActiveZone(zoneId: string): Promise<void> {
  const selected = useGlobalSelectionStore.getState().getSelection(zoneId as any);
  if (selected.length === 0) return;
  const workspace = useWorkspaceStore.getState();

  // Panes
  if (zoneId === "console") {
    const panes: PaneConfig[] = selected
      .filter((e) => e.kind === "pane")
      .map((e) => workspace.panes.find((p) => p.id === e.id))
      .filter((p): p is PaneConfig => !!p);
    if (!panes.length) return;
    const payload = buildIOClipboardPayload({
      originContext: "console-pane",
      contents: {
        paneConfigs: JSON.parse(JSON.stringify(panes)),
        textRepresentation: panes.map((p) => p.id).join(" - "),
      },
    });
    await useIOClipboardStore.getState().writeToClipboard(payload);
    return;
  }

  // Per-pane sub-zones: copy based on entity kind
  const paneId = zoneId.replace(/^console\/pane\//, "");
  const pane = workspace.panes.find((p) => p.id === paneId);
  if (!pane) return;

  const kind = selected[0].kind;
  switch (kind) {
    case "chart-series-row": {
      const points = selected.map((e) => e.payload as { tagname: string; displayName?: string; unit?: string });
      const payload = buildIOClipboardPayload({
        originContext: "chart",
        originPaneId: paneId,
        contents: {
          points,
          textRepresentation: computeTextRepresentation({ points }),
        },
      });
      await useIOClipboardStore.getState().writeToClipboard(payload);
      return;
    }
    case "table-cell":
    case "table-row": {
      const rows = selected.map((e) => e.payload as { columns: string[]; values: (string | number | null)[] });
      const payload = buildIOClipboardPayload({
        originContext: "table",
        originPaneId: paneId,
        contents: {
          tableRows: rows,
          textRepresentation: rows.map((r) => r.values.join(" - ")).join("\n"),
        },
      });
      await useIOClipboardStore.getState().writeToClipboard(payload);
      return;
    }
    case "alarm-row": {
      const alarms = selected.map((e) => e.payload as { tagname: string; severity?: string });
      const payload = buildIOClipboardPayload({
        originContext: "alarm-list",
        originPaneId: paneId,
        contents: {
          alarms,
          points: alarms.map((a) => ({ tagname: a.tagname })),
          textRepresentation: alarms.map((a) => a.tagname).join(" - "),
        },
      });
      await useIOClipboardStore.getState().writeToClipboard(payload);
      return;
    }
  }
}
```

**`frontend/src/pages/console/clipboard/consolePasteTarget.ts`**

```typescript
import type { PasteTarget } from "@/shared/clipboard";
import { extractPoints } from "@/shared/clipboard";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { v4 as uuid } from "uuid";

export function createConsolePaneTarget(paneId: string): PasteTarget {
  return {
    id: `console-pane-${paneId}`,
    zoneId: `console/pane/${paneId}`,
    priority: 10,
    accepts(payload) {
      if (!payload) return [];
      const ws = useWorkspaceStore.getState();
      const pane = ws.panes.find((p) => p.id === paneId);
      if (!pane) return [];
      const modes: any[] = [];
      if (pane.type === "chart") {
        if (extractPoints(payload).length) modes.push("points");
        if (payload.contents.chartConfigs?.length) modes.push("native");
      } else if (pane.type === "table") {
        if (payload.contents.tableRows?.length || extractPoints(payload).length) modes.push("table");
        if (extractPoints(payload).length) modes.push("points");
      } else if (pane.type === "alarm") {
        if (extractPoints(payload).length) modes.push("points", "most-recent-alarms");
      } else if (pane.type === "graphic") {
        if (payload.contents.nodes?.length) modes.push("shapes");
        if (extractPoints(payload).length) modes.push("points");
      }
      if (payload.contents.textRepresentation) modes.push("text");
      return modes;
    },
    async applyPaste(payload, mode) {
      const ws = useWorkspaceStore.getState();
      const pane = ws.panes.find((p) => p.id === paneId);
      if (!pane) return;
      if (pane.type === "chart" && (mode === "points" || mode === "native")) {
        const points = extractPoints(payload);
        ws.updatePane(paneId, (p) => {
          if (p.type !== "chart" || !p.chartConfig) return;
          const nextSlots = [...(p.chartConfig.points ?? [])];
          for (const pt of points) {
            nextSlots.push({ tagname: pt.tagname, /* remaining slot defaults */ } as any);
          }
          p.chartConfig.points = nextSlots;
        });
        return;
      }
      if (pane.type === "table" && (mode === "table" || mode === "points")) {
        const points = extractPoints(payload);
        ws.updatePane(paneId, (p) => {
          if (p.type !== "table") return;
          p.tablePointIds = [...(p.tablePointIds ?? []), ...points.map((pt) => pt.tagname)];
        });
        return;
      }
      if (pane.type === "graphic" && mode === "shapes") {
        // Defer to designer-compatible paste inside the graphic pane — reuse designer target handlers
        // via a cross-call. For MVP: append nodes to the graphic pane's in-memory overlay.
        return;
      }
      if (mode === "text") {
        // No-op for panes — text paste into a pane body has no natural home.
        return;
      }
    },
    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      return "This pane accepts no data from the clipboard";
    },
  };
}

export function createConsoleWorkspaceTarget(): PasteTarget {
  return {
    id: "console-workspace",
    zoneId: "console",
    priority: 5,
    accepts(payload) {
      if (!payload) return [];
      const modes: any[] = [];
      if (payload.contents.paneConfigs?.length) modes.push("native");
      if (extractPoints(payload).length) modes.push("temporary-graphic");
      if (payload.contents.nodes?.length) modes.push("temporary-graphic");
      return modes;
    },
    async applyPaste(payload, mode) {
      const ws = useWorkspaceStore.getState();
      if (mode === "native" && payload.contents.paneConfigs) {
        for (const pc of payload.contents.paneConfigs) {
          ws.addPane({ ...pc, id: uuid() });
        }
        return;
      }
      if (mode === "temporary-graphic") {
        ws.addPane({
          id: uuid(),
          type: "graphic",
          graphicId: "__temporary__",
          // Attach payload contents as a session-only overlay on the pane; shape TBD per workspace store.
          temporaryGraphicContents: payload.contents,
        } as any);
        return;
      }
    },
  };
}
```

**`frontend/src/pages/console/clipboard/TemporaryGraphicPane.tsx`**

A new pane component that renders `nodes` from a session-only payload, supports its own right-click "Paste into Temporary Graphic" (appending more content), and has a "Save as graphic…" button that calls the graphic-create API and swaps the pane's `graphicId` from `__temporary__` to the new persistent id.

### Files to modify

**`frontend/src/store/selectionStore.ts`** — refactor to delegate to the global store. Keep the old API (`selectedPaneIds: Set<string>`, `selectPane`, `clearSelection`) as shims that read/write the global store under zone `"console"`. Downstream code that imports from here continues to work while new code uses the global store directly.

**`frontend/src/pages/console/ConsolePageGrid.tsx`** (or root console layout)

- Add `useSelectionZone({ zoneId: "console", indicatorStyle: "selection-box", supportsSelectAll: false })`.
- Register `createConsoleWorkspaceTarget()` via `usePasteTarget`.
- On pane-title-bar mousedown: `setActiveZone("console")` and `select("console", { id: pane.id, zoneId: "console", kind: "pane" })`.
- On workspace empty-area mousedown: `setActiveZone("console")`.
- Wrap the page with a right-click that shows `<ClipboardContextMenu zoneId="console" onCopy={() => copyConsoleActiveZone("console")} />`.

**`frontend/src/pages/console/panes/TrendPane.tsx`**

- Register per-pane zone: `useSelectionZone({ zoneId: \`console/pane/${paneId}\`, indicatorStyle: "soft-glow", supportsSelectAll: true })`.
- Register `createConsolePaneTarget(paneId)` via `usePasteTarget`.
- Chart series legend rows become selectable via `useSelectableItem` — entity kind `chart-series-row`, payload `{ tagname, displayName, unit }`.
- Inside the pane body (not title bar), mount a `<MarqueeLayer zoneId={...} enumerate={enumerateLegendRows} containerRef={...} />`.

Same treatment for `TablePane.tsx` (table-cell / table-row entities) and `AlarmPane.tsx` (alarm-row entities) and `GraphicPane.tsx` (scene-node entities within the live view).

**`frontend/src/App.tsx`** — extend `useSelectionKeybinds`:

```typescript
useSelectionKeybinds({
  designer: copyDesignerSelection,
  console: () => copyConsoleActiveZone("console"),
  // per-pane zones registered dynamically — handler map is keyed by static prefixes,
  // so we add a fallback: any zone starting with "console/pane/" uses copyConsoleActiveZone(zoneId).
});
```

Update `useSelectionKeybinds` to accept a `fallbackMatcher: (zoneId) => (() => Promise<void>) | null` argument OR a prefix map. The minimal change is to pass a matcher:

```typescript
useSelectionKeybinds(
  {
    designer: copyDesignerSelection,
    console: () => copyConsoleActiveZone("console"),
  },
  {
    matchers: [
      { test: (z) => z.startsWith("console/pane/"), handler: (z) => copyConsoleActiveZone(z) },
    ],
  },
);
```

Extend `useSelectionKeybinds` signature accordingly.

### Implementation notes
- The workspace is managed by `workspaceStore` (zundo-wrapped). Every paste that adds a pane / mutates a chart slot must go through a normal store action so undo/redo captures it.
- `TemporaryGraphicPane` is a new pane type; extend `PaneConfig` with `type: "temporary-graphic"` OR piggyback on `type: "graphic"` with `graphicId === "__temporary__"` and an extra `temporaryGraphicContents` field. Pick whichever keeps `PaneConfig` closer to existing shape; document the choice.
- Marquee in a pane body must coexist with the pane's own inner drag (e.g. TrendPane's crosshair). Marquee only fires when the drag starts on non-interactive whitespace — enforce via `e.target !== containerRef.current` check (already built into MarqueeLayer).
- Overflow on charts: `ChartConfig.points` has no hard cap today, but the existing chart UI validates. Do NOT add a cap here — let the existing validator surface the error.
- Portal the selection overlay to `document.body` for console panes; compute rects in viewport space.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- Clicking a pane title bar selects the pane (selection box visible). Dragging the title bar still moves the pane.
- Clicking a chart series row in the legend selects that row; Ctrl+C writes a payload with `points: [{ tagname: …}]` and `originContext: "chart"`.
- Pasting that payload on a different chart pane adds the points as new series (no dialog).
- Right-click on empty workspace → Paste (with a panes payload on clipboard) → panes are duplicated with new ids.
- Ctrl+V on empty workspace with a shapes payload creates a Temporary Graphic pane that renders the shapes.
- "Save as graphic…" on a Temporary Graphic pane persists it and swaps the pane's graphicId.

---

## Phase 8 — Expression Builder Integration

### Goal
Make the expression builder a first-class paste target. Paste semantics are drop-target-aware:
- Points dropped/pasted onto a multi-input function tile (`avg()`, `sum()`, etc.) → wired as inputs.
- Points dropped/pasted onto a `( )` parentheses tile → joined as `point_ref1 + point_ref2 + …` inside, operators editable.
- Points dropped/pasted on empty canvas → N loose unconnected `point_ref` tiles.
- Copying tiles within the builder also works (native mode).

### Context for this phase
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx` uses `useReducer` and dnd-kit.
- `frontend/src/shared/types/expression.ts` defines `ExpressionTile`, `ExprNode`, `ExpressionAst`.
- The builder already has a concept of "drop target" for dnd-kit drops — reuse that signal to determine the paste mode.

### Files to create

**`frontend/src/shared/components/expression/clipboard/expressionPasteTarget.ts`**

```typescript
import type { PasteTarget } from "@/shared/clipboard";
import { extractPoints } from "@/shared/clipboard";

interface ExpressionHooks {
  getActiveDropTargetId(): string | null;
  getTileById(id: string): { kind: "function" | "paren" | "operator" | "point_ref" | "literal" } | null;
  addPointsAsLooseTiles(points: Array<{ tagname: string }>): void;
  addPointsToFunctionTile(tileId: string, points: Array<{ tagname: string }>): void;
  addPointsToParenTile(tileId: string, points: Array<{ tagname: string }>): void;
  pasteNativeTiles(tiles: unknown[]): void;
}

export function createExpressionPasteTarget(hooks: ExpressionHooks): PasteTarget {
  return {
    id: "expression-builder",
    zoneId: "expression-builder",
    priority: 10,
    accepts(payload) {
      if (!payload) return [];
      const modes: any[] = [];
      if (extractPoints(payload).length) modes.push("points");
      if (payload.contents.expressionTiles?.length) modes.push("native");
      if (payload.contents.textRepresentation) modes.push("text");
      return modes;
    },
    async applyPaste(payload, mode) {
      if (mode === "native" && payload.contents.expressionTiles) {
        for (const clip of payload.contents.expressionTiles) {
          hooks.pasteNativeTiles(clip.tiles);
        }
        return;
      }
      if (mode === "points") {
        const points = extractPoints(payload);
        const tgt = hooks.getActiveDropTargetId();
        if (!tgt) {
          hooks.addPointsAsLooseTiles(points);
          return;
        }
        const tile = hooks.getTileById(tgt);
        if (!tile) {
          hooks.addPointsAsLooseTiles(points);
          return;
        }
        if (tile.kind === "function") hooks.addPointsToFunctionTile(tgt, points);
        else if (tile.kind === "paren") hooks.addPointsToParenTile(tgt, points);
        else hooks.addPointsAsLooseTiles(points);
        return;
      }
    },
    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      return "No point data or expression tiles on clipboard";
    },
  };
}
```

### Files to modify

**`frontend/src/shared/components/expression/ExpressionBuilder.tsx`**

- Add a ref `activeDropTargetId` tracked via dnd-kit's `onDragOver` — or expose whichever element currently has hover focus.
- Add reducer actions:
  - `ADD_POINTS_AS_LOOSE_TILES`
  - `ADD_POINTS_TO_FUNCTION_TILE`
  - `ADD_POINTS_TO_PAREN_TILE`
  - `PASTE_NATIVE_TILES`
- Mount zone registration: `useSelectionZone({ zoneId: "expression-builder", indicatorStyle: "soft-glow", supportsSelectAll: true })`.
- Register paste target via `usePasteTarget(createExpressionPasteTarget({...hooks}))`.
- Each tile renders with `useSelectableItem` — kind `"expression-tile"`, payload is the tile object.
- On tile focus / click inside the builder, `setActiveZone("expression-builder")`.

**`frontend/src/App.tsx`**

Extend the keybinds handler map:

```typescript
useSelectionKeybinds(
  { /* ... */, "expression-builder": copyExpressionSelection },
  { matchers: [ /* ... */ ] },
);
```

Where `copyExpressionSelection` reads the expression-builder zone's selection, assembles an `ExpressionTileClip[]`, and writes a payload with `originContext: "expression-builder"`.

### Implementation notes
- A "function" tile has a list of argument slots; appending points fills the next empty slot, or appends if none.
- A "paren" tile is parsed as `( <children joined by + > )`; inserting points extends the children list with `point_ref` tiles separated by `+` operator tiles.
- For native paste of tiles: regenerate all tile ids to prevent collisions with existing tiles in the builder.
- Drop-target tracking: if dnd-kit is overkill for right-click paste resolution, fall back to "last hovered tile" tracked via `onMouseEnter`/`onMouseLeave` on each tile.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- Copying tiles inside the builder, then Ctrl+V on empty canvas reinserts them with new ids (no collision).
- Copying two points from a chart, hovering `avg()` in the builder, Ctrl+V → points appear as arguments inside `avg(a, b)`.
- Copying two points, hovering `( )`, Ctrl+V → `( point_ref_a + point_ref_b )`.
- Copying two points, hovering empty canvas, Ctrl+V → two loose `point_ref` tiles appear.

---

## Phase 9 — Universal Paste-As Menu (Remaining Modes)

### Goal
Flesh out every still-unimplemented paste mode so the menu is fully functional in every registered context. After this phase:
- `text` mode pastes `textRepresentation` into any text input / contenteditable.
- `table` mode builds a table structure from a points payload when no native table snapshot exists.
- `most-recent-alarms` mode emits a navigation intent: open forensics with the points as filters.
- `style+layout` mode completes in designer (partially done in Phase 6 — confirm).
- A shared "text field paste target" is registered automatically for every `<input>` / `<textarea>` / contenteditable in the app so "Paste as Text" works universally.

### Context for this phase
- Phases 1–8 are complete.
- Most targets already accept `"text"` but none actually paste text into a field.
- The app may have many free-form text inputs; we don't want to touch each — instead, register a single document-level target that activates when the focused element is editable.

### Files to create

**`frontend/src/shared/clipboard/targets/textFieldTarget.ts`**

```typescript
import type { PasteTarget } from "@/shared/clipboard";

export function createTextFieldTarget(): PasteTarget {
  return {
    id: "global-text-field",
    zoneId: "designer", // placeholder — wired dynamically in usePasteEngine
    priority: -100,
    accepts(payload) {
      if (!payload) return [];
      return ["text"];
    },
    async applyPaste(payload) {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const text = payload.contents.textRepresentation;
      if ((el as HTMLInputElement).value !== undefined) {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.setSelectionRange(start + text.length, start + text.length);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (el.isContentEditable) {
        document.execCommand("insertText", false, text);
      }
    },
  };
}
```

Wire in a small adjustment to `usePasteEngine`: when the browser's `document.activeElement` is editable, consult the text-field target AFTER the zone target returns no modes for `text` — a fallback layer.

**`frontend/src/shared/clipboard/targets/mostRecentAlarmsHook.ts`**

```typescript
export async function openForensicsWithPoints(
  tagnames: string[],
  mode: "most-recent-alarms" | "points",
) {
  // Emit a custom event; the forensics page listens and populates filters + queries most-recent alarms.
  window.dispatchEvent(
    new CustomEvent("io-navigate:forensics", {
      detail: { tagnames, mode },
    }),
  );
}
```

### Files to modify

**`frontend/src/shared/clipboard/usePasteEngine.ts`** — after the primary target fails to resolve a `text` mode, fall back to the text-field target when `document.activeElement` is editable.

**All existing paste targets (designer, console-pane, expression-builder)** — audit their `applyPaste` to confirm `text` actually inserts rendered text into something visible (e.g., adds a `text_block` in designer, inserts into a pane's title if the title bar is focused, inserts into the expression builder's literal input if focused). Where a target cannot cleanly handle `text`, remove `"text"` from its `accepts()` result so the text-field fallback can handle it.

**Designer target — `designerPasteTarget.ts`** — confirm `style+layout` is fully implemented (both `applyStyleToSelection` and `applyLayoutToSelection` called).

**Forensics page component** — mount an event listener for `"io-navigate:forensics"` that loads filters from the event detail.

**All targets that accept `most-recent-alarms`** — wire `applyPaste(payload, "most-recent-alarms")` to call `openForensicsWithPoints(points.map(p=>p.tagname), "most-recent-alarms")`.

### Implementation notes
- `document.execCommand("insertText", …)` is deprecated but still the most reliable way to insert into a contenteditable while respecting history/undo. If the target uses a rich-text editor with its own API (e.g., logbook entries), wire through that editor's API instead.
- For `table` synthesis from points: the existing `synthesizeTableFromPoints` helper from Phase 3 is already available — targets call it when `payload.contents.tableRows` is absent.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- Pasting a point payload into a focused text input inserts the `textRepresentation` at the caret.
- Right-click in a table pane with a points payload → "Paste as Table" adds the points as rows.
- Right-click anywhere with a points payload → "Paste as Most Recent Alarm(s)" navigates to forensics with those tagnames set.
- In designer, "Paste as Style + Layout" applies both style and layout (sidecar positions, display-element configs) without duplicating shapes.

---

## Phase 10 — Remaining Contexts: Alarm Viewer, Logbook, Forensics, Reports

### Goal
Extend selection + paste target registration into the remaining non-console screens so the same Ctrl+C / Ctrl+V / right-click menu works uniformly. By end of this phase the only places without copy/paste are login/admin screens.

### Context for this phase
- Phases 1–9 complete. Every primitive is ready; this phase is plumbing.
- Files:
  - Alarm viewer: `frontend/src/pages/alarms/*` (one page).
  - Logbook: `frontend/src/pages/logbook/*`.
  - Forensics: `frontend/src/pages/forensics/*`.
  - Reports: `frontend/src/pages/reports/*`.

### Files to create

One `*PasteTarget.ts` + one `*CopyHandler.ts` per context, mirroring the console pane pattern:

- `frontend/src/pages/alarms/clipboard/alarmPasteTarget.ts`
- `frontend/src/pages/alarms/clipboard/alarmCopyHandler.ts`
- `frontend/src/pages/logbook/clipboard/logbookPasteTarget.ts`
- `frontend/src/pages/logbook/clipboard/logbookCopyHandler.ts`
- `frontend/src/pages/forensics/clipboard/forensicsPasteTarget.ts`
- `frontend/src/pages/forensics/clipboard/forensicsCopyHandler.ts`
- `frontend/src/pages/reports/clipboard/reportsPasteTarget.ts`
- `frontend/src/pages/reports/clipboard/reportsCopyHandler.ts`

Each target's `accepts` and `applyPaste` follow the minimum viable contract:

| Zone | accepts (when payload has points) | applyPaste on `points` |
|---|---|---|
| `alarm-list` | `points`, `most-recent-alarms`, `text` | set alarm filter to these tagnames |
| `logbook` | `points`, `table`, `text` | add filter by tagname; paste as table inserts rows |
| `forensics` | `points`, `most-recent-alarms`, `text` | populate tagname filter set |
| `reports` | `points`, `table`, `text` | add points as a new report section |

### Files to modify

- Each page root: register its zone via `useSelectionZone`, register its paste target, call `setActiveZone` on focus/click.
- Rows in each list component: use `useSelectableItem`.
- Wrap each page in `<ClipboardContextMenu>` at the outer container.
- **`frontend/src/App.tsx`** — extend the keybinds handler map with all four new zones.

### Implementation notes
- For logbook table cells: allow cell-level selection first; a whole row counts as selected when every cell in it is selected OR when no cells are selected but the row itself is clicked.
- Forensics time-range hits are a separate entity kind (`forensics-hit`). Copy emits `points` plus a `timeRange` hint carried in `originPaneId` or a separate clipboard field (extend `IOClipboardContents` with an optional `timeRange?: { start: string; end: string }` if needed — add to Appendix).
- Reports may have a dedicated "section" type; pasting points can add a chart section or a table section depending on the user's preference. For this phase, default to table section — polish later.

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- Copy an alarm row → paste target tooltip on an incompatible context is "Clipboard contains no usable data for this target" (or customized).
- Ctrl+C on selected alarm rows, navigate to forensics, Ctrl+V → forensics filter is populated with those tagnames.
- Ctrl+C on a logbook row, Ctrl+V into a chart pane → chart gains those points as series.

---

## Phase 11 — Paste Previous Slot, Ctrl+Alt+V, Paste Previous As…

### Goal
Audit and harden the dual-slot behavior. Most wiring was scaffolded in Phases 3 + 4; this phase confirms every path honors it and adds visual feedback indicating when the "previous" slot has content.

### Context for this phase
- `useIOClipboardStore` already holds `current` and `previous`. `writeToClipboard` advances history.
- `usePasteEngine.pastePrevious()` already exists.
- `ClipboardContextMenu` already greys out the Paste Previous / Paste Previous as… menus when `previous` is null.
- `useSelectionKeybinds` already handles Ctrl+Alt+V.

What's new in this phase: a visible affordance (a status indicator in the app chrome) that shows the current and previous slot mini-summaries, and verification that every target's `accepts()` is correctly called against the previous slot (the menu does this already — verify).

### Files to create

**`frontend/src/shared/clipboard/ClipboardStatusIndicator.tsx`**

```tsx
import { useIOClipboardStore } from "./clipboardStore";

export function ClipboardStatusIndicator() {
  const current = useIOClipboardStore((s) => s.current);
  const previous = useIOClipboardStore((s) => s.previous);
  const summarize = (p: typeof current) => {
    if (!p) return "empty";
    const c = p.contents;
    if (c.nodes?.length) return `${c.nodes.length} shape(s)`;
    if (c.points?.length) return `${c.points.length} point(s)`;
    if (c.paneConfigs?.length) return `${c.paneConfigs.length} pane(s)`;
    if (c.tableRows?.length) return `${c.tableRows.length} row(s)`;
    if (c.alarms?.length) return `${c.alarms.length} alarm(s)`;
    return c.textRepresentation ? "text" : "data";
  };
  return (
    <div className="io-clipboard-status" title={`Current: ${summarize(current)}\nPrevious: ${summarize(previous)}`}>
      <span>CB</span>
      <span data-slot="current">{summarize(current)}</span>
      <span data-slot="previous">{summarize(previous)}</span>
    </div>
  );
}
```

### Files to modify

**`frontend/src/App.tsx`** or the app's status/toolbar area — mount `<ClipboardStatusIndicator />` in the top chrome.

**Paste targets** — audit each `accepts()` implementation to confirm it is pure (no side effects) and stable across calls against the same payload. The context menu calls it for both `current` and `previous` every time it opens; flaky behavior produces flicker in greyed state.

### Implementation notes
- `previous` is strictly in-memory. Page refresh clears it. `current` survives refresh via the system clipboard (if the OS retains it). This is the intended model.
- Ctrl+Alt+V with an empty previous slot should silently do nothing (not throw, not toast).

### Acceptance criteria
- `cd frontend && pnpm build` succeeds.
- Status indicator always reflects the current + previous slot contents.
- Copying a shape then copying a point: the indicator shows `Current: 1 point(s)`, `Previous: 1 shape(s)`. Ctrl+Alt+V pastes the shape; Ctrl+V pastes the point.
- Right-click → Paste Previous as… matches the previous payload's accepted modes.

---

## Phase 12 — Polish: Overflow, Tooltips, Acceptance Testing

### Goal
Close the loop: every target surfaces overflow / rejection in a user-visible way, every greyed menu item has a correct tooltip string, and a smoke-test checklist validates the whole feature end-to-end.

### Context for this phase
- All functional code is in place.

### Files to modify

- Every `PasteTarget.describeRejection` — replace generic strings with context-accurate ones:
  - Chart: "Chart only accepts point references or a chart config"
  - Table pane: "Table only accepts points or table rows"
  - Alarm list: "Alarm list only accepts points"
  - Designer: "Clipboard has no designer-compatible data"
  - Expression builder: "Expression builder accepts points or expression tiles"
- Every target's `applyPaste` — confirm it calls the existing validator pattern (toast on overflow, focus the relevant pane). Add `toast.warn(...)` wrappers where missing.
- Add a dev-only keyboard shortcut `Ctrl+Shift+D` that opens a clipboard inspector panel showing both slots' full JSON. Useful for debugging. Gate on `import.meta.env.DEV`.

### Files to create

**`frontend/src/shared/clipboard/__tests__/smokeChecklist.md`** — not code; a hand-checklist for QA:

```
[ ] Designer copy & paste round-trip (same doc)
[ ] Designer copy & paste round-trip (cross doc, expression remap)
[ ] Designer → chart pane: points flow silently
[ ] Chart series → designer: Paste as Points creates text blocks
[ ] Table pane → chart pane: points flow silently
[ ] Workspace empty area + shapes clipboard: Temporary Graphic pane appears
[ ] Temporary Graphic pane: "Save as graphic…" persists to DB and swaps id
[ ] Expression builder: points onto avg() → args
[ ] Expression builder: points onto () → chained +
[ ] Expression builder: points on empty → loose tiles
[ ] Most Recent Alarms from forensics → populates filters
[ ] Paste as Text into an input field
[ ] Paste as Style to a selected shape
[ ] Paste as Style+Layout to a selected shape
[ ] Paste as New Graphic from designer home
[ ] Ctrl+Alt+V uses previous slot
[ ] Status indicator reflects both slots
[ ] Tooltips on greyed menu items match target rejection text
[ ] Selection persists across module navigation
[ ] Ctrl+A, Ctrl+Click, Shift+Click, Alt+Click+drag all behave per spec
[ ] Marquee fully-contained behavior (not touched-by-rect)
```

### Implementation notes
- Re-run `pnpm build` and `pnpm lint` with zero warnings before declaring done.
- Manually test in Chromium (not Firefox) — `navigator.clipboard.writeText` permission model differs.

### Acceptance criteria
- All 22 checklist items pass.
- `cd frontend && pnpm build` and `pnpm lint` are clean.
- No residual imports of the legacy `useClipboardStore` from `shared/graphics` remain in files modified in Phases 6–11 (grep audit).
- The legacy shim file `shared/graphics/clipboardStore.ts` is either deleted OR still present with only the shim body (decided in this phase based on remaining consumers — if none, delete and update `commands.ts` imports).

---

## Appendix A — Complete Type Definitions (Canonical)

Reproduced here so any phase agent can reference them in one place.

```typescript
// frontend/src/shared/clipboard/types.ts

import type { SceneNode, GraphicExpression } from "../types/graphics";
import type { ChartConfig, PaneConfig } from "../../pages/console/types";
import type { ExpressionTile } from "../types/expression";

// --- Origin + mode ---
export type OriginContext =
  | "designer"
  | "console-pane"
  | "chart"
  | "table"
  | "alarm-list"
  | "logbook"
  | "forensics"
  | "expression-builder"
  | "external";

export type PasteMode =
  | "native"
  | "points"
  | "shapes"
  | "style"
  | "style+layout"
  | "table"
  | "text"
  | "new-graphic"
  | "temporary-graphic"
  | "most-recent-alarms";

// --- Payload sub-shapes ---
export interface PortablePointRef {
  tagname: string;
  displayName?: string;
  unit?: string;
  dataType?: string;
  pointCategory?: string;
  euRangeLow?: number;
  euRangeHigh?: number;
}

export interface PortableAlarmRef {
  tagname: string;
  severity?: string;
  priority?: number;
  lastEventAt?: string;
}

export interface TableRowSnapshot {
  columns: string[];
  values: (string | number | null)[];
  sourceRefs?: { tagname?: string; rowId?: string };
}

export interface LogEntrySnapshot {
  id: string;
  timestamp: string;
  tagname: string;
  value: string | number | null;
  unit?: string;
  createdBy?: string;
  notes?: string;
}

export interface ExpressionTileClip {
  tiles: ExpressionTile[];
  connectorHints?: Array<{ fromTileId: string; toTileId: string }>;
}

export interface StyleSnapshot {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  borderRadius?: number;
  backgroundColor?: string;
}

export interface LayoutSnapshot {
  sidecarPositions?: Record<string, { x: number; y: number; rotation?: number }>;
  displayElementConfigs?: Record<string, unknown>;
}

export interface IOClipboardContents {
  nodes?: SceneNode[];
  expressions?: Record<string, GraphicExpression>;
  points?: PortablePointRef[];
  alarms?: PortableAlarmRef[];
  chartConfigs?: ChartConfig[];
  paneConfigs?: PaneConfig[];
  tableRows?: TableRowSnapshot[];
  logEntries?: LogEntrySnapshot[];
  expressionTiles?: ExpressionTileClip[];
  style?: StyleSnapshot;
  layout?: LayoutSnapshot;
  textRepresentation: string;
  originalBounds?: { x: number; y: number; width: number; height: number };
  /** Optional time-range hint set by forensics-origin copies. */
  timeRange?: { start: string; end: string };
}

export interface IOClipboardPayload {
  source: "io-clipboard";
  version: "2.0";
  createdAt: string;
  originContext: OriginContext;
  originGraphicId?: string;
  originPaneId?: string;
  contents: IOClipboardContents;
}

// --- Selection ---
export type SelectionZoneId =
  | "designer"
  | "console"
  | `console/pane/${string}`
  | "alarm-list"
  | "logbook"
  | "forensics"
  | "reports"
  | "expression-builder";

export type SelectableEntityKind =
  | "scene-node"
  | "pane"
  | "chart-series-row"
  | "table-cell"
  | "table-row"
  | "alarm-row"
  | "log-entry"
  | "expression-tile"
  | "forensics-hit";

export interface SelectableEntity {
  id: string;
  zoneId: SelectionZoneId;
  kind: SelectableEntityKind;
  payload?: unknown;
}

export type SelectionIndicatorStyle = "soft-glow" | "selection-box";

export interface SelectionZoneConfig {
  zoneId: SelectionZoneId;
  indicatorStyle: SelectionIndicatorStyle;
  supportsSelectAll: boolean;
}

// --- Paste target ---
export interface PasteTarget {
  id: string;
  zoneId: SelectionZoneId;
  priority: number;
  accepts(payload: IOClipboardPayload | null): PasteMode[];
  applyPaste(payload: IOClipboardPayload, mode: PasteMode): Promise<void> | void;
  describeRejection?(payload: IOClipboardPayload | null): string;
}
```

---

## Appendix B — File Inventory

| Path | Created in phase | Purpose |
|---|---|---|
| `frontend/src/shared/clipboard/types.ts` | 1 | All clipboard/selection/paste types |
| `frontend/src/shared/clipboard/index.ts` | 1, 3, 4, 5 | Barrel |
| `frontend/src/store/globalSelectionStore.ts` | 2 | Global selection Zustand store |
| `frontend/src/store/useSelectionZone.ts` | 2 | Zone registration hook |
| `frontend/src/shared/clipboard/clipboardStore.ts` | 3 | Dual-slot clipboard Zustand store |
| `frontend/src/shared/clipboard/migrateLegacyClipboard.ts` | 3 | v1 → v2 migration |
| `frontend/src/shared/clipboard/extract.ts` | 3 | Smart extraction utilities |
| `frontend/src/shared/clipboard/buildPayload.ts` | 3 | Payload builder helper |
| `frontend/src/shared/clipboard/pasteTargetRegistry.ts` | 4 | Module-level target registry |
| `frontend/src/shared/clipboard/usePasteTarget.ts` | 4 | React hook for target registration |
| `frontend/src/shared/clipboard/usePasteEngine.ts` | 4 | Orchestration: pasteDefault / pastePrevious / pasteAs |
| `frontend/src/shared/clipboard/ClipboardContextMenu.tsx` | 4 | Reusable Radix context-menu content |
| `frontend/src/shared/clipboard/selection/SelectionOverlay.tsx` | 5 | Overlay indicator renderer |
| `frontend/src/shared/clipboard/selection/MarqueeLayer.tsx` | 5 | Drag-marquee component |
| `frontend/src/shared/clipboard/selection/useSelectableItem.ts` | 5 | Per-element selection wiring hook |
| `frontend/src/shared/clipboard/selection/useSelectionKeybinds.ts` | 5 | Global keyboard handler |
| `frontend/src/shared/clipboard/selection/selection.css` | 5 | Indicator styles |
| `frontend/src/pages/designer/clipboard/designerPasteTarget.ts` | 6 | Designer paste target |
| `frontend/src/pages/designer/clipboard/designerCopyHandler.ts` | 6 | Designer copy handler |
| `frontend/src/pages/console/clipboard/consoleCopyHandler.ts` | 7 | Console copy handler |
| `frontend/src/pages/console/clipboard/consolePasteTarget.ts` | 7 | Console paste targets (workspace + per-pane) |
| `frontend/src/pages/console/clipboard/TemporaryGraphicPane.tsx` | 7 | Temporary graphic pane |
| `frontend/src/shared/components/expression/clipboard/expressionPasteTarget.ts` | 8 | Expression builder target |
| `frontend/src/shared/clipboard/targets/textFieldTarget.ts` | 9 | Universal text-field fallback target |
| `frontend/src/shared/clipboard/targets/mostRecentAlarmsHook.ts` | 9 | Forensics navigation helper |
| `frontend/src/pages/alarms/clipboard/*` | 10 | Alarm viewer target + copy handler |
| `frontend/src/pages/logbook/clipboard/*` | 10 | Logbook target + copy handler |
| `frontend/src/pages/forensics/clipboard/*` | 10 | Forensics target + copy handler |
| `frontend/src/pages/reports/clipboard/*` | 10 | Reports target + copy handler |
| `frontend/src/shared/clipboard/ClipboardStatusIndicator.tsx` | 11 | Status chrome indicator |
| `frontend/src/shared/clipboard/__tests__/smokeChecklist.md` | 12 | QA checklist |

## Appendix C — Files Modified, by Phase

| Path | Phases that touch it |
|---|---|
| `frontend/src/shared/types/graphics.ts` | 1 |
| `frontend/src/shared/graphics/clipboardStore.ts` | 3 (shim), 12 (potential delete) |
| `frontend/src/App.tsx` (or root) | 5, 6, 7, 8, 10, 11 |
| `frontend/src/pages/designer/DesignerCanvas.tsx` | 6 |
| `frontend/src/pages/designer/DesignerHome.tsx` | 6 |
| `frontend/src/store/selectionStore.ts` | 7 (refactor to shim over global store) |
| `frontend/src/pages/console/ConsolePageGrid.tsx` | 7 |
| `frontend/src/pages/console/panes/TrendPane.tsx` | 7 |
| `frontend/src/pages/console/panes/TablePane.tsx` | 7 |
| `frontend/src/pages/console/panes/AlarmPane.tsx` | 7 |
| `frontend/src/pages/console/panes/GraphicPane.tsx` | 7 |
| `frontend/src/shared/components/expression/ExpressionBuilder.tsx` | 8 |
| `frontend/src/pages/alarms/*` | 10 |
| `frontend/src/pages/logbook/*` | 10 |
| `frontend/src/pages/forensics/*` | 10, 9 (event listener) |
| `frontend/src/pages/reports/*` | 10 |

---

*End of plan.*
