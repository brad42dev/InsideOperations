---
id: MOD-DESIGNER-017
unit: MOD-DESIGNER
title: Build File → Properties dialog for canvas resize and background color
status: pending
priority: high
depends-on: [MOD-DESIGNER-016]
source: feature
decision: docs/decisions/designer-canvas-size-controls.md
---

## What to Build

Create a new `CanvasPropertiesDialog` component and wire it to the File menu "Properties..." item and the
empty-canvas right-click menu "Properties..." item (RC-DES-1).

### Component: `CanvasPropertiesDialog`

Create `frontend/src/pages/designer/components/CanvasPropertiesDialog.tsx`.

The dialog is a non-blocking floating panel (not a full-screen modal — the user should be able to see the
canvas behind it). Alternatively, a modal is acceptable if the decision is simpler. Either way, it has no
"Apply" button — changes are live.

**Canvas section:**

- **Width** — number input. Min 320, Max 20000. Unit: "px".
- **Height** — number input. Min 240, Max 15000. Unit: "px". Label is "Min. Height" when `autoHeight=true`.
  Disabled (grayed, with tooltip "Canvas grows automatically") if `autoHeight=true` and mode=report.
- Proportional lock toggle between W and H (same as New Graphic dialog).
- **Preset chip row** — same presets as New Graphic dialog, same mode-awareness (Report mode adds A4/Letter).
- **Auto-grow vertically** — checkbox. Label: "Auto-grow vertically (for scrollable content)". Checked by
  default for Report graphics; unchecked for Graphic and Dashboard. Changes `canvas.autoHeight` via
  `ChangePropertyCommand`. When checked, the Height input is relabeled "Min. Height".

**Out-of-bounds warning** (shown inline when W or H would cause nodes to fall outside):
- Computed live as the user types (debounced 300ms after typing stops)
- Message: "⚠ {N} element(s) will be outside the canvas boundary after this change."
- Link: "[Select those elements]" — does NOT close dialog; selects the out-of-bounds nodes in the canvas
  (dispatches selection change)
- If count = 0: no warning shown.

Node is "outside bounds" if any part of its bounding box is outside (0, 0, newW, newH).

**Background color:**
- Color swatch + hex text input. Default `#09090b`. Clicking swatch opens a small popover color picker.
- Changing color creates `ChangePropertyCommand` on `canvas.backgroundColor`. Live preview on canvas.

**Grid section:**
- Grid size: dropdown with options 4, 8, 10, 16, 32. Current value from `doc.metadata.gridSize`.
- Changing creates `ChangePropertyCommand` on `metadata.gridSize`.

**Close button** — × in top-right corner of the dialog. No "Apply" button.

### Making changes live

Every field change (W, H, background, grid, autoHeight) creates an appropriate command via `executeCmd`.
These are immediately reflected on the canvas and are undoable with Ctrl+Z. W/H changes are debounced 500ms
(to avoid creating 20 undo entries while the user types "1920").

W and H changes use `ChangePropertyCommand` on `canvas.width` and `canvas.height`.

### Wiring

1. **File menu** — in `DesignerToolbar.tsx` (or wherever the File dropdown is), find the existing
   "Properties..." menu item stub. Wire its `onClick` to `setShowPropertiesDialog(true)` (lift state to
   the page-level `index.tsx` component). Render `<CanvasPropertiesDialog>` when the flag is true.

2. **Empty-canvas right-click (RC-DES-1)** — this is the existing empty-canvas context menu in
   `DesignerCanvas.tsx`. Find the "Properties..." item in that menu and wire the same `onPropertiesOpen`
   prop/callback. The canvas already has a mechanism to call back to the parent for other dialogs — use the
   same pattern.

## Acceptance Criteria

- [ ] File → Properties... opens the CanvasPropertiesDialog.
- [ ] Right-click on empty canvas → Properties... opens the same dialog.
- [ ] Only one dialog instance can be open at a time (opening it again focuses/brings it to front if modal,
      or is a no-op if already open).
- [ ] Changing Width and Height (after 500ms debounce) creates ChangePropertyCommands; the canvas updates and
      Ctrl+Z restores the previous size.
- [ ] If the new size would place ≥1 nodes outside bounds, the warning message appears with accurate count.
      [Select those elements] selects the out-of-bounds nodes without closing the dialog.
- [ ] Changing background color updates the canvas background live and is undoable.
- [ ] Changing grid size updates the grid and is undoable.
- [ ] Auto-grow checkbox changes `canvas.autoHeight` and is undoable. When enabled, Height input is
      relabeled "Min. Height".
- [ ] Preset chips work the same as in the New Graphic dialog (clicking populates W/H, manual override
      clears highlight).
- [ ] Proportional lock toggle works correctly.

## Do NOT

- Do not rebuild the entire file menu (only wire the existing stub).
- Do not implement canvas boundary visual rendering here (that is MOD-DESIGNER-018).
- Do not implement autoHeight canvas rendering behavior (MOD-DESIGNER-020).

## Dev Notes

New file: `frontend/src/pages/designer/components/CanvasPropertiesDialog.tsx`
Modified files:
- `frontend/src/pages/designer/index.tsx` — add `showPropertiesDialog` state, render dialog, pass open callback to DesignerCanvas and Toolbar
- `frontend/src/pages/designer/DesignerToolbar.tsx` or `panels/Toolbar.tsx` — wire File → Properties
- `frontend/src/pages/designer/DesignerCanvas.tsx` — wire RC-DES-1 "Properties..." context menu item

The out-of-bounds count can be computed by walking `doc.children` and calling `getNodeBounds(node)` for each
— compare against `{0, 0, proposedW, proposedH}`. Import `getNodeBounds` or duplicate the logic.

For the color picker, use an `<input type="color">` element alongside the hex text input — native color
picker is sufficient (no extra library). Style the native input to be invisible, trigger it from the swatch click.

`ChangePropertyCommand` path for canvas: `'canvas.width'`, `'canvas.height'`, `'canvas.backgroundColor'`,
`'canvas.autoHeight'`, `'metadata.gridSize'`.
