/// ISA-18.2 Alarm State Machine
///
/// Implements the standard alarm lifecycle states and valid transitions
/// as defined in ANSI/ISA-18.2-2016.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// State enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlarmState {
    /// Value within normal range — no alarm condition.
    Normal,
    /// Alarm condition active; operator has NOT yet acknowledged.
    Unacknowledged,
    /// Alarm condition still active; operator HAS acknowledged.
    Acknowledged,
    /// Condition has cleared but operator has not yet acknowledged the RTN.
    ReturnToNormal,
    /// Temporarily suppressed by operator for a defined period.
    Shelved,
    /// Suppressed by design (e.g. maintenance mode).
    Suppressed,
    /// Alarm definition administratively disabled.
    Disabled,
}

impl std::fmt::Display for AlarmState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            AlarmState::Normal => "normal",
            AlarmState::Unacknowledged => "unacknowledged",
            AlarmState::Acknowledged => "acknowledged",
            AlarmState::ReturnToNormal => "return_to_normal",
            AlarmState::Shelved => "shelved",
            AlarmState::Suppressed => "suppressed",
            AlarmState::Disabled => "disabled",
        };
        write!(f, "{s}")
    }
}

// ---------------------------------------------------------------------------
// Event enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum AlarmEvent {
    /// Tag value crossed the alarm threshold.
    ConditionActive { value: f64 },
    /// Tag value returned inside normal range (with deadband applied).
    ConditionCleared,
    /// Operator pressed "Acknowledge".
    OperatorAcknowledge { user_id: Uuid },
    /// Operator shelved the alarm for a fixed period.
    OperatorShelve { until: DateTime<Utc> },
    /// Operator manually un-shelved before expiry.
    OperatorUnshelve,
    /// Shelve timer expired.
    ShelveExpired,
    /// Admin disabled the alarm definition.
    Disable,
    /// Admin re-enabled the alarm definition.
    Enable,
}

// ---------------------------------------------------------------------------
// Alarm instance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlarmInstance {
    pub id: Uuid,
    pub definition_id: Uuid,
    pub point_id: Uuid,
    pub state: AlarmState,
    /// The tag value at the moment the alarm was first activated.
    pub value_at_activation: f64,
    pub activated_at: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub cleared_at: Option<DateTime<Utc>>,
    /// Set when shelved; cleared when state leaves Shelved.
    pub shelved_until: Option<DateTime<Utc>>,
    /// ISA-18.2 numeric priority (1 = most urgent).
    pub priority: i32,
    pub message: String,
}

impl AlarmInstance {
    pub fn new(
        definition_id: Uuid,
        point_id: Uuid,
        priority: i32,
        message: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            definition_id,
            point_id,
            state: AlarmState::Normal,
            value_at_activation: 0.0,
            activated_at: None,
            acknowledged_at: None,
            acknowledged_by: None,
            cleared_at: None,
            shelved_until: None,
            priority,
            message: message.into(),
        }
    }
}

// ---------------------------------------------------------------------------
// Transition function
// ---------------------------------------------------------------------------

