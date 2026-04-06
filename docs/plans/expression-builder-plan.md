# Expression Builder — Full Implementation Plan

**Project**: I/O Industrial Process Monitor — Expression Builder Feature  
**Date**: 2026-04-06  
**Status**: Ready for implementation  

---

## Architecture Overview

The Expression Builder is a tile-based drag-and-drop UI for building mathematical/logical expressions in an industrial monitoring application. Expressions reference live OPC point values and are evaluated server-side by a Rhai scripting engine.

### Current Service Topology

```
Browser  --->  API Gateway (Rust/Axum, port 4000)
                  |
                  +--proxy--> Auth Service (Rust/Axum, port 4001)
                  |              - Expression CRUD (custom_expressions table)
                  |              - expression_eval.rs (OLD tile-flat evaluator)
                  |
                  +--local-->  Gateway expression handlers
                  |              - ExprNode tree evaluator (Rhai)
                  |              - POST /api/expressions/evaluate (inline)
                  |              - POST /api/expressions/:id/evaluate (saved)
                  |
                  +--proxy--> Data Broker (Rust, port 4003)
                                 - WebSocket real-time point values
```

### Key Files Reference

| Layer | File | Purpose |
|-------|------|---------|
| Frontend types | `frontend/src/shared/types/expression.ts` | All TS types: ExpressionTile, ExprNode, ExpressionAst, ExpressionContext |
| Frontend builder | `frontend/src/shared/components/expression/ExpressionBuilder.tsx` | Main tile DnD builder |
| Frontend modal | `frontend/src/shared/components/expression/ExpressionBuilderModal.tsx` | Radix Dialog wrapper |
| Frontend AST | `frontend/src/shared/components/expression/ast.ts` | tilesToAst() converter |
| Frontend evaluator | `frontend/src/shared/components/expression/evaluator.ts` | Client-side JS evaluator |
| Frontend preview | `frontend/src/shared/components/expression/preview.ts` | expressionToString() |
| Frontend API | `frontend/src/api/expressions.ts` | API client (list/get/create/update/delete) |
| Frontend library | `frontend/src/pages/settings/ExpressionLibrary.tsx` | Settings page listing expressions |
| Frontend points API | `frontend/src/api/points.ts` | Point list/search API |
| Backend CRUD | `services/auth-service/src/handlers/expressions.rs` | Expression CRUD handlers |
| Backend old eval | `services/auth-service/src/expression_eval.rs` | OLD tile-flat Rhai evaluator |
| Backend gateway eval | `services/api-gateway/src/handlers/expressions.rs` | ExprNode tree Rhai evaluator |
| Backend gateway routes | `services/api-gateway/src/main.rs` | Route registration |
| Backend auth routes | `services/auth-service/src/main.rs` | Route registration |

---

## Phase 1 — Critical Fixes + Add Expression (Highest Priority)

**Goal**: Fix three blocking bugs preventing ANY expression from being created via the frontend, and add the missing "Add Expression" flow to ExpressionLibrary.

### Bug Summary

**Bug 1 — Field name mismatch: frontend sends `context`/`ast`, backend expects `expression_context`/`expression`.**  
Auth-service `CreateExpressionRequest` has `expression_context` and `expression` fields, but the frontend sends `context` and `ast`. The backend silently ignores the unknown fields, stores NULL for the expression, and later crashes on read.

**Bug 2 — Context validation rejects all frontend context values.**  
Auth-service validates against `["conversion", "calculated_value", "alarm_condition", "custom"]` but the frontend `ExpressionContext` type uses `["point_config", "alarm_definition", "rounds_checkpoint", "log_segment", "widget", "forensics"]`. Zero overlap — every create from the frontend returns 400.

**Bug 3 — AST format divergence.**  
Auth-service `expression_eval.rs` reads a flat `tiles[]` array. The frontend stores a recursive `ExprNode` tree (`{ version, context, root, output }`). Evaluating a stored expression via auth-service always fails.

**Bug 4 — Gateway ExprNode struct does not match frontend JSON shape.**  
Field name mismatches: `else_branch` vs `else`, `child` vs `inner`, missing `ref_type` on PointRef, missing `params` on FunctionNode.

### 1.1 Fix Field Name Mismatch in Auth-Service (serde aliases)

**File**: `services/auth-service/src/handlers/expressions.rs`

Read the file first. Find `CreateExpressionRequest` and `UpdateExpressionRequest` structs.

Add `#[serde(alias = "context")]` to the `expression_context` field and `#[serde(alias = "ast")]` to the `expression` field on both structs:

