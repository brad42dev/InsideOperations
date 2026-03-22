/// Public re-exports for integration tests and downstream consumers.
///
/// The event-service is primarily a binary, but exporting its core domain
/// types through a lib target allows integration tests to exercise the
/// ISA-18.2 alarm state machine without duplicating the implementation.
pub mod alarm_state;
