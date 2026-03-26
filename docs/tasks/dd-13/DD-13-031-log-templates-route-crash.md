---
id: DD-13-031
unit: DD-13
title: /log/templates direct route crashes browser after fix attempt
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Navigating directly to `http://localhost:5173/log/templates` crashes the Playwright browser (and presumably a real browser) with "Target page, context or browser has been closed". This happens every time without exception.

Note: The Templates *tab* on `/log` works correctly — 6 template rows appear when the tab is clicked. The crash is specific to the `/log/templates` route. This means LogTemplates.tsx renders fine as a tab but fails catastrophically as a standalone route.

Root cause to investigate:
1. A React error boundary is missing or misfiring on the `/log/templates` route
2. The route component mounts something that throws synchronously on the first render
3. A missing dependency or bad import that only executes on direct route mount

## Acceptance Criteria

- [ ] Navigate directly to /log/templates — page loads without crash
- [ ] Template rows visible at /log/templates (same 6 rows visible in the tab view)
- [ ] No uncaught JavaScript errors in browser console during navigation
- [ ] Error boundaries catch any render errors instead of crashing the page

## Verification Checklist

- [ ] Open browser, navigate directly to http://localhost:5173/log/templates (not via tab click)
- [ ] Page loads and shows template rows — no blank page, no "Something went wrong", no crash
- [ ] Check browser console for JS errors during navigation
- [ ] Navigate from /log/templates → /log/new — confirms no crash cascade

## Do NOT

- Do not remove the /log/templates route — it must work as a standalone route
- Do not just wrap in a try/catch — find and fix the root crash

## Dev Notes

UAT failure 2026-03-26: Every direct navigation to /log/templates closes the browser.
Templates tab from /log works fine (6 rows shown — DD-13-029 fix is partially effective).
After /log/templates crash, subsequent /log/new navigations also fail, triggering crash_streak=3 and blocking Scenarios 6-9.
Screenshot: docs/uat/DD-13/dd13-s4-templates-route-crash.png
