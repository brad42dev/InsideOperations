---
id: GFX-SHAPES-006
title: Add missing $schema, version, alarmAnchor, and states fields to incomplete sidecars
unit: GFX-SHAPES
status: pending
priority: medium
depends-on: [GFX-SHAPES-001]
---

## What This Feature Should Do

Every JSON sidecar must include `$schema`, `version`, `alarmAnchor`, and `states` fields per the spec's complete sidecar schema. Tank sidecars are missing all four. Some other sidecars are structurally split (pump-centrifugal-opt1.json as a separate file) rather than following the canonical single-sidecar-with-variants model.

## Spec Excerpt (verbatim)

> ```json
> {
>   "$schema": "io-shape-v1",
>   "shape_id": "pump-centrifugal",
>   "version": "1.0",
>   ...
>   "alarmAnchor": { "position": [1.1, -0.1] },
>   "states": {
>     "normal":  { "classes": ["io-normal"],  "description": "Normal operation" },
>     "running": { "classes": ["io-running"], "description": "Running / open" },
>     ...
>   }
> }
> ```
> — shape-library-implementation-spec.md, §JSON Sidecar Specification

## Where to Look in the Codebase

Primary files:
- `frontend/public/shapes/tanks/tank-storage-cone-roof.json` — missing `$schema`, `version`, `alarmAnchor`, `states`
- `frontend/public/shapes/tanks/tank-storage-sphere.json` — same (all 6 tank sidecars likely same issue)
- `frontend/public/shapes/pumps/pump-centrifugal-opt1.json` — this is a per-variant sidecar, non-standard; spec uses one canonical sidecar
- `frontend/public/shapes/pumps/pump-centrifugal-opt2.json` — same
- `frontend/public/shapes/rotating/compressor-opt1.json`, `compressor-opt2.json` — same split-sidecar issue
- `frontend/public/shapes/pumps/pump-centrifugal.json` — canonical sidecar, has `$schema` and `states` but check `alarmAnchor` format (should be `{ "nx": float, "ny": float }` not `{ "position": [...] }`)

## Verification Checklist

- [ ] All 6 tank sidecars (`tank-storage-*.json`) have `$schema: "io-shape-v1"`, `version`, `alarmAnchor`, and `states` fields
- [ ] All reactor sidecars (`reactors/*.json`) have `alarmAnchor` and `states` fields
- [ ] The canonical pump and rotating sidecars (`pump-centrifugal.json`, `compressor.json`, etc.) are the single source of truth; `pump-centrifugal-opt1.json`, `pump-centrifugal-opt2.json` etc. are either removed or clearly marked as deprecated
- [ ] `alarmAnchor` format matches spec: `{ "nx": float, "ny": float }` (normalized coordinates relative to viewBox)
- [ ] `states` format matches spec: keys are state names (`running`, `stopped`, `fault`, `transitioning`, `oos`), values are CSS class name strings or objects with `classes` array

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Tank sidecars are missing required schema fields. Per-variant sidecars (`-opt1.json`, `-opt2.json`) exist alongside canonical sidecars, creating ambiguity. Reactor sidecars need verification for `alarmAnchor`.

## Fix Instructions (if needed)

**Tank sidecars** — add the missing fields to each of the 6 tank sidecars:

```json
{
  "$schema": "io-shape-v1",
  "shape_id": "tank-storage-cone-roof",
  "version": "1.0",
  ...existing fields...,
  "alarmAnchor": { "nx": 1.1, "ny": -0.1 },
  "states": {
    "running":       "io-running",
    "stopped":       "io-stopped",
    "fault":         "io-fault",
    "transitioning": "io-transitioning",
    "oos":           "io-oos"
  }
}
```

Note: the `states` format in the static sidecars uses `"running": "io-running"` (string value) while the spec example shows an object with `"classes"` array. The static format is simpler and is what `shapeCache.ts` currently types as `Record<string, string>` — keep the flat string format for consistency with existing code in `shapeCache.ts:33`.

**Per-variant sidecars** — `pump-centrifugal-opt1.json`, `pump-centrifugal-opt2.json`, `compressor-opt1.json`, etc. should be removed. The canonical sidecar (`pump-centrifugal.json`) already has `variants.options` pointing to the correct SVG files. Having separate per-variant sidecars conflicts with the spec model and creates confusion about which sidecar is authoritative.

Before removing, verify that nothing in the codebase directly fetches `pump-centrifugal-opt1.json` by name:
```
grep -r "pump-centrifugal-opt1\|compressor-opt1" frontend/src/ services/
```

If the `seed_shapes.rs` references these files, also fix seed_shapes.rs (see GFX-SHAPES-007).

Do NOT:
- Add `states` as an array — it must be a `Record<string, string>` matching the `ShapeSidecar` type in `shapeCache.ts:38`
- Change the `alarmAnchor` to use `position: [x, y]` absolute coordinates — use normalized `nx/ny` as in the existing valves/pumps sidecars
