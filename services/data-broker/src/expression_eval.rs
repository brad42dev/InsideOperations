// TODO: migrate to a shared io-expression crate (Option B) so auth-service and
// data-broker don't maintain separate copies of this evaluator. For now (Phase 4)
// we duplicate to keep scope bounded.

/// Server-side Rhai expression evaluator.
///
/// Converts an ExpressionAst JSON (from the `custom_expressions.expression`
/// JSONB column) into a Rhai script string, then evaluates it in a sandboxed
/// engine with a max-operations guard.
///
/// # AST tile format (design doc 23)
///
/// The top-level object has a `tiles` array. Each tile has a `type` field:
///
/// | type         | relevant fields                               |
/// |--------------|-----------------------------------------------|
/// | point_ref    | `pointId` (UUID string or null → "current_point") |
/// | constant     | `value` (number)                              |
/// | add / subtract / multiply / divide / modulus / power | binary infix op (no extra fields) |
/// | negate       | unary prefix; applies to next operand         |
/// | abs          | unary abs(); applies to next operand          |
/// | group        | `children` array — sub-expression tiles       |
/// | square       | operand² — operand comes from `children`      |
/// | cube         | operand³ — operand comes from `children`      |
/// | round        | round() — operand comes from `children`       |
/// | if_then_else | `condition`, `then_tiles`, `else_tiles` arrays|
///
/// Binary operators are expressed as three consecutive sibling tiles:
///   [left_operand] [operator] [right_operand]
/// Grouping / precedence is achieved via group/container tiles.
use rhai::{Engine, Scope};
use serde_json::Value;
use std::collections::HashMap;

// Maximum Rhai operations — prevents runaway scripts.
const MAX_OPS: u64 = 100_000;

/// Evaluate an expression AST with given point values.
///
/// `point_values` maps point_id strings (or the special key `"current_point"`)
/// to f64 values. Returns the numeric result or a descriptive error string.
///
/// Supports two AST formats:
/// - **Tree format** (current frontend): `{ "version": 1, "context": "...", "root": {...}, "output": {...} }`
/// - **Flat tiles format** (legacy): `{ "tiles": [...] }`
pub fn evaluate_expression(
    ast: &Value,
    point_values: &HashMap<String, f64>,
) -> Result<f64, String> {
    if let Some(root) = ast.get("root") {
        // New ExprNode tree format from the frontend
        let script = expr_node_to_rhai(root, point_values)?;
        if script.trim().is_empty() {
            return Err("Expression produces no value".to_string());
        }
        let engine = make_engine();
        let mut scope = Scope::new();
        for (key, &val) in point_values {
            let var_name = sanitize_identifier(key);
            scope.push(var_name, val);
        }
        let result: rhai::Dynamic = engine
            .eval_with_scope::<rhai::Dynamic>(&mut scope, &script)
            .map_err(|e| format!("Rhai evaluation error: {e}"))?;
        if let Ok(v) = result.as_float() {
            return Ok(v);
        }
        if let Ok(v) = result.as_int() {
            return Ok(v as f64);
        }
        return Err(format!(
            "Expression result is not numeric: {}",
            result.type_name()
        ));
    }

    // Legacy flat tiles format
    let tiles = ast
        .get("tiles")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Expression AST missing 'root' or 'tiles' key".to_string())?;

    let script = tiles_to_rhai(tiles, point_values)?;
    if script.trim().is_empty() {
        return Err("Expression produces no value".to_string());
    }

    let engine = make_engine();
    let mut scope = Scope::new();
    let result: rhai::Dynamic = engine
        .eval_with_scope::<rhai::Dynamic>(&mut scope, &script)
        .map_err(|e| format!("Rhai evaluation error: {e}"))?;

    if let Ok(v) = result.as_float() {
        return Ok(v);
    }
    if let Ok(v) = result.as_int() {
        return Ok(v as f64);
    }
    Err(format!(
        "Expression result is not numeric: {}",
        result.type_name()
    ))
}

// ---------------------------------------------------------------------------
// ExprNode tree → Rhai conversion (current frontend format)
// ---------------------------------------------------------------------------

/// Sanitise a string into a valid Rhai variable/function identifier.
fn sanitize_identifier(s: &str) -> String {
    let mut out: String = s
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if out.starts_with(|c: char| c.is_ascii_digit()) {
        out.insert(0, '_');
    }
    if out.is_empty() {
        out = "_".to_string();
    }
    out
}

