---
id: GFX-DISPLAY-004
title: Fix analog bar pointer triangle height from 6px to 8px per spec
unit: GFX-DISPLAY
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The current-value pointer on the analog bar is a filled triangle pointing inward from the bar's right edge. The spec requires this triangle to be approximately 6px wide by 8px tall. Currently the pointer geometry uses ±3px (6px total height), but the spec requires ±4px (8px total height). At small sizes this is a visible proportion difference — the pointer should be slightly taller than it is wide.

## Spec Excerpt (verbatim)

> **Shape**: Triangle pointing inward from bar edge, ~6px wide × 8px tall
> — display-elements-implementation-spec.md, §Analog Bar Indicator, Pointer

> ```xml
> <!-- Pointer (at 62% = y position 57) -->
> <polygon points="18,54 25,57 18,60" fill="#A1A1AA"/>
> ```
> — display-elements-implementation-spec.md, §Rendered SVG Output

The reference SVG uses `points="18,54 25,57 18,60"` — that is `y-3` to `y+3` = 6px height. But the spec text says "8px tall". The reference SVG example uses 6px (3px above and below). Given the spec text is explicit ("8px tall"), use 8px (4px above and below the pointer Y position). The reference SVG is an approximation.

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — line 653: `<polygon data-role="pointer" points={\`${bw},${pointerY-3} ${bw+6},${pointerY} ${bw},${pointerY+3}\`}` — the ±3 is the current incorrect height
- `frontend/src/shared/graphics/displayElements/AnalogBar.tsx` — line 92: `points={\`${barWidth},${pointerY - 3} ${barWidth + 6},${pointerY} ${barWidth},${pointerY + 3}\`}` — same ±3 in the standalone component (not used by renderer but should stay consistent)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] SceneRenderer.tsx line 653: pointer polygon uses `pointerY - 4` and `pointerY + 4` (8px total height, ±4)
- [ ] SceneRenderer.tsx: pointer width (horizontal extent = `bw + 6`) is unchanged at 6px from bar edge
- [ ] AnalogBar.tsx line 92: pointer polygon also updated to ±4
- [ ] The crossing tick line coordinates (`x1={1} y1={pointerY} x2={bw-1} y2={pointerY}`) are unchanged
- [ ] The DOM mutation path in `applyPointValue` (SceneRenderer.tsx:1472): `pointer.setAttribute('points', \`${bw},${pointerY - 4} ${bw + 6},${pointerY} ${bw},${pointerY + 4}\`)` uses ±4

## Assessment

- **Status**: ⚠️ Wrong (minor)
- **Current state**: SceneRenderer.tsx line 653 and AnalogBar.tsx line 92 both use ±3px. The DOM mutation path at SceneRenderer.tsx:1472 also uses ±3. All three locations must be updated.

## Fix Instructions

**In `frontend/src/shared/graphics/SceneRenderer.tsx`:**

Line 653 — React render path pointer:
Change `${pointerY-3}` and `${pointerY+3}` to `${pointerY-4}` and `${pointerY+4}`:
```tsx
<polygon data-role="pointer" points={`${bw},${pointerY-4} ${bw+6},${pointerY} ${bw},${pointerY+4}`} ...
```

Line 1472 — DOM mutation path pointer:
Change `${pointerY - 3}` and `${pointerY + 3}` to `${pointerY - 4}` and `${pointerY + 4}`:
```ts
pointer.setAttribute('points', `${bw},${pointerY - 4} ${bw + 6},${pointerY} ${bw},${pointerY + 4}`)
```

**In `frontend/src/shared/graphics/displayElements/AnalogBar.tsx`:**

Line 92 — standalone component pointer:
```tsx
points={`${barWidth},${pointerY - 4} ${barWidth + 6},${pointerY} ${barWidth},${pointerY + 4}`}
```

Do NOT:
- Change the pointer width (the `bw+6` horizontal extent stays at 6px)
- Move the tip of the triangle (the `bw+6,pointerY` apex stays at 6px from the bar edge)
- Change the crossing tick line — it stays at `y={pointerY}` referencing the same `pointerY` value
- Change the pointer fill or color logic
