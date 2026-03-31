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
pub fn evaluate_expression(
    ast: &Value,
    point_values: &HashMap<String, f64>,
) -> Result<f64, String> {
    let tiles = ast
        .get("tiles")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Expression AST missing 'tiles' array".to_string())?;

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
