---
id: DD-13-027
unit: DD-13
title: Browser crashes when navigating to /log/new
status: pending
priority: high
depends-on: []
source: uat
uat_session: /home/io/io-dev/io/docs/uat/dd-13/CURRENT.md
---

## What to Build

The Playwright browser closes unexpectedly when navigating to http://localhost:5173/log/new during automated UAT testing. The error message is: "Target page, context or browser has been closed".

This issue prevents the UAT script from accessing the LogEditor component, which is required to test DD-13-020 (font-family selector in WYSIWYG editor).

## Acceptance Criteria

- [ ] Navigating to /log/new does not crash the browser
- [ ] Page loads successfully at /log/new route
- [ ] LogNew component renders without throwing errors
- [ ] No uncaught exceptions in browser console

## Verification Checklist

- [ ] Navigate to /log/new in browser (or via curl for non-browser testing)
- [ ] Page loads without error
- [ ] Check browser console for JavaScript errors
- [ ] Verify the page is stable and responsive

## Do NOT

- Do not assume this is a Playwright issue — reproduce locally in a standard browser first
- Do not return an error page — the route should load successfully

## Dev Notes

UAT failure from 2026-03-26: Browser closed during navigation to /log/new

Error context:
- Occurred during automated Playwright testing
- Previous page (/log templates list) was stable and loading correctly
- Page had successfully navigated to /log multiple times without crashing
- The crash occurred specifically when navigating to /log/new after template save attempt

This may be related to:
1. A React error during LogNew component mount
2. An uncaught exception in the page load logic
3. A WebSocket connection issue
4. Missing or corrupted application state

Check browser console logs, React error boundaries, and backend connection errors.
