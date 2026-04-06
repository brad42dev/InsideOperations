//! Expression evaluation handlers.
//!
//! Implements server-side Rhai expression evaluation for:
//!   - `/api/expressions/evaluate`        — ad-hoc AST evaluation
//!   - `/api/expressions/:id/evaluate`    — evaluate a saved expression by ID
//!
//! The AST JSON is converted to a Rhai expression string and evaluated in
//! expression-only mode via `Engine::eval_expression_with_scope`.
//!
//! Spec: design-docs/23_EXPRESSION_BUILDER.md §13.2 and §16.

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use io_auth::Claims;
use io_error::IoError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row as _;
use tracing::warn;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// ExprNode — mirrors the spec §11.3 Rust types for the expression AST
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExprNode {
    /// Numeric or boolean literal: `{ "type": "literal", "value": 42.0 }`
    Literal { value: Value },
    /// Reference to an OPC point by ID.
    /// Frontend sends `{ "type": "point_ref", "ref_type": "current"|"specific", "point_id": "<uuid>|null" }`.
    PointRef {
        /// Null/empty when ref_type is "current".
        #[serde(default)]
        point_id: Option<String>,
        /// "current" or "specific" — determines whether point_id is used.
        #[serde(default)]
        ref_type: Option<String>,
        /// Legacy alias field (kept for backwards compat).
        #[serde(default)]
        alias: Option<String>,
    },
    /// Reference to a field on the enclosing entity (round checkpoint / log segment):
    /// `{ "type": "field_ref", "field_name": "reading" }`
    FieldRef {
        /// Frontend sends "field_name"; keep "field" alias for any legacy data.
        #[serde(alias = "field")]
        field_name: String,
    },
    /// Unary operation: `{ "type": "unary", "op": "negate"|"abs"|..., "operand": {...} }`
    Unary { op: String, operand: Box<ExprNode> },
    /// Binary operation: `{ "type": "binary", "op": "+", "left": {...}, "right": {...} }`
    Binary {
        op: String,
        left: Box<ExprNode>,
        right: Box<ExprNode>,
    },
    /// Named function call: `{ "type": "function", "name": "abs", "args": [...], "params": {...} }`
    Function {
        name: String,
        args: Vec<ExprNode>,
        /// Optional extra parameters (e.g. `{ "precision": 2 }` for "round").
        #[serde(default)]
        params: Option<serde_json::Map<String, Value>>,
    },
    /// Ternary conditional.
    /// Frontend sends `"else_branch"` for the else arm; accept both forms.
    Conditional {
        condition: Box<ExprNode>,
        #[serde(rename = "then")]
        then_branch: Box<ExprNode>,
        #[serde(rename = "else", alias = "else_branch")]
        else_branch: Box<ExprNode>,
    },
    /// Parenthesised group (for display).
    /// Frontend sends `"child"`; accept both "child" and "inner".
    Group {
        #[serde(alias = "child")]
        inner: Box<ExprNode>,
    },
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

/// Request body for ad-hoc expression evaluation.
#[derive(Debug, Deserialize)]
pub struct EvalRequest {
    /// The expression AST to evaluate.
    pub ast: ExprNode,
    /// Point values to inject into the scope, keyed by point_id or alias.
    #[serde(default)]
    pub values: std::collections::HashMap<String, f64>,
}

/// Request body for evaluating a saved expression (by ID).
#[derive(Debug, Deserialize)]
pub struct EvalByIdRequest {
    /// Point values to inject into the scope, keyed by point_id or alias.
    #[serde(default)]
    pub values: std::collections::HashMap<String, f64>,
}

/// Successful evaluation response.
#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct EvalSuccess {
    pub result: f64,
}

/// Error evaluation response.
#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct EvalError {
    pub error: String,
}

// ---------------------------------------------------------------------------
// AST → Rhai expression string conversion
// ---------------------------------------------------------------------------

