# Inside/Operations - Testing Strategy

## Overview

Test at the right level. Unit tests for business logic, integration tests for service boundaries, E2E tests for critical user workflows.

No deadline pressure means we can build it right — comprehensive test infrastructure from the start. Every service ships with tests. Every module ships with tests. The CI pipeline enforces this from Phase 1.

**Testing principles:**

- **Test behavior, not implementation** — tests should survive refactoring
- **Deterministic by default** — no flaky tests, no random seeds in assertions, no timing-dependent checks
- **Fast feedback loop** — unit tests run in seconds, not minutes
- **Real dependencies where practical** — prefer a real PostgreSQL container over mocking SQL; mock only what's expensive or external (OPC UA servers, SMTP, Twilio)
- **Tests are documentation** — test names describe the business requirement they verify

---

## Backend Testing (Rust)

### Unit Tests

Rust's built-in `#[cfg(test)]` module convention. Each source file contains a `tests` module with unit tests for its public and internal functions.

**What to test:**

- Business logic: alarm threshold evaluation, expression evaluation (Rhai engine), point staleness detection, escalation timing logic
- Data transformations: point value serialization/deserialization, SVG element parsing, import field mapping, export format generation
- Validation: input sanitization, permission string parsing, cron expression validation, tag/filter matching
- Pure functions: time bucketing, correlation math (Pearson, FFT cross-correlation), change point detection, consensus scoring
- Error handling: every `Result`-returning function should have tests for both `Ok` and `Err` paths

