# Universal Copy and Paste — Post-Audit Fix Plan

> **Status:** Phases 1–4 complete (2026-04-26). Phase 5 not started.
> **Origin:** Gap analysis run 2026-04-26. The original plan (`universal-copy-paste-plan.md`)
> declared all 12 phases complete, but an Opus-driven audit found the implementation is
> mostly infrastructure with broken or missing surface connections. This document defines
> the remediation work.
>
> **How to use:** Each phase is fully self-contained. Read the Preamble + one phase section
> per session. Launch with: *"read docs/plans/universal-copy-paste-fix-plan.md and launch
> phase N"*.

---

## Preamble — What Was Built vs What's Missing

### System overview

The core clipboard system lives in `frontend/src/shared/clipboard/`. It is well-structured:

| File | Purpose |
|------|---------|
| `types.ts` | All types: `IOClipboardPayload`, `IOClipboardContents`, `PasteMode`, `SelectionZoneId`, `PasteTarget`, etc. |
| `clipboardStore.ts` | Zustand store. `writeToClipboard()` → `navigator.clipboard` + in-memory. `readFromSystemClipboard()`. Dual-slot (current + previous). |
| `pasteTargetRegistry.ts` | `registerPasteTarget()`, `findTargetForZone()`, `resolveModes()`, `pickDefaultMode()` |
| `usePasteEngine.ts` | `pasteDefault()`, `pastePrevious()`, `pasteAs(mode, source)` |
| `buildPayload.ts` | `buildIOClipboardPayload()` — constructs v2.0 payload |
| `extract.ts` | `extractPoints()`, `extractStyleFromNodes()`, `stripBindings()`, `synthesizeTableFromPoints()` |
| `ClipboardContextMenu.tsx` | Radix `ContextMenu` wrapping Copy / Cut / Paste / Paste Previous / Paste as… / Paste Previous as… |
| `selection/useSelectionKeybinds.ts` | Mounts at app root. Ctrl+C → zone copy handler. Ctrl+V → pasteDefault. Ctrl+Alt+V → pastePrevious. |
| `selection/useSelectableItem.ts` | `onMouseDown` for Ctrl+Click / Shift+Click / plain click selection |
| `selection/MarqueeLayer.tsx` | Rubber-band drag-to-select |
| `store/globalSelectionStore.ts` | Multi-zone selection state. `registerZone`, `setActiveZone`, `select`, `selectMany`, `clearZone`, etc. |

Module-specific handlers exist for: Designer, Console, Alerts, Log, Reports, Forensics, Expression Builder.

### The core problem

**`ClipboardContextMenu` has zero call sites.** The entire right-click "Paste as…" surface is a
component that is never rendered anywhere. Every existing context menu (PaneWrapper, DesignerCanvas,
chart cells) is a bespoke instance that doesn't invoke it.

Beyond that, several copy paths are dead because list rows never register their entities in the
global selection store, and several paste paths dispatch custom events that have no listeners.

### Known broken paths (before any fix)

| Path | Problem |
|------|---------|
| Right-click → Paste as… | `ClipboardContextMenu` never rendered anywhere |
| Ctrl+C in Alerts | Rows never register `kind:"alarm-row"` — store always empty |
| Ctrl+C in Log | Rows never register `kind:"log-entry"` — store always empty |
| Ctrl+C in Reports | Rows never register any kind — store always empty |
| Paste into Log | `io-navigate:logbook` event fires, zero listeners |
| Paste into Reports | `io-navigate:reports` event fires, zero listeners |
| Designer "new-graphic" paste | `io-designer:new-graphic-from-clipboard` fires, zero listeners |
| Paste into blank console pane | No branch for `pane.type === "blank"` — silent no-op |
| Copy pane via PaneWrapper right-click | Uses a legacy `onCopy` prop path, bypasses universal clipboard |
| Chart cell Copy (chart15/35/36) | `navigator.clipboard.writeText(rawString)` — bypasses payload system |
| extractStyleFromNodes | Returns `undefined` for typical designer nodes — "Paste as Style" dead |

---

## Phase 1 — Wire ClipboardContextMenu everywhere + fix dead selection registrations

**Goal:** Right-click → Copy / Paste / Paste as… works in Console panes, Designer canvas,
Alerts list, Log list, and Reports list. Ctrl+C produces a real payload in all five.

