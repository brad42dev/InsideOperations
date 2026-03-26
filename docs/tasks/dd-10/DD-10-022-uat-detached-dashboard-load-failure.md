---
id: DD-10-022
unit: DD-10
title: Detached dashboard view shows "Failed to load dashboard" when opened via "Open in New Window"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The "Open dashboard in new window" button in the dashboard viewer toolbar opens a new browser tab at
`/detached/dashboard/{id}` (e.g., `/detached/dashboard/a32a17b2-de8d-4a80-a520-f272962eb968`).

That new tab renders a full-screen error: **"Failed to load dashboard"** (red text) with a "Back to
Dashboards" button — no dashboard content is shown at all.

The correct behavior is that `/detached/dashboard/{id}` should render the dashboard in a stripped-down
"detached" view (no sidebar nav, no main app chrome) — just the dashboard widgets and their toolbar —
so the operator can display it on a secondary monitor or in a separate window.

The button itself and the tab-opening logic work correctly. The problem is that the detached route
fails to load the dashboard data or fails to initialize the widget rendering context.

## Acceptance Criteria

- [ ] Clicking "Open dashboard in new window" opens a tab that renders the dashboard content (widgets
      visible, not an error boundary)
- [ ] The `/detached/dashboard/{id}` route loads the same dashboard data as the main viewer route
- [ ] The detached view renders without the main app sidebar/nav (appropriate for secondary window use)
- [ ] No "Failed to load dashboard" error when accessing a valid dashboard ID

## Verification Checklist

- [ ] Navigate to /dashboards, open "Operations Overview", click "Open dashboard in new window"
- [ ] New tab at /detached/dashboard/{id} shows dashboard widgets — not "Failed to load dashboard"
- [ ] The detached view has no sidebar nav (stripped chrome appropriate for new-window display)
- [ ] Check browser console in the detached tab: no unhandled fetch errors or missing auth tokens

## Do NOT

- Do not stub this with a TODO comment
- Do not silently catch the load error and show a blank page — show the dashboard

## Dev Notes

UAT failure from 2026-03-26: Navigated to /dashboards, opened "Operations Overview" dashboard,
clicked "Open dashboard in new window" (button correctly labeled and functional). New tab opened at
`http://localhost:5173/detached/dashboard/a32a17b2-de8d-4a80-a520-f272962eb968`. Tab showed only:
"Failed to load dashboard" (red text) + "Back to Dashboards" button. Screenshot: dd-10-021-detached-fail.png.
Spec reference: DD-10-021 (Add "Open in New Window" button to Dashboard viewer toolbar)
