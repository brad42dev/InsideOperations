# Expression Builder — Phase Execution Prompts

Use each prompt below to kick off the corresponding phase. Compact between phases.

---

## Phase 1 Prompt (paste this to start)

```
Read /home/io/io-dev/io/docs/plans/expression-builder-plan.md in full.

You are implementing Phase 1 of the Expression Builder plan. Phase 1 fixes three blocking bugs that prevent ANY expression from being created via the frontend, and adds the missing "Add Expression" flow to the Expression Library settings page.

Work through these tasks IN ORDER:

**Task 1.1 — Fix serde field name aliases in auth-service**
Read: services/auth-service/src/handlers/expressions.rs
Add #[serde(alias = "context")] to expression_context field and #[serde(alias = "ast")] to expression field on BOTH CreateExpressionRequest and UpdateExpressionRequest structs.

**Task 1.2 — Fix context validation**
In the same file, find the valid_contexts array validation. Replace it with the combined array of 10 values (both original backend values AND all 6 frontend ExpressionContext values). The plan has the exact replacement.

**Task 1.3 — Fix auth-service evaluator to handle ExprNode tree format**
Read: services/auth-service/src/expression_eval.rs
The evaluator only handles the old {tiles:[]} flat format. Add detection logic at the top of evaluate_expression: if "root" key is present, use the new expr_node_to_rhai() recursive converter. If "tiles" key is present, use the existing logic. Write the full expr_node_to_rhai() function as described in the plan (handles all 8 ExprNode types: literal, point_ref, field_ref, unary, binary, function, conditional, group). Also add sanitize_identifier() helper.

**Task 1.4 — Fix gateway ExprNode struct**
Read: services/api-gateway/src/handlers/expressions.rs
Add serde aliases to ExprNode enum: PointRef needs #[serde(default)] on point_id and an ignored ref_type field; Conditional's else field needs #[serde(alias = "else_branch")]; Group's inner field needs #[serde(alias = "child")]; Function needs #[serde(default)] params field. Update ast_to_rhai_string match arms for PointRef (handle ref_type="current"), Function "round" (use params.precision), and Group (already has alias).

**Task 1.5 — Add "Add Expression" button and create dialog to ExpressionLibrary**
Read: frontend/src/pages/settings/ExpressionLibrary.tsx (read the full file carefully — it's large)
Add: (a) CONTEXT_LABELS constant, (b) createOpen state, (c) "+ Add Expression" button in header/action area shown only for users with system:expression_manage permission, (d) CreateExpressionDialog component that has a context picker and embeds ExpressionBuilder, (e) render the dialog. Follow the exact pattern shown in the plan.

**Task 1.6 — Add evaluate methods to frontend API client**
Read: frontend/src/api/expressions.ts
Add EvaluateInlineBody, EvaluateByIdBody, EvaluateResult interfaces.
Add evaluateInline() and evaluate() methods to expressionsApi.

After all changes:
1. Build: cd /home/io/io-dev/io && BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p auth-service -p api-gateway
2. Build frontend: cd /home/io/io-dev/io/frontend && pnpm build
3. Fix any compile/TypeScript errors.
4. Report what was done and what verification steps to perform.

Do NOT move to Phase 2. Stop after Phase 1 is complete and verified to compile.
```

---

## Phase 2 Prompt (paste after compacting)