```rust
#[derive(Debug, Deserialize)]
pub struct CreateExpressionRequest {
    pub name: String,
    pub description: Option<String>,
    #[serde(alias = "context")]
    pub expression_context: Option<String>,
    #[serde(alias = "ast")]
    pub expression: JsonValue,
    pub output_type: Option<String>,
    pub output_precision: Option<i32>,
    pub is_shared: Option<bool>,
    pub referenced_point_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExpressionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(alias = "ast")]
    pub expression: Option<JsonValue>,
    pub output_type: Option<String>,
    pub output_precision: Option<i32>,
    pub is_shared: Option<bool>,
    pub referenced_point_ids: Option<Vec<Uuid>>,
}
```

### 1.2 Fix Context Validation to Accept Frontend Context Values

**File**: `services/auth-service/src/handlers/expressions.rs`

Find the `valid_contexts` array (search for `"conversion"` or `"alarm_condition"`). Replace with:

```rust
let valid_contexts = [
    // Original backend contexts (kept for backwards compatibility)
    "conversion",
    "calculated_value",
    "alarm_condition",
    "custom",
    // Frontend ExpressionContext values
    "point_config",
    "alarm_definition",
    "rounds_checkpoint",
    "log_segment",
    "widget",
    "forensics",
];
```

### 1.3 Fix Auth-Service Evaluator to Handle ExprNode Tree Format

**File**: `services/auth-service/src/expression_eval.rs`

Read the entire file. The evaluator currently only handles the old `{ "tiles": [...] }` flat format. It needs to also handle the new tree format `{ "version": 1, "context": "...", "root": {...}, "output": {...} }`.

**Strategy**: At the top of `evaluate_expression`, detect which format is present by checking for the `root` key. If present, use a new `expr_node_to_rhai()` function. If absent, fall through to the existing tiles logic.

Add a new helper function `expr_node_to_rhai(node: &Value, ...) -> Result<String, String>` that recursively converts an ExprNode JSON object to a Rhai expression string. The ExprNode types (from the frontend) are:

- `{ "type": "literal", "value": <number|bool> }` → format the number
- `{ "type": "point_ref", "ref_type": "current"|"specific", "point_id": "<uuid>", "tagname": "<str>" }` → if ref_type is "current" or point_id is null/empty, use "current_point" variable; otherwise look up in point_values map
- `{ "type": "field_ref", "field_name": "<str>" }` → sanitized identifier
- `{ "type": "unary", "op": "negate"|"abs"|"square"|"cube"|"not", "operand": <node> }` → `-(x)`, `abs(x)`, `(x*x)`, `(x*x*x)`, `!(x)`
- `{ "type": "binary", "op": "+"|"-"|"*"|"/"|"%"|"^"|">"|"<"|">="|"<="|"and"|"or", "left": <node>, "right": <node> }` → `(l op r)`, map "and"→"&&", "or"→"||"
- `{ "type": "function", "name": "<str>", "args": [<node>], "params": {...} }` → `name(args...)`, special case "round" with precision from params
- `{ "type": "conditional", "condition": <node>, "then": <node>, "else_branch": <node> }` → `if (cond) { then } else { else }`
- `{ "type": "group", "child": <node> }` → `(inner)`

Also add a helper `sanitize_identifier(s: &str) -> String` that replaces non-alphanumeric-non-underscore chars with `_` and prepends `_` if starts with a digit.

Update the main `evaluate_expression` function body to:
```rust
pub fn evaluate_expression(ast: &Value, point_values: &HashMap<String, f64>) -> Result<f64, String> {
    if let Some(root) = ast.get("root") {
        // New tree format
        let script = expr_node_to_rhai(root, point_values)?;
        if script.trim().is_empty() {
            return Err("Expression produces no value".to_string());
        }
        // inject point values into Rhai scope and evaluate
        let engine = make_engine(); // or however the engine is constructed in this file
        let mut scope = rhai::Scope::new();
        for (key, &val) in point_values {
            let var_name = sanitize_identifier(key);
            scope.push(var_name, val);
        }
        let result: rhai::Dynamic = engine
            .eval_with_scope::<rhai::Dynamic>(&mut scope, &script)
            .map_err(|e| format!("Rhai evaluation error: {e}"))?;
        if let Ok(v) = result.as_float() { return Ok(v); }
        if let Ok(v) = result.as_int() { return Ok(v as f64); }
        Err(format!("Expression result is not numeric: {}", result.type_name()))
    } else {
        // Legacy tile format — existing code handles this
        // ... (existing tiles handling) ...
    }
}
```

### 1.4 Fix Gateway ExprNode Struct to Accept Frontend JSON Shape

**File**: `services/api-gateway/src/handlers/expressions.rs`

Read the file. Find the `ExprNode` enum. Add serde aliases to match the frontend's field names:

- `PointRef`: add `#[serde(default)]` to `point_id` (frontend sends null when ref_type is "current"), add `#[serde(default)]` for an ignored `ref_type: Option<String>` field.
- `Conditional` (`else_branch` field): add `#[serde(alias = "else_branch")]` to the `else` field (currently serialized as `"else"` but frontend sends `"else_branch"`).
- `Group` (`child` field): add `#[serde(alias = "child")]` to the `inner` field.
- `Function`: add `#[serde(default)] pub params: Option<serde_json::Map<String, Value>>` field.

