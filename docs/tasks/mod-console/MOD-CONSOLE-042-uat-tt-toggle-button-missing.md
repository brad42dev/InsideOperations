---
id: MOD-CONSOLE-042
unit: MOD-CONSOLE
title: TT toggle button missing from Console toolbar — pane title hide-all not implemented
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The Console workspace toolbar should contain a "TT" button (between AR and Export buttons) that toggles hide-all pane title bars. This button is completely absent.

Spec: MOD-CONSOLE-038 acceptance criteria states "The `TT` toggle button appears in the console toolbar between the AR and Export buttons." and "When `TT` is active, all pane title bars disappear regardless of per-pane `showTitle` setting." and "When `TT` is turned off, panes with `showTitle: true` restore their title bar."

## Acceptance Criteria

- [ ] A "TT" button appears in the Console toolbar between the AR and Export buttons
- [ ] Clicking TT hides all pane title bars (regardless of per-pane showTitle setting)
- [ ] Clicking TT again restores per-pane showTitle settings
- [ ] In live mode with no title bar, the fullscreen button appears as a hover overlay (top-right corner)

## Verification Checklist

- [ ] Navigate to /console → toolbar contains "TT" button visible between AR and Export
- [ ] Click TT → all pane title bars disappear
- [ ] Click TT again → panes with showTitle:true restore title bars
- [ ] With title bars hidden, hover over pane → fullscreen button appears as corner overlay

## Do NOT

- Do not implement only the visual button without the hide/show logic
- Do not place the button in a different position than between AR and Export

## Dev Notes

UAT failure from 2026-03-26: Console toolbar shows AR, Export, "Open workspace in new window", Edit. No "TT" button present anywhere in the toolbar in either live or edit mode.
Screenshot: docs/uat/MOD-CONSOLE/fail-s9-s11-toolbar-missing-buttons.png
Spec reference: MOD-CONSOLE-038
