---
id: MOD-CONSOLE-031
unit: MOD-CONSOLE
title: Detached console route /detached/console/:id still renders Phase 7 stub
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Navigating to `/detached/console/test-id` renders the text "Workspace ID: — live multi-pane view (Phase 7)" — a development stub placeholder. This was supposed to be fixed by MOD-CONSOLE-025 and MOD-CONSOLE-028 (both marked `verified`), but UAT confirms the route is still a stub.

The route should render a minimal workspace shell:
- Thin title bar showing workspace name + connection status dot
- No sidebar, no module switcher, no left nav panel
- Panes rendered read-only (no Edit controls)
- For an invalid/missing workspace ID: show a workspace-not-found state (not a crash)

## Acceptance Criteria

- [ ] /detached/console/{any-id} does NOT show "Phase 7" text
- [ ] Route renders a DetachedConsolePage component — minimal shell (thin title bar only, no sidebar)
- [ ] Workspace name is visible in the title bar
- [ ] No sidebar, no module switcher, no left nav accordion sections visible
- [ ] /detached/console/nonexistent-id shows workspace-not-found state gracefully (not a crash, not "Phase 7")
- [ ] Panes render read-only (no Edit button visible in detached view)

## Verification Checklist

- [ ] Navigate to /detached/console/test-id → page does NOT contain "Phase 7" text
- [ ] Page shows a thin title bar (not a full app shell)
- [ ] No sidebar nav, no left nav, no module icons visible
- [ ] Navigate to /detached/console/nonexistent → workspace-not-found message shown

## Do NOT

- Do not leave the Phase 7 stub connected to the route
- Do not render the full Console app shell (sidebar, left nav) in the detached view

## Dev Notes

UAT failure from 2026-03-26: /detached/console/test-id renders heading "Workspace" with body text "Workspace ID: — live multi-pane view (Phase 7)". This is the original stub; neither MOD-CONSOLE-025 nor MOD-CONSOLE-028 fixes reached the route in the running build. Screenshot: docs/uat/MOD-CONSOLE/fail-s9-s10-detached-phase7-stub.png
Spec reference: MOD-CONSOLE-025-uat-detached-console-route-stub.md, MOD-CONSOLE-028-uat-detached-console-still-phase7-stub.md, MOD-CONSOLE-002-detached-window-support.md
