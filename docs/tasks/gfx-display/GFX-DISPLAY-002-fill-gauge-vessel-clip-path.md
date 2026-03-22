---
id: GFX-DISPLAY-002
title: Fill gauge vessel-overlay mode must use vessel geometry clipPath, not a rect
unit: GFX-DISPLAY
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a fill gauge is placed in `vessel_overlay` mode (inside a tank or vessel shape), the fill rectangle must be clipped to the actual interior outline of the vessel — including curved bottoms, elliptical heads, and dished ends. A simple rectangular clipPath produces a fill that bleeds outside curved vessel geometry. The clipPath path data must come from the shape's sidecar or be passed from the parent SymbolInstance.

## Spec Excerpt (verbatim)

> ### Mode 1: Vessel-Interior (clipped)
> - Fill rectangle uses SVG `<clipPath>` referencing the vessel's interior outline
> - Fill clips to **curved shapes** — elliptical heads, spheres, dished ends. The clipPath must follow the actual vessel geometry, not a simple rect.
> - The fill rect must extend below the vessel's curved bottom so the clipPath shapes it correctly
> — display-elements-implementation-spec.md, §Fill Gauge Mode 1: Vessel-Interior

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `renderDisplayElement()` case `'fill_gauge'`, vessel_overlay branch at lines 662–677; comment says "approx rect" confirming the current shortcut
- `frontend/src/shared/graphics/displayElements/FillGauge.tsx` — standalone component accepts `vesselClipPath?: string` at line 13 (correct interface) but SceneRenderer does not pass it
- `frontend/public/shapes/*.json` — sidecar files — check whether vessel shapes define a `vesselInteriorPath` or similar field for the clip path

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] SceneRenderer vessel_overlay branch uses a `<path>` element (not `<rect>`) inside the `<clipPath>` definition
- [ ] The clip path data comes from the shape sidecar (not hardcoded) — either via a `vesselInteriorPath` sidecar field or from the SymbolInstance's referenced shape SVG geometry
- [ ] The fill rect extends below the vessel's bottom (`y + height + 20` or similar) so the clipPath trims the curved bottom correctly
- [ ] FillGauge.tsx `vesselClipPath` prop is wired up correctly when called from SceneRenderer (not left as undefined)

## Assessment

After checking:
- **Status**: ⚠️ Partial (interface exists but ignored at runtime)
- **What specifically needs to change**: SceneRenderer.tsx line 663 comment confirms "approx rect" — the clipPath `<defs>` block at line 668–671 creates `<rect x={0} y={0} width={bw} height={bh} />` instead of a vessel geometry path. The `FillGauge` standalone component has the right signature (`vesselClipPath?: string`) but SceneRenderer's inline render for vessel_overlay never passes it.

## Fix Instructions

**Step 1: Add `vesselInteriorPath` to shape sidecars** for vessel-type shapes (vertical vessels, tanks, reactors, columns). The path should trace the interior outline of the vessel body including curved heads. Format: an SVG path string in the shape's local coordinate space. See the sidecar schema in `shape-library-implementation-spec.md` for the property location.

Example sidecar addition:
```json
{
  "vesselInteriorPath": "M90,60 L90,200 A25,12.5 0 0,0 140,200 L140,60 A25,12.5 0 0,1 90,60 Z"
}
```

**Step 2: Expose `vesselInteriorPath` from the shape loader**. In `SceneRenderer.tsx` where `shapeData` is read (around the `fill_gauge` case), look up the parent `SymbolInstance` for this display element to get its sidecar's `vesselInteriorPath`. The parent is accessible via the node tree walk — display elements are children of SymbolInstances.

**Step 3: Replace the rect clipPath in SceneRenderer.tsx** (around line 668). Change from:
```tsx
<clipPath id={clipId}>
  <rect x={0} y={0} width={bw} height={bh} />
</clipPath>
```
To:
```tsx
<clipPath id={clipId}>
  <path d={vesselInteriorPath ?? `M0,0 H${bw} V${bh} H0 Z`} />
</clipPath>
```

**Step 4: Extend the fill rect** to go below the vessel bottom:
```tsx
<rect data-role="fill" x={0} y={fillY} width={bw} height={fillH + 20} fill={fillColor} clipPath={`url(#${clipId})`} />
```

Do NOT:
- Use the `FillGauge.tsx` standalone component for this — the SceneRenderer inlines the render for performance reasons and that is correct
- Hard-code the vessel interior path shape — it must come from the sidecar
- Apply the fix only to one vessel type — all vessel shapes (vertical vessel, tank, reactor, column) need sidecars with `vesselInteriorPath`