Also update the `ast_to_rhai_string` match arms:
- `ExprNode::PointRef`: if `ref_type == Some("current")` or `point_id` is empty, emit `"current_point"` as the variable name.
- `ExprNode::Function { name: "round", params, args }`: extract `precision` from params, emit `((arg * factor).round() / factor)`.

### 1.5 Add "Add Expression" Button and Create Flow to ExpressionLibrary

**File**: `frontend/src/pages/settings/ExpressionLibrary.tsx`

Read the full file first. Understand the existing layout (SettingsPageLayout with variant="list", DataTable, edit/delete dialogs).

**Changes needed:**

1. Import `ExpressionBuilder` from `../../shared/components/expression`:
   ```typescript
   import { ExpressionBuilder } from "../../shared/components/expression";
   ```

2. Add `CONTEXT_LABELS` map (used in create dialog):
   ```typescript
   const CONTEXT_LABELS: Record<string, string> = {
     point_config: "Point Conversion",
     alarm_definition: "Alarm Condition",
     rounds_checkpoint: "Rounds Checkpoint",
     log_segment: "Log Segment",
     widget: "Widget Data Source",
     forensics: "Forensics Calculated Series",
   };
   ```

3. Add state: `const [createOpen, setCreateOpen] = useState(false);`

4. Add "+ Add Expression" button in the page header. Find where the existing "edit" button or the `action` prop is passed to `SettingsPageLayout`. Add alongside it:
   ```tsx
   <button onClick={() => setCreateOpen(true)} style={btnPrimary}>
     + Add Expression
   </button>
   ```
   Only show if the user has `system:expression_manage` permission (check the existing permission pattern used for edit/delete in this file).

5. Add a `CreateExpressionDialog` component defined in the same file:

```tsx
function CreateExpressionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [context, setContext] = useState<string>("point_config");
  const queryClient = useQueryClient();

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: "var(--io-overlay, rgba(0,0,0,0.5))", zIndex: 200 }} />
        <Dialog.Content
          style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px", padding: "24px",
            width: "min(960px, 96vw)", maxHeight: "92vh",
            overflowY: "auto", zIndex: 201,
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column", gap: "16px",
          }}
          aria-describedby={undefined}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Dialog.Title style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--io-text-primary)" }}>
              New Expression
            </Dialog.Title>
            <Dialog.Close asChild>
              <button style={{ background: "none", border: "none", color: "var(--io-text-muted)", cursor: "pointer", fontSize: "18px" }} aria-label="Close">
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ fontSize: "13px", color: "var(--io-text-secondary)", fontWeight: 500 }}>Context:</label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              style={{ padding: "6px 10px", background: "var(--io-surface-sunken)", border: "1px solid var(--io-border)", borderRadius: "var(--io-radius)", color: "var(--io-text-primary)", fontSize: "13px" }}
            >
              {Object.entries(CONTEXT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <ExpressionBuilder
            context={context as ExpressionContext}
            contextLabel={CONTEXT_LABELS[context] ?? context}
            onApply={(_ast) => {
              queryClient.invalidateQueries({ queryKey: ["expressions"] });
              onCreated();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

6. Render the dialog at the bottom of the component return:
```tsx
<CreateExpressionDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
  onCreated={() => queryClient.invalidateQueries({ queryKey: ["expressions"] })}
/>
```

**Important**: Import `ExpressionContext` from `../../shared/types/expression` if not already imported. Import `Dialog` from `@radix-ui/react-dialog` if not already imported.

### 1.6 Add `evaluate()` and `evaluateInline()` to Frontend API Client

**File**: `frontend/src/api/expressions.ts`

Read the full file first. Add two new methods and the interfaces they need.

Add before the `smsProvidersApi` export (or at the end of the file):

```typescript
export interface EvaluateInlineBody {
  ast: Record<string, unknown>;  // ExprNode root object
  values: Record<string, number>;
}

export interface EvaluateByIdBody {
  values: Record<string, number>;
}

export interface EvaluateResult {
  result: number;
}
```

Add to `expressionsApi` object:
```typescript
  evaluateInline: (body: EvaluateInlineBody): Promise<ApiResult<EvaluateResult>> =>
    api.post<EvaluateResult>("/api/expressions/evaluate", body),

  evaluate: (id: string, body: EvaluateByIdBody): Promise<ApiResult<EvaluateResult>> =>
    api.post<EvaluateResult>(`/api/expressions/${id}/evaluate`, body),
