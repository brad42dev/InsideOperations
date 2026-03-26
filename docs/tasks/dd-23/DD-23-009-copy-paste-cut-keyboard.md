---
id: DD-23-009
title: Implement Ctrl+C, Ctrl+X, Ctrl+V clipboard operations for tiles
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Selected tiles can be copied (Ctrl+C), cut (Ctrl+X), and pasted (Ctrl+V) at the cursor position. Paste inside a container tile pastes inside that container. Cut shows a delete confirmation before removing the source tiles.

## Spec Excerpt (verbatim)

> **Copy**: Ctrl+C or right-click > "Copy": Copies selected tile(s) to clipboard
> **Paste**: Ctrl+V or right-click empty workspace > "Paste": Pastes at cursor position
> **Cut**: Ctrl+X or right-click > "Cut": Copy + Delete (with confirmation for the delete portion).
> — design-docs/23_EXPRESSION_BUILDER.md, §6.7

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1093–1107` — keyboard handler; only handles Ctrl+Z and Ctrl+Y
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:164–197` — ExprBuilderState; no clipboard field

## Verification Checklist

- [ ] `ExprBuilderState` has a `clipboard: ExpressionTile[] | null` field
- [ ] `Action` union includes `COPY_SELECTION`, `CUT_SELECTION`, `PASTE`
- [ ] Ctrl+C adds selected tiles to clipboard state (deep clone)
- [ ] Ctrl+X adds selected tiles to clipboard, then shows delete confirmation, then removes them
- [ ] Ctrl+V inserts clipboard tiles at `cursorParentId`/`cursorIndex`
- [ ] Paste assigns new IDs to pasted tiles (avoid duplicate IDs in workspace)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: The keyboard handler (lines 1093–1107) only handles `Ctrl+Z` and `Ctrl+Y`. No clipboard state exists in ExprBuilderState (lines 164–197). No COPY, CUT, or PASTE actions are in the Action union (lines 183–197).

## Fix Instructions (if needed)

1. Add `clipboard: ExpressionTile[] | null` to `ExprBuilderState` and initialize it as `null`.
2. Add `COPY_SELECTION`, `CUT_SELECTION`, and `PASTE` to the `Action` union.
3. In `exprReducer`:
   - `COPY_SELECTION`: deep-clone all selected tiles and store in `clipboard`; no tile mutation
   - `CUT_SELECTION`: same as COPY_SELECTION, then delete selected tiles; push to `past`
   - `PASTE`: insert clipboard tiles (with new UUIDs via a `reassignIds` helper) at `cursorParentId`/`cursorIndex`
4. Write `reassignIds(tiles: ExpressionTile[]): ExpressionTile[]` that walks the tree and replaces every `id` with a new `newId()`.
5. In the keyboard handler (line 1093), add:
   ```typescript
   if (e.key === 'c') { e.preventDefault(); dispatch({ type: 'COPY_SELECTION' }) }
   if (e.key === 'x') { e.preventDefault(); /* show confirm then */ dispatch({ type: 'CUT_SELECTION' }) }
   if (e.key === 'v') { e.preventDefault(); if (state.clipboard) dispatch({ type: 'PASTE' }) }
   ```
6. For Cut confirmation: use the same confirm dialog pattern as DD-23-008.

Do NOT:
- Use the browser clipboard API (navigator.clipboard) — keep clipboard in component state only
- Skip reassigning IDs on paste — duplicate IDs break dnd-kit and findTileLocation
