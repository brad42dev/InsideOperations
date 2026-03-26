---
id: DD-10-021
unit: DD-10
title: Add "Open in New Window" button to Dashboard viewer toolbar
status: pending
priority: medium
depends-on: []
source: bug
bug_report: No button to spawn Dashboard detached window for multi-monitor view
---

## What's Broken

The DashboardViewer toolbar has no button to open the current dashboard in a
detached browser window. The `/detached/dashboard/:dashboardId` route exists in
App.tsx and correctly renders `<DashboardViewer kiosk />`. There is no UI button
to reach it.

Code location: `frontend/src/pages/dashboards/DashboardViewer.tsx` — toolbar
right group (around line 367, the `display: flex, gap: 8px` div containing the
Variables, Edit, Duplicate, and Kiosk buttons).

## Expected Behavior

The DashboardViewer toolbar right group gains an "Open in New Window" icon button
after the Kiosk toggle button. Clicking it calls:

```typescript
window.open(`/detached/dashboard/${id}`, '_blank', 'noopener,noreferrer')
```

The detached window renders the dashboard in kiosk mode (no toolbar chrome) per
the existing App.tsx route definition.

## Root Cause

The `/detached/dashboard/:dashboardId` route was added to App.tsx but no trigger
button was added to DashboardViewer. Design-docs/10 §Detached Window Support
specifies the feature; the button placement was not resolved until decision file
`docs/decisions/cx-detach-window-button.md`.

## Acceptance Criteria

- [ ] Icon button appears in the DashboardViewer toolbar right group after the Kiosk button
- [ ] Button is hidden when `isKiosk` is true (no toolbar visible in kiosk mode anyway)
- [ ] Clicking the button opens `/detached/dashboard/:dashboardId` in a new window
- [ ] Button uses the external-link SVG icon with tooltip "Open dashboard in new window"
- [ ] The detached window renders the dashboard in kiosk mode (no toolbar) as currently implemented

## Verification

- Open any dashboard in the DashboardViewer
- Confirm the new icon button appears after the Kiosk button in the toolbar
- Click it — a new browser window opens at `/detached/dashboard/<id>`
- Confirm the detached window shows the dashboard without the toolbar (kiosk mode)
- Toggle kiosk on the main viewer → the toolbar (and therefore the button) is hidden
  via the existing kiosk strip behaviour — this is correct

## Spec Reference

Decision file: `docs/decisions/cx-detach-window-button.md`
Design doc: `design-docs/10_DASHBOARDS_MODULE.md` §Detached Window Support
Shell spec: `design-docs/06_FRONTEND_SHELL.md` §Multi-Window Architecture

## Do NOT

- Change the `/detached/dashboard/:dashboardId` App.tsx route — it already passes
  `kiosk` correctly
- Add a fullscreen button or any other feature to the detached view as part of
  this task — scope is the button only
- Gate on any permission beyond `dashboards:read`
