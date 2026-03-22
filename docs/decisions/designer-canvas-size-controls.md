---
decision: designer-canvas-size-controls
unit: MOD-DESIGNER
type: fix
date: 2026-03-22
author: feature-agent
---

# Designer — Canvas Size Controls (New Graphic Dialog, Properties, Boundary Visual)

## Context

The spec defines three canvas size features that are not built:
1. The New Graphic dialog collects Name and Mode but not Width/Height. The store hardcodes 1920×1080.
2. There is no File → Properties dialog for resizing an existing canvas.
3. The canvas boundary visual (dashed 1px border when zoomed out) is not rendered.
4. The save warning for nodes outside canvas bounds is not built.

All four are defined in designer-implementation-spec.md §2.1 and §2.2.

## Decision

### New Graphic Dialog — add canvas size inputs + presets

Add Width and Height numeric inputs to `NewGraphicDialog`. Add a preset button row above the inputs.

**Field changes:**
- Add `width: number` and `height: number` to the onConfirm callback signature
- Defaults by mode/scope: Graphic → 1920×1080 (Console scope) or 4000×3000 (Process scope). Dashboard →
  1920×1080. Report → 794×1123 (A4 Portrait, auto-height on — see designer-cross-mode-palette decision).
- Minimum: 320×240. Maximum: 20000×15000.
- W and H inputs are coupled to a proportional lock toggle (unlocked by default). When locked, changing W
  auto-adjusts H to maintain aspect ratio and vice versa.

**Preset buttons:**

All modes:

| Label | W | H |
|---|---|---|
| 720p | 1280 | 720 |
| 1080p | 1920 | 1080 |
| 1440p | 2560 | 1440 |
| 4K | 3840 | 2160 |
| 16:10 Medium | 1920 | 1200 |
| 16:10 Large | 2560 | 1600 |
| 4:3 Standard | 1024 | 768 |
| 4:3 Large | 1600 | 1200 |
| Ultrawide | 3440 | 1440 |
| Super-Ultrawide | 5120 | 1440 |

Report mode only (additional row):

| Label | W | H |
|---|---|---|
| A4 Portrait | 794 | 1123 |
| A4 Landscape | 1123 | 794 |
| Letter Portrait | 816 | 1056 |
| Letter Landscape | 1056 | 816 |

All dimensions are in SVG units (px at 96dpi). Clicking a preset populates the W/H fields; the user can still
override manually.

Preset buttons render as a compact scrollable chip row (not a dropdown). Active preset is highlighted with
`--io-accent` background. If the user manually changes a field to a value not matching any preset, no preset
is highlighted.

### File → Properties Dialog

Triggered by:
- File menu → "Properties..." (already shown in the File menu stub, §6.1)
- Right-click on empty canvas → "Properties..." (context menu RC-DES-1)

The dialog is a modal with:

**Canvas section:**
- Width: number input (min 320, max 20000) with unit label "px"
- Height: number input (min 240, max 15000) with unit label "px" — disabled/grayed if auto-height is on
  (Report mode)
- Proportional lock toggle (same as New Graphic dialog)
- Same preset chip row as New Graphic dialog (mode-aware)
- Background: color picker (hex input + swatch picker). Changing creates `ChangePropertyCommand` on
  `canvas.backgroundColor`.

**Out-of-bounds warning:**
After the user changes W or H and tabs away (or clicks Apply), if any existing nodes fall outside the new
boundary, show an inline warning in the dialog:
"⚠ N element(s) will be outside the canvas boundary after this change."
with a [Select those elements] link that does NOT close the dialog but highlights the nodes in the canvas.

Changing canvas size creates a `ChangePropertyCommand` on `canvas.width` and/or `canvas.height`. This is
immediately undoable with Ctrl+Z. Nodes are NOT moved or scaled.

**Grid section:**
- Grid size: dropdown (4, 8, 10, 16, 32). Changing creates `ChangePropertyCommand` on `metadata.gridSize`.

