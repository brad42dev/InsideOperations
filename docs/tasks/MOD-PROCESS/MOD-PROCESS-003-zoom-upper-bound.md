---
id: MOD-PROCESS-003
title: Fix zoom upper bound to 800% (not 1000%)
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Process module zoom range is 5% to 800% — wider than Console (25%-400%) to accommodate super-graphic navigation. The current implementation allows zoom up to 1000% (scale factor 10), which exceeds the spec upper bound.

## Spec Excerpt (verbatim)

> **5%-800% zoom range** (Console is 25%-400%). CSS transform matrix on the SVG viewport container.
> — process-implementation-spec.md, Non-Negotiable #4

> Zoom range: 5% to 800%
> — process-implementation-spec.md, §4.1 Zoom and Pan

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:436` — `Math.min(10, ...)` sets upper bound to 10.0 (1000%)
- `frontend/src/pages/process/index.tsx:484-497` — pinch-to-zoom also clamps to `Math.min(10, ...)`
- `frontend/src/pages/process/index.tsx:519-523` — `zoomIn()` and `zoomOut()` also clamp to 10/0.05

## Verification Checklist

- [ ] Mouse wheel zoom is clamped: `Math.max(0.05, Math.min(8.0, newZoom))`
- [ ] Pinch-to-zoom is clamped to the same range.
- [ ] `zoomIn()` function clamps to `Math.min(8.0, ...)`.
- [ ] `zoomOut()` function clamps to `Math.max(0.05, ...)`.
- [ ] Zoom percentage readout in the status bar shows max "800%" not "1000%".

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:436` — `Math.max(0.05, Math.min(10, vp.zoom * zoomFactor))`. The `10` should be `8.0`.
- `index.tsx:486` — pinch zoom: `Math.min(10, ...)` — same issue.
- `index.tsx:519` — `zoomIn()`: `Math.min(10, ...)` — same issue.

## Fix Instructions

Replace all occurrences of `Math.min(10, ` and `Math.max(0.05, ` in `frontend/src/pages/process/index.tsx` with `Math.min(8, ` (the max zoom factor for 800%). The min stays at `0.05`.

Specific lines to change:
- Line 436: `Math.max(0.05, Math.min(10, vp.zoom * zoomFactor))` → `Math.max(0.05, Math.min(8, vp.zoom * zoomFactor))`
- Line 486: `Math.max(0.05, Math.min(10, pinchBaseZoom.current * ratio))` → `Math.max(0.05, Math.min(8, pinchBaseZoom.current * ratio))`
- Line 519 (zoomIn): `Math.min(10, vp.zoom * 1.25)` → `Math.min(8, vp.zoom * 1.25)`

Also update `zoomFit()` at line 528 to not cap at `1`: `Math.min(vp.screenWidth / width, vp.screenHeight / height)` (no `1` cap) — the spec's zoom-to-fit should go below 100% for large graphics and allows any zoom within the 5%-800% range.

Do NOT:
- Change the 0.05 lower bound — that is correct (5%).
- Cap zoom-to-fit at 1.0 — for large process graphics, zoom-to-fit legitimately results in zoom levels like 0.15 (15%).
