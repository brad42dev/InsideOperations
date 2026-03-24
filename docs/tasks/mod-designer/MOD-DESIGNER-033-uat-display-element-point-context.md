---
id: MOD-DESIGNER-033
unit: MOD-DESIGNER
title: Point context menu items missing from display element right-click menu
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When the user right-clicks a display element on the canvas (e.g. a Text Readout), the context menu should include CX-POINT-CONTEXT items — specifically "Open Trend", "View Detail", and "View Alerts" (or equivalent point-context actions as defined in the context-menu spec). Currently the menu only shows "Bind Point…" and "Change Type" — the CX-POINT-CONTEXT entries are absent even for bound display elements.

The expected behavior: the display element's context menu should include the standard CX-POINT-CONTEXT section (Trend/Detail/Alerts shortcuts) in addition to the display-element-specific items. For unbound display elements, these point-context items may be disabled/greyed out, but they should still be present in the menu structure.

## Acceptance Criteria

- [ ] Right-clicking a display element shows a context menu containing CX-POINT-CONTEXT items (Open Trend, View Detail, View Alerts or per-spec equivalents)
- [ ] Point-context items are present in the menu even when the element is unbound (may be disabled but must be visible)
- [ ] When a display element is bound to a point, the point-context items are enabled and functional
- [ ] Existing items "Bind Point…" and "Change Type" remain in the menu

## Verification Checklist

- [ ] Navigate to /designer
- [ ] Drag a Text Readout display element from the palette onto the canvas
- [ ] Right-click the display element
- [ ] Confirm context menu contains "Open Trend" / "Trend" (or per-spec equivalent)
- [ ] Confirm context menu contains "View Detail" / "Detail" (or per-spec equivalent)
- [ ] Confirm context menu contains "View Alerts" / "Alerts" (or per-spec equivalent)
- [ ] Confirm "Bind Point…" and "Change Type" items are still present

## Do NOT

- Do not remove the existing "Bind Point…" or "Change Type" items
- Do not implement only the bound-point case — point-context items must be present (disabled) even for unbound elements

## Dev Notes

UAT failure from 2026-03-24: Right-clicked a Text Readout display element on the canvas. Context menu appeared ([role="menu"] visible) with items "Bind Point…" and "Change Type" only. No CX-POINT-CONTEXT items (Trend/Detail/Alerts) were found in the menu. Screenshot: docs/uat/MOD-DESIGNER/fail-display-element-no-point-context.png
Spec reference: MOD-DESIGNER-009 (point context menu on display elements), context-menu-implementation-spec.md CX-POINT-CONTEXT
