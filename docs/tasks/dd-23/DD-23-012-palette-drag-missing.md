---
id: DD-23-012
title: Implement drag-and-drop from palette to workspace (Method 2)
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Users can drag a tile from the palette and drop it into the workspace (or into a container tile). While dragging, an insertion indicator shows the drop position. Palette tiles are never consumed — they remain available. This is "Method 2" per spec §6.1.

## Spec Excerpt (verbatim)

> **Method 2 -- Drag-and-drop**: Left-click and hold a palette tile, drag it into the workspace. While dragging, an insertion indicator shows where the tile will land. Release to drop.
> Both methods create a new instance of the tile in the workspace. Palette tiles are never consumed — they remain available for repeated use.
> — design-docs/23_EXPRESSION_BUILDER.md, §6.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:908–943` — PaletteTile; currently just a button with onClick
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1335–1386` — workspace DndContext

## Verification Checklist

- [ ] PaletteTile uses `useDraggable` from @dnd-kit/core (not just onClick)
- [ ] The DndContext wrapping the workspace also wraps the palette, or palette items use a separate draggable ID namespace (prefixed with "palette-")
- [ ] `handleDragEnd` detects when the active ID has the palette prefix and creates a new tile at the drop position instead of reordering
- [ ] Palette tiles remain rendered after drag (not consumed)
- [ ] The DragOverlay shows a ghost tile while dragging from palette

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: PaletteTile (line 908) renders as `<button onClick={() => onClickAdd(item.type)}>` — no `useDraggable`. The DndContext at line 1335 only wraps the workspace, not the palette. Palette drag is entirely absent.

## Fix Instructions (if needed)

1. Extend the DndContext to wrap both the palette and the workspace. Move the `<DndContext>` opening tag to before the palette section (line ~1307) and close it after DragOverlay (line ~1386).
2. Add a `useDraggable` hook to PaletteTile:
   ```typescript
   const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
     id: `palette-${item.type}`,
     data: { source: 'palette', tileType: item.type },
   })
   ```
3. In `handleDragEnd`, detect palette drags:
   ```typescript
   const isPaletteSource = String(active.id).startsWith('palette-')
   if (isPaletteSource) {
     const tileType = active.data.current?.tileType as TileType
     const tile = createTile(tileType)
     const toLoc = findTileLocation(state.tiles, String(over?.id))
     dispatch({ type: 'INSERT_TILE', tile, parentId: null, index: toLoc?.index ?? state.tiles.length })
   }
   ```
4. Keep the click-to-add (handleAddFromPalette) intact — both methods must work.
5. When a palette tile is being dragged (`isDragging`), dim it to 40% opacity but do not remove it from the palette.

Do NOT:
- Remove the onClick handler from PaletteTile — both click and drag must work together
- Consume/hide the palette tile while dragging — they are "stamps," not "tokens"
