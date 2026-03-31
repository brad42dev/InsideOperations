/// Integration tests for the ISA-18.2 alarm state machine.
///
/// These tests exercise all 7 documented state transitions defined in
/// ANSI/ISA-18.2-2016 via the `event_service_lib::alarm_state` module.
///
/// No database is required — the state machine is a pure function.
use chrono::Utc;
use event_service_lib::alarm_state::{transition, AlarmEvent, AlarmInstance, AlarmState};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn new_instance() -> AlarmInstance {
    AlarmInstance::new(Uuid::new_v4(), Uuid::new_v4(), 2, "integration test alarm")
}

fn apply(state: &AlarmState, event: &AlarmEvent, inst: &mut AlarmInstance) -> Option<AlarmState> {
    transition(state, event, inst, Utc::now())
}

// ---------------------------------------------------------------------------
// Transition 1: Normal → Unacknowledged  (condition activates)
// ---------------------------------------------------------------------------

#[test]
fn transition_normal_to_unacknowledged_on_condition_active() {
    let mut inst = new_instance();
    let next = apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 110.5 },
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::Unacknowledged),
        "condition active from Normal must produce Unacknowledged"
    );
    assert!(
        inst.activated_at.is_some(),
        "activated_at must be set after transition to Unacknowledged"
    );
    assert!(
        (inst.value_at_activation - 110.5).abs() < f64::EPSILON,
        "value_at_activation must record the triggering value"
    );
}

// ---------------------------------------------------------------------------
// Transition 2: Unacknowledged → Acknowledged  (operator acks while active)
// ---------------------------------------------------------------------------

#[test]
fn transition_unacknowledged_to_acknowledged_on_operator_acknowledge() {
    let mut inst = new_instance();
    // First get to Unacknowledged state.
    apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 50.0 },
        &mut inst,
    );

    let operator_id = Uuid::new_v4();
    let next = apply(
        &AlarmState::Unacknowledged,
        &AlarmEvent::OperatorAcknowledge {
            user_id: operator_id,
        },
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::Acknowledged),
        "operator acknowledge from Unacknowledged must produce Acknowledged"
    );
    assert_eq!(
        inst.acknowledged_by,
        Some(operator_id),
        "acknowledged_by must record the operator's user ID"
    );
    assert!(
        inst.acknowledged_at.is_some(),
        "acknowledged_at must be set"
    );
}

// ---------------------------------------------------------------------------
// Transition 3: Unacknowledged → ReturnToNormal  (condition clears before ack)
// ---------------------------------------------------------------------------

#[test]
fn transition_unacknowledged_to_return_to_normal_on_condition_cleared() {
    let mut inst = new_instance();
    apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 80.0 },
        &mut inst,
    );

    let next = apply(
        &AlarmState::Unacknowledged,
        &AlarmEvent::ConditionCleared,
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::ReturnToNormal),
        "condition cleared from Unacknowledged must produce ReturnToNormal"
    );
    assert!(inst.cleared_at.is_some(), "cleared_at must be set");
}

// ---------------------------------------------------------------------------
// Transition 4: Acknowledged → Normal  (condition clears after ack — silent RTN)
// ---------------------------------------------------------------------------

#[test]
fn transition_acknowledged_to_normal_on_condition_cleared() {
    let mut inst = new_instance();
    apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 90.0 },
        &mut inst,
    );
    apply(
        &AlarmState::Unacknowledged,
        &AlarmEvent::OperatorAcknowledge {
            user_id: Uuid::new_v4(),
        },
        &mut inst,
    );

    let next = apply(
        &AlarmState::Acknowledged,
        &AlarmEvent::ConditionCleared,
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::Normal),
        "condition cleared from Acknowledged must produce Normal (silent RTN)"
    );
    assert!(inst.cleared_at.is_some(), "cleared_at must be set");
}

// ---------------------------------------------------------------------------
// Transition 5: ReturnToNormal → Normal  (operator acks the RTN)
// ---------------------------------------------------------------------------

#[test]
fn transition_return_to_normal_to_normal_on_operator_acknowledge() {
    let mut inst = new_instance();
    apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 70.0 },
        &mut inst,
    );
    apply(
        &AlarmState::Unacknowledged,
        &AlarmEvent::ConditionCleared,
        &mut inst,
    );

    let operator_id = Uuid::new_v4();
    let next = apply(
        &AlarmState::ReturnToNormal,
        &AlarmEvent::OperatorAcknowledge {
            user_id: operator_id,
        },
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::Normal),
        "acking ReturnToNormal must return to Normal"
    );
    assert_eq!(
        inst.acknowledged_by,
        Some(operator_id),
        "acknowledged_by must be updated"
    );
}

// ---------------------------------------------------------------------------
// Transition 6: * → Shelved  (operator shelves from any non-disabled state)
// ---------------------------------------------------------------------------

