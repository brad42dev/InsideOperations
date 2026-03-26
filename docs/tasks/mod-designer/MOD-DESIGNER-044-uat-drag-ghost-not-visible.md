---
id: MOD-DESIGNER-044
unit: MOD-DESIGNER
title: Drag ghost not visible during palette-to-canvas drag
status: completed
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When dragging a shape or display element from the palette to the canvas, a drag ghost (preview image) must appear under the cursor. Per spec, this is implemented as `#io-canvas-drag-ghost` in the DOM.

During UAT on 2026-03-26:
- mouse.down() + mouse.move() + mouse.up() drag from palette tile to canvas: NO ghost element appeared (`#io-canvas-drag-ghost` not found, no ghost-class elements, no pointer-events:none floating elements)
- browser_drag (Playwright dragTo): element WAS placed on canvas successfully, but ghost could not be checked mid-drag (dragTo is synchronous)

The drag mechanism uses pointer events (not HTML5 drag API, since tiles have no `draggable="true"`). The ghost element should appear once the drag crosses a threshold distance.

Expected: during any drag from palette to canvas, `#io-canvas-drag-ghost` appears in the DOM with a preview of the shape being dragged.

## Acceptance Criteria

- [ ] `#io-canvas-drag-ghost` element exists in the DOM during a palette→canvas drag
- [ ] The ghost element is positioned under the cursor and moves with it
- [ ] The ghost shows a preview of the shape being dragged (not just a blank box)
- [ ] The ghost disappears when the drag is released or cancelled (Escape key)

## Verification Checklist

- [ ] Navigate to /designer, create a new graphic
- [ ] Begin dragging a shape from the Equipment palette toward the canvas
- [ ] Mid-drag: confirm `document.getElementById('io-canvas-drag-ghost')` returns a visible element
- [ ] Release on canvas: ghost disappears, node appears on canvas

## Do NOT

- Do not implement using HTML5 drag events (dragstart/dragend) — use pointer events
- Do not show ghost only at drop time — it must be visible throughout the drag

## Dev Notes

UAT failure from 2026-03-26: drag via mouse.down+move+up from (88,422) to (580,230) — no ghost appeared at any point during move sequence. Multiple prior UAT sessions (MOD-DESIGNER-031, MOD-DESIGNER-032, MOD-DESIGNER-035) also reported this failure — consistently not fixed across audit rounds.
Spec reference: MOD-DESIGNER-002, MOD-DESIGNER-031, graphics-scene-graph-implementation-spec.md §drag-ghost