**Prerequisite reading:** Preamble above. No other phases needed first.

### Task 1.1 — Integrate ClipboardContextMenu into PaneWrapper

File: `frontend/src/pages/console/PaneWrapper.tsx`

The existing right-click menu is a bespoke Radix `ContextMenu.Root` (around line 758).
It has a bespoke "Copy" item that calls an `onCopy` prop (legacy, non-universal).

Steps:
1. Import `ClipboardContextMenu` from `shared/clipboard`.
2. Replace the bespoke `ContextMenu.Root` + `ContextMenu.Content` wrapping the pane with
   `ClipboardContextMenu` as the outer wrapper, passing the pane's existing bespoke items
   as `extraItems` (or prepend them after the universal section). The component accepts
   `children` as the trigger and `extraItems?: React.ReactNode` to append module-specific items.
3. Remove the legacy `onCopy` prop threading. Instead, the `onCopy` passed to
   `ClipboardContextMenu` should call `copyConsoleActiveZone(zoneId)` from
   `pages/console/clipboard/consoleCopyHandler.ts`.
4. Verify: right-click on a pane shows Copy / Paste / Paste as… section.

### Task 1.2 — Integrate ClipboardContextMenu into DesignerCanvas

File: `frontend/src/pages/designer/DesignerCanvas.tsx`

The designer already has a large Radix `ContextMenu` on the canvas. It needs a "Copy / Cut /
Paste / Paste as…" section inserted at the top of the menu content, above the existing items.

Steps:
1. Import `usePasteEngine` and the designer copy handler.
2. At the top of the canvas context menu content, add:
   - "Copy" → `copyDesignerSelection()`
   - "Cut" → `copyDesignerSelection()` then delete selected nodes
   - Separator
   - "Paste" → `pasteDefault()`
   - "Paste Previous" → `pastePrevious()`
   - "Paste as…" submenu → map `PASTE_AS_ORDER` modes, calling `pasteAs(mode)` for each,
     with disabled state from `resolveModes(payload)`.
3. Do not replace the existing designer menu items — append after the separator.

### Task 1.3 — Make alert rows register in global selection store

Files:
- `frontend/src/pages/alerts/` — find the alarm row component (likely `AlarmRow.tsx` or
  similar inside `components/` or directly in `index.tsx`)
- `frontend/src/store/globalSelectionStore.ts`

The copy handler (`alertsCopyHandler.ts`) filters for `kind: "alarm-row"` but no component
ever calls `useSelectableItem` or `store.select()` with that kind.

Steps:
1. In the alert list zone, call `registerZone("alarm-list", { indicatorStyle: "glow" })` on
   mount (likely already done — verify in the alerts page component).
2. On each alarm row component, call `useSelectableItem({ zoneId: "alarm-list", entityId: alarm.tagname, kind: "alarm-row", payload: alarm })`.
3. Wire the returned `onMouseDown` to the row's `onMouseDown`.
4. Apply `io-node-selected` CSS class when `isSelected` is true.
5. Verify: Ctrl+C in Alerts produces an `IOClipboardPayload` with `alarms` populated.

### Task 1.4 — Make log rows register in global selection store

Files: `frontend/src/pages/log/` — find the log entry row component.

Same pattern as Task 1.3 but with `zoneId: "logbook"` and `kind: "log-entry"`.

Steps:
1. Verify `registerZone("logbook", ...)` is called.
2. On each log entry row, apply `useSelectableItem({ zoneId: "logbook", entityId: entry.id, kind: "log-entry", payload: entry })`.
3. Wire `onMouseDown`, apply `io-node-selected` class.
4. Verify: Ctrl+C in Log produces a payload with `logEntries` populated.

### Task 1.5 — Make report rows register in global selection store

Files: `frontend/src/pages/reports/` — find the report row component.

Steps:
1. Verify `registerZone("reports", ...)` is called.
2. On each report row, apply `useSelectableItem({ zoneId: "reports", entityId: report.id, kind: "table-row", payload: report })`.
3. Wire `onMouseDown`, apply `io-node-selected` class.
4. Verify: Ctrl+C in Reports produces a payload.

### Task 1.6 — Add ClipboardContextMenu to Alerts, Log, Reports list views

Each list page needs right-click → Copy / Paste / Paste as… on rows (or on the list container
for the paste side).