```

### Phase 1 Build and Verify

After all changes:

1. **Build backend**: `BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p auth-service -p api-gateway` from `/home/io/io-dev/io`. Fix any compile errors.

2. **Build frontend**: `pnpm build` from `/home/io/io-dev/io/frontend`. Fix any TypeScript errors.

3. **Restart services**: Kill existing auth-service (check with `pgrep auth-service`) and api-gateway (`pgrep api-gateway`), restart with new binaries.

4. **Manual verification**:
   - Navigate to Settings > Expression Library
   - Confirm "+ Add Expression" button is present
   - Click it, verify dialog opens with context picker and ExpressionBuilder
   - Build a simple expression (drag a Constant tile, set value to 42)
   - Fill in name "Test Expression", click Save/Apply
   - Verify it appears in the library list (no 400/500 errors)

---

## Phase 2 — Expression Builder UX Polish

**Goal**: Improve ExpressionBuilder with real point search, live server-validated preview, better palette organization.

### 2.1 Point Picker Integration

**File**: `frontend/src/shared/components/expression/ExpressionBuilder.tsx`

Currently the "Point Ref" tile is dropped with an empty `pointId`, and users must manually type it. Fix this by showing a search popover when the user clicks/edits a Point Ref tile.

Create a new file `frontend/src/shared/components/expression/PointSearchPopover.tsx`:

```tsx
// Props:
// - onSelect: (pointId: string, tagname: string) => void
// - onClose: () => void
// - anchor: DOMRect | null

// Implementation:
// - useQuery({ queryKey: ["points-search", query], queryFn: () => pointsApi.list({ search: query, limit: 10 }) })
// - Debounce query 300ms (use a local state + useEffect)
// - Show a floating popover (position: fixed, based on anchor rect)
// - Text input with autofocus
// - Scrollable list of results showing tagname, description, engineering unit
// - Keyboard: ArrowUp/Down to navigate, Enter to select, Escape to close
```

In `ExpressionBuilder.tsx`, find where Point Ref tile renders its edit/display UI (search for `point_ref` in the tile rendering section). Add a click handler on the tile's point display area that opens `PointSearchPopover`. On selection, dispatch `UPDATE_TILE` with the new `pointId` and `pointLabel` (tagname).

Import `pointsApi` from `../../../api/points` (verify the actual import path by checking other files that use pointsApi).

### 2.2 Live Server-Side Preview in ExpressionBuilder

**File**: `frontend/src/shared/components/expression/ExpressionBuilder.tsx`

Find the existing Test/Preview panel (search for `showTest` state or test button). Currently it shows the client-side JS evaluator result.

Add server-side validation:
1. Import `expressionsApi` from `../../../api/expressions`
2. Import `tilesToAst` from `./ast`
3. After the client-side result, add a "Server Check" button that:
   - Calls `expressionsApi.evaluateInline({ ast: tilesToAst(state.tiles, context).root, values: testValues })`
   - Shows the server result in a separate line
   - If server result differs from client result, shows a warning "Client and server results differ"
   - Shows any server evaluation error

Use `useState` for `serverResult: number | null` and `serverError: string | null`. Use a regular async function (not useMutation) since this is a one-off test action.

### 2.3 Palette Category Descriptions

**File**: `frontend/src/shared/components/expression/ExpressionBuilder.tsx`

Find the palette section (search for "Values" or "Operators" group names). Below each group header `<div>`, add a short `<div>` with description text in a smaller, muted font:

| Group | Description |
|-------|-------------|
| Values | Data inputs — point references and constants |
| Operators | Arithmetic operations |
| Functions | Math transforms and wrappers |
| Compare | Comparison operators (return 1.0 or 0.0) |
| Boolean | Logical operators (alarm context only) |
| Control | Conditional branching |
| Time | Time-based functions (server-evaluated) |
| Aggregation | Statistical aggregates over point history |

Keep the description text short (max 50 chars). Style with `fontSize: "11px"` and `color: "var(--io-text-muted)"`.

### Phase 2 Build and Verify

1. `pnpm build` from frontend dir — no TypeScript errors.
2. Open expression builder, drag a Point Ref tile, click on it — point search popover appears.
3. Type a partial tag name — results appear matching OPC points in the database.
4. Select a point — tile updates with the tag name.
5. Fill in test inputs, click "Server Check" — server result appears alongside client result.

---

## Phase 3 — Missing API Endpoints + Integration Points

**Goal**: Add missing endpoints from spec, wire expression builder into alarm definitions, fix point management integration, add context filter to expression library.

### 3.1 Add `GET /api/expressions/by-context/:ctx` Endpoint

**File**: `services/auth-service/src/handlers/expressions.rs`

Add a new handler function after the existing list handler:

```rust
pub async fn list_expressions_by_context(
    State(state): State<AppState>,
    Extension(caller): Extension<AuthUser>,
    Path(ctx): Path<String>,
) -> IoResult<impl IntoResponse> {
    let rows = sqlx::query_as!(ExpressionRow,
        r#"SELECT id, name, description, expression, output_type, output_precision,
                  expression_context, created_by, shared, referenced_point_ids,
                  created_at, updated_at
           FROM custom_expressions
           WHERE expression_context = $1
             AND (created_by = $2 OR shared = true)
           ORDER BY name ASC"#,
        ctx,
        caller.user_id,
    )
    .fetch_all(&state.db)
    .await
    .map_err(IoError::from)?;

    Ok(Json(ApiResponse::ok(rows)))
}
```

Note: use whatever pattern the existing `list_expressions` handler uses for auth and response formatting — mirror it exactly. Read the existing handler before writing this one.

**File**: `services/auth-service/src/main.rs`

Add route (add before the existing `/expressions/:id` route to avoid path conflicts):
```rust
.route("/expressions/by-context/:ctx", get(handlers::expressions::list_expressions_by_context))
```

**File**: `services/api-gateway/src/main.rs`

Add proxy route:
```rust
.route("/api/expressions/by-context/:ctx", get(proxy_auth))
```

### 3.2 Add `GET /api/expressions/by-point/:pointId` Endpoint

Same pattern as 3.1. Add handler, auth route, and gateway proxy route.

Query:
```sql
SELECT ... FROM custom_expressions
WHERE $1::uuid = ANY(referenced_point_ids)
  AND (created_by = $2 OR shared = true)
