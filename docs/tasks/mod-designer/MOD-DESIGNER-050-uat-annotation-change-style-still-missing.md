---
id: MOD-DESIGNER-050
unit: MOD-DESIGNER
title: Annotation node right-click "Change Style" still absent after MOD-DESIGNER-042 fix
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

The annotation (text annotation placed via T key) right-click context menu must include a "Change Style" item. UAT Scenario 7 confirmed it is still missing after MOD-DESIGNER-042 was marked verified.

**Observed in UAT (2026-03-26):** Right-clicking an annotation node on canvas produced a context menu with these items: Cut, Copy, Paste, Duplicate, Delete, Group, Ungroup, Rotate 90° CW/CCW, Flip H/V, Lock, Bind Point, Rename, Properties. "Change Style" was absent.

**Expected:** The annotation node context menu must include a "Change Style" item that opens a style picker (stroke, fill, font style options or similar annotation-specific styling dialog).

## Acceptance Criteria

- [ ] Right-clicking a text annotation placed on the Designer canvas shows a context menu containing "Change Style"
- [ ] Clicking "Change Style" opens a style picker or styling dialog relevant to annotations
- [ ] Other context menu items (Delete, Rename, etc.) are not affected

## Verification Checklist

- [ ] Navigate to /designer, open a graphic
- [ ] Press T to activate text tool, click canvas to place a text annotation
- [ ] Press V or Escape to switch to Select mode
- [ ] Right-click the annotation → confirm [role="menu"] visible
- [ ] Confirm "Change Style" menuitem is present
- [ ] Click "Change Style" → confirm styling dialog or popover opens

## Do NOT

- Do not stub this with a TODO comment — that is what caused the original failure
- Do not add "Change Style" only to the general node menu — it must appear specifically for annotation nodes
- Do not remove existing context menu items while adding this one

## Dev Notes

UAT failure from 2026-03-26 (Scenario 7): "Change Style" absent from annotation context menu.
Screenshot: docs/uat/MOD-DESIGNER/fail-s7-change-style-missing.png
Spec reference: MOD-DESIGNER-042 (prior fix attempt, marked verified but UAT failed)
Context menu spec: spec_docs/context-menu-implementation-spec.md