```
Read /home/io/io-dev/io/docs/plans/expression-builder-plan.md in full.

You are implementing Phase 2 of the Expression Builder plan. Phase 1 is already complete (backend bugs fixed, Add Expression button added). Phase 2 improves the ExpressionBuilder UX.

**Task 2.1 — Point Picker Integration**
Read: frontend/src/shared/components/expression/ExpressionBuilder.tsx (full file)
Read: frontend/src/api/points.ts (to understand the points API)
Create: frontend/src/shared/components/expression/PointSearchPopover.tsx
This component takes onSelect(pointId, tagname) and onClose callbacks plus an anchor DOMRect. It shows a floating popover with a debounced search input that queries pointsApi.list() and shows results. Keyboard nav (ArrowUp/Down, Enter, Escape).

Then in ExpressionBuilder.tsx, find where the point_ref tile renders its display area. Add a click handler that captures the tile's DOM rect and opens PointSearchPopover. On selection, dispatch UPDATE_TILE with the new pointId and label.

**Task 2.2 — Live Server-Side Preview**
In ExpressionBuilder.tsx, find the Test/Preview panel (search for showTest state).
Import expressionsApi from the api directory.
After the existing client-side result display, add a "Verify on Server" button.
On click: call expressionsApi.evaluateInline({ ast: tilesToAst(tiles, context).root, values: testValues }).
Show server result. If it differs from client result, show a yellow warning.

**Task 2.3 — Palette Category Descriptions**
In ExpressionBuilder.tsx, find the palette group headers (search for "Values" or "Operators" group names).
Below each group header, add a short description in a small muted font (see plan for the 8 descriptions).

After all changes:
1. pnpm build from frontend dir
2. Fix any TypeScript errors
3. Report completion
```

---

## Phase 3 Prompt (paste after compacting)

```
Read /home/io/io-dev/io/docs/plans/expression-builder-plan.md in full.

You are implementing Phase 3 of the Expression Builder plan. Phases 1 and 2 are complete. Phase 3 adds missing API endpoints and wires the expression builder into more integration points.

**Task 3.1 + 3.2 — Add by-context and by-point endpoints**
Read: services/auth-service/src/handlers/expressions.rs (study the existing list handler pattern)
Read: services/auth-service/src/main.rs (find route registration area)
Read: services/api-gateway/src/main.rs (find proxy route area)

Add list_expressions_by_context handler (GET /expressions/by-context/:ctx).
Add list_expressions_by_point handler (GET /expressions/by-point/:point_id).
Mirror the existing list handler exactly for auth/response patterns.
Add routes to both auth-service main.rs and gateway main.rs.
IMPORTANT: Add the /by-context and /by-point routes BEFORE the /:id route to avoid Axum treating "by-context" as an ID.

**Task 3.3 — Frontend API methods**
Add listByContext() and listByPoint() to expressionsApi in frontend/src/api/expressions.ts.

**Task 3.4 — Context filter in ExpressionLibrary**
Read: frontend/src/pages/settings/ExpressionLibrary.tsx
Add a filter bar above the table with a context dropdown and search text input.
Update the useQuery to include these as query params and in the queryKey.

**Task 3.5 — Wire expression builder into alarm definitions**
Read the alarm definition form file (search for "alarm" in frontend/src/pages/settings/ to find it).
Add an "Expression Condition" section that opens ExpressionBuilderModal in alarm_definition context.
Store the expression ID on the alarm definition form.

**Task 3.6 — Fix Point Management duplicate save (if applicable)**
Read: frontend/src/pages/settings/PointManagement.tsx around line 1147-1240.
If there is a duplicate expressionsApi.create() call in the onApply callback, remove it.

After all changes:
1. Build backend and frontend
2. Fix any errors
3. Report completion
```

---

## Phase 4 Prompt (paste after compacting)

