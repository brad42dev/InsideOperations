---
id: MOD-CONSOLE-015
unit: MOD-CONSOLE
title: Console module crashes with TypeError reading 'reduce' on workspaces selector
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The Console module crashes immediately on load with: "Cannot read properties of undefined (reading 'reduce')". The error is thrown in the ConsolePage component when accessing workspace data via a selector or store that returns undefined before data is loaded.

This differs from MOD-CONSOLE-014 (which describes a "dynamic import error"). The current crash is a runtime TypeError at the selector/store level, likely because `useWorkspaces()` or similar hook returns undefined instead of an empty array as its initial value.

## Acceptance Criteria

- [ ] Navigating to /console no longer shows the error boundary
- [ ] Console module renders (at minimum an empty state or loading skeleton)
- [ ] All selectors/hooks that access workspace arrays must default to [] not undefined

## Verification Checklist

- [ ] Navigate to /console → module loads without "Console failed to load" error boundary
- [ ] DevTools shows no TypeError: Cannot read properties of undefined (reading 'reduce')
- [ ] Empty workspace state shows "Create Workspace" CTA

## Do NOT

- Do not stub this with a TODO comment
- Do not suppress the error without fixing the root cause

## Dev Notes

UAT failure 2026-03-23: Console crashes immediately with TypeError: Cannot read properties of undefined (reading 'reduce') in chunk-EMBGZOEE.js. Error boundary catches it and shows "Reload Console". The ConsolePage likely calls .reduce() on a workspaces selector that returns undefined rather than [].
