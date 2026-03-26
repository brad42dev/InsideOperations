---
id: DD-13-035
unit: DD-13
title: Re-verify DD-13-021 — PointContextMenu on point rows blocked by crash cascade
status: pending
priority: high
depends-on: ["DD-13-031", "DD-13-032", "DD-13-034"]
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Re-verification task. DD-13-021 (PointContextMenu on PointDataSegment rows) has been marked verified, but UAT could not confirm because accessing a log instance with PointDataSegment required navigating through /log/new, which crashed after the crash cascade (browser_error — crash_streak=3).

Fix DD-13-031, DD-13-032, DD-13-034 first, then test:
1. Open a log instance with PointDataSegment showing point rows
2. Right-click a point row
3. Verify [role="menu"] appears with point-specific actions (Point Detail, Trend Point, Copy Tag Name, etc.)

## Acceptance Criteria

- [ ] Log instance with PointDataSegment has ≥1 point row visible
- [ ] Right-click on a point row opens a context menu ([role="menu"])
- [ ] Menu contains point-specific actions: Point Detail, Trend Point, Copy Tag Name (at minimum)
- [ ] Clicking a menu item produces a visible effect (not a silent no-op)

## Verification Checklist

- [ ] Create/open log instance from "Test Log with Points" or "PointContextMenu Test" template
- [ ] Locate PointDataSegment with point rows
- [ ] Right-click a point row → [role="menu"] appears
- [ ] Menu has ≥1 item with point-specific label
- [ ] Click one item — something visible happens

## Dev Notes

UAT failure 2026-03-26: Scenario 9 — browser_error crash_streak=3 prevented testing.
Depends on DD-13-031, DD-13-032, DD-13-034 being fixed first.
