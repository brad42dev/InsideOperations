---
id: CX-DETACH-WINDOW-BUTTON
title: Detached window spawn buttons for Console, Process, and Dashboard modules
status: decided
contract: CX-DETACH-WINDOW-BUTTON
decided: 2026-03-26
---

## What Was Decided

Console, Process, and Dashboard modules each need a toolbar-level button that
opens the current content in a detached browser window (`window.open()`). All
three modules have working `/detached/*` routes but zero UI affordance to reach
them. Reports was evaluated and excluded — it is an async PDF generator, not a
real-time display module, and was not included in the doc 06 multi-window
architecture.

## Inventory (What Exists Today)

| Module | Route | Button | Gap |
|--------|-------|--------|-----|
| Console (workspace) | `/detached/console/:workspaceId` ✅ | ❌ No workspace-level button | Pane right-click "Open in New Window" exists (MOD-CONSOLE-018) but no toolbar button for the whole workspace |
| Process | `/detached/process/:viewId` ✅ | ❌ Not in §2.5 View Toolbar | No trigger anywhere |
| Dashboard | `/detached/dashboard/:dashboardId` ✅ | ❌ Not in DashboardViewer toolbar | Route passes `kiosk` prop to DashboardViewer — correct behaviour |
| Reports | No route | N/A | Not specced; out of scope |

## Questions and Answers

**Q1**: Should all three modules get a dedicated "Open in New Window" toolbar button?
**A**: Yes — Console, Process, and Dashboard all get one. Reports does not.

**Q2**: Where does the Console button go?
**A**: In the main Console workspace toolbar (console/index.tsx right-side controls), immediately to the left of the Edit button, visible only when a workspace is active. Same visibility condition as the AR toggle and the new fullscreen button (MOD-CONSOLE-040). Gated on `console:read` (the workspace is already loaded — no extra permission needed to pop it out).

**Q3**: Where does the Process button go?
**A**: Right group of the view toolbar (process/index.tsx §2.5), immediately to the left of the Fullscreen button. Visible whenever a view is loaded. No separate permission gate (already gated by `process:read` entry to the module).

**Q4**: Where does the Dashboard button go?
**A**: In the DashboardViewer toolbar right group (dashboards/DashboardViewer.tsx), after the Kiosk button, hidden when already in kiosk mode (`!isKiosk`). No separate permission gate.

**Q5**: What does clicking the button do?
**A**: All three call `window.open('<detached-route>', '_blank', 'noopener,noreferrer')`. No extra window sizing hints — browser decides placement. The browser's popup blocker may intercept this if not triggered from a direct user click; no workaround needed — browser will show its native "pop-up blocked" indicator.

**Q6**: Should the button be hidden if the user is already in a detached window?
**A**: Yes — all three detached views render without the main app toolbar, so the button naturally disappears. No additional logic needed.

**Q7**: Is the button gated on any permission beyond module read access?
**A**: No. Opening a detached window is equivalent to opening a new browser tab to the same content. No elevated permission.

## Resulting Specification

### Console — Workspace Toolbar Detach Button

- **Location**: console/index.tsx toolbar right-side controls, between the AR toggle group and the Edit button.
- **Visibility**: Same condition as Edit button — `activeWorkspace` is non-null.
- **Icon**: External link / new window icon (two overlapping squares with arrow, 13×13px SVG). Tooltip: "Open workspace in new window".
- **Action**: `window.open('/detached/console/' + activeWorkspace.id, '_blank', 'noopener,noreferrer')`
- **Kiosk**: Not rendered in kiosk mode (consistent with all other toolbar buttons that hide in kiosk).

### Process — View Toolbar Detach Button

- **Location**: process/index.tsx view toolbar right group, immediately left of the Fullscreen button.
- **Visibility**: Always visible when a view is loaded (`activeViewId` non-null). Hidden when `isKiosk`.
- **Icon**: Same external link SVG as Console. Tooltip: "Open view in new window".
- **Action**: `window.open('/detached/process/' + activeViewId, '_blank', 'noopener,noreferrer')`

### Dashboard — Viewer Toolbar Detach Button

- **Location**: dashboards/DashboardViewer.tsx toolbar right group, after the Kiosk button.
- **Visibility**: Hidden when `isKiosk` (already in detached/kiosk mode — redundant).
- **Icon**: Same external link SVG. Tooltip: "Open dashboard in new window".
- **Action**: `window.open('/detached/dashboard/' + id, '_blank', 'noopener,noreferrer')`
- **Note**: The `/detached/dashboard/:id` route passes `kiosk` prop to DashboardViewer — the detached window renders in kiosk mode by default (no toolbar chrome). This is correct per design-docs/10.

### Icon — Shared SVG

All three modules use the same inline SVG for the "open in new window" icon:

```tsx
<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" strokeWidth="2">
  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  <polyline points="15 3 21 3 21 9" />
  <line x1="10" y1="14" x2="21" y2="3" />
</svg>
```

## Explicitly Out of Scope

- Reports module — no detached window, no button.
- Window Groups management UI (doc 06) — separate, higher-level feature.
- Changing the detached shell layouts — those are handled by existing tasks.
- Adding popup-blocked detection/fallback banner — this is covered by DD-06-012.

## Open Questions

None — all questions resolved.
