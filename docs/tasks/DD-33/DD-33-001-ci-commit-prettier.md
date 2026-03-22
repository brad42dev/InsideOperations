---
id: DD-33-001
title: Add Prettier format check to CI commit stage
unit: DD-33
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The CI commit stage must enforce Prettier formatting on the frontend codebase in addition to ESLint and TypeScript type-check. Every push should fail fast if code is not formatted, keeping the codebase consistent without developer manual intervention.

## Spec Excerpt (verbatim)

> **Commit** | Every push | Rust unit tests, frontend unit tests, `clippy`, `rustfmt`, ESLint, Prettier, TypeScript type check | < 2 minutes
> — 33_TESTING_STRATEGY.md, §CI Pipeline

## Where to Look in the Codebase

Primary files:
- `.github/workflows/ci.yml` — frontend-checks job (lines 47–71) — Prettier check needs to be added here
- `frontend/package.json` — scripts section — needs a `format:check` script or Prettier must be invoked directly

## Verification Checklist

- [ ] `frontend-checks` job in ci.yml includes a step that runs `npx prettier --check .` or equivalent
- [ ] The step fails the job if any file is not Prettier-formatted
- [ ] Prettier is listed as a devDependency in `frontend/package.json`
- [ ] A `format:check` script exists in package.json (or the CI step calls `npx prettier` directly)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: ci.yml frontend-checks job (lines 47–71) runs type check, unit tests, and lint (`pnpm lint`) but has no Prettier check step. Prettier is not listed as a devDependency in `frontend/package.json`.

## Fix Instructions (if needed)

1. Add `prettier` to devDependencies in `frontend/package.json`:
   ```json
   "prettier": "^3.x"
   ```

2. Add a `format:check` script in `frontend/package.json` scripts:
   ```json
   "format:check": "prettier --check \"src/**/*.{ts,tsx}\" \"e2e/**/*.ts\""
   ```

3. In `.github/workflows/ci.yml`, inside the `frontend-checks` job after the `lint` step, add:
   ```yaml
   - name: Format check
     run: pnpm format:check
   ```

Do NOT:
- Add a `format` (write) script to CI — CI must only check, never modify files
- Place Prettier in dependencies (it is a dev tool)
- Run Prettier on `node_modules/` or `dist/`