**Conventions:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alarm_fires_when_value_exceeds_high_threshold() {
        let def = AlarmDefinition { high: Some(100.0), ..Default::default() };
        let result = evaluate_alarm(&def, 101.5);
        assert_eq!(result, AlarmState::High);
    }

    #[tokio::test]
    async fn expression_evaluates_conditional_correctly() {
        let engine = RhaiEngine::new_sandboxed();
        let result = engine.eval_expression("if(x > 10, 'HIGH', 'LOW')", &vars).await;
        assert_eq!(result.unwrap(), "HIGH");
    }
}
```

**Target:** All pure functions and core business logic. Aim for high coverage on the `io-*` shared crates since they're used by all 11 services.

### Integration Tests

`cargo test --test` integration test binaries in each service's `tests/` directory. These tests hit real infrastructure.

**What to test:**

- API endpoints: real HTTP requests against a running Axum server (using `axum::serve` with a test listener or `reqwest` against a bound port)
- Database operations: full CRUD cycles against a real PostgreSQL + TimescaleDB container
- Database migrations: verify all migrations run cleanly from scratch and that rollbacks work
- Inter-service communication: NOTIFY/LISTEN message delivery, Unix domain socket IPC request/response
- WebSocket behavior: subscription registration, point fanout, backpressure handling, ticket-based auth
- Alarm evaluation engine: threshold scenarios with real point data flowing through the pipeline
- Expression builder: Rhai engine evaluation with edge cases (division by zero, missing variables, timeout enforcement)
- Time-series operations: hypertable inserts, continuous aggregate refresh, compression, retention policy execution
- Import pipeline: connector initialization, field mapping, transform execution, duplicate detection
- Export pipeline: CSV/JSON/XLSX/PDF/Parquet generation with realistic datasets

**Database setup:** Each integration test suite gets a fresh database created from migrations + seed data. Tests run inside a transaction that rolls back on completion (via `sqlx::test`) where possible. Tests that need to verify transaction behavior or NOTIFY/LISTEN use a dedicated ephemeral database.

### Service-Level Tests

Each of the 11 services has its own integration test suite covering service-specific behavior:

| Service | Key Test Scenarios |
|---------|--------------------|
| **API Gateway** (3000) | Route dispatch, JWT validation, RBAC permission enforcement (all permissions defined in doc 03), rate limiting, request validation, error response format |
| **Data Broker** (3001) | WebSocket connection lifecycle, subscription registry, point fanout to N clients, backpressure throttling, stale data detection, SharedWorker reconnection |
| **OPC Service** (3002) | Connection lifecycle, reconnection with backoff, metadata crawl, subscription batching, backfill on reconnect, value quality mapping (mock OPC UA server) |
| **Event Service** (3003) | MSSQL historian polling, event deduplication, alarm state transitions, event-to-alert bridging |
| **Parser Service** (3004) | SVG import parsing, DXF/AutoCAD format handling, point binding extraction, symbol detection handoff |
| **Archive Service** (3005) | Continuous aggregate maintenance, compression scheduling, retention policy execution, data downsampling |
| **Import Service** (3006) | Connector initialization (mock external sources), ETL pipeline stages, schedule execution, error recovery, duplicate detection |
| **Alert Service** (3007) | Escalation timing (1→5→15→30 min), shift-aware routing, muster activation, channel failover (SMS→email→push), suppression during maintenance windows |
| **Email Service** (3008) | Template rendering (minijinja), SMTP delivery (mock server), provider failover, bounce handling, queue drain behavior |
| **Auth Service** (3009) | Login flows (local, OIDC, SAML, LDAP), MFA enrollment/verification, token refresh, session management, SCIM provisioning, API key lifecycle, WebSocket ticket generation |
| **Recognition Service** (3010) | ONNX model loading, inference pipeline (mock images), confidence thresholds, feedback ingestion, .iomodel package validation |

### Performance Tests

**Micro-benchmarks** with `criterion` on hot paths:

- Point value serialization/deserialization (~1M iterations)
- Rhai expression evaluation throughput (simple vs complex expressions)
- Correlation engine: Pearson correlation with 50 points × 1,440 samples
- FFT cross-correlation with realistic signal lengths
- SVG tile generation via `resvg` (measure render time per tile at each zoom level)
- Alarm threshold evaluation throughput (batch of 10,000 points)
- JSON response serialization for large point lists

**Load tests** with Goose (Apache-2.0):

- 200 concurrent WebSocket connections with active subscriptions
- 10,000 point updates/second throughput through the Data Broker
- API response time under load (target: p95 < 200ms)
- Concurrent import + export operations while maintaining real-time performance
- Alert delivery latency under load (target: < 5s for safety-critical)

---

## Frontend Testing (React / TypeScript)

### Unit Tests

Vitest as the test runner. Testing Library for component rendering. happy-dom as the DOM implementation (faster than jsdom for Vitest).

**What to test:**

- Component rendering: verify correct output for given props and state
- Zustand stores: state transitions, selector behavior, middleware (zundo undo/redo)
- Utility functions: time formatting, unit conversion, tag filtering, permission checking
- Expression builder: AST serialization/deserialization, tile validation, expr-eval-fork evaluation
- Theme tokens: verify CSS variable application across all 3 themes
- WebSocket message parsing: point update deserialization, subscription acknowledgment handling

**Conventions:**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('AlarmBadge', () => {
  it('renders high alarm with correct severity color', () => {
    render(<AlarmBadge state="high" value={105.2} />);
    expect(screen.getByText('HIGH')).toHaveClass('alarm-high');
  });

  it('shows nothing when alarm state is normal', () => {
    const { container } = render(<AlarmBadge state="normal" value={50.0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

### Integration Tests

Module-level workflow tests with mocked backend (msw for HTTP, custom mock for WebSocket).

**What to test:**

- Console: create workspace → add pane → subscribe to points → verify data rendering
- Designer: open graphic → add element → bind point → save → verify SVG output
- Dashboards: create dashboard → add widgets → configure data sources → verify rendering
- Log: create entry with rich text → add attachment → save → search and find it
- Rounds: fill out round instance → submit readings → verify validation
- Settings: modify configuration → save → verify persistence
- Offline behavior: queue operations in IndexedDB (Rounds/Log) → simulate reconnect → verify sync
- RBAC UI visibility: verify elements show/hide based on permission sets
- Multi-window: BroadcastChannel message propagation (auth refresh, theme change)

### E2E Tests

Playwright for browser automation. Tests run against a fully deployed local stack (all services + real database).

**Critical path tests (run on every PR):**

1. **Login → Console → Live Data**: Login → navigate to Console → open workspace → verify point values update via WebSocket
2. **Designer → Console Pipeline**: Import SVG → bind points → save graphic → open in Console → verify dynamic elements render
3. **Rounds Workflow**: Create template → generate instance → complete round on mobile viewport (375px) → verify 60px touch targets → submit
4. **Log Workflow**: Select template → fill WYSIWYG entry → attach image → save → search and retrieve
5. **Emergency Alert**: Send emergency alert → verify alert overlay appears in Console → acknowledge
6. **Forensics Correlation**: Select 3+ points → set time range → run correlation → verify chart renders with results
7. **Report Generation**: Create template → generate report → download CSV export → verify contents
8. **Alarm Configuration**: Configure alarm threshold in Settings → inject point value above threshold → verify alarm fires and appears in UI

**Extended tests (nightly):**

- Full CRUD for all entity types (workspaces, dashboards, templates, users, roles, connections, etc.)
- Import wizard: configure connection → map fields → preview → execute → verify imported data
- Export: trigger export for each format (CSV, JSON, XLSX, PDF, Parquet, HTML) → verify file downloads
- Bulk Update: download template → modify rows → upload → verify diff → apply
- Multi-user scenarios: two browser contexts, one modifies a shared resource, the other sees the update
- Mobile viewport tests: all modules at 375px width, touch interaction, responsive breakpoints
- Multi-window tests: open detached pane → verify SharedWorker WebSocket sharing

---

## Test Libraries and Licensing

### Backend (Rust)

| Crate | Purpose | License | Notes |
|-------|---------|---------|-------|
| (built-in) | `#[test]`, `#[cfg(test)]` | — | Rust's native test framework |
| `tokio::test` | Async test runtime | MIT | Already in project |
| `sqlx` (test feature) | Database test transactions, ephemeral DBs | MIT/Apache-2.0 | Already in project |
| `criterion` | Micro-benchmarks with statistical analysis | MIT/Apache-2.0 | — |
| `wiremock` | HTTP mock server for external API calls | MIT/Apache-2.0 | Mock OPC UA, SMTP, Twilio, etc. |
| `testcontainers` | Spin up Docker containers (PostgreSQL, TimescaleDB) in tests | MIT/Apache-2.0 | — |
| `fake` | Generate realistic test data (names, emails, timestamps) | MIT/Apache-2.0 | — |
| `assert-json-diff` | Structured JSON comparison in test assertions | MIT | — |
| `goose` | HTTP/WebSocket load testing | Apache-2.0 | Replaces drill (GPL, not usable) |

