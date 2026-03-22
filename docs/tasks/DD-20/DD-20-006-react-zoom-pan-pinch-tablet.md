---
id: DD-20-006
title: Add react-zoom-pan-pinch for tablet graphics pinch-zoom
unit: DD-20
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

On tablet (>=768px mobile), graphics viewed in Console and Process modules must support smooth pinch-zoom between 0.5x (zoomed out) and 5x (zoomed in), with momentum-based velocity animation. The spec requires `react-zoom-pan-pinch` (MIT, ~15 KB) wrapping the shared container div that holds both Canvas and SVG layers, so CSS transforms keep both layers in sync without re-rendering.

## Spec Excerpt (verbatim)

> Use `react-zoom-pan-pinch` (MIT, ~15 KB) — wraps the shared container div holding both Canvas and SVG layers. CSS transforms on the container keep both layers in perfect sync without re-rendering.
> Configure:
> - `minScale`: 0.5x (zoomed out to half)
> - `maxScale`: 5x (zoomed in 5x for detail inspection)
> - Velocity/momentum animation enabled for natural feel
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Graphics on Mobile > Pinch-Zoom

## Where to Look in the Codebase

Primary files:
- `frontend/package.json` — need to add `react-zoom-pan-pinch`
- `frontend/src/shared/graphics/SceneRenderer.tsx` — renders the canvas+SVG container
- `frontend/src/pages/console/panes/GraphicPane.tsx` — wraps SceneRenderer for Console panes
- `frontend/src/pages/process/index.tsx` — wraps SceneRenderer for Process full view

## Verification Checklist

- [ ] `react-zoom-pan-pinch` is present in `frontend/package.json` dependencies
- [ ] `TransformWrapper` and `TransformComponent` from `react-zoom-pan-pinch` wrap the graphics container in at least one of GraphicPane.tsx or SceneRenderer.tsx
- [ ] `minScale={0.5}` and `maxScale={5}` are configured on `TransformWrapper`
- [ ] `velocityAnimation` (or equivalent momentum prop) is enabled
- [ ] The wrapper is only applied on tablet/phone device types (`detectDeviceType() !== 'desktop'`), not on desktop (desktop has its own pan/zoom handling)

## Assessment

- **Status**: ❌ Missing — `react-zoom-pan-pinch` is not in package.json and not used anywhere in the source

## Fix Instructions

1. Install the package:
```bash
cd frontend && pnpm add react-zoom-pan-pinch
```

2. In `frontend/src/pages/process/index.tsx`, wrap the graphics viewport div with `TransformWrapper`:
```tsx
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

const isMobile = detectDeviceType() !== 'desktop'

// In the render, replace the bare container div wrapping SceneRenderer:
{isMobile ? (
  <TransformWrapper
    minScale={0.5}
    maxScale={5}
    velocityAnimation={{ sensitivity: 1, animationTime: 200 }}
    panning={{ velocityDisabled: false }}
  >
    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
      <SceneRenderer ... />
    </TransformComponent>
  </TransformWrapper>
) : (
  <SceneRenderer ... />
)}
```

3. Apply the same pattern to `frontend/src/pages/console/panes/GraphicPane.tsx` for the 4-pane tablet layout.

4. The Leaflet `TileGraphicViewer` already handles its own pinch-zoom — do NOT wrap it with `TransformWrapper`. The TransformWrapper wraps only the Canvas+SVG hybrid renderer (SceneRenderer).

Do NOT:
- Wrap the desktop renderer with TransformWrapper — desktop has its own panning via `svg-panzoom` or the existing pan handler
- Set `disabled={true}` on desktop — conditionally render a different element instead
- Apply this to the Leaflet tile viewer — Leaflet manages its own zoom
