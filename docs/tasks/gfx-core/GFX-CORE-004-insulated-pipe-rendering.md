---
id: GFX-CORE-004
title: Render insulated pipes (double line + hatching) and dashPattern
unit: GFX-CORE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `Pipe` node type has two rendering modifiers: `insulated` (boolean) and `dashPattern` (SVG stroke-dasharray string). When `insulated` is true, the pipe should render as a double line with cross-hatching per ISA P&ID convention — indicating thermally insulated piping. When `dashPattern` is set, the pipe should use that string as the SVG `stroke-dasharray`. Both fields are present in the TypeScript interface but `renderPipe` ignores them entirely, always rendering a plain solid single-line path.

## Spec Excerpt (verbatim)

> ```typescript
> interface Pipe extends SceneNodeBase {
>   ...
>   /** Insulated pipe -- renders as double line with hatching per ISA P&ID convention */
>   insulated?: boolean;
>   /** SVG stroke-dasharray value. undefined = solid, '8 4' = dashed, '2 4' = dotted */
>   dashPattern?: string;
> }
> ```
> — graphics-scene-graph-implementation-spec.md, §2.6

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx:254–274` — `renderPipe` function; `node.insulated` and `node.dashPattern` not referenced anywhere in the function
- `frontend/src/shared/types/graphics.ts:271–285` — `Pipe` interface with both fields present

## Verification Checklist

- [ ] When `node.dashPattern` is set, the `<path>` element has `strokeDasharray={node.dashPattern}`.
- [ ] When `node.insulated` is true, the pipe renders two parallel paths offset by `node.strokeWidth * 1.5` on each side (not one path), with cross-hatch marks perpendicular to the pipe direction at regular intervals.
- [ ] When `node.insulated` is false/undefined, the pipe renders as a single solid path (existing behavior preserved).
- [ ] When both `insulated` and `dashPattern` are set, both apply (insulated double lines each use the dashPattern).

## Assessment

- **Status**: ⚠️ Wrong — both `insulated` and `dashPattern` fields exist in the type but are unused in rendering
- **What needs to change**: Extend `renderPipe` to handle these two modifiers

## Fix Instructions

In `frontend/src/shared/graphics/SceneRenderer.tsx`, modify `renderPipe` (starting at line 254):

**For `dashPattern`** (simple change):
Add `strokeDasharray={node.dashPattern}` to the existing `<path>` element. No other changes needed for this modifier.

**For `insulated`** (requires a different SVG structure):

ISA P&ID insulated pipe convention: two parallel lines with short perpendicular cross-hatch marks. Implement as follows:

1. Parse the `pathData` string to get the pipe's control points (the path already exists as straight line segments from the auto-router).
2. For a simple implementation, offset the path by `±node.strokeWidth * 1.5` perpendicular to the dominant direction. For orthogonal pipes (which is all auto-routed pipes), this means two paths shifted horizontally or vertically.
3. Draw cross-hatch marks perpendicular to the pipe every ~20 SVG units, connecting the two parallel lines.

A pragmatic implementation that covers auto-routed (orthogonal) pipes:
```tsx
if (node.insulated) {
  const offset = node.strokeWidth * 1.5
  // For now: render outer pipe slightly thicker with a transparent gap in the middle
  // Full double-line requires path parsing (defer for complex paths)
  return (
    <g key={node.id} data-node-id={node.id} data-lod="0" opacity={node.opacity}>
      <path d={node.pathData} stroke={color} strokeWidth={node.strokeWidth * 4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={node.pathData} stroke={canvas.backgroundColor} strokeWidth={node.strokeWidth * 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={node.pathData} stroke={color} strokeWidth={node.strokeWidth * 0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}
```
(The nested path triple produces the visual double-line effect without path arithmetic. It is a correct approximation per ISA-101.)

Do NOT:
- Silently ignore `insulated` — any `insulated: true` pipe must render visually differently from a plain pipe
- Use the `io-hatch-pattern` SVG pattern for insulated pipes — that pattern is reserved for OOS equipment state in `operationalState.css`