### Frontend (TypeScript)

| Library | Purpose | License | Notes |
|---------|---------|---------|-------|
| Vitest | Test runner (Vite-native, fast) | MIT | — |
| `@testing-library/react` | Component testing with user-centric queries | MIT | — |
| `@testing-library/user-event` | Simulate real user interactions (click, type, etc.) | MIT | — |
| happy-dom | Fast DOM implementation for Vitest | MIT | Faster than jsdom |
| Playwright | E2E browser automation | Apache-2.0 | Chromium, Firefox, WebKit |
| msw (Mock Service Worker) | API request interception and mocking | MIT | For integration tests |
| axe-core | Automated accessibility auditing | MPL-2.0 | On I/O approved license list |

All libraries comply with I/O's licensing requirement: MIT, Apache-2.0, BSD, ISC, or MPL-2.0. No GPL/AGPL dependencies.

---

## Test Infrastructure

### CI Pipeline

| Stage | Trigger | What Runs | Duration Target |
|-------|---------|-----------|-----------------|
| **Commit** | Every push | Rust unit tests, frontend unit tests, `clippy`, `rustfmt`, ESLint, Prettier, TypeScript type check | < 2 minutes |
| **PR** | Pull request open/update | Integration tests (Rust + frontend), E2E critical paths (8 tests), accessibility checks | < 20 minutes |
| **Nightly** | Scheduled (daily) | Full E2E suite, performance benchmarks (`criterion`), load tests (Goose), security tests | < 60 minutes |
| **Weekly** | Scheduled | Extended security tests, dependency audit (`cargo audit`, `npm audit`), license check | < 15 minutes |

### Test Database