No "Apply" button — all changes are live (same pattern as the property panel). The dialog has only a "Close"
button (×).

### Canvas Boundary Visual

When the viewport is zoomed out such that the canvas boundary is visible (i.e., the viewport shows content
beyond x=0, y=0 or x=canvasW, y=canvasH), render:

- A 1px dashed SVG `<rect>` or `<line>` set at the canvas boundary coordinates (0, 0, canvasW, canvasH)
- Stroke: `--io-border-subtle` at 50% opacity
- Dash pattern: `stroke-dasharray="8 4"`
- This element is rendered in the SVG layer, below all content nodes but above the grid
- It is NOT part of the scene graph — it is a pure rendering artifact, never serialized
- It is always visible in Designer edit mode when the zoom level is low enough to reveal the boundary
- It is NOT rendered in Console/Process view-only mode

Condition for "boundary is visible": `panX < 0 || panY < 0 || (panX + viewportW/zoom) > canvasW ||
(panY + viewportH/zoom) > canvasH`. If the canvas perfectly fills the viewport, no boundary rect is shown.

### Save Warning for Out-of-Bounds Nodes

On every explicit save (Ctrl+S, auto-save trigger, or File → Save):

1. Walk the scene graph. For each top-level node, compute its bounding box.
2. A node is "outside bounds" if any part of its bounding box is outside (0, 0, canvasW, canvasH).
3. If count > 0: show a non-blocking toast notification:
   - Icon: ⚠ (warning color `--io-warning`)
   - Message: "{N} element{s} outside the canvas boundary"
   - Action button: [Select] — clicking selects only the out-of-bounds nodes and dismisses the toast
   - Auto-dismiss: 8 seconds
4. The save is NOT blocked. This is informational only.
5. If count = 0: no toast.

## Acceptance Criteria

1. New Graphic dialog shows Width and Height number inputs with correct defaults per mode.
2. Clicking a preset populates Width and Height fields; manual override removes preset highlight.
3. Report mode shows the A4/Letter presets in addition to the aspect ratio presets.
4. Proportional lock toggle works correctly in both directions in the New Graphic dialog.
5. File → Properties dialog opens from File menu and from empty-canvas right-click.
6. Width, Height, Background Color, and Grid Size changes in Properties dialog are immediately reflected on
   canvas and undoable with Ctrl+Z.
7. The out-of-bounds inline warning in the Properties dialog accurately counts affected nodes and the
   [Select those elements] link highlights them.
8. The canvas boundary visual (1px dashed border) appears when zoomed out enough to see beyond the canvas
   edge. It disappears when the canvas exactly fills the viewport or when zoomed in so no boundary is visible.
9. On save, if any nodes are outside the canvas boundary, a non-blocking warning toast appears with
   [Select] action. If no nodes are out of bounds, no toast.
10. Proportional lock toggle works in the Properties dialog.

## Out of Scope

- Scaling/moving existing content when the canvas is resized (nodes stay where they are).
- Report auto-height behavior (handled in designer-cross-mode-palette decision).
- Preserve-aspect-ratio enforcement during canvas resize (the spec does not require this for the Properties
  dialog — only the proportional lock toggle is in scope).

## Files Expected to Change

- `frontend/src/pages/designer/index.tsx` — NewGraphicDialog component: add W/H inputs, presets, lock toggle
- `frontend/src/pages/designer/components/CanvasPropertiesDialog.tsx` — new component (File → Properties)
- `frontend/src/pages/designer/DesignerCanvas.tsx` — canvas boundary SVG rect rendering; save warning
  logic (hook into the save event)
- `frontend/src/pages/designer/panels/Toolbar.tsx` — wire File → Properties menu item to dialog
- `frontend/src/store/designer/` — ensure createGraphic action accepts width/height from dialog

## Dependencies

- None. These are standalone UI additions.
