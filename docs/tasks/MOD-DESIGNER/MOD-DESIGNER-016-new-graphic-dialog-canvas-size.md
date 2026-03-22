---
id: MOD-DESIGNER-016
unit: MOD-DESIGNER
title: Add canvas size inputs and aspect preset buttons to New Graphic dialog
status: pending
priority: high
depends-on: []
source: feature
decision: docs/decisions/designer-canvas-size-controls.md
---

## What to Build

The `NewGraphicDialog` in `frontend/src/pages/designer/index.tsx` currently collects Name and Mode only.
Add Width, Height, and preset buttons. Also pass width/height through to the store's create action.

### Dialog changes

Add below the Mode row:

1. **Preset chip row** — a horizontally scrollable row of small clickable chips. Mode-aware:

   All modes:
   ```
   720p (1280×720)   1080p (1920×1080)   1440p (2560×1440)   4K (3840×2160)
   16:10 M (1920×1200)   16:10 L (2560×1600)
   4:3 Std (1024×768)   4:3 Lg (1600×1200)
   Ultrawide (3440×1440)   Super-UW (5120×1440)
   ```
   Report mode only (additional row):
   ```
   A4 Portrait (794×1123)   A4 Landscape (1123×794)
   Letter Portrait (816×1056)   Letter Landscape (1056×816)
   ```

   Active preset chip: background `var(--io-accent)`, text `#09090b`. Inactive: `var(--io-surface)` border.
   If user manually types a W or H that doesn't match any preset, clear the active chip highlight.

2. **Width and Height inputs** — two number inputs side by side:
   - Labels: "Width" and "Height" (or "Min. Height" when mode=report)
   - Units: "px" suffix label next to each input
   - Min: 320 (W), 240 (H). Max: 20000 (W), 15000 (H).
   - Proportional lock toggle button between them (chain-link icon). Default: unlocked.
   - When locked: changing W recalculates H = W × (currentH/currentW), and vice versa. Rounded to nearest integer.

3. **Defaults** — set when mode changes:
   - `graphic` → W=1920, H=1080
   - `dashboard` → W=1920, H=1080
   - `report` → W=794, H=1123 (A4 Portrait), autoHeight=true
   - Clear the active preset chip when mode changes unless the new default matches a preset.

### onConfirm callback signature change

Change `onConfirm` from:
```typescript
(name: string, mode: 'graphic' | 'dashboard' | 'report') => void
```
to:
```typescript
(name: string, mode: 'graphic' | 'dashboard' | 'report', width: number, height: number, autoHeight: boolean) => void
```

### Store/API wiring

Trace `handleNewConfirm` in `index.tsx` to wherever it calls the API to create the graphic. Pass `width`,
`height`, and `autoHeight` into the graphic creation payload. The `GraphicDocument` is initialized with
`canvas: { width, height, backgroundColor: '#09090b', autoHeight }`.

The `autoHeight` field on `GraphicDocument.canvas` is new — add it to the TypeScript type in
`frontend/src/shared/types/graphics.ts`. Default: `false`. Set to `true` when mode=report.

## Acceptance Criteria

- [ ] New Graphic dialog shows a Width input, Height input, and preset chip row.
- [ ] Clicking a preset populates both inputs with the correct values and highlights the chip.
- [ ] Manually overriding a width or height clears the preset highlight.
- [ ] Mode switching updates the default W/H and active preset chip.
- [ ] Report mode shows the A4/Letter preset chips in addition to the aspect ratio presets.
- [ ] Proportional lock toggle: when locked, changing W auto-adjusts H and vice versa.
- [ ] W and H are passed to the store; the created graphic has the correct canvas dimensions.
- [ ] Report graphics are created with `autoHeight: true`.
- [ ] Min/max enforcement: W < 320 snaps to 320 on blur; W > 20000 snaps to 20000. Same for H.

## Do NOT

- Do not build the File → Properties dialog here (that is MOD-DESIGNER-017).
- Do not implement the auto-height canvas rendering behavior here (that is MOD-DESIGNER-020).
- Do not change the Mode or Name fields.

## Dev Notes

File to edit: `frontend/src/pages/designer/index.tsx` — `NewGraphicDialog` component (lines 44–176).
`frontend/src/shared/types/graphics.ts` — add `autoHeight: boolean` to the `canvas` field of `GraphicDocument`.
The preset chip row should be a scrollable `<div>` with `overflow-x: auto; display: flex; gap: 6px; flex-wrap: nowrap`.
The proportional lock icon: use a chain-link SVG or a simple "🔗" emoji in a toggle button.
Keep the dialog width at 380px — it will get taller with the new fields. Consider 480–520px total height.
The `handleNewConfirm` function further down in `index.tsx` calls either `api.createGraphic(...)` or dispatches
to the store — follow the call chain and add the new parameters.
