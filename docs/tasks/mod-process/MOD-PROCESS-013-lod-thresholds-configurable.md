---
id: MOD-PROCESS-013
title: Read LOD thresholds from graphic metadata instead of hardcoded constants
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The 4-tier LOD system thresholds (zoom percentages that trigger each LOD level) should be configurable per graphic, stored in `GraphicDocument.metadata.lodThresholds`. Currently `zoomToLod()` uses hardcoded constants (15%, 40%, 80%). If a graphic's `metadata.lodThresholds` is present, those values must be used; if absent, the defaults (15/40/80) apply.

## Spec Excerpt (verbatim)

> **Configurable LOD Thresholds**
>
> LOD thresholds are configurable per graphic, stored in `GraphicDocument.metadata`:
>
> ```typescript
> interface LODThresholds {
>   lod0Max: number;  // Default: 15 (zoom < 15% → LOD 0)
>   lod1Max: number;  // Default: 40 (zoom < 40% → LOD 1)
>   lod2Max: number;  // Default: 80 (zoom < 80% → LOD 2)
>   // zoom >= lod2Max → LOD 3
> }
> ```
>
> These are set in the Designer's graphic properties panel. If not present, the defaults above are used.
> — process-implementation-spec.md, §4.3.4

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:106-111` — `zoomToLod()` function (hardcoded thresholds)
- `frontend/src/pages/process/index.tsx:985-993` — `bindingIndex` and `rbushIndex` useMemo (uses `zoomToLod` indirectly)
- `frontend/src/pages/process/index.tsx:1055` — `lodLevel` derived value (calls `zoomToLod`)
- `frontend/src/pages/process/index.tsx:1007` — viewport subscription query (calls `zoomToLod`)

## Verification Checklist

- [ ] `zoomToLod` (or its replacement) accepts an optional `LODThresholds` parameter.
- [ ] When `graphic.scene_data.metadata.lodThresholds` is present, those values are used for the tier boundaries.
- [ ] When `metadata.lodThresholds` is absent or `null`, defaults of `{ lod0Max: 15, lod1Max: 40, lod2Max: 80 }` apply.
- [ ] The LOD level displayed in the status bar reflects the configurable thresholds (not hardcoded ones).
- [ ] The viewport subscription query uses the same thresholds as the display LOD level.

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:106-111` — `zoomToLod()` has hardcoded breakpoints. No code reads `graphic.scene_data?.metadata?.lodThresholds`.

## Fix Instructions

1. Add a `LODThresholds` type (likely already in `frontend/src/shared/types/graphics.ts` — check):
```typescript
interface LODThresholds {
  lod0Max: number
  lod1Max: number
  lod2Max: number
}

const DEFAULT_LOD_THRESHOLDS: LODThresholds = { lod0Max: 15, lod1Max: 40, lod2Max: 80 }
```

2. Derive thresholds from the loaded graphic:
```typescript
const lodThresholds = useMemo((): LODThresholds => {
  const meta = graphic?.scene_data?.metadata as Record<string, unknown> | undefined
  const t = meta?.lodThresholds as LODThresholds | undefined
  if (t && typeof t.lod0Max === 'number') return t
  return DEFAULT_LOD_THRESHOLDS
}, [graphic?.scene_data])
```

3. Update `zoomToLod` to accept thresholds:
```typescript
function zoomToLod(zoom: number, t: LODThresholds = DEFAULT_LOD_THRESHOLDS): LodLevel {
  const pct = zoom * 100
  if (pct < t.lod0Max) return 0
  if (pct < t.lod1Max) return 1
  if (pct < t.lod2Max) return 2
  return 3
}
```

4. Pass `lodThresholds` everywhere `zoomToLod` is called:
   - `index.tsx:1007` — viewport subscription: `zoomToLod(debouncedVp.zoom, lodThresholds)`
   - `index.tsx:1055` — display: `zoomToLod(viewport.zoom, lodThresholds)`

Do NOT:
- Change the default values (15/40/80 are correct defaults).
- Store thresholds in component state — `useMemo` is appropriate (recomputed only on graphic load).
- Crash if `metadata` or `lodThresholds` is null/undefined — always fall back to defaults.
