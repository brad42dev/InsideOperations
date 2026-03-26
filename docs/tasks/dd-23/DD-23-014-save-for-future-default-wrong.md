---
id: DD-23-014
title: Fix saveForFuture default to true (checked by default)
unit: DD-23
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The "Save for Future Use" checkbox should be checked by default when the expression builder opens. Currently it initializes to false (unchecked), which means users building new expressions have to manually check it to save their work.

## Spec Excerpt (verbatim)

> **Save for Future Use**: Checked by default. Unchecking disables Name and Description fields.
> — design-docs/23_EXPRESSION_BUILDER.md, §4

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1065` — `saveForFuture: false` in initial state

## Verification Checklist

- [ ] Initial state sets `saveForFuture: true`
- [ ] When opened with `initialExpression` (edit mode), saveForFuture defaults to `true` (the expression was already saved)
- [ ] Name and Description fields are NOT grayed out when builder opens (since saveForFuture defaults to true)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Line 1065: `saveForFuture: false` — spec says "checked by default".

## Fix Instructions (if needed)

In `frontend/src/shared/components/expression/ExpressionBuilder.tsx` line 1065, change:
```typescript
saveForFuture: false,
```
to:
```typescript
saveForFuture: true,
```

Also verify that the Name and Description fields correctly enable/disable based on `saveForFuture` state (they should be active when true, grayed out when false). Currently the inputs at lines 1219–1233 do not conditionally disable — add `disabled={!state.saveForFuture}` and `style={{ opacity: state.saveForFuture ? 1 : 0.5 }}` to both name and description inputs.

Do NOT:
- Change the default for edit mode — when editing an existing expression, saveForFuture should also be true