Steps (repeat for each module):
1. Wrap each row (or the list container) with `ClipboardContextMenu`.
2. Pass the zone-appropriate `onCopy` callback.
3. Confirm "Paste as…" submenu appears and modes light/grey correctly.

### Task 1.7 — Replace chart cell direct clipboard writes

Files:
- `frontend/src/shared/components/charts/renderers/chart15-data-table.tsx` (lines ~192, ~201)
- `frontend/src/shared/components/charts/renderers/chart35-state-timeline.tsx` (line ~364)
- `frontend/src/shared/components/charts/renderers/chart36-scorecard-table.tsx` (lines ~418, ~427)

These call `navigator.clipboard.writeText(rawString)` for "Copy Tag Name" / "Copy Value".
They should instead call `writeToClipboard(buildIOClipboardPayload(...))` so the data enters
the universal system.

Steps:
1. Import `writeToClipboard`, `buildIOClipboardPayload` from `shared/clipboard`.
2. Replace each `navigator.clipboard.writeText(str)` call with a proper payload build +
   `writeToClipboard(payload)` — still include `textRepresentation: str` so plain-text paste
   still works in text fields.

### Verification for Phase 1
- Right-click a console pane → see Copy / Paste / Paste as… section
- Right-click the designer canvas → see Copy / Cut / Paste / Paste as… at top
- Select an alarm row → Ctrl+C → right-click elsewhere → Paste is enabled
- Select a log entry → Ctrl+C → paste into designer → points create text blocks
- Right-click a chart cell → Copy Tag Name still works, but now also loads the universal clipboard

---

## Phase 2 — Fix dead paste event listeners + blank pane auto-create

**Goal:** Paste targets that fire custom events actually do something. Pasting into a blank
console pane creates a trend (points) or table chart (table mode) automatically.

**Prerequisite:** Phase 1 complete (rows are selectable, context menus have Paste as…).

### Task 2.1 — Add listener for io-navigate:logbook

File: The Log page component (`frontend/src/pages/log/index.tsx` or main Log component).

`logPasteTarget.ts` dispatches:
```js
window.dispatchEvent(new CustomEvent("io-navigate:logbook", { detail: { tagnames, mode } }))
```
No listener exists.

Steps:
1. In the Log page `useEffect`, add:
   ```js
   window.addEventListener("io-navigate:logbook", handler)
   ```
2. Handler should receive `{ tagnames: string[], mode: "points" | "table" }`.
3. For `mode: "points"` — navigate to the log view filtered by those tagnames (open tag filter,
   pre-populate with the tagnames).
4. For `mode: "table"` — same, but switch to table view if one exists.
5. Clean up the listener on unmount.

### Task 2.2 — Add listener for io-navigate:reports

File: `frontend/src/pages/reports/index.tsx` or main Reports component.

Same pattern as 2.1. `reportsPasteTarget.ts` dispatches `io-navigate:reports`.

Steps:
1. Add `window.addEventListener("io-navigate:reports", handler)` in a `useEffect`.
2. Handler pre-filters the reports list by the provided tagnames.
3. Clean up on unmount.

### Task 2.3 — Add listener for io-designer:new-graphic-from-clipboard

File: `frontend/src/pages/designer/` — the main designer page or `DesignerCanvas.tsx`.

`designerPasteTarget.ts:199` dispatches `io-designer:new-graphic-from-clipboard` with the
clipboard payload. This should open a new designer document pre-populated with the clipboard
nodes.

Steps:
1. In the designer page component, add a `useEffect` that listens for
   `io-designer:new-graphic-from-clipboard`.
2. On event: create a new untitled graphic document (call whatever new-document action already
   exists in the designer), then trigger the "native" paste mode in the new document's context.
3. Alternatively, if new-document creation is async, queue the paste to run after the document
   is ready.

### Task 2.4 — Handle blank console pane on paste

File: `frontend/src/pages/console/clipboard/consolePasteTarget.ts`

`createConsolePaneTarget(paneId)` currently reads the pane type and only handles
`"trend"`, `"point_table"`, `"alarm_list"`. A `"blank"` pane returns empty `accepts()`.

