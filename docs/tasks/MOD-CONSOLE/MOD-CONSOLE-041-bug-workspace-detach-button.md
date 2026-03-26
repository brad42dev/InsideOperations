---
id: MOD-CONSOLE-041
unit: MOD-CONSOLE
title: Add "Open in New Window" button to Console workspace toolbar
status: pending
priority: medium
depends-on: []
source: bug
bug_report: No button to spawn Console detached window for multi-monitor view
---

## What's Broken

The Console workspace toolbar has no button to open the current workspace in a
detached browser window. Operators with multi-monitor setups cannot use the
`/detached/console/:workspaceId` route without manually constructing the URL.

Per-pane "Open in New Window" exists in the pane right-click context menu
(MOD-CONSOLE-018), but there is no workspace-level trigger. The route is fully
implemented and working.

Code location: `frontend/src/pages/console/index.tsx` — workspace toolbar right-
side controls (around line 1537, near the Edit button).

## Expected Behavior

When a workspace is active, the toolbar shows an "Open in New Window" icon button
(external link icon) to the left of the Edit button. Clicking it calls:

```typescript
window.open(`/detached/console/${activeWorkspace.id}`, '_blank', 'noopener,noreferrer')
```

The detached window opens in a new browser window with the minimal shell already
implemented in `WorkspaceView.tsx` (detached render path).

## Root Cause

Button was never added to the toolbar. The detached route and WorkspaceView
detached render path were implemented (MOD-CONSOLE-025/031), but no toolbar
trigger was created.

## Acceptance Criteria

- [ ] Icon button appears in the workspace toolbar when `activeWorkspace` is non-null
- [ ] Button is hidden when no workspace is active
- [ ] Button is hidden in kiosk mode (consistent with other toolbar buttons)
- [ ] Clicking the button opens `/detached/console/:workspaceId` in a new window
- [ ] Button uses the external-link SVG icon with tooltip "Open workspace in new window"
- [ ] Button is positioned immediately left of the Edit button

## Verification

- Load any Console workspace
- Confirm the new icon button appears in the toolbar to the left of Edit
- Click it — a new browser window opens at `/detached/console/<id>`
- Confirm the detached window shows the workspace with minimal shell (no sidebar,
  no module switcher, no left nav panel)
- Confirm no workspace loaded → button absent from toolbar
- Confirm kiosk mode → button absent

## Spec Reference

Decision file: `docs/decisions/cx-detach-window-button.md`
Design doc: `design-docs/07_CONSOLE_MODULE.md` §Detached Window Support
Spec: `spec_docs/console-implementation-spec.md` §12

## Do NOT

- Add a second button for the same per-pane detach that already exists in
  PaneWrapper right-click menu — this button is workspace-level only
- Gate on any permission beyond what is already required to view the workspace
- Open in a same-tab navigate — must be `window.open` to a new window
