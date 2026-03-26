---
id: MOD-PROCESS-025
unit: MOD-PROCESS
title: Add "Open in New Window" button to Process view toolbar
status: pending
priority: medium
depends-on: []
source: bug
bug_report: No button to spawn Process detached window for multi-monitor view
---

## What's Broken

The Process view toolbar has no button to open the current view in a detached
browser window. There is no UI affordance anywhere in the Process module to
reach `/detached/process/:viewId`. The route is fully implemented (MOD-PROCESS-016,
verified pass).

Code location: `frontend/src/pages/process/index.tsx` — view toolbar right group
(around line 1720, near the Fullscreen button).

## Expected Behavior

The view toolbar right group gains an "Open in New Window" icon button immediately
left of the Fullscreen button. Clicking it calls:

```typescript
window.open(`/detached/process/${activeViewId}`, '_blank', 'noopener,noreferrer')
```

The detached window opens using `ProcessDetachedView.tsx` (already implemented).

## Root Cause

The process spec §2.5 View Toolbar was written without a detach button in the
button list. The route was added later. Button was never added to the toolbar.
Decision file `docs/decisions/cx-detach-window-button.md` resolves the spec gap.

## Acceptance Criteria

- [ ] Icon button appears in the view toolbar right group when a view is loaded
- [ ] Button is hidden in kiosk mode (`isKiosk === true`)
- [ ] Clicking the button opens `/detached/process/:viewId` in a new window
- [ ] Button uses the external-link SVG icon with tooltip "Open view in new window"
- [ ] Button is positioned immediately left of the Fullscreen button
- [ ] Uses the existing `toolbarBtnStyle` constant for visual consistency

## Verification

- Load any Process view
- Confirm the new icon button appears in the toolbar left of the Fullscreen button
- Click it — a new browser window opens at `/detached/process/<id>`
- Confirm the detached window renders with the minimal shell from ProcessDetachedView
- Enter kiosk mode → button absent from toolbar
- No view loaded (empty state) → button absent

## Spec Reference

Decision file: `docs/decisions/cx-detach-window-button.md`
Design doc: `design-docs/08_PROCESS_MODULE.md`
Spec: `spec_docs/process-implementation-spec.md` §2.5, §11

## Do NOT

- Create a new detached view component — `ProcessDetachedView.tsx` already exists
  and is wired in App.tsx
- Gate on any permission beyond module read access
- Open in a same-tab navigate
