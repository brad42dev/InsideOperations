---
id: MOD-PROCESS-011
title: Fix tablet zoom range to 5%–800% (TransformWrapper limits 50%–500%)
unit: MOD-PROCESS
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When using the Process module on a tablet device, pinch-to-zoom must be clamped to 5%–800% (0.05–8.0 scale), the same range as the desktop path. Currently the tablet path uses `react-zoom-pan-pinch`'s `TransformWrapper` with `minScale={0.5}` and `maxScale={5}`, which limits tablet users to 50%–500%.

## Spec Excerpt (verbatim)

> **5%-800% zoom range** (Console is 25%-400%). CSS transform matrix on the SVG viewport container. Smooth pan: pointer drag with `cursor:grab`.
> — process-implementation-spec.md, §4.1

> Mouse wheel zoom: Zoom range: 5% to 800%
> — process-implementation-spec.md, §4.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:1206-1232` — tablet branch uses `TransformWrapper` with wrong scale limits

## Verification Checklist

- [ ] Tablet path (`isTablet === true`) allows zoom down to 5% (scale 0.05).
- [ ] Tablet path allows zoom up to 800% (scale 8.0).
- [ ] Desktop path `handleWheel` already clamps at `Math.max(0.05, Math.min(8, ...))` — unchanged.
- [ ] Pinch-to-zoom gesture on tablet respects the same 0.05–8.0 range.

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:1207-1212` — `TransformWrapper minScale={0.5} maxScale={5}` clamps tablet zoom to 50%–500%. Spec requires 5%–800%.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`, in the tablet branch of the scene renderer (around line 1207):

```tsx
<TransformWrapper
  minScale={0.05}   // was 0.5 — spec requires 5% minimum
  maxScale={8}      // was 5  — spec requires 800% maximum
  velocityAnimation={{ sensitivity: 1, animationTime: 200 }}
  panning={{ velocityDisabled: false }}
>
```

Change only `minScale` and `maxScale`. Do not touch the desktop `handleWheel` path (it already clamps correctly at `Math.max(0.05, Math.min(8, ...))`).

Do NOT:
- Change the desktop wheel handler — it is already correct.
- Add separate clamp logic on top of `TransformWrapper` — just fix the props.
- Use fractional percentage string props — `react-zoom-pan-pinch` takes a decimal scale factor (0.05 = 5%).
