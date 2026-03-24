---
id: MOD-PROCESS-010
unit: MOD-PROCESS
title: React Query graphic data returns undefined instead of null on graphic load
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-PROCESS/CURRENT.md
---

## What to Build

On initial load of the Process module and on every graphic selection, the browser console emits:

```
Query data cannot be undefined. Please make sure to return a value other than undefined
from your query function. Affected query key: ["graphic","<uuid>"]
```

This is a React Query contract violation. The `useQuery` hook for the `["graphic", <id>]` query key has a query function that returns `undefined` (instead of `null`) when the graphic data is not yet available or not found. React Query requires query functions to never return `undefined` — they must return a value (e.g. `null`) or throw.

The bug fires once on page load (for the default/last selected graphic) and once each time the user clicks a different graphic in the sidebar Views list.

## Acceptance Criteria

- [ ] The query function for `["graphic", <uuid>]` never returns `undefined`
- [ ] Navigating to /process and selecting any graphic from the sidebar produces zero `Query data cannot be undefined` console errors
- [ ] The Process module continues to render correctly (no regression)

## Verification Checklist

- [ ] Navigate to /process, open browser DevTools console — confirm zero `Query data cannot be undefined` errors on load
- [ ] Click 3 different graphics in the sidebar Views list — confirm zero `Query data cannot be undefined` errors on each selection
- [ ] No error boundary ("Something went wrong") appears after the fix

## Do NOT

- Do not stub this with a TODO comment
- Do not suppress the error by wrapping in try/catch without fixing the root cause
- Do not change React Query library behavior — fix the query function return value

## Dev Notes

UAT failure from 2026-03-24: Console error `Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ["graphic","2e1cf01e-501e-4efa-814a-234bbf524007"]` observed on initial load and on graphic selection.

Spec reference: MOD-PROCESS-002 (Pre-build spatial binding index on graphic load)

Fix: locate the React Query `queryFn` for key `["graphic", id]` in the Process module frontend code and ensure it returns `null` (not `undefined`) when the graphic cannot be fetched (e.g. 404 response or empty result).
