---
id: MOD-CONSOLE-028
unit: MOD-CONSOLE
title: Detached console route /detached/console/:id still renders Phase 7 stub
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Navigating to /detached/console/test-id renders a Phase 7 development stub: "Workspace ID: — live multi-pane view (Phase 7)". This route must render a real minimal workspace shell (or a workspace-not-found state for invalid IDs), with no sidebar, no module switcher, no left nav.

## Acceptance Criteria

- [ ] /detached/console/{valid-id} renders a minimal workspace view — NOT "Phase 7" stub text
- [ ] Minimal shell shows workspace name and connection status dot
- [ ] No sidebar, no module switcher, no left nav visible in detached view
- [ ] /detached/console/nonexistent-id shows workspace-not-found state (not a crash)
- [ ] Panes render read-only (no edit controls, no "Edit" button)

## Verification Checklist

- [ ] Navigate to /detached/console/test-id → no "Phase 7" text visible
- [ ] Page shows workspace name in thin title bar or workspace-not-found message
- [ ] No sidebar navigation present
- [ ] Right-click on a pane in regular console → "Pop Out Window" opens /detached/console/:id

## Do NOT

- Do not leave the Phase 7 stub — any path through this route must render real UI
- Do not show the full AppShell (sidebar, top nav) in detached mode

## Dev Notes

UAT failure from 2026-03-26: /detached/console/test-id renders "Workspace" heading + "Workspace ID: — live multi-pane view (Phase 7)" paragraph. Pure stub.
Screenshot: docs/uat/MOD-CONSOLE/scenario10-detached-phase7-stub.png
Spec reference: MOD-CONSOLE-025, MOD-CONSOLE-002
