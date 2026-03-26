---
id: DD-33-005
title: Add unit tests to 8 services and 5 shared crates that have zero test coverage
unit: DD-33
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Every Rust service and shared crate must have unit tests for its core business logic, pure functions, and error handling. Eight of eleven services and five of twelve shared crates currently have zero `#[cfg(test)]` blocks, leaving all their logic unverified.

## Spec Excerpt (verbatim)

> **Target:** All pure functions and core business logic. Aim for high coverage on the `io-*` shared crates since they're used by all 11 services.
>
> **Error handling:** every `Result`-returning function should have tests for both `Ok` and `Err` paths
> — 33_TESTING_STRATEGY.md, §Backend Testing — Unit Tests

## Where to Look in the Codebase

Services with 0 test blocks (verified by grep):
- `services/data-broker/src/` — `fanout.rs`, `staleness.rs`, `registry.rs` have pure logic with no tests
- `services/opc-service/src/` — `driver.rs`, `db.rs` have pure logic with no tests
- `services/parser-service/src/` — SVG/DXF parsing logic
- `services/archive-service/src/` — compression and retention scheduling logic
- `services/import-service/src/` — ETL pipeline, field mapping logic
- `services/alert-service/src/` — escalation timing logic
- `services/email-service/src/` — template rendering logic
- `services/recognition-service/src/` — confidence threshold logic

Shared crates with 0 test blocks:
- `crates/io-db/src/lib.rs` — database helper functions
- `crates/io-opc/src/lib.rs` — OPC UA type conversions
- `crates/io-export/src/lib.rs` — export format generation
- `crates/io-health/src/lib.rs` — health check logic
- `crates/io-observability/src/lib.rs` — metrics helpers

## Verification Checklist

- [ ] `services/data-broker/src/fanout.rs` has a `#[cfg(test)]` module testing point-to-N-subscriber fanout logic
- [ ] `services/data-broker/src/staleness.rs` has tests for staleness timestamp comparison
- [ ] `services/opc-service/src/driver.rs` has tests for value quality mapping
- [ ] `services/alert-service/src/` has tests for escalation tier timing (1→5→15→30 min boundary conditions)
- [ ] `crates/io-export/src/lib.rs` has tests for CSV/JSON format generation with known inputs
- [ ] `crates/io-opc/src/lib.rs` has tests for OPC UA variant-to-f64 conversion edge cases
- [ ] All `Result`-returning functions in io-* crates have at least one `Err` path test

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: 8 of 11 services have 0 test blocks. 5 of 12 crates have 0 test blocks. Services with tests: api-gateway (2 blocks in `correlation.rs`), auth-service (1 block in `expression_eval.rs`), event-service (1 block in `alarm_state.rs`).

## Fix Instructions (if needed)

For each untested service and crate, add a `#[cfg(test)]` module to the files with the most pure logic. Priority order:

1. **`services/data-broker/src/staleness.rs`** — Add tests for the staleness detection window math. Example:
   ```rust
   #[cfg(test)]
   mod tests {
       use super::*;
       #[test]
       fn marks_stale_after_threshold_exceeded() { ... }
       #[test]
       fn not_stale_within_threshold() { ... }
   }
   ```

2. **`services/alert-service/src/`** — Add tests for escalation timing boundaries. The spec requires testing "1→5→15→30 min" tier transitions. Mock the clock using a deterministic timestamp parameter rather than `Instant::now()`.

3. **`crates/io-export/src/lib.rs`** — Add round-trip tests for each export format (CSV headers, JSON structure, Parquet schema). Use in-memory byte buffers.

4. **`crates/io-opc/src/lib.rs`** — Add tests for all OPC UA `Variant` type conversions to the internal `PointValue` type, including `Bad` quality mapping.

5. **`services/opc-service/src/driver.rs`** — Add tests for reconnection backoff calculation logic (pure math — testable without a live OPC server).

General rules per spec:
- Test names must describe the business requirement, not the implementation (`alarm_fires_when_value_exceeds_high_threshold`, not `test_threshold_1`)
- Every `Result`-returning public function needs at least one `Err` path test
- Do NOT mock `sqlx` — integration tests (DD-33-006) cover database paths; unit tests cover pure logic only

Do NOT:
- Add empty or trivial test stubs (e.g., `assert!(true)`) to inflate the count
- Write tests that depend on a running database in unit test modules — those belong in `tests/` directories (DD-33-006)
- Copy-paste test structure without thinking about what business invariant is being verified