ORDER BY name ASC
```

Route path: `/expressions/by-point/:point_id` (auth-service), `/api/expressions/by-point/:point_id` (gateway).

### 3.3 Frontend API Methods for New Endpoints

**File**: `frontend/src/api/expressions.ts`

Add to `expressionsApi`:
```typescript
  listByContext: (ctx: string): Promise<ApiResult<SavedExpression[]>> =>
    api.get<SavedExpression[]>(`/api/expressions/by-context/${encodeURIComponent(ctx)}`),

  listByPoint: (pointId: string): Promise<ApiResult<SavedExpression[]>> =>
    api.get<SavedExpression[]>(`/api/expressions/by-point/${pointId}`),
```

Note: check what the `SavedExpression` type is called in this file — it may be `Expression`, `ExpressionRecord`, or something else. Use the existing type name.

### 3.4 Add Context Filter to ExpressionLibrary

**File**: `frontend/src/pages/settings/ExpressionLibrary.tsx`

Add above the DataTable, a filter bar with:
1. A context dropdown (`<select>`) defaulting to "All Contexts" (empty string), with all 10 context values (both original and frontend) as options.
2. A search text input with debounce (300ms).

Pass these as query params to the `expressionsApi.list()` call. The backend already supports `?context=...&q=...` query params on the list endpoint — verify this by reading the `list_expressions` handler in auth-service.

Update the `useQuery` queryKey to include these filters: `["expressions", contextFilter, searchQuery]`.

### 3.5 Wire Expression Builder into Alarm Definitions

**File**: `frontend/src/pages/settings/EventConfig.tsx` (or wherever alarm definitions are edited)

Read the file first to understand the alarm definition form structure.

Find where alarm conditions/rules are configured. Add a new section "Expression Condition" that:
1. Shows a button "Configure Expression" (only visible when alarm type is "expression" or similar).
2. Opens `ExpressionBuilderModal` from `../../shared/components/expression` in `alarm_definition` context.
3. On apply, stores `expressionId` on the alarm definition form state and calls the update API.

If the current EventConfig form doesn't support expression conditions at all (expression alarm type doesn't exist yet), add it:
- Add "Expression" as an alarm condition type option in the type dropdown.
- When selected, show the "Configure Expression" button.

### 3.6 Fix Point Management Duplicate Save

**File**: `frontend/src/pages/settings/PointManagement.tsx`

Read around line 1147-1240 (the custom conversion section). Check if the `onApply` callback calls `expressionsApi.create()` in addition to what ExpressionBuilder does internally.

If double-saving is occurring, remove the duplicate API call from PointManagement's `onApply`. The ExpressionBuilder's internal "Save for Future Use" mechanism handles persistence. The `onApply` callback only needs to store the returned expression AST or ID on the point's form state.

### Phase 3 Build and Verify

1. Build both services and frontend.
2. `GET /api/expressions/by-context/point_config` — returns only matching expressions.
3. `GET /api/expressions/by-point/{valid-uuid}` — returns expressions that reference that point.
4. ExpressionLibrary context dropdown filters the list.
5. Alarm definition form has expression condition type with working builder.

---

## Phase 4 — Real-time Expression Evaluation Pipeline

**Goal**: Enable SceneRenderer and graphics displays to show live calculated values from expressions, updating in real-time as OPC point values change.

### Architecture Design

Current data flow:
```
OPC Server → opc-service → Data Broker ShadowCache → WebSocket → Browser
```

Target data flow for expression-derived values:
```
Point update arrives at Data Broker
  → Check expression registry: which expressions reference this point?
  → For each affected expression:
      1. Gather current values for all referenced points from ShadowCache
      2. Evaluate expression with Rhai engine
      3. Store result in ShadowCache under expression UUID
      4. Fan out result to all clients subscribed to that expression UUID
