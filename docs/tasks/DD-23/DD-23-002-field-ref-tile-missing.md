---
id: DD-23-002
title: Add field_ref tile type for rounds_checkpoint and log_segment contexts
unit: DD-23
status: pending
priority: high
depends-on: [DD-23-001]
---

## What This Feature Should Do

The rounds_checkpoint context allows referencing checkpoint field values (e.g., "feet", "inches", "eighths") and the log_segment context allows referencing segment field values. These are accessed via a "Field Ref" tile, analogous to Point Ref but resolving against the containing form's field values instead of OPC subscriptions.

## Spec Excerpt (verbatim)

> `type FieldRefNode = { type: "field_ref"; field_name: string; }`
> — design-docs/23_EXPRESSION_BUILDER.md, §11.2

> **Context value**: `rounds_checkpoint` — **Available inputs**: Checkpoint fields (for multi-field calculations) — referenced by field name within the checkpoint definition
> — design-docs/23_EXPRESSION_BUILDER.md, §3.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/types/expression.ts:6–38` — TileType union; `field_ref` is absent
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:59–95` — ALARM_EXTRA, WIDGET_EXTRA, CONTROL_FLOW palette additions; no FieldRef palette entries for rounds/log contexts
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:140–158` — createTile factory; needs `field_ref` case
- `frontend/src/shared/components/expression/evaluator.ts:33–41` — evalTile; needs `field_ref` case
- `frontend/src/shared/components/expression/preview.ts:34–112` — tileToString; needs `field_ref` case

## Verification Checklist

- [ ] `field_ref` is present in `TileType` union in expression.ts
- [ ] `ExpressionTile` has optional `fieldName?: string` property
- [ ] `getPaletteItems('rounds_checkpoint')` returns a `field_ref` palette entry
- [ ] `getPaletteItems('log_segment')` returns a `field_ref` palette entry
- [ ] `createTile('field_ref')` returns `{ id, type: 'field_ref', fieldName: '' }`
- [ ] `evalTile` handles `field_ref` by looking up `values[tile.fieldName]`
- [ ] `tileToString` handles `field_ref` by returning the field name

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `field_ref` is not in TileType (expression.ts:6–38), not in palette for rounds/log contexts (ExpressionBuilder.tsx:89–91 adds only `if_then_else`), not in createTile factory, not handled in evaluator or preview.

## Fix Instructions (if needed)

1. Add `'field_ref'` to the `TileType` union in `frontend/src/shared/types/expression.ts`.
2. Add `fieldName?: string` to `ExpressionTile`.
3. Create a `ROUNDS_EXTRA` and `LOG_EXTRA` palette array in ExpressionBuilder.tsx containing `{ type: 'field_ref', label: 'Field Ref', group: 'Values' }`.
4. In `getPaletteItems`: add `...ROUNDS_EXTRA` for `rounds_checkpoint` and `...LOG_EXTRA` for `log_segment` (do not share — rounds has checkpoint fields, log has segment fields; both use the same tile type but the field names differ per context object).
5. In `createTile`, add: `case 'field_ref': return { ...base, fieldName: '' }`.
6. In `evaluator.ts evalTile`: add `case 'field_ref': return tile.fieldName ? (values[tile.fieldName] ?? null) : null`.
7. In `preview.ts tileToString`: add `case 'field_ref': return tile.fieldName ? tile.fieldName : '?'`.
8. The field_ref tile UI should show the fieldName in a text input (similar to ConstantEditor) so users can type the field name. The field name list is context-object-dependent and not known statically, so a free-text input with autocomplete from `contextObjectId` data is acceptable.
9. In the spec's ExprNode tree format (DD-23-001), `field_ref` maps to `FieldRefNode: { type: "field_ref", field_name: string }`.

Do NOT:
- Add field_ref to alarm_definition, widget, point_config, or forensics palette — it only applies to rounds_checkpoint and log_segment
