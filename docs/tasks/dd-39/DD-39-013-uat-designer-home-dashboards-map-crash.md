---
id: DD-39-013
unit: DD-39
title: Designer home page crashes with "dashboards.map is not a function" error boundary
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-39/CURRENT.md
---

## What to Build

The Designer home page (/designer) renders an error boundary with the message "Designer failed to load — dashboards.map is not a function or its return value is not iterable".

This occurs because the /api/dashboards endpoint sometimes returns a non-array response (e.g., a 429 Too Many Requests error object or null), and the DesignerHome component calls `.map()` on the result without validating that it is actually an iterable array.

The fix requires the Designer home component to:
1. Handle non-200 responses from /api/dashboards gracefully (treat as empty array or show error state)
2. Guard against non-array values before calling `.map()` — e.g., `(Array.isArray(dashboards) ? dashboards : []).map(...)`
3. Show a user-friendly empty/error state instead of crashing the entire page

The /designer/symbols sub-route works correctly and is unaffected.

## Acceptance Criteria

- [ ] Navigating to /designer renders the Designer home page without error boundary
- [ ] If /api/dashboards is slow or returns an error, the page shows a loading or empty state instead of crashing
- [ ] dashboards.map (or equivalent) is guarded: only called when value is a valid array
- [ ] The Symbol Library button and other Designer home controls remain accessible

## Verification Checklist

- [ ] Navigate to /designer — page loads without "Designer failed to load" error boundary
- [ ] Reload /designer multiple times — no crashes observed
- [ ] If rate-limiting occurs on /api/dashboards, page degrades gracefully (empty list or error message), not crash
- [ ] Click "Symbol Library" from /designer home → navigates to /designer/symbols

## Do NOT

- Do not stub this with a TODO comment
- Do not suppress the error silently — show appropriate empty/error state to the user

## Dev Notes

UAT failure from 2026-03-24: /designer home page consistently showed error boundary "dashboards.map is not a function or its return value is not iterable". Browser console showed 429 Too Many Requests on /api/dashboards. The component does not guard the .map() call against non-array values returned when the API fails.
Spec reference: DD-39-001 through DD-39-008 (iographic format tasks), GFX-DISPLAY, MOD-DESIGNER
Screenshot: docs/uat/DD-39/designer-error-boundary.png