```

The client subscribes to an expression UUID the same way it subscribes to a point UUID — no protocol change needed.

### 4.1 Shared Expression Evaluator Crate

**File**: `crates/io-models/src/lib.rs` OR create a new file `crates/io-models/src/expression_eval.rs`

Extract the `expr_node_to_rhai()` and `evaluate_expression()` functions from `services/auth-service/src/expression_eval.rs` into a shared location. Both the auth-service and the data-broker need this functionality.

Option A (simpler): Duplicate the evaluator code into data-broker (quick but creates maintenance burden).  
Option B (clean): Move to a shared crate. Add `rhai = "1.19"` to the shared crate's `Cargo.toml`, then use it from both services.

Recommend Option A for Phase 4 to keep scope bounded — add a TODO comment to migrate to Option B later.

### 4.2 Expression Registry in Data Broker

**File**: `services/data-broker/src/expression_registry.rs` (CREATE)

```rust
use dashmap::DashMap;
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;

pub struct ExpressionRegistry {
    /// expression_id → (ast_json, referenced_point_ids)
    pub expressions: DashMap<Uuid, (Value, Vec<Uuid>)>,
    /// point_id → Vec<expression_id> that reference this point
    pub point_to_exprs: DashMap<Uuid, Vec<Uuid>>,
}

impl ExpressionRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            expressions: DashMap::new(),
            point_to_exprs: DashMap::new(),
        })
    }

    pub fn load_expression(&self, id: Uuid, ast: Value, point_ids: Vec<Uuid>) {
        for pid in &point_ids {
            self.point_to_exprs.entry(*pid).or_default().push(id);
        }
        self.expressions.insert(id, (ast, point_ids));
    }

    pub fn remove_expression(&self, id: &Uuid) {
        if let Some((_, (_, point_ids))) = self.expressions.remove(id) {
            for pid in &point_ids {
                if let Some(mut exprs) = self.point_to_exprs.get_mut(pid) {
                    exprs.retain(|e| e != id);
                }
            }
        }
    }

    pub fn expressions_for_point(&self, point_id: &Uuid) -> Vec<Uuid> {
        self.point_to_exprs
            .get(point_id)
            .map(|v| v.clone())
            .unwrap_or_default()
    }
}
```

**File**: `services/data-broker/src/main.rs`

On startup (after DB connection is established), load all expressions from the database:
```rust
let expression_registry = ExpressionRegistry::new();
let exprs = sqlx::query!(
    "SELECT id, expression, referenced_point_ids FROM custom_expressions WHERE array_length(referenced_point_ids, 1) > 0"
)
.fetch_all(&db_pool)
.await?;
for expr in exprs {
    let ids: Vec<Uuid> = expr.referenced_point_ids.unwrap_or_default();
    expression_registry.load_expression(expr.id, expr.expression, ids);
}
```

Pass `expression_registry: Arc<ExpressionRegistry>` into the fanout/update handler.

### 4.3 Expression Evaluation on Point Update

**File**: `services/data-broker/src/fanout.rs` (or the file where point updates are dispatched)

Read the data-broker source first to understand the update path. After updating the ShadowCache with a new point value:

```rust
// After updating shadow_cache with new point value:
let affected_exprs = expression_registry.expressions_for_point(&point_id);
for expr_id in affected_exprs {
    if let Some(entry) = expression_registry.expressions.get(&expr_id) {
        let (ast, ref_ids) = entry.value();
        // Gather current values
        let mut values: HashMap<String, f64> = HashMap::new();
        for pid in ref_ids {
            if let Some(v) = shadow_cache.get(pid) {
                values.insert(pid.to_string(), v.value);
            }
        }
        // Evaluate — use the local copy of evaluate_expression
        match evaluate_expression(ast, &values) {
            Ok(result) => {
                // Store in shadow cache under expression UUID
                shadow_cache.insert(expr_id, PointValue { value: result, quality: Good, timestamp: now() });
                // Fan out to subscribers
                fanout_value(expr_id, result, &subscribers);
            }
            Err(e) => {
                tracing::warn!("Expression {} evaluation error: {e}", expr_id);
            }
        }
    }
}
```

Add throttling: track `last_evaluated_at: DashMap<Uuid, Instant>` on the registry. Skip re-evaluation if last eval was < 100ms ago (for high-frequency points).

### 4.4 PostgreSQL LISTEN/NOTIFY for Expression Changes

**File**: `services/data-broker/src/main.rs`

Add a PostgreSQL LISTEN connection for `expression_changed` notifications. The auth-service should send `NOTIFY expression_changed, '<expression_id>:<action>'` where action is `created`, `updated`, or `deleted`.

**File**: `services/auth-service/src/handlers/expressions.rs`

After each successful create/update/delete of an expression, add:
```rust
sqlx::query("SELECT pg_notify('expression_changed', $1)")
    .bind(format!("{}:{}", expression_id, action))
    .execute(&state.db)
    .await
    .ok(); // non-fatal
