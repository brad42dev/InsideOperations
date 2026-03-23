---
id: MOD-CONSOLE-014
unit: MOD-CONSOLE
title: Console module fails to load due to dynamic import error
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

UAT Scenario [MOD-CONSOLE-001]: Navigating to /console results in a dynamic import error for 'src/pages/console/index.tsx'. The module code-splitting / lazy loading is broken — the chunk either doesn't exist, has a build configuration issue, or the import path is incorrect. The entire Console module is inaccessible as a result.

## Acceptance Criteria

- [ ] Navigating to /console loads the Console module without errors
- [ ] Workspace list is visible (or empty state shown)
- [ ] No dynamic import error in the browser

## Verification Checklist

- [ ] Run pnpm build and confirm no build errors for console chunk
- [ ] Navigate to /console — module loads without 'Failed to fetch dynamically imported module' error
- [ ] Workspace list renders or empty state shows

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: /console shows dynamic import error for src/pages/console/index.tsx. The lazy import path or chunk configuration is broken. Spec reference: MOD-CONSOLE-001
