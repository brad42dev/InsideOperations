---
id: DD-23-020
title: Fix field_ref AST conversion reads tile.pointLabel instead of tile.fieldName
unit: DD-23
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When a rounds_checkpoint or log_segment expression contains field_ref tiles, the AST converter must emit the field's name correctly in the `field_name` property of the `FieldRefNode`. Currently the converter reads `tile.pointLabel` (a point-ref property) instead of `tile.fieldName` (the field_ref property), so every field_ref in the serialized AST has `field_name: ''`. This makes all rounds/log expressions that use field references silently broken — the Rhai evaluator receives an empty variable name and cannot look up the field value.

## Spec Excerpt (verbatim)

> The `field_ref` tile references a checkpoint or segment field by name. The AST node is:
> `{ "type": "field_ref", "field_name": "<field_name>" }`
> — design-docs/23_EXPRESSION_BUILDER.md, §11.2 (ExprNode wire format)

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ast.ts:170–178` — the `field_ref` case reads `tile.pointLabel` instead of `tile.fieldName`
- `frontend/src/shared/types/expression.ts:46–47` — `ExpressionTile.fieldName?: string` is the correct property for field_ref tiles
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:247–248` — `createTile` for `field_ref` sets `fieldName: ''` (populated later by UI to the selected field name)

## Verification Checklist

- [ ] `ast.ts` `field_ref` case uses `tile.fieldName` (not `tile.pointLabel`)
- [ ] `ast.ts` `field_ref` case does NOT have `(tile as ExpressionTile & { fieldName?: string })` cast — the cast is unnecessary because `fieldName` is already in `ExpressionTile`
- [ ] `ast.ts` `field_ref` case is `case 'field_ref':` (not `case ('field_ref' as any):`) since TileType includes it
- [ ] The `// Note: 'field_ref' TileType is added in DD-23-002` stale comment is removed
- [ ] A field_ref tile with fieldName='reading' produces `{ type: 'field_ref', field_name: 'reading' }` in the AST

## Assessment

- **Status**: ⚠️ Wrong
- **Current code** (ast.ts:170–178):
  ```typescript
  // Note: 'field_ref' TileType is added in DD-23-002. The type cast below
  // ensures this branch compiles until TileType is extended.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  case ('field_ref' as any): {
    return {
      type: 'field_ref',
      field_name: (tile as ExpressionTile & { fieldName?: string }).pointLabel ?? '',
    } satisfies FieldRefNode
  }
  ```
- `tile.pointLabel` is the display label for point_ref tiles; `tile.fieldName` is the correct property
- The `as any` cast and `ExpressionTile & { fieldName?: string }` intersection are stale since `field_ref` is now in `TileType` and `fieldName` is already in `ExpressionTile`

## Fix Instructions

Replace lines 170–178 in `frontend/src/shared/components/expression/ast.ts` with:

```typescript
case 'field_ref': {
  return {
    type: 'field_ref',
    field_name: tile.fieldName ?? '',
  } satisfies FieldRefNode
}
```

That is the complete fix. No other files need changes.

Do NOT:
- Change `ExpressionTile` or `expression.ts` — the types are already correct
- Add a separate `fieldName` property or rename anything — use the existing `tile.fieldName`
- Keep the `as any` cast or the intersection type — they are stale workarounds