```

### 4.5 Frontend SceneRenderer — Include Expression UUIDs in Subscription

**File**: `frontend/src/shared/graphics/SceneRenderer.tsx`

Find where the WebSocket subscription message is built (search for `Subscribe` or `subscribe`). Alongside point UUIDs, collect all `expressionId` values from bindings in the scene graph, and include them in the subscription list.

No change to how values are displayed — the SceneRenderer already handles `expressionId` by looking it up in `pointValues` (which will now be populated by the Data Broker).

### Phase 4 Build and Verify

1. Build data-broker: `cargo build -p data-broker`
2. Build auth-service with NOTIFY additions.
3. Create an expression referencing a real OPC point (e.g., `point_A * 2`).
4. Bind a display element in the designer to that expression UUID.
5. Open the graphic in the console/process module.
6. Verify the display element shows the correct computed value (not 0 or N/A).
7. Simulate an OPC point value change — verify the display element updates in real-time.

### Phase 4 Risks

- **dashmap dependency**: Ensure `dashmap` is already in data-broker's Cargo.toml. If not, add it (MIT license — acceptable).
- **Rhai in data-broker**: Rhai crate may not currently be a dependency of data-broker. Add to `services/data-broker/Cargo.toml`.
- **Performance**: On high-frequency points (100Hz), expression eval fires 100x/sec. The 100ms throttle in 4.3 must be implemented.
- **Circular refs**: Do not allow expressions to reference other expression UUIDs — only raw point UUIDs. Validate this in the auth-service create/update handler.

---

## Phase 5 — Advanced Builder Features

**Goal**: Templates, sharing UI, copy-paste subtrees, expression import/export, forensics calculated series.

### 5.1 Expression Templates

**File**: `frontend/src/shared/components/expression/templates.ts` (CREATE)

Define a set of pre-built expression templates as arrays of ExpressionTile objects:

```typescript
export interface ExpressionTemplate {
  id: string;
  name: string;
  description: string;
  category: "Conversion" | "Alarm" | "Statistical" | "Arithmetic";
  contexts: string[];  // valid ExpressionContext values
  tiles: ExpressionTile[];
}

