---
decision: designer-cross-mode-palette
unit: MOD-DESIGNER
type: change
date: 2026-03-22
author: feature-agent
---

# Designer — Cross-Mode Palette Parity + Scrollable Canvas

## Context

The Designer has three modes: Graphic, Dashboard, Report. Each mode currently exposes a different palette
of draggable elements, and the canvas has a fixed size in all modes. This creates artificial restrictions:

- Widgets (trend charts, data tables, gauges, etc.) cannot be dragged onto a Graphic canvas — yet nothing in
  the architecture prevents it (widgets render in the HTML overlay regardless of canvas designMode).
- Stencils cannot be dragged onto Dashboard or Report canvases.
- Reports need variable vertical height (long tables, multi-section reports), but the canvas model treats all
  canvases as fixed-size rectangles.
- Draw tools (rect, ellipse, line, pipe) may be silently blocked or subtly behave differently in Dashboard
  and Report modes.

The user intent is full cross-mode uniformity: every element type can be placed in any mode. The difference
between modes is WHERE the graphic is displayed and its scrollability, not what can be put in it.

## Decision

### Palette Parity — all elements available in all three modes

**Graphic mode palette — add Widget section:**
Add a collapsible "Widgets" section (Section 4) to the Graphic mode palette, below the Display Elements
section. It contains the same 8 widget types as the Dashboard/Report palette, with the same icons, min sizes,
and drag behavior.

**Dashboard mode palette — add Stencils section:**
Add a collapsible "Stencils" section between Equipment and Display Elements. Same content and behavior as the
Graphic mode Stencils section (drag to canvas → creates Stencil node; right-click menu with Export SVG,
Replace SVG, Delete, Promote to Shape).

**Report mode palette — add Stencils section:**
Same as Dashboard mode. (Report already inherits Widget and Equipment sections from Dashboard.)

**Draw tools in all modes:**
The toolbar draw tools (Rect, Ellipse, Line, Pipe, Pen/Freehand) must be active and functional in Dashboard
and Report modes. If any mode-gate exists in the current code that suppresses draw tools in Dashboard or
Report modes, remove it. The toolbar shows the same tools in all three modes.

**Palette section order per mode:**

| Mode | Section order |
|---|---|
| Graphic | 1. Equipment (shapes), 2. Stencils, 3. Display Elements, 4. **Widgets** |
| Dashboard | 1. **Widgets**, 2. Equipment (shapes), 3. **Stencils**, 4. Display Elements |
| Report | 1. **Widgets**, 2. Equipment (shapes), 3. **Stencils**, 4. Display Elements, 5. Report Elements |

Items already present in a section are not changed. Only missing sections are added.

**Pipes on Dashboard/Report canvases:**
Pipes can be drawn on any canvas mode. They behave as visual connectors (useful for diagram flows on
dashboards). No restriction.

### Scrollable Canvas — Report and Dashboard modes

The current canvas model treats every canvas as a fixed-size rectangle. Reports need unbounded vertical
height. Dashboards benefit from optional vertical scrollability.

**Schema change — add `canvas.autoHeight` boolean to GraphicDocument:**

```typescript
canvas: {
  width: number;
  height: number;            // Treated as minimum height / page height hint when autoHeight=true
  backgroundColor: Color;
  autoHeight: boolean;       // Default: false for graphic/dashboard, true for report
}
```

**Behavior when `autoHeight = true`:**
- The SVG element's height is computed at render time as `max(canvas.height, contentBoundingBox.bottom + 80)`.
  It grows as content is added below the declared height; it never shrinks below `canvas.height`.
- The canvas boundary visual shows only the left/right/top edges (no bottom edge when auto-height is on).
  A light horizontal dashed line at `canvas.height` shows the "minimum height" / page guide.
- The Designer canvas panel gains a vertical scrollbar when content extends below the viewport.
- In Console/Process view-only mode, the SVG height also auto-sizes (so report graphics scroll correctly
  when placed in a pane or report viewer).
