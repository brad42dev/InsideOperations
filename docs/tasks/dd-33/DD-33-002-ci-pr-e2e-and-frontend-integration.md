---
id: DD-33-002
title: Wire E2E critical paths and frontend integration tests to PR CI stage
unit: DD-33
status: pending
priority: high
depends-on: [DD-33-007]
---

## What This Feature Should Do

Every opened or updated pull request should run the 8 E2E critical path tests and the frontend integration test suite before merge is allowed. Currently E2E runs only in nightly (and is stub-level), and frontend integration tests do not exist as a distinct CI job. The PR stage gate must block merges on E2E failures.

## Spec Excerpt (verbatim)

> **PR** | Pull request open/update | Integration tests (Rust + frontend), E2E critical paths (8 tests), accessibility checks | < 20 minutes
> — 33_TESTING_STRATEGY.md, §CI Pipeline

## Where to Look in the Codebase

Primary files:
- `.github/workflows/ci.yml` — add new job `e2e-critical` triggered on PR; add new job `frontend-integration`
- `.github/workflows/nightly.yml:25` — `e2e-critical` job exists here; it should be MOVED to ci.yml for PR trigger (or duplicated with `on: pull_request`)
- `frontend/package.json` — scripts: `e2e` already present at line 13
- `frontend/src/test/` — module-level integration tests need to exist here before this CI job is meaningful

## Verification Checklist

- [ ] ci.yml contains an `e2e-critical` job triggered on `pull_request` to `main`
- [ ] The e2e-critical job installs the full app stack (or uses Docker Compose services) so tests can run against a real backend
- [ ] ci.yml contains a `frontend-integration` job that runs module-level Vitest tests (distinct from `frontend-checks` unit tests)
- [ ] The e2e-critical job uploads the Playwright HTML report as an artifact on failure
- [ ] The PR merge gate requires `e2e-critical` and `frontend-integration` to pass (branch protection rules)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: ci.yml has no `e2e-critical` job (only nightly.yml:25 does). ci.yml has no `frontend-integration` job. The Rust integration-tests job exists (ci.yml:73) but does not start services, so it cannot test inter-service behavior. Frontend integration tests have no distinct CI target.

## Fix Instructions (if needed)

1. In `.github/workflows/ci.yml`, add a new job after `integration-tests`:

```yaml
e2e-critical:
  name: E2E — critical paths (PR gate)
  runs-on: ubuntu-24.04
  needs: [integration-tests]
  services:
    postgres:
      image: timescale/timescaledb:2.13.1-pg16
      env:
        POSTGRES_USER: io
        POSTGRES_PASSWORD: io_password
        POSTGRES_DB: io_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  env:
    IO_DATABASE_URL: postgresql://io:io_password@localhost:5432/io_test
    JWT_SECRET: test-secret-for-ci-only
    IO_SERVICE_SECRET: test-service-secret
    E2E_BASE_URL: http://localhost:5173
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
    - uses: pnpm/action-setup@v3
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - name: Install system dependencies
      run: sudo apt-get update -qq && sudo apt-get install -y libxmlsec1-dev libxmlsec1-openssl libxml2-dev
    - name: Install sqlx-cli and run migrations
      run: |
        cargo install sqlx-cli --no-default-features --features postgres
        sqlx migrate run --source migrations
    - name: Start API Gateway (background)
      run: cargo run -p io-api-gateway &
      env:
        DATABASE_URL: postgresql://io:io_password@localhost:5432/io_test
    - name: Install frontend deps + Playwright
      working-directory: frontend
      run: |
        pnpm install --frozen-lockfile
        npx playwright install --with-deps chromium
    - name: Run E2E critical paths
      working-directory: frontend
      run: npx playwright test --reporter=html
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report-pr
        path: frontend/playwright-report/
```

2. Add a `frontend-integration` job that separates module-level tests once DD-33-007 adds them.

Do NOT:
- Remove the existing nightly e2e-critical job — keep both (nightly runs extended suite, PR runs critical paths only)
- Run E2E without a running backend — page navigation tests will pass vacuously if the dev server just serves the SPA