export const EXPRESSION_TEMPLATES: ExpressionTemplate[] = [
  {
    id: "linear-scale",
    name: "Linear Scale",
    description: "(value − offset) × gain",
    category: "Conversion",
    contexts: ["point_config"],
    tiles: [/* pre-built tile array for (point_ref - constant) * constant */],
  },
  {
    id: "clamp",
    name: "Clamp to Range",
    description: "Clamp value between min and max",
    category: "Conversion",
    contexts: ["point_config", "widget"],
    tiles: [/* if-then-else with gt/lt comparisons */],
  },
  {
    id: "threshold-alarm",
    name: "High Threshold Alarm",
    description: "True when value exceeds limit",
    category: "Alarm",
    contexts: ["alarm_definition"],
    tiles: [/* point_ref gt constant */],
  },
  {
    id: "range-alarm",
    name: "Out-of-Range Alarm",
    description: "True when value is outside low..high range",
    category: "Alarm",
    contexts: ["alarm_definition"],
    tiles: [/* (point_ref lt low) or (point_ref gt high) */],
  },
  {
    id: "deviation-alarm",
    name: "Deviation Alarm",
    description: "True when two points differ by more than threshold",
    category: "Alarm",
    contexts: ["alarm_definition"],
    tiles: [/* abs(point_ref_a - point_ref_b) gt constant */],
  },
];
```

For each template, actually construct the `ExpressionTile[]` array with real tile objects matching the types from `frontend/src/shared/types/expression.ts`. Use `crypto.randomUUID()` or simple ID strings for tile IDs (they will be regenerated when loaded anyway).

**File**: `frontend/src/shared/components/expression/ExpressionBuilder.tsx`

Add a "Templates" tab alongside "Palette" in the left panel. Show templates filtered by current context. Clicking a template:
1. Shows a confirmation prompt if the current workspace is non-empty ("This will replace your current expression. Continue?").
2. Deep-clones the template tiles (regenerating all IDs with `crypto.randomUUID()`).
3. Dispatches `RESET_TILES` (or equivalent) with the cloned tiles.

### 5.2 Expression Sharing Toggle in Library

**File**: `frontend/src/pages/settings/ExpressionLibrary.tsx`

In the DataTable actions column, add a Share button (or toggle icon) alongside Edit/Delete.

On click, call:
```typescript
expressionsApi.update(id, { is_shared: !currentExpression.is_shared })
```

Then `queryClient.invalidateQueries({ queryKey: ["expressions"] })`.

Show a tooltip "Shared expressions are visible to all users" on hover.

Only show for the expression owner or admins (check `expr.created_by === currentUserId || hasRole("admin")`).

### 5.3 Expression Import/Export

**File**: `frontend/src/pages/settings/ExpressionLibrary.tsx`

Add "Export" and "Import" buttons in the page action area (alongside "+ Add Expression").

**Export**: 
- Let user select expressions via checkboxes in the table (add a checkbox column).
- "Export Selected" button calls `expressionsApi.list()` and serializes the selected records to JSON.
- Trigger a file download: `URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))`.

**Import**:
- A hidden `<input type="file" accept=".json">` triggered by a button click.
- On file read, parse JSON, validate it's an array of expression objects.
- For each, call `expressionsApi.create(...)` with the expression data.
- Show progress and any errors (e.g., name conflicts).

### 5.4 Copy-Paste Fix/Verification

**File**: `frontend/src/shared/components/expression/ExpressionBuilder.tsx`

The builder already has clipboard state. Verify Ctrl+C / Ctrl+V actually work:
1. Find `COPY_TILES` and `PASTE_TILES` (or equivalent) in the reducer.
2. Verify the paste operation deep-clones tiles with new IDs.
3. Test: select a group tile, Ctrl+C, Ctrl+V — a copy should appear.

If not implemented, add it: on Ctrl+C, store `state.selectedTileIds` tiles in `state.clipboard`. On Ctrl+V, deep-clone clipboard tiles with new UUIDs and insert at cursor or at end.

### 5.5 Forensics Calculated Series Integration

**File**: `frontend/src/pages/forensics/` (read the forensics module to understand current structure)

The forensics module can add calculated time series — series derived from expressions applied to historical point data.

Add a "Batch Evaluate" backend endpoint:

**File**: `services/api-gateway/src/handlers/expressions.rs`

```rust
// POST /api/expressions/:id/evaluate-batch
// Body: { "timestamps": [unix_ms...], "point_values": { "uuid": [values...] } }
// Returns: { "results": [values...] }
pub async fn evaluate_batch_handler(...) { ... }
```

In the frontend forensics module, when the user adds a "Calculated Series", open `ExpressionBuilderModal` in `forensics` context. On apply, call the batch evaluate endpoint with the historical data for the referenced points.

---

## Summary of All Files to Modify/Create

### Phase 1 (Critical — Do First)
| Action | File |
|--------|------|
| MODIFY | `services/auth-service/src/handlers/expressions.rs` |
| MODIFY | `services/auth-service/src/expression_eval.rs` |
| MODIFY | `services/api-gateway/src/handlers/expressions.rs` |
| MODIFY | `frontend/src/pages/settings/ExpressionLibrary.tsx` |
| MODIFY | `frontend/src/api/expressions.ts` |

### Phase 2 (UX Polish)
| Action | File |
|--------|------|
| CREATE | `frontend/src/shared/components/expression/PointSearchPopover.tsx` |
| MODIFY | `frontend/src/shared/components/expression/ExpressionBuilder.tsx` |

### Phase 3 (Missing Endpoints + Integrations)
| Action | File |
|--------|------|
| MODIFY | `services/auth-service/src/handlers/expressions.rs` |
| MODIFY | `services/auth-service/src/main.rs` |
| MODIFY | `services/api-gateway/src/main.rs` |
| MODIFY | `frontend/src/api/expressions.ts` |
| MODIFY | `frontend/src/pages/settings/EventConfig.tsx` (or alarm definition file) |
| MODIFY | `frontend/src/pages/settings/PointManagement.tsx` |
| MODIFY | `frontend/src/pages/settings/ExpressionLibrary.tsx` |

### Phase 4 (Real-time Pipeline — Most Complex)
| Action | File |
|--------|------|
| CREATE | `services/data-broker/src/expression_registry.rs` |
| MODIFY | `services/data-broker/src/main.rs` |
| MODIFY | `services/data-broker/Cargo.toml` |
| MODIFY | `services/auth-service/src/handlers/expressions.rs` |
| MODIFY | `frontend/src/shared/graphics/SceneRenderer.tsx` |

### Phase 5 (Advanced Features)
| Action | File |
|--------|------|
| CREATE | `frontend/src/shared/components/expression/templates.ts` |
| MODIFY | `frontend/src/shared/components/expression/ExpressionBuilder.tsx` |
| MODIFY | `frontend/src/pages/settings/ExpressionLibrary.tsx` |
| MODIFY | `frontend/src/api/expressions.ts` |
| MODIFY | `services/api-gateway/src/handlers/expressions.rs` |
| MODIFY | `services/api-gateway/src/main.rs` |

---

## Phase Prompts for Sonnet

See the section below for copy-paste prompts to use when starting each phase.

---
