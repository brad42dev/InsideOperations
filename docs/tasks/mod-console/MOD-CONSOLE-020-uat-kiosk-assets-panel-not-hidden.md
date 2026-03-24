---
id: MOD-CONSOLE-020
unit: MOD-CONSOLE
title: Kiosk mode does not hide Console ASSETS/left panel
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

When navigating to /console?kiosk=true, the global app navigation and header are correctly hidden. However, the Console module's own ASSETS panel (left panel showing Workspaces, Graphics, Widgets, Points tabs) remains fully visible.

In kiosk mode, the intent is a clean full-screen display for control room monitors. The ASSETS panel is operational UI chrome that should be hidden, leaving only the workspace pane content, playback bar, and status bar visible.

## Acceptance Criteria

- [ ] /console?kiosk=true hides the Console ASSETS/left panel (Workspaces, Graphics, Widgets, Points)
- [ ] The workspace pane content fills the available screen space
- [ ] Playback bar and status bar may remain (they are operational, not chrome)

## Verification Checklist

- [ ] Navigate to /console?kiosk=true → ASSETS panel not visible in snapshot (no "Workspaces", "Graphics", "Widgets", "Points" tab buttons)
- [ ] Navigate to /console (no param) → ASSETS panel visible normally
- [ ] The pane content area expands to fill the space left by the hidden ASSETS panel

## Do NOT

- Do not break the existing global nav hiding (complementary sidebar + header already correctly hidden)
- Do not hide the playback bar or status bar — those are operational controls

## Dev Notes

UAT failure from 2026-03-24: /console?kiosk=true correctly hid the global navigation (complementary sidebar, header with search/alerts/admin) but the Console module's ASSETS panel remained visible. Screenshot: docs/uat/MOD-CONSOLE/kiosk-mode-working.png
Spec reference: MOD-CONSOLE-017 (Console kiosk mode URL parameter not activating kiosk UI), MOD-CONSOLE-009 (kiosk-mode-and-permission-aware-cta)
