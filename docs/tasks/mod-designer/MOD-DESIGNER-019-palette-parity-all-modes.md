---
id: MOD-DESIGNER-019
unit: MOD-DESIGNER
title: Palette parity — add Widgets to Graphic mode and Stencils to Dashboard/Report mode
status: pending
priority: medium
depends-on: [MOD-DESIGNER-016]
source: feature
decision: docs/decisions/designer-cross-mode-palette.md
---

## What to Build

Three palette additions and one toolbar verification, all in `DesignerLeftPalette.tsx`.

### 1. Add "Widgets" section to Graphic mode palette

The Graphic mode palette currently has: Equipment, Stencils, Display Elements.
Add a fourth collapsible section: **Widgets** (same 8 types as Dashboard mode).

The Widget section in Dashboard mode already exists. Reuse that exact section component/rendering logic —
extract it into a shared `<WidgetPaletteSection>` sub-component if it isn't already. Render it as Section 4
of the Graphic mode palette.

Palette section order for Graphic mode after this change:
1. Equipment (shapes) — existing
2. Stencils — existing
3. Display Elements — existing
4. **Widgets** — new

Drag behavior: same as Dashboard mode. Dragging a widget from the Graphic mode palette onto the canvas
creates a `WidgetNode` and renders it in the HTML overlay layer. The canvas `designMode: 'graphic'` does
NOT prevent WidgetNode creation — the architecture already supports this (widgets render in the HTML overlay
regardless of canvas mode). No code changes needed to the rendering pipeline for this.

### 2. Add "Stencils" section to Dashboard mode palette

The Dashboard mode palette currently has: Widgets, Equipment (shapes + display elements).
Add a **Stencils** section between Equipment and Display Elements.

Palette section order for Dashboard mode after this change:
1. Widgets — existing
2. Equipment (shapes) — existing
3. **Stencils** — new
4. Display Elements — existing

Reuse the exact same `<StencilPaletteSection>` used in Graphic mode (extract if needed).

Drag behavior: same as Graphic mode. Dragging a stencil onto a Dashboard canvas creates a Stencil node.

### 3. Add "Stencils" section to Report mode palette

Same as Dashboard mode addition. Report mode currently inherits Dashboard sections plus Report Elements.
Add the Stencils section in the same position (after Equipment, before Display Elements).

Palette section order for Report mode after this change:
1. Widgets — existing
2. Equipment (shapes) — existing
3. **Stencils** — new
4. Display Elements — existing
5. Report Elements — existing

### 4. Verify draw tools are active in all modes

In `DesignerCanvas.tsx` or `DesignerToolbar.tsx`, check whether the draw tools (Rect, Ellipse, Line, Pen,
Pipe) are mode-gated. Specifically look for any condition like:
```typescript
if (activeMode !== 'graphic') return  // or similar guard
```

If such a guard exists for draw tools (as opposed to the palette sections), remove it. Draw tools should
be functional in Dashboard and Report modes. The toolbar should show the same draw tool buttons in all modes.

If no guard exists (draw tools already work in all modes), confirm this with a quick scan and note it.

### Search scope fix

The palette search bar filters by name. After adding the new sections, ensure the search scope includes:
- Widget type names (Trend, Table, Gauge, KPI Card, Bar Chart, Pie Chart, Alarm List, Muster Point) in
  Graphic mode
- Stencil names in Dashboard and Report modes

The existing search implementation likely already handles this if the new sections are added as proper
collapsible sections that participate in the existing filter logic.

## Acceptance Criteria

- [ ] Graphic mode palette has a "Widgets" section with all 8 widget types (Trend, Table, Gauge, KPI Card,
      Bar Chart, Pie Chart, Alarm List, Muster Point).
- [ ] Dragging a widget from the Graphic mode palette onto a Graphic canvas creates a WidgetNode visible
      in the HTML overlay.
- [ ] Dashboard mode palette has a "Stencils" section. Stencils can be dragged onto Dashboard canvases.
- [ ] Report mode palette has a "Stencils" section. Stencils can be dragged onto Report canvases.
- [ ] Draw tools (Rect, Ellipse, Line, Pipe) are active in all three canvas modes. Drawing a rect on a
      Dashboard canvas creates a Primitive node.
- [ ] Palette search filters widget names in Graphic mode and stencil names in Dashboard/Report modes.
- [ ] Collapsing/expanding any of the new sections works correctly.
- [ ] The new sections respect the theme (design tokens, no hardcoded colors).

## Do NOT

- Do not gate widget placement by canvas designMode — any canvas can hold any node type.
- Do not change how the existing sections render their items.
- Do not add a Widget section to Report mode (it already has one via Dashboard inheritance).
- Do not build the auto-height scrollable canvas here (that is MOD-DESIGNER-020).

## Dev Notes

File to edit: `frontend/src/pages/designer/DesignerLeftPalette.tsx`
The palette renders different content based on `activeMode` from `useUiStore()`.
Look for the `activeMode === 'graphic'` / `'dashboard'` / `'report'` conditionals that render sections.
Extracting `<WidgetPaletteSection>` and `<StencilPaletteSection>` as named sub-components will prevent
duplication across modes — do this even if it means slightly restructuring the existing palette rendering.
Each section should follow the existing collapsible section pattern: header row with chevron + item count
badge, collapse/expand on click, items inside.
Widget thumbnails: each widget type should have a small icon or mini-preview. Reuse what Dashboard mode
already uses. If Dashboard mode uses placeholder icons, match that approach.
