---
id: DD-23-015
title: Fix Round tile precision to use powers-of-10 increment values per spec
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Round tile's dropdown specifies the rounding increment as a power-of-10 value (0.0000001 to 1000000). Rounding to "1" means round to nearest whole number. Rounding to "0.1" means round to one decimal place. Rounding to "10" means round to nearest 10. The current implementation uses integer decimal-place counts (0–7) which is semantically different.

## Spec Excerpt (verbatim)

> **Dropdown values**: 0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000, 1000000 (powers of 10 increments)
> **Default**: 1
> **Examples**: 5.94 rounded to 0.1 = 5.9; 5.94 rounded to 1 = 6; 5.94 rounded to 10 = 10; 5.94 rounded to 100 = 0
> — design-docs/23_EXPRESSION_BUILDER.md, §5.4

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:783–803` — Round tile dropdown renders options 0–7 (decimal places)
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:145–147` — createTile sets `precision: 2` as default
- `frontend/src/shared/components/expression/evaluator.ts:65–71` — round case uses `Math.pow(10, decimals)` treating precision as decimal places

## Verification Checklist

- [ ] The Round tile's `precision` field stores a numeric increment value (e.g., 0.1, 1, 10) not a decimal-places count
- [ ] Default precision is `1` (round to nearest whole number), not `2`
- [ ] Dropdown options are the 14 values: `[0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000, 1000000]`
- [ ] `evaluator.ts` round case uses `Math.round(inner / precision) * precision`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Line 799: dropdown renders `{[0,1,2,3,4,5,6,7].map(n => <option ...>{n}</option>)}` — decimal place counts. Line 145: `precision: 2`. evaluator.ts line 68: `const factor = Math.pow(10, decimals)` — treats value as decimal place count. The semantics are wrong; `precision: 2` means 2 decimal places but should mean "round to nearest 2".

## Fix Instructions (if needed)

1. Define the options constant:
   ```typescript
   const ROUND_INCREMENTS = [0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000, 1000000]
   ```
2. In `createTile` (line 145), change `precision: 2` to `precision: 1`.
3. In the Round tile dropdown (line 799), render ROUND_INCREMENTS as options:
   ```tsx
   {ROUND_INCREMENTS.map(v => <option key={v} value={v}>{v}</option>)}
   ```
4. In `evaluator.ts` round case (line 65–71), change to:
   ```typescript
   const increment = tile.precision ?? 1
   return Math.round(inner / increment) * increment
   ```
5. Update `preview.ts` round case (line 75–78) to show the increment value: `round(${inner}, to=${decimals})`.

Do NOT:
- Change the `precision` field name on ExpressionTile — just change its semantics from decimal-places to increment-value
- Keep the `Math.pow(10, decimals)` formula — replace with `Math.round(inner / increment) * increment`