#[test]
fn transition_unacknowledged_to_shelved_on_operator_shelve() {
    let mut inst = new_instance();
    apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 60.0 },
        &mut inst,
    );

    let until = Utc::now() + chrono::Duration::hours(2);
    let next = apply(
        &AlarmState::Unacknowledged,
        &AlarmEvent::OperatorShelve { until },
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::Shelved),
        "operator shelve from Unacknowledged must produce Shelved"
    );
    assert_eq!(
        inst.shelved_until,
        Some(until),
        "shelved_until must record the expiry time"
    );
}

#[test]
fn transition_normal_to_shelved_on_operator_shelve() {
    let mut inst = new_instance();
    let until = Utc::now() + chrono::Duration::hours(1);
    let next = apply(
        &AlarmState::Normal,
        &AlarmEvent::OperatorShelve { until },
        &mut inst,
    );

    assert_eq!(
        next,
        Some(AlarmState::Shelved),
        "operator shelve from Normal must produce Shelved"
    );
}

// ---------------------------------------------------------------------------
// Transition 7: * → Disabled  (admin disables alarm definition)
// ---------------------------------------------------------------------------

#[test]
fn transition_any_state_to_disabled_on_disable_event() {
    let states = [
        AlarmState::Normal,
        AlarmState::Unacknowledged,
        AlarmState::Acknowledged,
        AlarmState::ReturnToNormal,
        AlarmState::Shelved,
    ];

    for state in &states {
        let mut inst = new_instance();
        let next = apply(state, &AlarmEvent::Disable, &mut inst);
        assert_eq!(
            next,
            Some(AlarmState::Disabled),
            "Disable event from {:?} must produce Disabled",
            state
        );
    }
}

// ---------------------------------------------------------------------------
// Transition: Disabled → Normal  (admin re-enables)
// ---------------------------------------------------------------------------

#[test]
fn transition_disabled_to_normal_on_enable() {
    let mut inst = new_instance();
    let next = apply(&AlarmState::Disabled, &AlarmEvent::Enable, &mut inst);
    assert_eq!(
        next,
        Some(AlarmState::Normal),
        "Enable from Disabled must return to Normal"
    );
}

// ---------------------------------------------------------------------------
// Shelve expiry and unshelve
// ---------------------------------------------------------------------------

#[test]
fn transition_shelved_to_normal_on_shelve_expired() {
    let mut inst = new_instance();
    let until = Utc::now() + chrono::Duration::hours(1);
    apply(
        &AlarmState::Normal,
        &AlarmEvent::OperatorShelve { until },
        &mut inst,
    );

    let next = apply(&AlarmState::Shelved, &AlarmEvent::ShelveExpired, &mut inst);
    assert_eq!(
        next,
        Some(AlarmState::Normal),
        "ShelveExpired must return to Normal"
    );
    assert!(
        inst.shelved_until.is_none(),
        "shelved_until must be cleared"
    );
}

#[test]
fn transition_shelved_unshelve_with_active_condition_returns_unacknowledged() {
    let mut inst = new_instance();
    // Activate alarm so activated_at is set and cleared_at is None.
    apply(
        &AlarmState::Normal,
        &AlarmEvent::ConditionActive { value: 95.0 },
        &mut inst,
    );
    let until = Utc::now() + chrono::Duration::hours(1);
    apply(
        &AlarmState::Unacknowledged,
        &AlarmEvent::OperatorShelve { until },
        &mut inst,
    );

    // Operator manually unshelves while condition is still active.
    let next = apply(
        &AlarmState::Shelved,
        &AlarmEvent::OperatorUnshelve,
        &mut inst,
    );
    assert_eq!(
        next,
        Some(AlarmState::Unacknowledged),
        "Unshelving with active condition must return to Unacknowledged"
    );
}

// ---------------------------------------------------------------------------
// Invalid transitions return None
// ---------------------------------------------------------------------------

#[test]
fn invalid_transition_returns_none() {
    let mut inst = new_instance();
    // Cannot get ConditionActive when already Acknowledged (no re-activation path).
    let next = apply(
        &AlarmState::Acknowledged,
        &AlarmEvent::ConditionActive { value: 100.0 },
        &mut inst,
    );
    assert_eq!(
        next, None,
        "ConditionActive from Acknowledged must return None (invalid transition)"
    );
}

// ---------------------------------------------------------------------------
// State Display impl
// ---------------------------------------------------------------------------

#[test]
fn alarm_state_display_strings_are_stable() {
    let cases = [
        (AlarmState::Normal, "normal"),
        (AlarmState::Unacknowledged, "unacknowledged"),
        (AlarmState::Acknowledged, "acknowledged"),
        (AlarmState::ReturnToNormal, "return_to_normal"),
        (AlarmState::Shelved, "shelved"),
        (AlarmState::Suppressed, "suppressed"),
        (AlarmState::Disabled, "disabled"),
    ];

    for (state, expected) in &cases {
        assert_eq!(
            state.to_string(),
            *expected,
            "Display for {:?} must be \"{}\"",
            state,
            expected
        );
    }
}