- **Container**: Docker with PostgreSQL 16 + TimescaleDB 2.13+ (managed by `testcontainers` in Rust, Docker Compose for E2E)
- **Setup**: Fresh migration run + seed data for each test suite execution
- **Isolation**: Each integration test gets its own transaction (rolled back) or ephemeral database (for tests requiring commits)
- **Seed data**: Deterministic fixtures — default admin user, sample roles with known permissions, sample point sources, sample alarm definitions

### Test Data Strategy

**Factories** for common entities:

- Users (with specific role/permission combinations for RBAC testing)
- Points (with realistic metadata, alarm thresholds, engineering units)
- Workspaces and graphics (with bound points for Console/Process tests)
- Alarm definitions (with escalation policies for Alert Service tests)
- Round templates and instances (with equipment hierarchies)
- Log templates and entries (with rich text and attachments)
- Import connections and definitions (with mock external sources)

**Time-series generators:**

- Deterministic point history generators for forensics correlation tests (known patterns with planted anomalies)
- Realistic process data profiles (ramp, oscillation, steady-state, step change) for dashboard and chart rendering tests
- High-volume generators for load tests (10,000+ points, configurable update frequency)

**Rules:**

- No random data in assertions — use fixed seeds or deterministic generators
- Test data lives in version-controlled fixture files or builder functions, not in the database
- Sensitive-looking test data (passwords, tokens) must be obviously fake (`test-password-123`, `test-jwt-token-xxx`)

---

## Test Categories and When to Run

| Category | Scope | Trigger | Duration Target |
|----------|-------|---------|-----------------|
| Unit (Rust) | Business logic, pure functions, shared crates | Every commit | < 30 seconds |
| Unit (Frontend) | Components, Zustand stores, utilities | Every commit | < 30 seconds |
| Lint + Format | clippy, rustfmt, ESLint, Prettier, tsc | Every commit | < 60 seconds |
| Integration (Rust) | Service APIs, database operations, IPC | PR merge | < 5 minutes |
| Integration (Frontend) | Module workflows with mocked API | PR merge | < 3 minutes |
| E2E (Critical) | 8 critical user paths | PR merge | < 10 minutes |
| E2E (Full) | All user workflows, all modules | Nightly | < 30 minutes |
| Performance | criterion benchmarks, Goose load tests | Nightly | < 15 minutes |
| Security | Auth flows, RBAC, injection, rate limiting | Nightly (subset), Weekly (full) | < 10 minutes |
| Accessibility | axe-core checks, keyboard nav, touch targets | PR merge (subset), Weekly (full) | < 5 minutes |
| Dependency Audit | cargo audit, npm audit, license scan | Weekly | < 5 minutes |

---

## Security Testing

**Authentication flows:**

- Login with valid/invalid credentials (local, OIDC, SAML, LDAP)
- Token refresh: valid refresh token, expired refresh token, revoked refresh token
- Session expiry: verify access denied after token expiry without refresh
- MFA enrollment and verification (TOTP)
- API key authentication: create, use, revoke, verify revoked key is rejected
- WebSocket ticket auth: valid ticket accepted, expired ticket (>30s) rejected, reused ticket rejected

**RBAC enforcement:**

- Test each permission defined in doc 03: verify the protected action succeeds with the permission and returns 403 without it
- Role hierarchy: verify Admin inherits all permissions
- Cross-module isolation: verify a user with `console:read` cannot access `settings:write` endpoints
- Permission changes take effect on next request (no stale permission caching)

**Input validation:**

- SQL injection attempts on all user-input fields (parameterized queries should make this a non-issue, but verify)
- XSS payloads in text fields (log entries, workspace names, alarm messages)
- Path traversal in file upload/download endpoints
- Oversized payloads (verify request size limits)
- Malformed JSON, missing required fields, wrong types

**File upload security:**

- YARA-X rule validation: submit test payloads with embedded scripts (SVG), XXE (XML), suspicious ONNX structures
- Verify clean files pass scanning
- Verify malicious files are rejected with appropriate error messages

**Rate limiting:**

- Brute-force protection on login endpoint (verify lockout after N failures)
- Rate limiting on token refresh endpoint
- Rate limiting on password reset endpoint

---

## Accessibility Testing

**Automated (axe-core in Playwright tests):**