/// Recursively convert an ExprNode JSON object to a Rhai expression string.
///
/// ExprNode types (from frontend `shared/types/expression.ts`):
/// - `literal`     — `{ type, value }`
/// - `point_ref`   — `{ type, ref_type, point_id, tagname }`
/// - `field_ref`   — `{ type, field_name }`
/// - `unary`       — `{ type, op, operand }`
/// - `binary`      — `{ type, op, left, right }`
/// - `function`    — `{ type, name, args, params }`
/// - `conditional` — `{ type, condition, then, else_branch }`
/// - `group`       — `{ type, child }`
pub(crate) fn expr_node_to_rhai(
    node: &Value,
    point_values: &HashMap<String, f64>,
) -> Result<String, String> {
    let node_type = node
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "ExprNode missing 'type' field".to_string())?;

    match node_type {
        "literal" => {
            let v = node.get("value").unwrap_or(&Value::Null);
            match v {
                Value::Number(n) => {
                    if let Some(f) = n.as_f64() {
                        Ok(format_f64(f))
                    } else {
                        Ok("0.0".to_string())
                    }
                }
                Value::Bool(b) => Ok(b.to_string()),
                _ => Ok("0.0".to_string()),
            }
        }

        "point_ref" => {
            let ref_type = node.get("ref_type").and_then(|v| v.as_str()).unwrap_or("");
            let point_id = node.get("point_id").and_then(|v| v.as_str()).unwrap_or("");
            let lookup_key = if ref_type == "current" || point_id.is_empty() {
                "current_point"
            } else {
                point_id
            };
            let val = point_values.get(lookup_key).copied().unwrap_or(f64::NAN);
            Ok(format_f64(val))
        }

        "field_ref" => {
            let field = node
                .get("field_name")
                .and_then(|v| v.as_str())
                .unwrap_or("field");
            Ok(sanitize_identifier(field))
        }

        "unary" => {
            let op = node.get("op").and_then(|v| v.as_str()).unwrap_or("negate");
            let operand = node
                .get("operand")
                .ok_or_else(|| "unary node missing 'operand'".to_string())?;
            let inner = expr_node_to_rhai(operand, point_values)?;
            match op {
                "negate" | "-" => Ok(format!("(-({inner}))")),
                "abs" => Ok(format!("({inner} as f64).abs()")),
                "square" => Ok(format!("(({inner}) * ({inner}))")),
                "cube" => Ok(format!("(({inner}) * ({inner}) * ({inner}))")),
                "not" | "!" => Ok(format!("(!({inner}))")),
                other => Err(format!("Unknown unary op: '{other}'")),
            }
        }

        "binary" => {
            let op = node.get("op").and_then(|v| v.as_str()).unwrap_or("+");
            let left = node
                .get("left")
                .ok_or_else(|| "binary node missing 'left'".to_string())?;
            let right = node
                .get("right")
                .ok_or_else(|| "binary node missing 'right'".to_string())?;
            let l = expr_node_to_rhai(left, point_values)?;
            let r = expr_node_to_rhai(right, point_values)?;
            let rhai_op = match op {
                "and" => "&&",
                "or" => "||",
                other => other,
            };
            Ok(format!("(({l}) {rhai_op} ({r}))"))
        }

        "function" => {
            let name = node
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let args = node
                .get("args")
                .and_then(|v| v.as_array())
                .map(|a| a.as_slice())
                .unwrap_or(&[]);
            let params = node.get("params");

            // Special-case: round(x, precision)
            if name == "round" {
                let precision = params
                    .and_then(|p| p.get("precision"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let arg = args
                    .first()
                    .map(|a| expr_node_to_rhai(a, point_values))
                    .unwrap_or(Ok("0.0".to_string()))?;
                if precision <= 0 {
                    return Ok(format!("({arg} as f64).round()"));
                }
                let factor = 10_f64.powi(precision as i32);
                return Ok(format!("(({arg}) * {factor:.1}).round() / {factor:.1}"));
            }

            let mut arg_strs = Vec::with_capacity(args.len());
            for a in args {
                arg_strs.push(expr_node_to_rhai(a, point_values)?);
            }
            Ok(format!(
                "{}({})",
                sanitize_identifier(name),
                arg_strs.join(", ")
            ))
        }

        "conditional" => {
            let cond = node
                .get("condition")
                .ok_or_else(|| "conditional missing 'condition'".to_string())?;
            let then = node
                .get("then")
                .ok_or_else(|| "conditional missing 'then'".to_string())?;
            // Frontend field is "else_branch"
            let els = node
                .get("else_branch")
                .or_else(|| node.get("else"))
                .ok_or_else(|| "conditional missing 'else_branch'".to_string())?;
            let c = expr_node_to_rhai(cond, point_values)?;
            let t = expr_node_to_rhai(then, point_values)?;
            let e = expr_node_to_rhai(els, point_values)?;
            Ok(format!("if ({c}) {{ {t} }} else {{ {e} }}"))
        }

        "group" => {
            // Frontend field is "child"
            let child = node
                .get("child")
                .or_else(|| node.get("inner"))
                .ok_or_else(|| "group node missing 'child'".to_string())?;
            let inner = expr_node_to_rhai(child, point_values)?;
            Ok(format!("({inner})"))
        }

        other => Err(format!("Unknown ExprNode type: '{other}'")),
    }
}

// ---------------------------------------------------------------------------
// Engine builder
// ---------------------------------------------------------------------------

fn make_engine() -> Engine {
    let mut engine = Engine::new();
    engine.set_max_operations(MAX_OPS);
    // No file access, no external modules.
    engine
}

// ---------------------------------------------------------------------------
// Tile → Rhai conversion
// ---------------------------------------------------------------------------

/// Convert a slice of sibling tiles into a Rhai expression string.
/// Binary operators are handled left-to-right: `[a] [+] [b]` → `(a + b)`.
pub(crate) fn tiles_to_rhai(
    tiles: &[Value],
    point_values: &HashMap<String, f64>,
) -> Result<String, String> {
    if tiles.is_empty() {
        return Ok("0.0".to_string());
    }

    // State machine: accumulate into a running expression, applying operators
    // as we encounter them.
    let mut result = String::new();
    let mut pending_op: Option<&str> = None;

    let mut i = 0usize;
    while i < tiles.len() {
        let tile = &tiles[i];
        let tile_type = tile
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match tile_type {
            // ── Operands ────────────────────────────────────────────────────
            "point_ref" => {
                let point_id = tile
                    .get("pointId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("current_point");
                let lookup_key = if point_id.is_empty() {
                    "current_point"
                } else {
                    point_id
                };
                let val = point_values.get(lookup_key).copied().unwrap_or(f64::NAN);
                let operand = format_f64(val);
                result = apply_op(result, pending_op.take(), &operand);
            }

            "constant" => {
                let val = tile.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let operand = format_f64(val);
                result = apply_op(result, pending_op.take(), &operand);
            }

            // ── Binary operators ─────────────────────────────────────────────
            "add" => pending_op = Some("+"),
            "subtract" => pending_op = Some("-"),
            "multiply" => pending_op = Some("*"),
            "divide" => pending_op = Some("/"),
            "modulus" => pending_op = Some("%"),
            "power" => {
                // Rhai uses ^ for power
                pending_op = Some("^");
            }

            // ── Unary negate ─────────────────────────────────────────────────
            "negate" => {
                // Next tile is the operand to negate
                if let Some(next) = tiles.get(i + 1) {
                    let inner = single_tile_to_rhai(next, point_values)?;
                    let operand = format!("(-({inner}))");
                    result = apply_op(result, pending_op.take(), &operand);
                    i += 2;
                    continue;
                }
            }

            // ── Unary abs ────────────────────────────────────────────────────
            "abs" => {
                // Next tile is the operand
                if let Some(next) = tiles.get(i + 1) {
                    let inner = single_tile_to_rhai(next, point_values)?;
                    let operand = format!("abs({inner} as f64)");
                    result = apply_op(result, pending_op.take(), &operand);
                    i += 2;
                    continue;
                }
            }

            // ── Container tiles with `children` ──────────────────────────────
            "group" => {
                let children = tile
                    .get("children")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);
                let inner = tiles_to_rhai(children, point_values)?;
                let operand = format!("({inner})");
                result = apply_op(result, pending_op.take(), &operand);
            }

            "square" => {
                let children = tile
                    .get("children")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);
                let inner = tiles_to_rhai(children, point_values)?;
                let operand = format!("(({inner}) * ({inner}))");
                result = apply_op(result, pending_op.take(), &operand);
            }

            "cube" => {
                let children = tile
                    .get("children")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);
                let inner = tiles_to_rhai(children, point_values)?;
                let operand = format!("(({inner}) * ({inner}) * ({inner}))");
                result = apply_op(result, pending_op.take(), &operand);
            }

            "round" => {
                let children = tile
                    .get("children")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);
                let inner = tiles_to_rhai(children, point_values)?;
                let operand = format!("({inner} as f64).round()");
                result = apply_op(result, pending_op.take(), &operand);
            }

            // ── If-then-else ─────────────────────────────────────────────────
            "if_then_else" => {
                let condition_tiles = tile
                    .get("condition")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);
                let then_tiles = tile
                    .get("then_tiles")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);
                let else_tiles = tile
                    .get("else_tiles")
                    .and_then(|v| v.as_array())
                    .map(|a| a.as_slice())
                    .unwrap_or(&[]);

                let cond = tiles_to_rhai(condition_tiles, point_values)?;
                let then_expr = tiles_to_rhai(then_tiles, point_values)?;
                let else_expr = tiles_to_rhai(else_tiles, point_values)?;

                // Build a Rhai if-expression
                let operand =
                    format!("if ({cond}) != 0.0 {{ {then_expr} }} else {{ {else_expr} }}");
                result = apply_op(result, pending_op.take(), &operand);
            }

            other => {
                return Err(format!("Unknown tile type: '{other}'"));
            }
        }

        i += 1;
    }

    if result.is_empty() {
        Ok("0.0".to_string())
    } else {
        Ok(result)
    }
}