Steps:
1. Add a branch for `pane.type === "blank"` (or however a newly-added empty pane is typed).
2. For `"native"` or `"points"` mode with points in payload → mutate the pane config to
   `type: "trend"` and add the points as series. This is the spec-required behavior:
   "Paste as Points only into a blank Console Module Pane would open a trend."
3. For `"table"` mode → mutate the pane config to `type: "point_table"` and add the points.
4. For `"native"` mode with `paneConfigs` in payload → existing workspace logic already handles
   this via `createConsoleWorkspaceTarget` — confirm it fires for blank panes too.

### Task 2.5 — Fix "Paste as Style" — fix extractStyleFromNodes

File: `frontend/src/shared/clipboard/extract.ts`

`extractStyleFromNodes(nodes)` returns `nodes[0].style` if present. Most designer nodes
carry style as inline properties (`fill`, `stroke`, `fontSize`, etc.) directly on the node
object, not nested under a `style` key.

Steps:
1. Read the actual `SceneNode` type definition (likely in `frontend/src/shared/graphics/types.ts`
   or similar) to see what style-relevant fields exist on different node types.
2. Update `extractStyleFromNodes` to map those fields into a `StyleSnapshot` object:
   ```ts
   {
     fill: node.fill,
     stroke: node.stroke,
     strokeWidth: node.strokeWidth,
     opacity: node.opacity,
     fontSize: node.fontSize,
     fontFamily: node.fontFamily,
     color: node.color,
     // etc.
   }
   ```
3. Return a `StyleSnapshot` (or `undefined` if node has no style-relevant fields).
4. Test: copy a colored shape in designer, paste as Style onto another shape — verify the
   fill/stroke transfers.

### Verification for Phase 2
- Paste points into blank console pane → pane becomes a trend chart
- Paste into log view → log filters to those tags
- Designer: create a new document, paste clipboard → nodes appear
- Copy a red rectangle, select a blue one, Paste as Style → blue turns red

---

## Phase 3 — Process module + PointDetailPanel + Settings/Points

**Goal:** The three most-used "everywhere" surfaces that lack any clipboard integration gain it.

**Prerequisite:** Phase 1 complete.

### Task 3.1 — Process module clipboard integration

Files: `frontend/src/pages/process/`

The Process module renders graphics views (scene graphs with bound points). It currently has
no `useSelectionZone`, `usePasteTarget`, or `useSelectableItem`.

Steps:
1. Register a selection zone: `"process"` (add to `SelectionZoneId` type in `types.ts` first).
2. Apply `useNodeMarquee` + `useNodeClick` from `shared/hooks/` to the process canvas (same
   pattern as Console — Mode A per `docs/decisions/selection-behavior.md`).
3. Nodes should apply `io-node-selected` CSS class when selected.
4. Register a copy handler for zone `"process"`: copy scene nodes + their bound points.
   Can reuse `consoleCopyHandler.ts` pattern for `kind: "scene-node"`.
5. Register a paste target that accepts `"native"` (open in designer) and `"points"` (navigate
   to trend).
6. Add `ClipboardContextMenu` to the process canvas right-click.

### Task 3.2 — PointDetailPanel copy

File: `frontend/src/shared/components/PointDetailPanel.tsx` (or wherever the panel lives).

This is a "static object you can't interact with" per the spec. Users should be able to
right-click the point name, current value, or EU and copy them via the universal clipboard.

Steps:
1. Add a small `ClipboardContextMenu` wrapper (or just a Radix `ContextMenu`) on the panel.
2. `onCopy`: build a payload with `points: [{ tagname, displayName, unit, ... }]` from the
   panel's current point. Set `textRepresentation` to `"${displayName} - ${tagname}: ${value} ${unit}"`.
3. "Copy" option in the menu (or Ctrl+C when panel is focused).
4. No paste target needed — the panel is read-only.

### Task 3.3 — Settings / Point Management rows

File: `frontend/src/pages/settings/` — find the point management table component.

Steps:
1. Register zone `"settings-points"` (add to `SelectionZoneId`).
2. Apply `useSelectableItem` to each point row with `kind: "scene-node"` and payload including
   tagname, displayName, unit, dataType, etc.
3. Register copy handler: extract `PortablePointRef[]` from the selection.
4. Register paste target that accepts `"points"` — pastes by navigating to the console with
   those points pre-loaded in a new pane.
5. Add `ClipboardContextMenu` to the table.