- The height field in the Properties dialog is relabeled "Min. Height / Page Height" when autoHeight is on,
  and a badge "Auto-growing" appears next to it.

**Behavior when `autoHeight = false` (default for all modes):**
- Canvas is fixed as today. No change.

**Defaults by mode on creation:**
- Graphic: `autoHeight: false`
- Dashboard: `autoHeight: false` (but user can toggle in Properties dialog)
- Report: `autoHeight: true` (set automatically in New Graphic dialog when mode = report)

**Properties dialog toggle:**
The Canvas Properties dialog gains an "Auto-grow vertically" checkbox. For Report mode canvases, this
defaults to checked but can be unchecked (for fixed-page reports). For Dashboard canvases, defaults unchecked.
For Graphic canvases, the checkbox is shown but defaults unchecked.

### New Graphic dialog defaults for autoHeight

- Mode = report → autoHeight = true, H field shows 1123 (A4 Portrait default) labeled "Min. Height"
- Mode = dashboard or graphic → autoHeight = false, H field shows fixed height

## Acceptance Criteria

1. The Graphic mode palette has a "Widgets" section with all 8 widget types. Dragging a widget onto a
   Graphic canvas creates a WidgetNode and renders it in the HTML overlay layer.
2. The Dashboard mode palette has a "Stencils" section. Dragging a stencil onto a Dashboard canvas creates
   a Stencil node.
3. The Report mode palette has a "Stencils" section. Dragging a stencil onto a Report canvas creates a
   Stencil node.
4. Draw tools (rect, ellipse, line, pipe) are active in all three modes. Drawing a rect on a Dashboard
   creates a Primitive node.
5. Pipes can be drawn on Dashboard and Report canvases (no restriction).
6. New Report graphics default to `canvas.autoHeight = true`. The canvas grows vertically as content is
   added below the declared height.
7. Dashboard canvases have `autoHeight = false` by default but can be toggled in Properties dialog.
8. When `autoHeight = true`, the canvas bottom boundary is not drawn; a dashed guide appears at the declared
   canvas height. The canvas panel scrolls vertically when content extends below the viewport.
9. The New Graphic dialog sets autoHeight correctly based on mode. The H field is relabeled "Min. Height"
   for Report mode.
10. Toggling autoHeight in the Properties dialog is undoable with Ctrl+Z.

## Out of Scope

- Enforcing that widgets ONLY appear in Dashboard/Report canvases (they can appear in any mode — this is
  by design).
- Report page-break rendering at the declared height (that is a report generation/print feature, not a
  designer canvas feature).
- Horizontal auto-width (width is always fixed regardless of mode).
- Custom palette sections or user-reordering of palette sections.

## Files Expected to Change

- `frontend/src/pages/designer/DesignerLeftPalette.tsx` — add Widget section to Graphic mode; add Stencils
  section to Dashboard and Report modes
- `frontend/src/pages/designer/panels/Toolbar.tsx` or DesignerCanvas.tsx — remove any mode-gates on draw
  tools
- `frontend/src/shared/types/graphics.ts` — add `autoHeight: boolean` to GraphicDocument canvas interface
- `frontend/src/pages/designer/index.tsx` — NewGraphicDialog: set autoHeight default per mode
- `frontend/src/pages/designer/DesignerCanvas.tsx` — auto-sizing SVG height when autoHeight=true;
  boundary visual update (no bottom edge when autoHeight=true, guide line at canvas.height)
- `frontend/src/pages/designer/components/CanvasPropertiesDialog.tsx` — auto-grow toggle, relabeled H field
- Backend: `services/api-gateway/src/handlers/graphics.rs` — schema migration for autoHeight field (default false)

## Dependencies

- `designer-canvas-size-controls` — the CanvasPropertiesDialog is created in that decision; the autoHeight
  toggle is added to it here. Implement designer-canvas-size-controls first (or concurrently with this task).
