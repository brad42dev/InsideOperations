---
id: DD-23-001
title: Fix AST serialization format to match doc 37 tree structure
unit: DD-23
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The expression builder must serialize expressions as a typed tree (root ExprNode) with specific node types per the doc 37 wire format. The current flat `tiles[]` array cannot be consumed by the Rhai backend evaluator. Every caller that saves or evaluates expressions needs the same schema.

## Spec Excerpt (verbatim)

> Expressions are stored as an AST (Abstract Syntax Tree) in JSON format, compatible with PostgreSQL JSONB.
> `{ "version": 1, "context": "point_config", "root": { ... }, "output": { "type": "float", "precision": 3 } }`
> — design-docs/23_EXPRESSION_BUILDER.md, §11.1

> `type ExprNode = LiteralNode | PointRefNode | FieldRefNode | UnaryNode | BinaryNode | FunctionNode | ConditionalNode | GroupNode`
> — design-docs/23_EXPRESSION_BUILDER.md, §11.2

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/types/expression.ts` — current ExpressionAst stores `tiles: ExpressionTile[]`; needs to be replaced with `root: ExprNode` plus `context` field
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1146–1157` — handleApply builds ExpressionAst; must call a tilesToAst converter
- `frontend/src/api/expressions.ts` — CreateExpressionBody.ast field will need updating
- `frontend/src/test/expressionAst.test.ts` — tests reference flat tiles format; will need rewriting

## Verification Checklist

- [ ] `ExpressionAst` type has `version: 1`, `context: ExpressionContext`, `root: ExprNode`, `output: { type: 'float'|'integer', precision?: number }` — no `tiles[]` field
- [ ] `ExprNode` union type covers all 8 node types: LiteralNode, PointRefNode, FieldRefNode, UnaryNode, BinaryNode, FunctionNode, ConditionalNode, GroupNode
- [ ] A `tilesToAst(tiles: ExpressionTile[], context: ExpressionContext): ExprNode` conversion function exists
- [ ] `handleApply` calls `tilesToAst` before calling `onApply`
- [ ] `expressionToString` and `evaluateExpression` can still function (may operate on ExpressionTile[] internally)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: ExpressionAst (expression.ts:57–64) uses `tiles: ExpressionTile[]` which is a flat array of UI tile objects. Spec §11 requires a recursive tree: `root: ExprNode` with typed node variants. These are structurally incompatible — the backend Rhai engine cannot parse the flat format.

## Fix Instructions (if needed)

1. In `frontend/src/shared/types/expression.ts`, replace the `ExpressionAst` interface with the spec's tree format:
   ```typescript
   export interface ExpressionAst {
     version: 1
     context: ExpressionContext
     root: ExprNode
     output: { type: 'float' | 'integer'; precision?: number }
   }
   ```
2. Add the full `ExprNode` union and all 8 typed node interfaces per spec §11.2.
3. Write a `tilesToAst(tiles: ExpressionTile[]): ExprNode` conversion function (can live in `frontend/src/shared/components/expression/ast.ts`). The conversion maps flat infix tile arrays to binary tree nodes recursively.
4. Update `handleApply` in ExpressionBuilder.tsx to call `tilesToAst(state.tiles)` and pass the tree as `root`.
5. Keep `ExpressionTile[]` as the internal UI state — only the output format (what's passed to `onApply`) changes.
6. Update `expressionsApi` in `frontend/src/api/expressions.ts` to use the new `ExpressionAst` shape.
7. Rewrite `frontend/src/test/expressionAst.test.ts` to test the tree format and tilesToAst conversion.

Do NOT:
- Change the internal reducer state — it can still use ExpressionTile[] for the workspace
- Store `context` on ExpressionTile — it belongs on ExpressionAst
