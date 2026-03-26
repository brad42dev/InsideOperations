---
id: MOD-CONSOLE-043
unit: MOD-CONSOLE
title: Workspace browser fullscreen button missing from Console main toolbar
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

A fullscreen button for the workspace browser (left assets panel) should appear in the Console main toolbar. This button is completely absent.

Spec: MOD-CONSOLE-040 task title states "Add workspace browser fullscreen button to Console main toolbar."

## Acceptance Criteria

- [ ] A fullscreen/expand button appears in the Console main toolbar for the workspace browser
- [ ] Clicking the button expands the workspace browser (left panel) to fill more of the screen or enter a focused view
- [ ] The button toggles — clicking again returns to normal view

## Verification Checklist

- [ ] Navigate to /console → main console toolbar shows a workspace browser fullscreen/expand button
- [ ] Click the button → workspace browser expands
- [ ] Click again → workspace browser returns to normal layout

## Do NOT

- Do not confuse this with the per-pane fullscreen buttons (Full screen F11) — those already work
- This button is specifically for the workspace browser/left panel, not individual panes

## Dev Notes

UAT failure from 2026-03-26: Console toolbar shows AR, Export, "Open workspace in new window", Edit. No workspace browser fullscreen button present.
Screenshot: docs/uat/MOD-CONSOLE/fail-s9-s11-toolbar-missing-buttons.png
Spec reference: MOD-CONSOLE-040