/// Apply `event` to `current` state and return the next state.
///
/// Returns `None` when the event is not valid for the current state
/// (i.e. no transition occurs).
pub fn transition(
    current: &AlarmState,
    event: &AlarmEvent,
    instance: &mut AlarmInstance,
    now: DateTime<Utc>,
) -> Option<AlarmState> {
    match (current, event) {
        // ── Normal → Unacknowledged : condition becomes active ──────────────
        (AlarmState::Normal, AlarmEvent::ConditionActive { value }) => {
            instance.value_at_activation = *value;
            instance.activated_at = Some(now);
            instance.cleared_at = None;
            Some(AlarmState::Unacknowledged)
        }

        // ── Unacknowledged → Acknowledged : operator acks while active ──────
        (AlarmState::Unacknowledged, AlarmEvent::OperatorAcknowledge { user_id }) => {
            instance.acknowledged_at = Some(now);
            instance.acknowledged_by = Some(*user_id);
            Some(AlarmState::Acknowledged)
        }

        // ── Unacknowledged → ReturnToNormal : condition clears before ack ───
        (AlarmState::Unacknowledged, AlarmEvent::ConditionCleared) => {
            instance.cleared_at = Some(now);
            Some(AlarmState::ReturnToNormal)
        }

        // ── Acknowledged → Normal : condition clears after ack (silent RTN) ─
        (AlarmState::Acknowledged, AlarmEvent::ConditionCleared) => {
            instance.cleared_at = Some(now);
            Some(AlarmState::Normal)
        }

        // ── ReturnToNormal → Normal : operator acks the RTN ─────────────────
        (AlarmState::ReturnToNormal, AlarmEvent::OperatorAcknowledge { user_id }) => {
            instance.acknowledged_at = Some(now);
            instance.acknowledged_by = Some(*user_id);
            Some(AlarmState::Normal)
        }

        // ── * → Shelved : operator shelves (from Normal, Unack, Ack, RTN) ───
        (
            AlarmState::Normal
            | AlarmState::Unacknowledged
            | AlarmState::Acknowledged
            | AlarmState::ReturnToNormal,
            AlarmEvent::OperatorShelve { until },
        ) => {
            instance.shelved_until = Some(*until);
            Some(AlarmState::Shelved)
        }

        // ── Shelved → Normal : shelve expires and condition is not active ────
        (AlarmState::Shelved, AlarmEvent::ShelveExpired) => {
            instance.shelved_until = None;
            Some(AlarmState::Normal)
        }

        // ── Shelved → Unacknowledged : operator manually unshelves and
        //    condition is still active — evaluator must re-check the tag. ──────
        (AlarmState::Shelved, AlarmEvent::OperatorUnshelve) => {
            instance.shelved_until = None;
            // Return to Unacknowledged if the alarm was previously active.
            if instance.activated_at.is_some() && instance.cleared_at.is_none() {
                Some(AlarmState::Unacknowledged)
            } else {
                Some(AlarmState::Normal)
            }
        }

        // ── * → Disabled ─────────────────────────────────────────────────────
        (_, AlarmEvent::Disable) => Some(AlarmState::Disabled),

        // ── Disabled → Normal : re-enable; evaluator will re-check ──────────
        (AlarmState::Disabled, AlarmEvent::Enable) => Some(AlarmState::Normal),

        // ── Suppressed → Normal : suppression lifted (design-time) ──────────
        (AlarmState::Suppressed, AlarmEvent::Enable) => Some(AlarmState::Normal),

        // ── All other combinations are invalid / no-op ───────────────────────
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_instance() -> AlarmInstance {
        AlarmInstance::new(Uuid::new_v4(), Uuid::new_v4(), 3, "test alarm")
    }

    #[test]
    fn normal_to_unacknowledged() {
        let mut inst = dummy_instance();
        let next = transition(
            &AlarmState::Normal,
            &AlarmEvent::ConditionActive { value: 105.0 },
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::Unacknowledged));
        assert!(inst.activated_at.is_some());
    }

    #[test]
    fn unack_to_ack() {
        let mut inst = dummy_instance();
        let uid = Uuid::new_v4();
        let next = transition(
            &AlarmState::Unacknowledged,
            &AlarmEvent::OperatorAcknowledge { user_id: uid },
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::Acknowledged));
        assert_eq!(inst.acknowledged_by, Some(uid));
    }

    #[test]
    fn unack_clears_to_rtn() {
        let mut inst = dummy_instance();
        let next = transition(
            &AlarmState::Unacknowledged,
            &AlarmEvent::ConditionCleared,
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::ReturnToNormal));
    }

    #[test]
    fn ack_clears_to_normal() {
        let mut inst = dummy_instance();
        let next = transition(
            &AlarmState::Acknowledged,
            &AlarmEvent::ConditionCleared,
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::Normal));
    }

    #[test]
    fn rtn_ack_to_normal() {
        let mut inst = dummy_instance();
        let next = transition(
            &AlarmState::ReturnToNormal,
            &AlarmEvent::OperatorAcknowledge { user_id: Uuid::new_v4() },
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::Normal));
    }

    #[test]
    fn shelve_from_unack() {
        let mut inst = dummy_instance();
        let until = Utc::now() + chrono::Duration::hours(1);
        let next = transition(
            &AlarmState::Unacknowledged,
            &AlarmEvent::OperatorShelve { until },
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::Shelved));
        assert_eq!(inst.shelved_until, Some(until));
    }

    #[test]
    fn disable_from_any() {
        let mut inst = dummy_instance();
        let next = transition(
            &AlarmState::Acknowledged,
            &AlarmEvent::Disable,
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, Some(AlarmState::Disabled));
    }

    #[test]
    fn invalid_transition_returns_none() {
        let mut inst = dummy_instance();
        // Can't get ConditionActive when already Acknowledged
        let next = transition(
            &AlarmState::Acknowledged,
            &AlarmEvent::ConditionActive { value: 99.0 },
            &mut inst,
            Utc::now(),
        );
        assert_eq!(next, None);
    }
}
