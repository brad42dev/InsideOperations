---
id: DD-23-011
title: Render blinking insertion cursor in workspace at current cursor position
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

A blinking vertical line (2px wide, theme accent color, 530ms on/off) indicates the current insertion point in the workspace. The cursor exists at the top level and inside container tiles. Arrow keys navigate it, and clicking between tiles repositions it. This is the visual indicator for where the next tile will be inserted.

## Spec Excerpt (verbatim)

> A blinking vertical line (2px wide, theme accent color) indicates the current insertion point:
> - **Blink rate**: 530ms on, 530ms off (standard)
> - **Can exist in**: The main workspace or inside any container tile
> - **During drag**: The cursor becomes solid (non-blinking) and shows at the potential drop position
> — design-docs/23_EXPRESSION_BUILDER.md, §6.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1056–1069` — state has `cursorParentId` and `cursorIndex` but nothing renders them
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:864–901` — DropZoneRow; where cursor element should be inserted between tiles

## Verification Checklist

- [ ] A cursor element (2px wide, var(--io-accent) color) is rendered between tiles in DropZoneRow at the position matching cursorParentId/cursorIndex
- [ ] The cursor blinks at 530ms on/530ms off using CSS animation
- [ ] Clicking between two tiles in the workspace sets the cursor to that position
- [ ] During drag (activeDragId !== null), the cursor is shown as solid at the drop target position

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `cursorParentId` and `cursorIndex` are tracked in state (line 1056) but no visual element is rendered for the cursor. DropZoneRow renders tiles without any insertion indicator.

## Fix Instructions (if needed)

1. Add a CSS keyframe animation `@keyframes io-cursor-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }` (can use a `<style>` tag injected once, or a CSS module if available).
2. In DropZoneRow, after rendering each tile, check if `cursorParentId === parentId` and `cursorIndex === i + 1`. If yes, insert a cursor `<div>`:
   ```tsx
   <div style={{
     width: '2px', height: '36px', background: 'var(--io-accent)',
     animation: isDragging ? 'none' : 'io-cursor-blink 1.06s step-end infinite',
     flexShrink: 0,
   }} />
   ```
3. Also render the cursor at index 0 (before first tile) if cursorIndex === 0.
4. Handle clicks on the empty space between tiles: add onClick handlers on invisible hitboxes (10px wide) between each tile to dispatch `SET_CURSOR`.
5. Pass `isDragging: boolean` (derived from `activeDragId !== null`) to DropZoneRow to suppress the blink animation during drag.

Do NOT:
- Use `useInterval` for blinking — CSS animation is the correct approach (no JS timer overhead)
