use crate::{
    cache::ShadowCache, expression_eval, fanout::PendingMap, registry::SubscriptionRegistry,
};
use chrono::Utc;
use dashmap::DashMap;
use io_bus::WsPointValue;
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use uuid::Uuid;

/// Minimum interval between re-evaluations of the same expression.
/// Prevents high-frequency points from hammering the Rhai engine.
const EVAL_THROTTLE: Duration = Duration::from_millis(100);

/// In-memory registry of expressions that reference at least one OPC point.
///
/// Thread-safe via DashMap; designed to be held as `Arc<ExpressionRegistry>`
/// and shared across the UDS and NOTIFY dispatch paths.
pub struct ExpressionRegistry {
    /// expression_id → (ast_json, referenced_point_ids)
    pub expressions: DashMap<Uuid, (Value, Vec<Uuid>)>,
    /// point_id → list of expression_ids that reference this point
    pub point_to_exprs: DashMap<Uuid, Vec<Uuid>>,
    /// Per-expression last evaluation timestamp (for 100ms throttle).
    last_evaluated_at: DashMap<Uuid, Instant>,
}

impl ExpressionRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            expressions: DashMap::new(),
            point_to_exprs: DashMap::new(),
            last_evaluated_at: DashMap::new(),
        })
    }

    /// Load or replace an expression in the registry.
    ///
    /// If an expression with this `id` already exists, it is replaced — the old
    /// reverse-index entries are cleaned up before inserting the new ones.
    pub fn load_expression(&self, id: Uuid, ast: Value, point_ids: Vec<Uuid>) {
        // Remove stale reverse-index entries for this id if it was previously loaded.
        self.remove_expression(&id);

        for pid in &point_ids {
            self.point_to_exprs.entry(*pid).or_default().push(id);
        }
        self.expressions.insert(id, (ast, point_ids));
    }

    /// Remove an expression from the registry.
    pub fn remove_expression(&self, id: &Uuid) {
        if let Some((_, (_, point_ids))) = self.expressions.remove(id) {
            for pid in &point_ids {
                if let Some(mut exprs) = self.point_to_exprs.get_mut(pid) {
                    exprs.retain(|e| e != id);
                }
            }
        }
        self.last_evaluated_at.remove(id);
    }

    /// Return the expression IDs that reference `point_id`.
    pub fn expressions_for_point(&self, point_id: &Uuid) -> Vec<Uuid> {
        self.point_to_exprs
            .get(point_id)
            .map(|v| v.clone())
            .unwrap_or_default()
    }

    /// Evaluate all expressions affected by a point update, store results in the
    /// shadow cache, and fan the results out to subscribed WebSocket clients.
    ///
    /// Skips expressions whose last evaluation was less than 100ms ago.
    pub fn eval_affected_for_update(
        &self,
        point_id: &Uuid,
        cache: &ShadowCache,
        sub_registry: &SubscriptionRegistry,
        pending: &PendingMap,
    ) {
        let affected = self.expressions_for_point(point_id);
        if affected.is_empty() {
            return;
        }

        let now = Instant::now();
        let ts = Utc::now();

        for expr_id in affected {
            // Throttle: skip if evaluated less than 100ms ago.
            {
                let last = self.last_evaluated_at.get(&expr_id);
                if let Some(last) = last {
                    if now.duration_since(*last) < EVAL_THROTTLE {
                        continue;
                    }
                }
            }

            let entry = match self.expressions.get(&expr_id) {
                Some(e) => e,
                None => continue,
            };
            let (ast, ref_ids) = entry.value();

            // Gather current values from shadow cache.
            let mut point_values: HashMap<String, f64> = HashMap::new();
            for pid in ref_ids {
                if let Some(cv) = cache.get(pid) {
                    point_values.insert(pid.to_string(), cv.value);
                }
            }

            // Evaluate.
            match expression_eval::evaluate_expression(ast, &point_values) {
                Ok(result) => {
                    // Update throttle timestamp.
                    self.last_evaluated_at.insert(expr_id, now);

                    // Store result in shadow cache under the expression UUID.
                    cache.update(expr_id, result, "good".to_string(), ts, None);

                    // Fan out to subscribed clients.
                    let client_ids = sub_registry.get_clients_for_point(&expr_id);
                    if client_ids.is_empty() {
                        continue;
                    }
                    let pv = WsPointValue {
                        id: expr_id,
                        v: result,
                        q: "good".to_string(),
                        t: ts.timestamp_millis(),
                    };
                    for client_id in client_ids {
                        pending.entry(client_id).or_default().push(pv.clone());
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        expr_id = %expr_id,
                        error = %e,
                        "Expression evaluation error"
                    );
                }
            }
        }
    }
}
