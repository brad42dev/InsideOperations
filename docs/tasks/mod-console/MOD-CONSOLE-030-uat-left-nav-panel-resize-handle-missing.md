---
id: MOD-CONSOLE-030
unit: MOD-CONSOLE
title: Left nav panel width resize handle missing
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The left nav panel (Assets palette) spec requires a draggable resize handle on its right edge to allow width adjustment (clamped 200–400px), with the width persisted to user preferences. UAT found no such handle: no element with a `col-resize` or `ew-resize` cursor exists at the panel boundary, and no drag handle element with "resize", "splitter", or similar semantics is present.

The spec also calls for a drag handle at the bottom edge of each section for height resizing. Neither the panel-width handle nor the section-height handles were found.

Reference: MOD-CONSOLE-001 spec (MOD-CONSOLE-001-left-nav-panel-favorites-viewmode-search.md), verification checklist items:
- "A drag handle exists at the bottom edge of each section for height resizing"
- "Panel width is resizable (drag right edge, clamped 200–400px) and width is persisted in user preferences"

## Acceptance Criteria

- [ ] A draggable handle exists on the right edge of the left nav panel; dragging it resizes the panel width
- [ ] Panel width is clamped between 200px and 400px
- [ ] Resized width is persisted to user preferences (survives page reload)
- [ ] A drag handle exists at the bottom edge of each accordion section for height resizing
- [ ] Section heights are persisted to user preferences

## Verification Checklist

- [ ] Navigate to /console → inspect right edge of Assets palette for col-resize cursor element
- [ ] Drag right edge of palette left/right → panel resizes
- [ ] Reload page → panel width restored to saved value
- [ ] Drag bottom edge of Workspaces section → section height changes
- [ ] Reload page → section height restored

## Do NOT

- Do not stub with a TODO comment
- Do not implement only the visual handle — it must actually resize the panel and persist the size

## Dev Notes

UAT failure from 2026-03-26: Searched DOM for all elements with col-resize/ew-resize cursor — none found outside react-grid-layout pane handles. No element with "resize", "splitter", or "drag-handle" in class names in the palette area. Screenshot: docs/uat/MOD-CONSOLE/fail-s8-no-panel-resize-handle.png
Spec reference: MOD-CONSOLE-001-left-nav-panel-favorites-viewmode-search.md
