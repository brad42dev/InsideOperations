---
id: DD-33-007
title: Implement real E2E critical path tests and integrate axe-core accessibility audits
unit: DD-33
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The eight E2E spec files must implement the actual critical path workflows described in the spec (not just URL navigation checks). Additionally, axe-core must be integrated into the Playwright tests so every critical path test runs an accessibility audit on the page it exercises. An extended nightly E2E suite must be separated from the critical-path PR suite.

## Spec Excerpt (verbatim)

> **Critical path tests (run on every PR):**
> 1. Login → Console → Live Data: Login → navigate to Console → open workspace → verify point values update via WebSocket
> 2. Designer → Console Pipeline: Import SVG → bind points → save graphic → open in Console → verify dynamic elements render
> 3. Rounds Workflow: Create template → generate instance → complete round on mobile viewport (375px) → verify 60px touch targets → submit
> ...
>
> **Automated (axe-core in Playwright tests):**
> - Run axe-core accessibility audit on every page/route during E2E tests
> - Zero violations policy for WCAG 2.1 Level A
> — 33_TESTING_STRATEGY.md, §E2E Tests + §Accessibility Testing

## Where to Look in the Codebase

Primary files:
- `frontend/e2e/01-login-console.spec.ts` — has 3 tests; only URL/visibility checks; missing WebSocket live data verification
- `frontend/e2e/03-rounds-workflow.spec.ts` — has 2 tests; only navigates to `/rounds` and checks for tab; missing create/complete/submit workflow
- `frontend/e2e/06-forensics.spec.ts` — 1 test: navigates to `/forensics`, checks URL. Nothing else.
- `frontend/e2e/08-emergency-alert.spec.ts` — 1 test: navigates to `/alerts`, checks URL. Nothing else.
- `frontend/e2e/04-alarms.spec.ts` — 1 test: navigates to `/settings/alarm-definitions`, checks URL. Nothing else.
- `frontend/package.json` — no `@axe-core/playwright` devDependency
- `frontend/playwright.config.ts` — no Firefox/WebKit projects; workers:1 in CI

## Verification Checklist

- [ ] `@axe-core/playwright` is in `frontend/package.json` devDependencies
- [ ] Every E2E spec file imports and calls `checkA11y` (or equivalent axe API) after page load
- [ ] `e2e/01-login-console.spec.ts` verifies WebSocket point values update (not just page navigation)
- [ ] `e2e/03-rounds-workflow.spec.ts` exercises create template → generate instance → fill readings → submit at 375px viewport
- [ ] `e2e/03-rounds-workflow.spec.ts` verifies 60px touch targets exist on the rounds form
- [ ] `e2e/04-alarms.spec.ts` configures an alarm threshold, injects a point value above threshold, verifies alarm fires in the UI
- [ ] `e2e/06-forensics.spec.ts` selects 3+ points, sets time range, runs correlation, verifies chart renders
- [ ] `e2e/08-emergency-alert.spec.ts` sends an alert, verifies overlay appears in Console, acknowledges it
- [ ] A separate `e2e/extended/` directory or file tag separates nightly-only tests from PR critical paths

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: All 8 spec files are stub-level. Five files have only 1 test that navigates to a URL and checks it in the browser history. `@axe-core/playwright` is not installed. No extended nightly suite separation exists.

## Fix Instructions (if needed)

### 1. Install axe-core

In `frontend/package.json` devDependencies:
```json
"@axe-core/playwright": "^4.x"
```

### 2. Create an axe helper

Create `frontend/e2e/helpers/accessibility.ts`:
```typescript
import { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export async function checkA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a'])
    .analyze()
  // Filter known false positives here if needed
  return results.violations
}
```

### 3. Implement real critical path for 01-login-console.spec.ts

Replace the stub test body with:
- Login as admin
- Navigate to `/console`
- Open or create a workspace
- Wait for WebSocket to connect (check for a visible point value element, or intercept WS traffic)
- Assert that at least one dynamic element shows a numeric value (not placeholder)
- Run `checkA11y(page)` and assert `violations.length === 0`

### 4. Implement real critical path for 03-rounds-workflow.spec.ts

- Set viewport to 375px width
- Login as operator
- Navigate to `/rounds`
- Create a round template (fill name, add an equipment check item)
- Generate an instance from the template
- Fill readings (tap number input, type value) — verify the touch targets are ≥60px using `page.evaluate`
- Submit the round
- Navigate to history tab and verify the completed round appears

### 5. Implement real critical path for 06-forensics.spec.ts

- Navigate to `/forensics`
- Select 3 points from a point picker
- Set a 24-hour time range
- Click "Run Correlation"
- Wait for the chart to render (non-empty canvas or SVG)
- Assert correlation matrix values are numeric

### 6. Implement real critical path for 08-emergency-alert.spec.ts

- Open two page contexts (or use two browser pages)
- In context A: navigate to `/alerts`, compose and send an emergency alert to "All Users"
- In context B: verify the alert overlay/banner appears
- Acknowledge the alert in context B
- Verify the alert status changes to acknowledged

### 7. Separate extended nightly tests

Tag nightly-only tests with `@nightly`:
```typescript
test('Full CRUD for workspaces @nightly', ...)
```

In `playwright.config.ts`, add a `testIgnore` or separate `projects` that filter by tag for CI vs. nightly runs.

Do NOT:
- Leave any test that only checks `toHaveURL` as a "critical path" test — URL checks belong in smoke tests, not critical paths
- Skip axe checks on forms — form accessibility is a frequent failure point
- Run extended tests in the PR CI job — they are nightly only