/// Recursively convert an `ExprNode` tree into a Rhai expression string.
///
/// The output is a single expression (not a full script), suitable for use
/// with `Engine::eval_expression_with_scope`.
pub fn ast_to_rhai_string(node: &ExprNode) -> String {
    match node {
        ExprNode::Literal { value } => match value {
            Value::Number(n) => {
                if let Some(f) = n.as_f64() {
                    // Emit as float literal so Rhai treats it as f64.
                    format!("{f:.16e}")
                } else {
                    "0.0".to_string()
                }
            }
            Value::Bool(b) => b.to_string(),
            Value::String(s) => format!("{s:?}"), // Rust Debug gives a quoted, escaped string
            _ => "0.0".to_string(),
        },

        ExprNode::PointRef {
            point_id,
            ref_type,
            alias,
        } => {
            // "current" ref_type means the enclosing entity's own point value.
            let is_current = ref_type.as_deref() == Some("current")
                || point_id.as_deref().map(|s| s.is_empty()).unwrap_or(true);
            if is_current {
                return "current_point".to_string();
            }
            // Use explicit alias if provided, otherwise sanitise the point_id.
            let raw = alias
                .as_deref()
                .or(point_id.as_deref())
                .unwrap_or("current_point");
            sanitize_identifier(raw)
        }

        ExprNode::FieldRef { field_name } => sanitize_identifier(field_name),

        ExprNode::Unary { op, operand } => {
            let inner = ast_to_rhai_string(operand);
            match op.as_str() {
                "-" => format!("(-({inner}))"),
                "!" | "not" => format!("(!({inner}))"),
                _ => {
                    warn!(op = %op, "Unknown unary operator; defaulting to identity");
                    inner
                }
            }
        }

        ExprNode::Binary { op, left, right } => {
            let l = ast_to_rhai_string(left);
            let r = ast_to_rhai_string(right);
            // Map friendly names to Rhai operators where needed.
            let rhai_op = match op.as_str() {
                "and" => "&&",
                "or" => "||",
                "mod" => "%",
                other => other,
            };
            format!("(({l}) {rhai_op} ({r}))")
        }

        ExprNode::Function { name, args, params } => {
            // Special-case: round(x, precision) uses params.precision
            if name == "round" {
                let precision = params
                    .as_ref()
                    .and_then(|p| p.get("precision"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let arg = args
                    .first()
                    .map(ast_to_rhai_string)
                    .unwrap_or_else(|| "0.0".to_string());
                if precision <= 0 {
                    return format!("({arg} as f64).round()");
                }
                let factor = 10_f64.powi(precision as i32);
                return format!("(({arg}) * {factor:.1}).round() / {factor:.1}");
            }
            let args_str: Vec<String> = args.iter().map(ast_to_rhai_string).collect();
            format!("{}({})", sanitize_identifier(name), args_str.join(", "))
        }

        ExprNode::Conditional {
            condition,
            then_branch,
            else_branch,
        } => {
            // Rhai has no ternary operator; use `if` expression syntax.
            let cond = ast_to_rhai_string(condition);
            let then = ast_to_rhai_string(then_branch);
            let els = ast_to_rhai_string(else_branch);
            format!("if ({cond}) {{ {then} }} else {{ {els} }}")
        }

        ExprNode::Group { inner } => {
            format!("({})", ast_to_rhai_string(inner))
        }
    }
}

/// Sanitise a string so it is a valid Rhai variable/function identifier.
///
/// Replaces any character that is not alphanumeric or `_` with `_`.
/// Prepends `_` if the first character is a digit.
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

// ---------------------------------------------------------------------------
// Evaluation helper
// ---------------------------------------------------------------------------

/// Evaluate a Rhai expression string with the provided variable bindings.
///
/// Returns the numeric result (`f64`) or an error string if evaluation fails.
fn evaluate_expression(
    expr: &str,
    values: &std::collections::HashMap<String, f64>,
) -> Result<f64, String> {
    use rhai::{Engine, Scope};

    let mut engine = Engine::new();
    // Limit operations to prevent run-away expressions (spec §13.2).
    engine.set_max_operations(100_000);

    let mut scope = Scope::new();
    for (key, &val) in values {
        let var_name = sanitize_identifier(key);
        scope.push(var_name, val);
    }

    engine
        .eval_expression_with_scope::<f64>(&mut scope, expr)
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/expressions/evaluate`
///
/// Evaluate an ad-hoc expression AST with caller-supplied point values.
pub async fn evaluate_expression_handler(
    _claims: axum::Extension<Claims>,
    Json(body): Json<EvalRequest>,
) -> impl IntoResponse {
    let expr_str = ast_to_rhai_string(&body.ast);
    match evaluate_expression(&expr_str, &body.values) {
        Ok(result) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "result": result })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
    }
}

/// `POST /api/expressions/:id/evaluate`
///
/// Load a saved expression from the database and evaluate it with
/// caller-supplied point values.
pub async fn evaluate_saved_expression_handler(
    State(state): State<AppState>,
    _claims: axum::Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EvalByIdRequest>,
) -> impl IntoResponse {
    // Fetch the saved expression record.
    let row = sqlx::query("SELECT expression FROM custom_expressions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("expression {id}")).into_response();
        }
        Err(e) => {
            return IoError::Database(e).into_response();
        }
    };

    // Parse the stored AST JSON.
    let ast_value: serde_json::Value = match row.try_get("expression") {
        Ok(v) => v,
        Err(e) => {
            return IoError::Internal(format!("failed to read expression column: {e}"))
                .into_response();
        }
    };

    let ast: ExprNode = match serde_json::from_value(ast_value) {
        Ok(a) => a,
        Err(e) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("AST parse error: {e}") })),
            )
                .into_response()
        }
    };

    let expr_str = ast_to_rhai_string(&ast);
    match evaluate_expression(&expr_str, &body.values) {
        Ok(result) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "result": result })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": e })),
        )
            .into_response(),
    }
}

// ---------------------------------------------------------------------------
// Batch evaluation handler
// ---------------------------------------------------------------------------

/// Request body for batch evaluation of a saved expression over a time series.
#[derive(Debug, Deserialize)]
pub struct EvalBatchRequest {
    /// Unix millisecond timestamps (one per sample).
    pub timestamps: Vec<i64>,
    /// Point values keyed by point UUID. Each entry must have the same length
    /// as `timestamps`.
    pub point_values: std::collections::HashMap<String, Vec<f64>>,
}

/// `POST /api/expressions/:id/evaluate-batch`
///
/// Evaluate a saved expression over a historical time series.
/// The caller supplies parallel arrays of timestamps and per-point values;
/// the expression is evaluated independently for each sample index.
pub async fn evaluate_batch_handler(
    State(state): State<AppState>,
    _claims: axum::Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EvalBatchRequest>,
) -> impl IntoResponse {
    // Validate that all value arrays have the same length as timestamps.
    let n = body.timestamps.len();
    for (key, vals) in &body.point_values {
        if vals.len() != n {
            return (
                axum::http::StatusCode::UNPROCESSABLE_ENTITY,
                Json(serde_json::json!({
                    "error": format!(
                        "point_values[{key}] has {} entries but timestamps has {n}",
                        vals.len()
                    )
                })),
            )
                .into_response();
        }
    }

    // Fetch the saved expression AST from the database.
    let row = sqlx::query("SELECT expression FROM custom_expressions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("expression {id}")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let ast_value: serde_json::Value = match row.try_get("expression") {
        Ok(v) => v,
        Err(e) => {
            return IoError::Internal(format!("failed to read expression column: {e}"))
                .into_response()
        }
    };

    let ast: ExprNode = match serde_json::from_value(ast_value) {
        Ok(a) => a,
        Err(e) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("AST parse error: {e}") })),
            )
                .into_response()
        }
    };

    let expr_str = ast_to_rhai_string(&ast);

    // Evaluate expression for each sample index.
    let results: Vec<Option<f64>> = (0..n)
        .map(|i| {
            let mut values: std::collections::HashMap<String, f64> =
                std::collections::HashMap::new();
            for (key, vals) in &body.point_values {
                values.insert(key.clone(), vals[i]);
            }
            evaluate_expression(&expr_str, &values).ok()
        })
        .collect();

    (
        axum::http::StatusCode::OK,
        Json(serde_json::json!({ "results": results })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn lit(v: f64) -> ExprNode {
        ExprNode::Literal { value: json!(v) }
    }

    #[test]
    fn literal_f64() {
        let s = ast_to_rhai_string(&lit(1.5));
        // Should produce a float literal string
        assert!(s.contains("1.5") || s.contains("1.50"));
    }

    #[test]
    fn literal_bool() {
        let node = ExprNode::Literal { value: json!(true) };
        assert_eq!(ast_to_rhai_string(&node), "true");
    }

    #[test]
    fn point_ref_alias() {
        let node = ExprNode::PointRef {
            point_id: Some("tag.PV".to_string()),
            ref_type: Some("specific".to_string()),
            alias: Some("pv".to_string()),
        };
        assert_eq!(ast_to_rhai_string(&node), "pv");
    }

    #[test]
    fn point_ref_no_alias_sanitises() {
        let node = ExprNode::PointRef {
            point_id: Some("ns=2;s=Tank.Level".to_string()),
            ref_type: Some("specific".to_string()),
            alias: None,
        };
        // Semicolons and dots should be replaced with underscores
        let result = ast_to_rhai_string(&node);
        assert!(!result.contains(';'));
        assert!(!result.contains('.'));
    }

    #[test]
    fn binary_addition() {
        let node = ExprNode::Binary {
            op: "+".to_string(),
            left: Box::new(lit(1.0)),
            right: Box::new(lit(2.0)),
        };
        let s = ast_to_rhai_string(&node);
        assert!(s.contains('+'));
    }

    #[test]
    fn unary_negation() {
        let node = ExprNode::Unary {
            op: "-".to_string(),
            operand: Box::new(lit(5.0)),
        };
        let s = ast_to_rhai_string(&node);
        assert!(s.contains('-'));
    }

    #[test]
    fn function_call() {
        let node = ExprNode::Function {
            name: "abs".to_string(),
            args: vec![lit(-1.0)],
            params: None,
        };
        let s = ast_to_rhai_string(&node);
        assert!(s.starts_with("abs("));
    }

    #[test]
    fn evaluate_simple_addition() {
        let values = std::collections::HashMap::new();
        let result = evaluate_expression("1.0 + 2.0", &values);
        assert_eq!(result.unwrap(), 3.0);
    }

    #[test]
    fn evaluate_with_scope_variable() {
        let mut values = std::collections::HashMap::new();
        values.insert("x".to_string(), 10.0);
        let result = evaluate_expression("x * 2.0", &values);
        assert_eq!(result.unwrap(), 20.0);
    }

    #[test]
    fn evaluate_division_by_zero_returns_infinity() {
        let values = std::collections::HashMap::new();
        // Rhai f64 division returns infinity rather than an error
        let result = evaluate_expression("1.0 / 0.0", &values);
        assert!(result.is_ok());
        assert!(result.unwrap().is_infinite());
    }

    #[test]
    fn evaluate_syntax_error_returns_err() {
        let values = std::collections::HashMap::new();
        let result = evaluate_expression("(((broken", &values);
        assert!(result.is_err());
    }

    #[test]
    fn conditional_expression() {
        let node = ExprNode::Conditional {
            condition: Box::new(ExprNode::Literal { value: json!(true) }),
            then_branch: Box::new(lit(1.0)),
            else_branch: Box::new(lit(2.0)),
        };
        let s = ast_to_rhai_string(&node);
        assert!(s.contains("if"));
        assert!(s.contains("else"));
    }

    #[test]
    fn sanitize_identifier_replaces_special_chars() {
        assert_eq!(sanitize_identifier("a.b.c"), "a_b_c");
        assert_eq!(sanitize_identifier("ns=2;s=X"), "ns_2_s_X");
        assert_eq!(sanitize_identifier("123abc"), "_123abc");
    }
}
