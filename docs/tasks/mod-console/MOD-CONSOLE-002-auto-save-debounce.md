---
id: MOD-CONSOLE-002
title: Debounce auto-save 2 seconds after last layout change
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every layout change (pane add/remove/resize/swap, template switch, content assignment) currently triggers an immediate save via `persistWorkspace`. The spec requires a 2-second debounce so that rapid edits (e.g., dragging a pane through several grid positions) do not issue a server request for every intermediate state — only the final settled state should be persisted.

## Spec Excerpt (verbatim)

> Every layout change (pane add/remove/resize/swap, template switch, content assignment) triggers a debounced save
> Debounce period: 2 seconds after last change
> — console-implementation-spec.md, §3.5

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — `handleGridLayoutChange` at line 431, `persistWorkspace` callback at line 296-308. Every caller of `persistWorkspace` fires it synchronously.

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A debounce ref (e.g., `useRef<ReturnType<typeof setTimeout> | null>`) exists for auto-save
- [ ] Every layout-changing action (grid layout change, pane drop, template change, pane remove) clears and restarts the debounce timer
- [ ] After the debounce timer fires (2 seconds after last change), `persistWorkspace` is called once with the latest state
- [ ] Explicit Ctrl+S still saves immediately (bypasses the debounce) — this is existing correct behavior at `index.tsx:449-456`
- [ ] The debounce timer is cleared on component unmount

## Assessment

Current state: `handleGridLayoutChange` at `index.tsx:432-439` calls `persistWorkspace(ws)` synchronously after updating grid items. Same pattern in `handlePaletteDrop` (line 646), `handleChangeLayout` (line 428), `handleRemovePane` (line 528). No debounce timer exists.

## Fix Instructions

1. In `frontend/src/pages/console/index.tsx`, add a save debounce ref near line 340:
   ```typescript
   const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   ```

2. Create a debounced save helper:
   ```typescript
   const scheduleSave = useCallback((ws: WorkspaceLayout) => {
     if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
     saveDebounceRef.current = setTimeout(() => {
       persistWorkspace(ws)
       saveDebounceRef.current = null
     }, 2000)
   }, [persistWorkspace])
   ```

3. Replace all `persistWorkspace(ws)` calls in layout-change handlers with `scheduleSave(ws)`. Do NOT replace the Ctrl+S handler's `persistWorkspace(ws)` — that must remain immediate.

4. Add cleanup on unmount:
   ```typescript
   useEffect(() => () => { if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current) }, [])
   ```

Do NOT:
- Debounce the Ctrl+S manual save path at `index.tsx:453`
- Debounce non-layout changes (e.g., publish toggle, workspace rename) — those should still save immediately
- Remove the save failure banner logic or exponential backoff retry
