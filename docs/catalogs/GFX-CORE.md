---
unit: GFX-CORE
audited: 2026-03-21
relationship: OVERHAUL
spec-files: [graphics-scene-graph-implementation-spec.md]
result: ⚠️ Gaps found
tasks-generated: 3
tasks-open: [GFX-CORE-002, GFX-CORE-003, GFX-CORE-004]
---

## Summary

Third audit pass. Two previously open tasks are now resolved: GFX-CORE-001 (real-time direct DOM mutation pipeline) was confirmed implemented in the prior pass and remains correctly implemented. GFX-CORE-005 (setpoint binding expressionId fallback and data-point-id correctness) is now fixed — setpoint lookup uses `spKey = cfg.setpointBinding?.pointId ?? cfg.setpointBinding?.expressionId` at line 585 and all six display element types use `data-point-id={pvKey}`. Three gaps remain open: NN#8 (NavigationLink onClick still missing on 6 node types), annotation types 3–9 returning null, and pipe `insulated`/`dashPattern` fields ignored.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|----------------|--------|----------|
| 1 | SVG never stored; `scene_data JSONB` is source of truth | ✅ | `api/graphics.ts:7,11` — create/update use `scene_data: GraphicDocument`; no SVG fields stored |
| 2 | Exactly 11 renderable `SceneNodeType` members + `graphic_document`, all handled | ✅ | `types/graphics.ts:32–44` — 12-value union; `renderNode` switch covers all 11 renderable types + `case 'graphic_document': return null` at line 851 |
| 3 | Hybrid SVG + HTML overlay (Widgets in HTML layer, not SVG) | ✅ | `SceneRenderer.tsx:923–956` — HTML overlay div `position: absolute, inset: 0`; `case 'widget': return null` in SVG render at line 850 |
| 4 | Layers are metadata on `GraphicDocument`, not tree nodes | ✅ | `types/graphics.ts:68–74` — `LayerDefinition[]` on `GraphicDocument`; `isNodeVisible()` checks `layerMap` at line 211 |
| 5 | Shape SVGs loaded by reference at render time, not embedded | ✅ | `SceneRenderer.tsx:239–248` — `fetchShapes(shapeIds, batchFn)`; `SymbolInstance` stores `shapeRef.shapeId` only |
| 6 | `PointBinding` uses both `pointId` and `expressionId`; `pvKey = pointId ?? expressionId` | ✅ | `SceneRenderer.tsx:470` — `pvKey = node.binding.pointId ?? node.binding.expressionId`; `data-point-id={pvKey}` on all 6 display element types (lines 505, 530, 546, 574, 639, 667/684); setpoint at line 585 uses `spKey = cfg.setpointBinding?.pointId ?? cfg.setpointBinding?.expressionId`; symbol_instance `data-point-id={statePvKey}` at line 781 |
| 7 | Real-time updates bypass React; direct SVG DOM mutation via `pointToElements` + rAF | ✅ | `SceneRenderer.tsx:109–203` — `liveSubscribe` prop; `pointToElementsRef` built from `querySelectorAll('[data-point-id]')` at line 162; rAF drain at lines 176–195; `applyPointValue` at line 994 mutates text/fill/stroke directly |
| 8 | `navigationLink` handled on ANY `SceneNode` type that has it | ⚠️ Wrong | `handleNodeClick` at line 286 exists; called only from `renderSymbolInstance` (line 783) and `renderPrimitive` (line 352); `renderTextBlock` (383), `renderImage` (411), `renderEmbeddedSvg` (426), `renderStencil` (439), `renderPipe` (360), `renderAnnotation` (796) — none wire `onClick` |
| 9 | `bindings` JSONB denorm updated by trigger; subscriptions use denorm data | ✅ | Frontend uses `pointsApi` and walk; no evidence of scene_data JSONB scanning in frontend subscription queries |
| 10 | Image assets loaded via content hash, not URL | ✅ | `api/graphics.ts:98` — `imageUrl: (hash) => /api/v1/image-assets/${hash}`; `ImageNode.assetRef.hash` |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| Real-time updates through React state | ✅ Not present | `liveSubscribe` path writes to DOM directly; `useWebSocketRaf` is phone-only (`GraphicPane.tsx`) |
| `PointBinding` uses only `pointId`, ignores `expressionId` | ✅ Not present | `pvKey = node.binding.pointId ?? node.binding.expressionId` line 470; `data-point-id={pvKey}` all elements |
| Widget nodes render inside `<svg>` | ✅ Not present | `case 'widget': return null` at line 850; widgets in HTML overlay at line 923 |
| Layers implemented as tree nodes | ✅ Not present | `LayerDefinition[]` flat array on `GraphicDocument`; no layer node type in union |
| `pointToElements` map rebuilt on every point update | ✅ Not present | `useEffect(..., [document.id, children, liveSubscribe])` — structural change only |

## Wave 0 Contract Gaps

GFX-CORE is a shared rendering library, not a user-facing routed module. Wave 0 contracts (CX-EXPORT, CX-RBAC, CX-POINT-CONTEXT, etc.) apply to module units (MOD-*) that consume GFX-CORE — not to GFX-CORE itself. No Wave 0 checks apply here.

## Findings Summary

- [GFX-CORE-002] NavigationLink onClick missing on text_block, image, embedded_svg, stencil, annotation, pipe — `SceneRenderer.tsx:383,411,426,439,796,360`
- [GFX-CORE-003] 7 of 9 annotation types return null (only border and callout handled) — `SceneRenderer.tsx:796–825`
- [GFX-CORE-004] `node.insulated` and `node.dashPattern` ignored in `renderPipe` — `SceneRenderer.tsx:360–381`

## Resolved Since Last Audit

- [GFX-CORE-001] Real-time direct DOM mutation pipeline — ✅ Implemented (`SceneRenderer.tsx:109–203`)
- [GFX-CORE-005] Setpoint expressionId fallback and data-point-id correctness — ✅ Fixed (`SceneRenderer.tsx:585, 505, 530, 546, 574, 639, 667, 684, 781`)
