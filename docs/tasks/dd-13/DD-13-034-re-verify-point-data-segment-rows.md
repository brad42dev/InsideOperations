---
id: DD-13-034
unit: DD-13
title: Re-verify DD-13-030 — PointDataSegment point rows blocked by crash cascade
status: pending
priority: high
depends-on: ["DD-13-031", "DD-13-032"]
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Re-verification task. DD-13-030 (PointDataSegment shows no point rows) has been marked verified, but UAT could not confirm because creating a log instance required /log/new, which crashed after the crash cascade (browser_error — crash_streak=3).

Fix DD-13-031 and DD-13-032 first, then test:
1. Navigate to /log/new
2. Select "Test Log with Points" template
3. Click Start Entry
4. On the instance editor, verify PointDataSegment shows ≥1 point row

## Acceptance Criteria

- [ ] Log instance created from "Test Log with Points" template
- [ ] PointDataSegment section shows ≥1 configured point row (not "No points configured for this segment.")
- [ ] Point rows are interactive (visible tag label/value)

## Verification Checklist

- [ ] Navigate to /log/new
- [ ] Select "Test Log with Points" from dropdown
- [ ] Click Start Entry
- [ ] On instance page, find PointDataSegment section
- [ ] Verify point rows are visible (not empty state message)

## Dev Notes

UAT failure 2026-03-26: Scenario 8 — browser_error crash_streak=3 prevented testing.
Depends on DD-13-031 and DD-13-032 being fixed first.
