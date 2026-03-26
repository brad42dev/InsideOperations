---
id: DD-23-016
title: Implement Rhai expression evaluation handler in API gateway
unit: DD-23
status: pending
priority: high
depends-on: [DD-23-001]
---

## What This Feature Should Do

The `/api/expressions/evaluate` and `/api/expressions/:id/evaluate` endpoints must evaluate expression ASTs server-side using the Rhai engine in expression-only mode. This is used for historical data queries, report generation, and server-side alarm evaluation. The rhai crate is already in the workspace Cargo.toml.

## Spec Excerpt (verbatim)

> **Library**: `Rhai` v1.19.0 (MIT OR Apache-2.0). The AST JSON is converted to a Rhai expression string and evaluated in expression-only mode.
> `let engine = Engine::new(); let result: f64 = engine.eval_expression_with_scope::<f64>(&mut scope, &expression_string)?;`
> — design-docs/23_EXPRESSION_BUILDER.md, §13.2

> ```
> POST /api/expressions/evaluate   — Test-evaluate an expression with a given value
> POST /api/expressions/:id/evaluate — Evaluate a saved expression
> ```
> — design-docs/23_EXPRESSION_BUILDER.md, §16

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs:376–379` — routes for /api/expressions registered but point to `proxy_auth` (stub)
- `services/api-gateway/src/handlers/` — no expressions.rs handler file exists
- `Cargo.toml` — `rhai = { version = "1.19", features = ["sync"] }` present at workspace level

## Verification Checklist

- [ ] `services/api-gateway/src/handlers/expressions.rs` exists
- [ ] Handler deserializes `ExpressionAst` (the tree format from DD-23-001) from request body
- [ ] Handler converts ExprNode tree to a Rhai expression string
- [ ] Handler uses `Engine::new()` with `eval_expression_with_scope` (expression-only mode, not full script mode)
- [ ] Point variable values are injected into a Rhai `Scope` before evaluation
- [ ] Response returns `{ result: f64 }` or `{ error: string }` on eval failure

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Routes exist in main.rs (lines 377–379) but route to `proxy_auth` which is a passthrough stub. No `expressions.rs` handler file exists in `services/api-gateway/src/handlers/`. The rhai crate is present in Cargo.toml (workspace level) but not referenced from api-gateway's own Cargo.toml.

## Fix Instructions (if needed)

1. Add `rhai.workspace = true` to `services/api-gateway/Cargo.toml` (as auth-service does).
2. Create `services/api-gateway/src/handlers/expressions.rs` with:
   - `ExpressionDocument` struct matching the spec §11.3 Rust types
   - `ast_to_rhai_string(node: &ExprNode) -> String` recursive converter
   - `evaluate_handler(body: Json<EvalRequest>) -> Json<EvalResponse>` endpoint handler
3. The `ast_to_rhai_string` must handle all 8 ExprNode variants: Literal, PointRef, FieldRef, Unary, Binary, Function, Conditional, Group.
4. Use `Engine::new()` (not `Engine::new_raw()`) with default limits. The spec mentions 100k op limit — set `engine.set_max_operations(100_000)`.
5. Bind point values to a Rhai `Scope` before calling `eval_expression_with_scope`.
6. Update `main.rs` routes to use the new handler instead of `proxy_auth`.
7. Add `pub mod expressions;` to `handlers/mod.rs`.

Do NOT:
- Use `engine.eval::<f64>()` (full script mode) — must use `eval_expression_with_scope` (expression-only)
- Use `Engine::new_raw()` — the default Engine has safe built-in math functions needed for expressions
