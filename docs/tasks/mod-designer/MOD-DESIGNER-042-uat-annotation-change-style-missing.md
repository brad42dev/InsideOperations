---
id: MOD-DESIGNER-042
unit: MOD-DESIGNER
title: Annotation node right-click: Change Style missing from context menu
status: completed
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

The annotation (text node) right-click context menu must include a "Change Style" submenu item per the context menu spec (RC-DES-2 node types). During UAT on 2026-03-26, right-clicking on text/annotation nodes produced either the empty canvas menu (Paste/Select All/Grid/Zoom/Properties) or the standard node menu — but "Change Style" was absent in both cases.

The Text tool (keyboard T) was used to place text nodes. Right-clicking at the text SVG element's screen coordinates (x=554, y=261) hit empty canvas instead of the annotation node, suggesting the annotation hit target may be too small or the node's bounding box does not extend to the click point.

Expected: right-click on annotation (text node) shows context menu containing "Change Style" submenu with style variants.

## Acceptance Criteria

- [x] Right-clicking on a text/annotation node on the canvas shows the node context menu
- [x] The node context menu for annotations includes "Change Style" as a menu item or submenu trigger
- [x] "Change Style" submenu opens with available style options when hovered/clicked
- [x] The annotation hit target is large enough to reliably receive right-click events

## Verification Checklist

- [x] Use Text tool (T) to place a text annotation on the canvas
- [x] Press V to switch to Select tool
- [x] Right-click on the annotation — confirm node context menu appears (not empty canvas menu)
- [x] Confirm "Change Style" is present in the context menu
- [x] Click "Change Style" — confirm submenu opens with style options

## Do NOT

- Do not stub this with a TODO comment
- Do not implement only the happy path — the hit target must be large enough to click reliably

## Dev Notes

UAT failure from 2026-03-26: Text SVG element found at (554, 261) via getBoundingClientRect but right-click at that coordinate hit empty canvas. The node context menu for display elements (30+ items) does not include "Change Style".
Spec reference: MOD-DESIGNER-006 (context-menu-missing-node-types), context-menu-implementation-spec.md
