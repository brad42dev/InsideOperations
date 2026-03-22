---
id: MOD-DESIGNER-003
title: Move selection state from local useRef into uiStore
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The selected node IDs should be stored in `uiStore` (the ephemeral UI state store) rather than in a local `useRef` inside `DesignerCanvas.tsx`. This ensures selection state is accessible to other panels (right panel can show properties for the selected node), is reactive (components can subscribe to selection changes), and follows the three-store contract from the spec.

## Spec Excerpt (verbatim)

> `uiStore` — tool selection, cursor mode, active drag state, hover highlights, panel widths, zoom level. Ephemeral; never persisted.
>
> One monolithic Designer store is wrong. Stores that bleed concerns (e.g. selection state inside sceneStore) are wrong.
> — docs/SPEC_MANIFEST.md, MOD-DESIGNER Non-Negotiable #7

## Where to Look in the Codebase

Primary files:
- `frontend/src/store/designer/uiStore.ts` — UiStore interface (line 146) — no `selectedNodeIds` field present
- `frontend/src/pages/designer/DesignerCanvas.tsx:1507` — `const selectedIdsRef = useRef<Set<NodeId>>(new Set())` — local ref, not in store
- `frontend/src/pages/designer/DesignerCanvas.tsx:1793-1794` — `selectedIdsRef.current = newSelection; emitSelection(...)` — mutates ref and emits CustomEvent
- `frontend/src/pages/designer/DesignerRightPanel.tsx` — subscribes to `io:selection-change` CustomEvent to know what's selected

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `uiStore.ts` has a `selectedNodeIds: Set<NodeId>` field (or `string[]`) with `setSelectedNodes(ids: NodeId[]): void` action
- [ ] `DesignerCanvas.tsx` reads selection from `useUiStore(s => s.selectedNodeIds)` and writes via `setSelectedNodes()`
- [ ] `DesignerRightPanel.tsx` reads selection from `useUiStore(s => s.selectedNodeIds)` instead of listening to `io:selection-change` CustomEvent
- [ ] Existing `emitSelection()` helper and `io:selection-change` CustomEvent are removed (replaced by Zustand subscription)

## Assessment

After checking:
- **Status**: ❌ Missing — selectedIdsRef is a local useRef, not in uiStore

## Fix Instructions

1. In `frontend/src/store/designer/uiStore.ts`, add to `UiStore` interface:
   ```ts
   selectedNodeIds: Set<NodeId>
   setSelectedNodes(ids: NodeId[]): void
   clearSelection(): void
   ```
   And implement in the create() call:
   ```ts
   selectedNodeIds: new Set<NodeId>(),
   setSelectedNodes(ids) { set({ selectedNodeIds: new Set(ids) }) },
   clearSelection() { set({ selectedNodeIds: new Set() }) },
   ```

2. In `frontend/src/pages/designer/DesignerCanvas.tsx`:
   - Import `setSelectedNodes` and `clearSelection` from useUiStore
   - Replace all `selectedIdsRef.current = new Set(...)` with `setSelectedNodes([...ids])`
   - Replace all reads of `selectedIdsRef.current` with `useUiStore.getState().selectedNodeIds` (for synchronous reads inside callbacks) or `useUiStore(s => s.selectedNodeIds)` (for reactive reads in render)
   - Keep `selectedIdsRef` as a local cache if needed for synchronous hit-test callbacks, but keep it in sync with the store
   - Remove the `emitSelection()` function and `io:selection-change` CustomEvent dispatch

3. In `frontend/src/pages/designer/DesignerRightPanel.tsx`:
   - Remove the `io:selection-change` event listener
   - Subscribe to `useUiStore(s => s.selectedNodeIds)` directly

Do NOT:
- Store selectedNodeIds in sceneStore (it would be persisted to the backend as part of the document)
- Use both the ref AND the store simultaneously without keeping them in sync
- Remove the ref entirely before the store subscription is working (do a staged migration)
