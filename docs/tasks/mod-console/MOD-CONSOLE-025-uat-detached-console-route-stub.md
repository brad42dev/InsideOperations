---
id: MOD-CONSOLE-025
unit: MOD-CONSOLE
title: Detached console route /detached/console/:id is a Phase 7 stub
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The route `/detached/console/:workspaceId` renders only a placeholder stub: "Workspace ID: — live multi-pane view (Phase 7)". This must be replaced with a real `DetachedConsolePage` that shows the workspace in a minimal shell.

The spec (console-implementation-spec.md §12) requires:
- Route `/detached/console/:workspaceId` renders `DetachedConsolePage`
- Minimal shell: thin title bar (workspace name, connection status dot, clock)
- No sidebar navigation, no module switcher, no left nav panel
- Loads workspace config from `GET /api/workspaces/:id` via React Query
- Renders `WorkspaceGrid` in read-only mode (`editMode={false}`)
- SharedWorker WebSocket connection is reused (no new WebSocket created)
- "Open in New Window" in the pane context menu calls `window.open('/detached/console/:workspaceId', '_blank', 'noopener')`

## Acceptance Criteria

- [ ] Navigating to `/detached/console/{valid-id}` renders a minimal workspace view (not "Phase 7")
- [ ] Minimal shell shows workspace name and connection status
- [ ] No sidebar, no module switcher, no left nav panel visible
- [ ] Panes render in the detached window (read-only, no edit controls)
- [ ] Navigating to `/detached/console/nonexistent-id` shows workspace-not-found state (not a crash)

## Verification Checklist

- [ ] Navigate to /detached/console/test-id → no "Phase 7" text; shows minimal shell or workspace-not-found
- [ ] Right-click pane → "Open in New Window" → opens /detached/console/:id in new tab/window
- [ ] Detached window has no sidebar navigation visible

## Do NOT

- Do not leave the Phase 7 stub — it must render a real implementation
- Do not show the full AppShell in detached mode — it must be minimal

## Dev Notes

UAT failure from 2026-03-25: /detached/console/test-id renders "Workspace ID: — live multi-pane view (Phase 7)". Phase 7 development stub.
Screenshot: docs/uat/MOD-CONSOLE/scenario9-detached-stub.png
Spec reference: MOD-CONSOLE-002