### Verification for Phase 3
- In Process: click a node, Ctrl+C, paste into Designer → shape appears
- In Process: right-click canvas → Paste as… menu visible
- In PointDetailPanel: right-click → Copy → paste into expression builder → point appears
- In Settings/Points: select 3 rows, Ctrl+C, switch to Console, Ctrl+V → new pane with trend

---

## Phase 4 — Cut + persistence + UX feedback

**Goal:** Cut works. Clipboard previous slot survives page reload. Users see confirmation
when paste succeeds.

**Prerequisite:** Phases 1–2 complete.

### Task 4.1 — Implement Cut (Ctrl+X)

Files:
- `frontend/src/shared/clipboard/selection/useSelectionKeybinds.ts`
- Each module's copy handler

Steps:
1. In `useSelectionKeybinds.ts`, add a `keydown` handler for `Ctrl+X` (same skip logic as C).
2. On Ctrl+X: call the zone's copy handler (same as Ctrl+C), then call a zone-specific
   delete function.
3. Each zone that supports cut needs to expose a `deleteSelection()` callback:
   - Designer: delete selected nodes (already exists in designer — find the existing delete key handler)
   - Console: remove selected panes
   - Log / Reports: rows are read-only — cut = copy only (no delete), or disable cut
   - Alerts: read-only — disable cut
4. Register cut handlers in `App.tsx` alongside copy handlers.
5. Update `ClipboardContextMenu` `onCut` prop to be wired (currently never passed).

### Task 4.2 — Persist the `previous` clipboard slot

File: `frontend/src/shared/clipboard/clipboardStore.ts`

The `previous` slot is purely in-memory. On page reload it's gone. The spec implies
"Paste Previous" should be durable.

Steps:
1. Add `sessionStorage` persistence for the `previous` slot only (current is already
   in `navigator.clipboard` which is tab-scoped).
