---
id: MOD-PROCESS-001
title: Auto zoom-to-fit on initial graphic load
unit: MOD-PROCESS
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When a process graphic first loads into the viewport, the view should automatically scale and position the graphic so the entire canvas fits within the available screen area. Users should not have to manually click "Fit" after opening a graphic — they start with the full graphic visible and then zoom into the area of interest.

## Spec Excerpt (verbatim)

> **Initial load: zoom-to-fit** — when a graphic first loads in Process view, the viewport auto-zooms to fit the entire graphic within the viewport. Users then zoom in to the area of interest. Loading at 100% zoom (no fit) is wrong.
> — process-implementation-spec.md, §Manifest Non-Negotiable #9

> Initial zoom: zoom-to-fit (entire graphic visible) [vs Console: 100% (fit to pane)]
> — process-implementation-spec.md, §6.1 Initial Load table

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:420-424` — the useEffect that runs when a graphic loads; currently sets `zoom: 1`
- `frontend/src/pages/process/index.tsx:525-530` — the `zoomFit()` function which computes correct fit zoom
- `frontend/src/pages/process/index.tsx:407-417` — viewport resize observer that sets `screenWidth`/`screenHeight`

## Verification Checklist

- [ ] When `graphic?.scene_data` loads for the first time, the viewport zoom is set to `Math.min(screenWidth / canvasWidth, screenHeight / canvasHeight)` with 20px padding, not `1`.
- [ ] The zoom-to-fit fires after `screenWidth` and `screenHeight` are known (not before the resize observer has reported dimensions).
- [ ] Subsequent view changes (switching to another graphic) also trigger zoom-to-fit.
- [ ] Manual zoom changes after load are not reset.

## Assessment

- **Status**: ❌ Missing
- `index.tsx:423` sets `zoom: 1` unconditionally when graphic loads. The `zoomFit()` function (line 525) computes the correct zoom but is never called on load — only called when user clicks the Fit button or presses Ctrl+0.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`, change the useEffect at lines 420-424 from:

```typescript
useEffect(() => {
  if (!graphic?.scene_data) return
  const { width, height } = graphic.scene_data.canvas
  setViewport((vp) => ({ ...vp, canvasWidth: width, canvasHeight: height, panX: 0, panY: 0, zoom: 1 }))
}, [graphic?.scene_data])
```

To:

```typescript
useEffect(() => {
  if (!graphic?.scene_data) return
  const { width, height } = graphic.scene_data.canvas
  setViewport((vp) => {
    const PADDING = 20
    const sw = vp.screenWidth - PADDING * 2
    const sh = vp.screenHeight - PADDING * 2
    const fitZoom = sw > 0 && sh > 0
      ? Math.min(sw / width, sh / height)
      : 1
    return { ...vp, canvasWidth: width, canvasHeight: height, panX: -PADDING / fitZoom, panY: -PADDING / fitZoom, zoom: fitZoom }
  })
}, [graphic?.scene_data])
```

The 20px padding matches the spec ("Adds 20px padding on all sides" — §4.1 Zoom-to-fit). The `vp.screenWidth` / `vp.screenHeight` come from the resize observer and should be valid by the time the graphic loads.

Do NOT:
- Call `zoomFit()` directly in this effect — `zoomFit()` captures `viewport` via closure and the viewport may not have current canvas dimensions yet.
- Set a flat `zoom: 1` as a default — this is the exact false-DONE pattern the spec calls out.
- Guard with `vp.screenWidth === 1920` (the initial default) — the ResizeObserver fires before the graphic query resolves in practice.
