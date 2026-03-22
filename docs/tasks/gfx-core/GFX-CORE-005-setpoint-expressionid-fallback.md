---
id: GFX-CORE-005
title: Fix analog bar setpoint binding to use expressionId fallback
unit: GFX-CORE
status: done
priority: low
depends-on: [GFX-CORE-001]
---

## What This Feature Should Do

`PointBinding` has two mutually exclusive fields: `pointId` and `expressionId`. The renderer consistently uses `pvKey = pointId ?? expressionId` throughout, except in one place: the analog bar's setpoint lookup. When `setpointBinding.expressionId` is set (and `pointId` is null), the setpoint diamond marker never appears, even though the expression result would be available in `pointValues` under the expression key.

Additionally, all `data-point-id` attributes on display element `<g>` nodes must use `pvKey = pointId ?? expressionId` (not just `pointId`) so that the `pointToElementsRef` map correctly indexes expression-backed bindings.

## Spec Excerpt (verbatim)

> ```typescript
> interface PointBinding {
>   /** Direct point reference (mutually exclusive with expressionId) */
>   pointId?: string;
>   /** Expression reference (mutually exclusive with pointId) */
>   expressionId?: string;
>   pointAttribute?: string;
> }
> ```
> `pvKey = pointId ?? expressionId`. Code that only handles `pointId` is wrong.
> — graphics-scene-graph-implementation-spec.md, §2.1 / manifest non-negotiable #6

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx`
  - **Setpoint lookup** in the `analog_bar` case of `renderDisplayElement` — look for `cfg.setpointBinding?.pointId` to confirm it uses `?? cfg.setpointBinding?.expressionId`
  - **`data-point-id` attributes** on every display element `<g>` — must be `pvKey` (the `pointId ?? expressionId` variable computed at the top of `renderDisplayElement`), not `node.binding.pointId` directly

## Verification Checklist

- [ ] In the `analog_bar` case of `renderDisplayElement`, setpoint lookup uses `const spKey = cfg.setpointBinding?.pointId ?? cfg.setpointBinding?.expressionId` as the key into `pointValues`.
- [ ] The fix is consistent with the `pvKey = node.binding.pointId ?? node.binding.expressionId` pattern used at the top of `renderDisplayElement`.
- [ ] All display element `<g>` elements — `text_readout`, `alarm_indicator`, `digital_status`, `analog_bar`, `sparkline`, `fill_gauge` — have `data-point-id={pvKey}` (not `data-point-id={node.binding.pointId}`).
- [ ] `symbol_instance` `<g>` has `data-point-id={statePvKey || undefined}` where `statePvKey = node.stateBinding?.pointId ?? node.stateBinding?.expressionId`.

## Assessment

- **Status**: ⚠️ Wrong — setpoint binding ignores `expressionId`; `data-point-id` attributes use `pointId` only
- **What needs to change**: Two targeted fixes in `renderDisplayElement` + `renderSymbolInstance`

## Fix Instructions

In `frontend/src/shared/graphics/SceneRenderer.tsx`:

**1. Setpoint lookup in `analog_bar`** — find the line that reads `cfg.setpointBinding?.pointId`:

```typescript
// Current (wrong):
const spPv = cfg.setpointBinding?.pointId ? pointValues.get(cfg.setpointBinding.pointId) : undefined

// Correct:
const spKey = cfg.setpointBinding?.pointId ?? cfg.setpointBinding?.expressionId
const spPv = spKey ? pointValues.get(spKey) : undefined
```

**2. `data-point-id` on all display element `<g>` nodes** — replace every `data-point-id={node.binding.pointId}` with `data-point-id={pvKey}` (the variable already computed as `node.binding.pointId ?? node.binding.expressionId` at the top of `renderDisplayElement`). Affected display types: `text_readout`, `alarm_indicator`, `digital_status`, `analog_bar`, `sparkline`, `fill_gauge` (both vessel_overlay and standalone modes).

**3. `data-point-id` on `symbol_instance` `<g>`** — add `data-point-id={statePvKey || undefined}` to the outer `<g>` in `renderSymbolInstance`, where `statePvKey` is already computed as `node.stateBinding?.pointId ?? node.stateBinding?.expressionId`.

Do NOT:
- Change the conditional guard `if (spVal === null) return null` — the null check remains correct
- Apply only the setpoint fix without also fixing `data-point-id` — both are required for expression-backed bindings to work on the live DOM path (GFX-CORE-001 depends on correct `data-point-id` values)