2. On `writeToClipboard`, after rotating slots: `sessionStorage.setItem("io-clipboard-prev", JSON.stringify(payload))`.
3. On store init: read from sessionStorage to hydrate `previous` if present.
4. Cap the persisted payload size: if `JSON.stringify(payload).length > 512_000`, skip
   persistence (large graphics payloads shouldn't bloat sessionStorage).

### Task 4.3 — Add success toast on paste

File: `frontend/src/shared/clipboard/usePasteEngine.ts`

Currently the engine only toasts when `pastePrevious` is called with an empty slot (line ~51).
Successful pastes are silent.

Steps:
1. After a successful `applyPaste()` call in each of `pasteDefault`, `pastePrevious`, `pasteAs`,
   call a toast with a brief summary: e.g., `"Pasted 3 points"` or `"Pasted 2 shapes"`.
2. Derive the message from the payload contents: `points.length`, `nodes.length`, etc.
3. Use whatever toast system is already in use across the app (find an existing `toast(...)` call
   to see the import and API).
4. Error cases: if `applyPaste()` throws or returns a rejection reason, toast the error.

### Task 4.4 — Add visual paste affordance

This is a UX polish task. When the user has something on the clipboard and mouses over a valid
paste target, show a subtle indicator that paste is available.

Steps:
1. In `usePasteTarget.ts`, expose whether the current registered target `accepts()` the current
   clipboard payload (read from `clipboardStore`).
2. Return an `isPasteAvailable: boolean` from the hook.
3. In PaneWrapper, Console workspace, and Designer canvas: when `isPasteAvailable` is true,
   show a subtle indicator (e.g., a faint dashed border on hover, or a paste icon badge in
   the pane corner).
4. This is enhancement-only — don't block Phase 4 on this if it's complex.

### Verification for Phase 4
- Select 2 nodes in designer, Ctrl+X → nodes disappear, clipboard has them
- Paste into designer in new location → nodes appear
- Copy in designer, close tab, reopen, Ctrl+Alt+V → previous slot restores
- Paste points into trend → toast: "Pasted 3 points"
- Paste with incompatible mode → toast shows rejection reason

---

## Phase 5 — Logbook TipTap bridge + Text paste mode

**Goal:** Universal clipboard text can be pasted as inline prose into the Logbook editor.
"Text only" mode works end-to-end.

**Prerequisite:** Phases 1–2 complete.

### Task 5.1 — Bridge universal clipboard to TipTap log editor

Files:
- `frontend/src/pages/log/PasteFromOffice.ts` (existing TipTap extension)
- `frontend/src/pages/log/clipboard/logPasteTarget.ts`

The TipTap editor inside the Logbook has its own `PasteFromOffice` extension that handles
rich text. It is completely separate from the universal clipboard.

The spec example: "copy the current point name and value into a Logbook entry you might use
Text only to paste that vs pasting a link."

Steps:
1. Create a new TipTap extension `PasteFromIOClipboard.ts` alongside `PasteFromOffice.ts`.
2. The extension intercepts `paste` events and checks if `navigator.clipboard` holds an
   `io-clipboard` v2 payload.
3. If yes and editor is focused: instead of native paste, insert `payload.contents.textRepresentation`
   as plain text (or optionally as a formatted link/block if TipTap schema supports it).
4. Allow the user to choose: detect if the paste was triggered by Ctrl+V vs right-click
   "Paste as Text" — for Ctrl+V fall through to native if the TipTap editor is focused
   (preserving current editor behavior); only intercept for explicit "Text" mode from the
   context menu.
5. Wire the "Text" mode in `logPasteTarget.ts`: instead of dispatching `io-navigate:logbook`,
   dispatch a different event `io-logbook:paste-text` that the TipTap extension listens to.
6. Update the `accepts()` in `logPasteTarget.ts` to include `"text"` mode.

### Task 5.2 — Text paste into any text input

File: `frontend/src/shared/clipboard/targets/textFieldTarget.ts`

The text field target already handles the fallback case. Verify it works correctly:
1. When a text `<input>` or `<textarea>` is focused and the user hits Ctrl+V, the universal
   clipboard should insert `textRepresentation` at the cursor.
2. Currently `textFieldTarget.ts` sets `zoneId: "designer"` — this is wrong (it should be
   a global fallback). Verify in `usePasteEngine.ts` that the fallback path (lines ~38-44)
   uses the `isEditableElement` check and calls `textFieldTarget.applyPaste()` regardless
   of zone. Fix the zoneId to `"*"` or remove it from zone-based lookup — it should only
   fire through the explicit editable-element branch.

### Verification for Phase 5
- Select 3 points in Console, Ctrl+C, switch to Logbook, open a log entry editor, right-click
  → Paste as Text → the point names/values appear inline as text
- Copy a designer shape, click in a search input, Ctrl+V → tagname text appears in the input

---

## Phase 6 — Remaining surface area (Forensics, Alert Composer, Chart legend rows)

**Goal:** Fill in the remaining modules that have partial or no clipboard integration.

**Prerequisite:** Phase 1 complete.

### Task 6.1 — Forensics investigation inside an open investigation

File: `frontend/src/pages/forensics/` — find the investigation workspace component.

Currently only the investigation *list* page has `useSelectableItem`. Inside an open
investigation, hits/results are not selectable.

Steps:
1. Register zone `"forensics-investigation"` (add to `SelectionZoneId` or reuse `"forensics"`).
2. Apply `useSelectableItem` to forensics hit rows inside the investigation workspace.
3. Reuse `forensicsCopyHandler.ts` and `forensicsPasteTarget.ts`.
4. Add `ClipboardContextMenu` to the investigation results list.

### Task 6.2 — Chart legend rows in non-trend panes

File: Identify chart components where series legend rows exist but `useSelectableItem` is
not applied. TrendPane applies it; chart35, chart36, chart37, and others likely don't.

For each chart that has a visible series list or legend:
1. Apply `useSelectableItem` to legend rows with `kind: "chart-series-row"` and point payload.
2. Ctrl+C on a legend row should produce a payload with those points.

### Task 6.3 — Alert Composer / Alert Templates

File: `frontend/src/pages/alerts/composer/` or similar.

Alert template rows should be selectable and copyable as point references (the alert's
monitored tagname).

Steps:
1. Register zone, apply `useSelectableItem`, add `ClipboardContextMenu`.
2. Copy handler: extract the tagname from each selected alert template row.

### Task 6.4 — Sidebar / topbar pinned points (static objects)

Per spec: "the ability to select and copy from what would typically be a static object."

Pinned points in the sidebar or topbar should support right-click → Copy (universal clipboard).

Steps:
1. Find the pinned point display components.
2. Add a `ClipboardContextMenu` or just a Radix `ContextMenu` with a "Copy" item.
3. Build a payload: `points: [{ tagname, displayName, unit }]`, `textRepresentation: "${displayName}: ${value} ${unit}"`.

### Verification for Phase 6
- Open an investigation, select a forensics hit, Ctrl+C, paste into console → opens forensics
  with that point
- In a scorecard chart, click a series legend row, Ctrl+C, paste into expression builder →
  point appears
- Right-click a pinned point in sidebar → Copy → paste into expression builder → works

---

## Appendix — Key File Locations

```
frontend/src/
  shared/
    clipboard/
      types.ts                  ← All types, PasteMode enum, SelectionZoneId union
      clipboardStore.ts         ← Dual-slot store
      pasteTargetRegistry.ts    ← Registration + lookup
      usePasteEngine.ts         ← pasteDefault / pastePrevious / pasteAs
      buildPayload.ts           ← buildIOClipboardPayload()
      extract.ts                ← extractPoints / extractStyleFromNodes / stripBindings
      ClipboardContextMenu.tsx  ← THE COMPONENT THAT IS NEVER RENDERED
      index.ts                  ← Public barrel
      selection/
        useSelectionKeybinds.ts ← Ctrl+C/V/Alt+V global handler
        useSelectableItem.ts    ← Per-item click selection
        MarqueeLayer.tsx        ← Drag-to-select
      targets/
        textFieldTarget.ts      ← Fallback for text inputs (zoneId wrongly set to "designer")
        mostRecentAlarmsHook.ts ← Forensics navigation helper
    hooks/
      useNodeMarquee.ts         ← Mode A marquee (Console/Process)
      useNodeClick.ts           ← Mode A click hit-test
  store/
    globalSelectionStore.ts     ← Multi-zone selection state
    useSelectionZone.ts         ← Zone registration hook

  pages/
    designer/
      clipboard/
        designerCopyHandler.ts  ← copyDesignerSelection()
        designerPasteTarget.ts  ← accepts: native/shapes/points/style/style+layout/text/new-graphic
    console/
      PaneWrapper.tsx           ← Has bespoke legacy right-click menu (needs ClipboardContextMenu)
      clipboard/
        consoleCopyHandler.ts   ← copyConsoleActiveZone(zoneId)
        consolePasteTarget.ts   ← createConsolePaneTarget / createConsoleWorkspaceTarget
        temporaryGraphicStore.ts
        TemporaryGraphicPane.tsx
    alerts/
      clipboard/
        alertsCopyHandler.ts    ← filters kind:"alarm-row" (no rows register this kind)
        alertsPasteTarget.ts
    log/
      clipboard/
        logCopyHandler.ts       ← filters kind:"log-entry" (no rows register this kind)
        logPasteTarget.ts       ← dispatches io-navigate:logbook (no listener)
      PasteFromOffice.ts        ← TipTap extension (separate from universal clipboard)
    reports/
      clipboard/
        reportsCopyHandler.ts   ← no rows register any kind
        reportsPasteTarget.ts   ← dispatches io-navigate:reports (no listener)
    forensics/
      clipboard/
        forensicsCopyHandler.ts
        forensicsPasteTarget.ts
    process/                    ← NO clipboard integration at all
  shared/
    components/
      PointDetailPanel.tsx      ← NO clipboard integration
      expression/
        clipboard/
          expressionCopyHandler.ts
          expressionPasteTarget.ts  ← accepts: points / native (works)
      charts/renderers/
        chart15-data-table.tsx  ← direct navigator.clipboard.writeText (bypasses system)
        chart35-state-timeline.tsx ← same
        chart36-scorecard-table.tsx ← same
```

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Wire ClipboardContextMenu + fix selection registrations | Done | Completed 2026-04-26 |
| Phase 2 — Dead event listeners + blank pane auto-create | Done | Completed 2026-04-26 |
| Phase 3 — Process + PointDetailPanel + Settings/Points | Done | Completed 2026-04-26 |
| Phase 4 — Cut + persistence + UX feedback | Done | Completed 2026-04-26 |
| Phase 5 — Logbook TipTap bridge + Text paste | Not started | Depends on Phase 2 |
| Phase 6 — Forensics interior + chart legend rows + sidebar | Not started | Depends on Phase 1 |
