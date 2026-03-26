---
id: DD-33-004
title: Create weekly CI workflow for license scan and extended dependency audit
unit: DD-33
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

A weekly scheduled CI workflow must run extended security tests, `cargo audit`, `npm audit`, and a license compliance scan. This is separate from nightly because these checks have lower urgency (weekly cadence is sufficient) and because license scanning requires additional tooling.

## Spec Excerpt (verbatim)

> **Weekly** | Scheduled | Extended security tests, dependency audit (`cargo audit`, `npm audit`), license check | < 15 minutes
> — 33_TESTING_STRATEGY.md, §CI Pipeline

## Where to Look in the Codebase

Primary files:
- `.github/workflows/` — no `weekly.yml` file exists; only `ci.yml` and `nightly.yml`
- `.github/workflows/nightly.yml:9-23` — nightly already runs `cargo audit` and `pnpm audit`; these need to remain nightly AND run weekly with license check added

## Verification Checklist

- [ ] `.github/workflows/weekly.yml` exists
- [ ] The workflow has `schedule: - cron: '0 3 * * 0'` (or similar once-per-week schedule)
- [ ] The workflow runs `cargo audit` for Rust dependency vulnerabilities
- [ ] The workflow runs `pnpm audit` for Node dependency vulnerabilities
- [ ] The workflow runs a license check tool (e.g., `cargo-deny check licenses` for Rust, `license-checker` or `pnpm licenses list` for Node)
- [ ] The license check enforces the allowed list from CLAUDE.md §1 (MIT, Apache-2.0, BSD, ISC, MPL-2.0 only)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No weekly workflow file exists. The nightly workflow (nightly.yml:9-23) does run `cargo audit` and `pnpm audit` daily, which partially covers the requirement, but the weekly requirement additionally mandates a license check which is completely absent.

## Fix Instructions (if needed)

Create `.github/workflows/weekly.yml`:

```yaml
name: Weekly — Dependency audit + license scan

on:
  schedule:
    - cron: '0 3 * * 0'  # 3am UTC every Sunday
  workflow_dispatch:

jobs:
  dependency-audit:
    name: Dependency audit
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Install cargo-audit
        run: cargo install cargo-audit
      - name: Audit Rust dependencies
        run: cargo audit
      - name: Audit Node dependencies
        working-directory: frontend
        run: |
          pnpm install --frozen-lockfile
          pnpm audit --audit-level moderate

  license-check:
    name: License compliance check
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Install cargo-deny
        run: cargo install cargo-deny
      - name: Check Rust licenses
        run: cargo deny check licenses
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install frontend deps
        working-directory: frontend
        run: pnpm install --frozen-lockfile
      - name: Check Node licenses
        working-directory: frontend
        run: npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;MPL-2.0;CC0-1.0;CC-BY-3.0;CC-BY-4.0;0BSD;Python-2.0;BlueOak-1.0.0'
```

Also create `deny.toml` in the repo root for `cargo-deny` configuration:
```toml
[licenses]
allow = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "Unicode-DFS-2016"]
deny = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.0", "LGPL-2.1", "LGPL-3.0"]
```

Do NOT:
- Merge the weekly job into the nightly workflow — they have different cadences and different failure urgency
- Use `cargo-licenses` instead of `cargo-deny` — `cargo-deny` also checks advisories and bans, which is more comprehensive
- Suppress MPL-2.0 from the allowed list — `axe-core` (MPL-2.0) is on the I/O approved list per doc 33