- Run axe-core accessibility audit on every page/route during E2E tests
- Zero violations policy for WCAG 2.1 Level A (warning-only for Level AA initially, promote to error over time)
- Custom rules for I/O-specific requirements (60px touch targets on mobile viewport)

**Manual verification checklist (per module, during development):**

- Keyboard navigation: all interactive elements reachable via Tab, actionable via Enter/Space
- Focus management: modal dialogs trap focus, focus returns to trigger on close
- Screen reader: alarm notifications announced via ARIA live regions
- High-contrast theme: all text meets 4.5:1 contrast ratio, alarm colors distinguishable
- Touch targets: minimum 60px on mobile viewports (gloved operation requirement)
- Zoom: content remains usable at 200% browser zoom

---

## Test Environment Profiles

| Profile | Infrastructure | Test Scope | Data |
|---------|---------------|------------|------|
| **Local dev** | Docker Compose (PostgreSQL + TimescaleDB), services run via `cargo run` | Unit + integration tests | Seed data + test fixtures |
| **CI** | Ephemeral containers (testcontainers for Rust, Docker Compose for E2E), clean environment per run | Full test suite | Fresh migration + seed data per run |
| **Staging** | Deployed instance matching production topology (Standalone or Resilient profile) | E2E tests against deployed stack | Dedicated test dataset (realistic but synthetic) |
| **Production** | Live deployment | Health checks (`/healthz`) and smoke tests only | No test data — ever |

**Staging rules:**

- Staging database is wiped and re-seeded before each test run
- Staging environment matches the target deployment profile (see doc 22)
- Staging tests verify deployment-specific behavior: systemd service startup, nginx routing, TLS termination
- No staging tests modify production-adjacent systems (no real SMTP, no real OPC UA servers)

---

## Integration with Development Phases

Testing infrastructure is built incrementally alongside application development (see doc 05):

| Phase | Testing Milestone |
|-------|-------------------|
| **Phase 1 (Foundation)** | CI pipeline, testcontainers setup, database test harness, first unit + integration tests |
| **Phase 2 (Auth & Core API)** | Auth flow tests, RBAC permission tests, API response format tests |
| **Phase 3 (Real-Time Pipeline)** | OPC Service tests with mock server, WebSocket integration tests, subscription fanout tests, backpressure tests, reconnection tests |
| **Phase 4-5 (Shell & Shared Components)** | Vitest + Testing Library setup, component unit tests, first Playwright E2E tests |
| **Phase 6-7 (Graphics & Console)** | SVG rendering tests, Designer E2E tests, Console workspace tests — **first live demo validation** |
| **Phase 8 (Expression Builder)** | Expression evaluation tests, AST serialization roundtrip, Rhai sandbox tests, ISA-18.2 alarm state machine tests |
| **Phase 9-12 (Feature modules)** | Module-specific integration and E2E tests ship with each module (Reports, Dashboards, Forensics, Log, Rounds) |
| **Phase 13 (Alerts, Shifts & Email)** | Alert escalation timing tests, shift-aware routing tests, email delivery tests, muster workflow tests |
| **Phase 14 (Universal Import)** | Connector tests with mock sources, import wizard E2E, data quality validation tests |
| **Phase 16 (Templates & Polish)** | Modbus/MQTT connector tests, export format verification, enterprise auth provider tests |
| **Phase 17 (Hardening)** | Full security audit, load testing, accessibility audit, installer regression tests |

**Rule:** No phase is considered complete until its test suite passes in CI.

---

## Permissions

None. Testing is a development concern, not a runtime feature.

---

## Change Log

- **v0.3**: Updated "Integration with Development Phases" table to match doc 05 v2.0 (17-phase demo-first build order). Expanded from 8 to 11 phase rows covering all testing milestones.
- **v0.2**: Removed hardcoded permission counts (reference doc 03 as source of truth instead). Flagged "Integration with Development Phases" table for update after build order review (doc 05).
- **v0.1**: Initial testing strategy covering backend (Rust), frontend (React/TypeScript), E2E, security, accessibility, test infrastructure, CI pipeline, and environment profiles. All test libraries verified as MIT, Apache-2.0, BSD, ISC, or MPL-2.0 compliant.