// ---------------------------------------------------------------------------
// Helper: convert a single tile to Rhai (used for unary operands)
// ---------------------------------------------------------------------------

fn single_tile_to_rhai(
    tile: &Value,
    point_values: &HashMap<String, f64>,
) -> Result<String, String> {
    tiles_to_rhai(std::slice::from_ref(tile), point_values)
}

// ---------------------------------------------------------------------------
// Helper: apply pending binary operator
// ---------------------------------------------------------------------------

fn apply_op(lhs: String, op: Option<&str>, rhs: &str) -> String {
    if lhs.is_empty() {
        rhs.to_string()
    } else if let Some(op) = op {
        format!("({lhs} {op} {rhs})")
    } else {
        // Two operands with no operator — treat as multiplication
        // (shouldn't happen in well-formed expressions; produce something safe)
        format!("({lhs} * {rhs})")
    }
}

// ---------------------------------------------------------------------------
// Helper: format f64 as a Rhai-safe literal
// ---------------------------------------------------------------------------

fn format_f64(v: f64) -> String {
    if v.is_nan() {
        "0.0".to_string()
    } else if v.is_infinite() {
        if v.is_sign_positive() {
            "1e308_f64".to_string()
        } else {
            "-1e308_f64".to_string()
        }
    } else if v.fract() == 0.0 && v.abs() < 1e15 {
        format!("{v:.1}")
    } else {
        format!("{v}")
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn pts(pairs: &[(&str, f64)]) -> HashMap<String, f64> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    #[test]
    fn test_constant() {
        let ast = json!({ "tiles": [{ "type": "constant", "value": 42.0 }] });
        let result = evaluate_expression(&ast, &pts(&[])).unwrap();
        assert!((result - 42.0).abs() < 1e-9);
    }

    #[test]
    fn test_add_two_constants() {
        let ast = json!({
            "tiles": [
                { "type": "constant", "value": 3.0 },
                { "type": "add" },
                { "type": "constant", "value": 4.0 }
            ]
        });
        let result = evaluate_expression(&ast, &pts(&[])).unwrap();
        assert!((result - 7.0).abs() < 1e-9);
    }

    #[test]
    fn test_point_ref() {
        let ast = json!({
            "tiles": [
                { "type": "point_ref", "pointId": "abc" },
                { "type": "multiply" },
                { "type": "constant", "value": 2.0 }
            ]
        });
        let result = evaluate_expression(&ast, &pts(&[("abc", 10.0)])).unwrap();
        assert!((result - 20.0).abs() < 1e-9);
    }

    #[test]
    fn test_group() {
        let ast = json!({
            "tiles": [
                {
                    "type": "group",
                    "children": [
                        { "type": "constant", "value": 2.0 },
                        { "type": "add" },
                        { "type": "constant", "value": 3.0 }
                    ]
                },
                { "type": "multiply" },
                { "type": "constant", "value": 4.0 }
            ]
        });
        let result = evaluate_expression(&ast, &pts(&[])).unwrap();
        assert!((result - 20.0).abs() < 1e-9);
    }
}
