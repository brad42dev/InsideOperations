---
id: DD-13-030
unit: DD-13
title: PointDataSegment shows no point rows — cannot verify PointContextMenu wiring
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Every PointDataSegment in tested log instances shows "No points configured for this segment." This makes it impossible to verify that DD-13-018 (PointContextMenu wiring) works end-to-end.

Tested templates: "Test Log with Points" and "PointContextMenu Test" — both created instances with PointDataSegment sections that are empty.

Two possible causes:
1. The template's point segment bindings are not being persisted when the instance is created (the template has point references, but they don't copy into the instance)
2. The seed templates were created without any point bindings in the `log_template_segments` table

Fix so that at least one PointDataSegment in one seed template contains configured point rows (real OPC tag references) when an instance is created from it. The point rows must be visible to users so the right-click PointContextMenu can be tested.

## Acceptance Criteria

- [ ] Creating an instance from "Test Log with Points" or "PointContextMenu Test" shows ≥1 point row in the PointDataSegment
- [ ] Right-clicking a point row in the PointDataSegment opens a context menu (verifying DD-13-018)
- [ ] Context menu contains point-specific actions (e.g. View Trend, Copy Tag, etc.)

## Verification Checklist

- [ ] Navigate to /log/new, select "Test Log with Points", click Start Entry
- [ ] On the instance editor, the PointDataSegment shows point rows (not "No points configured")
- [ ] Right-click a point row → context menu appears
- [ ] Context menu has at least one actionable item

## Do NOT

- Do not just remove the "No points configured" message — the segment needs real data
- Do not hardcode UI rows without a backing data source

## Dev Notes

UAT failure 2026-03-26: All PointDataSegment instances show "No points configured for this segment."
Tested templates: "Test Log with Points" (instance: /log/f4b69fdc-...) and "PointContextMenu Test" (instance: /log/19c2bfc2-...)
Screenshot: docs/uat/DD-13/dd13-scenario11-no-point-rows.png
Spec reference: DD-13-018 (CX-POINT-CONTEXT wiring on PointDataSegment rows)