```
Read /home/io/io-dev/io/docs/plans/expression-builder-plan.md in full.

You are implementing Phase 4 of the Expression Builder plan. This is the most complex phase — real-time expression evaluation in the Data Broker. Phases 1-3 are complete.

BEFORE WRITING ANY CODE, read these files completely:
- services/data-broker/src/main.rs
- services/data-broker/src/fanout.rs (or the file handling point update dispatch)
- services/data-broker/Cargo.toml
- crates/io-bus/src/lib.rs
- frontend/src/shared/graphics/SceneRenderer.tsx (search for "expressionId" and "Subscribe")
- services/auth-service/src/expression_eval.rs (you'll be copying the evaluator)

Then implement:

**Task 4.1 — Copy evaluator to data-broker**
Copy the evaluate_expression(), expr_node_to_rhai(), tiles_to_rhai() (if it exists), and sanitize_identifier() functions from services/auth-service/src/expression_eval.rs into a new file services/data-broker/src/expression_eval.rs.
Add rhai = "1.19" to services/data-broker/Cargo.toml if not already present.

**Task 4.2 — Create ExpressionRegistry**
Create services/data-broker/src/expression_registry.rs per the plan.
Add dashmap to Cargo.toml if not already present (MIT license — acceptable).

**Task 4.3 — Load registry on startup + LISTEN for changes**
In data-broker/src/main.rs:
- Load all expressions with referenced_point_ids from DB into the registry on startup.
- Add a background task that LISTENs for the "expression_changed" PostgreSQL notification and updates the registry accordingly.

**Task 4.4 — Evaluate on point update**
In the fanout/update handler, after updating ShadowCache with a new point value:
- Check expression_registry.expressions_for_point()
- For each affected expression, gather current point values from ShadowCache, evaluate, store result, fan out.
- Add 100ms throttle per expression.

**Task 4.5 — NOTIFY from auth-service**
In services/auth-service/src/handlers/expressions.rs:
After successful create, update, and delete, add pg_notify('expression_changed', ...).

**Task 4.6 — Frontend SceneRenderer subscription**
In frontend/src/shared/graphics/SceneRenderer.tsx:
Find where the WebSocket Subscribe message is built.
Collect all expressionId values from bindings and include them alongside point UUIDs in the Subscribe message.

After all changes:
1. Build data-broker: cargo build -p data-broker
2. Build auth-service: cargo build -p auth-service
3. Build frontend: pnpm build
4. Fix all errors
5. Report completion and verification steps
```

---

## Phase 5 Prompt (paste after compacting)

```
Read /home/io/io-dev/io/docs/plans/expression-builder-plan.md in full.

You are implementing Phase 5 of the Expression Builder plan. This is the final phase — advanced builder features. Phases 1-4 are complete.

**Task 5.1 — Expression Templates**
Create frontend/src/shared/components/expression/templates.ts with EXPRESSION_TEMPLATES array.
Build actual tile arrays for at least: Linear Scale (point_config), High Threshold Alarm (alarm_definition), Out-of-Range Alarm (alarm_definition), Deviation Alarm (alarm_definition), Clamp to Range (point_config/widget).
In ExpressionBuilder.tsx, add a "Templates" tab in the left panel. Show templates filtered by current context. Clicking replaces tiles (with confirmation if workspace non-empty).

**Task 5.2 — Expression Sharing Toggle**
In ExpressionLibrary.tsx, add a Share/Unshare button in the actions column.
Call expressionsApi.update(id, { is_shared: !current }) on click.
Add a tooltip explaining shared visibility.
Show only for expression owner or admin.

**Task 5.3 — Expression Import/Export**
In ExpressionLibrary.tsx, add:
- Checkbox column to select expressions
- "Export Selected" button (downloads JSON file)
- "Import" button (file input, reads JSON, creates expressions via API, shows progress/errors)

**Task 5.4 — Verify Copy-Paste**
In ExpressionBuilder.tsx, find the COPY/PASTE reducer logic.
Verify Ctrl+C saves selected tiles to clipboard (deep clone with new IDs).
Verify Ctrl+V inserts the clipboard tiles at the cursor.
Fix if broken.

**Task 5.5 — Forensics Calculated Series (if forensics module exists)**
Read the forensics module files.
If a "Calculated Series" feature exists or is partially implemented, wire it to ExpressionBuilderModal in forensics context.
Add POST /api/expressions/:id/evaluate-batch endpoint (gateway only) that takes arrays of point values and returns arrays of results.

After all changes:
1. pnpm build (frontend)
2. cargo build (backend if any backend changes)
3. Fix all errors
4. Report completion
```
