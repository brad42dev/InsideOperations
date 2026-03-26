---
id: MOD-CONSOLE-023
unit: MOD-CONSOLE
title: View-mode selector buttons missing from left nav section headers
status: pending
priority: medium
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Each accordion section in the left nav panel (Workspaces, Graphics, Widgets, Points) must have three view-mode icon buttons at the top-right of the section header: List, Thumbnails, and Grid. Currently, no such buttons exist — the section header shows only the section title and a collapse chevron.

The spec (console-implementation-spec.md §2.3) requires:
- **List**: Names only, compact vertical list, maximum density
- **Thumbnails + Name**: Preview thumbnail (48×36px) with up to 2 lines of name text
- **Grid/Palette**: Thumbnail grid (80×60px) with single-line name below
- Each section remembers its last chosen view mode (persisted in user preferences)

## Acceptance Criteria

- [ ] Workspaces section header has three view-mode icon buttons (List / Thumbnails / Grid)
- [ ] Clicking "List" switches Workspaces items to list view (name only, compact)
- [ ] Clicking "Thumbnails" switches to thumbnail + name view (48×36px previews)
- [ ] Clicking "Grid" switches to tiled grid view (80×60px)
- [ ] Active view mode button is visually highlighted
- [ ] Same buttons appear on Graphics, Widgets sections (Points section: List only is acceptable)

## Verification Checklist

- [ ] Navigate to /console → Workspaces section header → three icon buttons visible at top-right
- [ ] Click each button → workspace items re-render in corresponding layout
- [ ] Reload page → previously selected view mode is restored

## Do NOT

- Do not implement view mode switching without the visible buttons — the buttons must be in the section header
- Do not stub with TODO — the buttons must actually switch the layout

## Dev Notes

UAT failure from 2026-03-25: Workspaces section header shows "WORKSPACES" label + collapse arrow + badge only. No view-mode icon buttons.
Screenshot: docs/uat/MOD-CONSOLE/left-nav-missing-features.png
Spec reference: MOD-CONSOLE-001
