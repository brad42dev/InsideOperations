---
id: DD-23-010
title: Add ARIA roles and live region for screen reader support
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The workspace has `role="application"` and `aria-label="Equation workspace"`. Each tile has `role="option"` with a descriptive `aria-label`. Container tiles use `role="group"`. An `aria-live="polite"` region updates with the text expression as tiles change.

## Spec Excerpt (verbatim)

> - Workspace: `role="application"` with `aria-label="Equation workspace"`
> - Tiles: `role="option"` with descriptive `aria-label` (e.g., "Plus operator", "Point Reference: TI-101.PV")
> - Container tiles: `role="group"` with `aria-label` including nesting level
> - Live expression readout: `aria-live="polite"` region updates with the text expression as tiles change
> — design-docs/23_EXPRESSION_BUILDER.md, §15.2

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1340–1363` — workspace div; no role attribute
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:536–587` — WorkspaceTile render; no role or aria-label
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1454–1496` — Expression preview div; no aria-live

## Verification Checklist

- [ ] The workspace `<div>` at line ~1340 has `role="application"` and `aria-label="Equation workspace"`
- [ ] Each WorkspaceTile `<div>` has `role="option"` and a descriptive `aria-label`
- [ ] Container tiles (group, square, etc.) use `role="group"` with `aria-label` including depth level
- [ ] The expression preview panel has `role="math"` and `aria-label` with the spoken expression
- [ ] An `aria-live="polite"` region exists that updates when tiles change

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `role`, `aria-label`, or `aria-live` attributes are present anywhere in ExpressionBuilder.tsx.

## Fix Instructions (if needed)

1. Add `role="application" aria-label="Equation workspace"` to the workspace `<div>` at line ~1340.
2. In WorkspaceTile, generate an `aria-label` from tile type:
   - Operators: "Plus operator", "Minus operator", etc.
   - point_ref: `"Point Reference: ${tile.pointLabel ?? 'current point'}"`
   - constant: `"Value: ${tile.value}"`
   - Containers: `"Group, level ${depth + 1}"`
3. For container tiles, use `role="group"` instead of `role="option"`.
4. Add `role="math" aria-label={previewStr || 'empty expression'}` to the preview div at line ~1483.
5. Add a visually-hidden `<div aria-live="polite" aria-atomic="true">` that renders `previewStr` — this announces changes to screen readers without showing visible text twice.

Do NOT:
- Use `aria-live="assertive"` — polite is correct for expression updates
