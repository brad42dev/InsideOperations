---
id: DD-13-021
unit: DD-13
title: Re-verify PointContextMenu on PointDataSegment rows when log backend available
status: blocked
priority: high
depends-on: [opc-point-data-available]
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
blocker: OPC point data needed — log backend constraint issue FIXED (DD-13-019), but testing requires OPC server/SimBLAH with seeded points
---

## What to Build

The PointContextMenu wired onto point rows in PointDataSegment (DD-13-018) could not be verified during UAT because the log backend API returns 404, preventing creation of log instances. Without a log instance that contains a PointDataSegment, right-click behavior on point rows cannot be tested.

This task is a re-verification task: once the log backend is available, confirm PointContextMenu appears on right-click of point rows in PointDataSegment.

## Acceptance Criteria

**Ready to test when:** Backend provides OPC point data AND log template persistence is fixed

- [ ] Open a log instance that contains a PointDataSegment (point data rows)
- [ ] Right-click on a point row in the PointDataSegment table
- [ ] PointContextMenu appears with role="menu" (Radix UI dropdown)
- [ ] Menu displays actions: Point Detail, Trend Point, Investigate Point, Report on Point, Copy Tag Name
- [ ] Permission checks respected: only show actions user has permission for
- [ ] Clicking an action produces visible effect (navigation, dialog, etc.)

## Verification Checklist

- [ ] With backend running: create/open a log instance with PointDataSegment
- [ ] Right-click a point row → `[role="menu"]` appears with at least one point-related action
- [ ] Menu items include tag name or point ID in the context
- [ ] Clicking a menu item produces visible change (not a silent no-op)

## Code Verification Complete ✅

**PointContextMenu Implementation** (PointContextMenu.tsx):
- Right-click handler: captures `onContextMenu`, calls `triggerOpen()`
- Radix UI dropdown menu with proper `role="menu"` accessibility
- All 6 menu items implemented with permission checks:
  1. Point Detail (always)
  2. Trend Point (console:read)
  3. Investigate Point (forensics:write)
  4. Report on Point (reports:read)
  5. Investigate Alarm (if isAlarm || isAlarmElement)
  6. Copy Tag Name (always)
- Touch long-press support (500ms) for mobile devices

**PointDataSegment Integration** (LogEditor.tsx:459–510):
- Each point row wrapped in PointContextMenu
- Correct props passed: pointId, tagName, isAlarm, isAlarmElement
- WebSocket integration for live point values

**Do NOT**
- Do not modify the menu structure — implementation is correct per spec
- Do not add menu items without permission checks

## Dev Notes

**Code Review (2026-03-26):** PointContextMenu correctly implemented in PointDataSegment (LogEditor.tsx:459–510). Component wraps each point row with PointContextMenu, passing pointId, tagName, isAlarm props. Radix UI dropdown with role="menu" captures right-click events.

**Backend Status (2026-03-26):**
✅ Log backend constraint issue FIXED (DD-13-019) — status='pending' → status='draft' in logs.rs:584. Backend now compiles and allows log instance creation.

**Functional Testing Status:**
⏳ Ready for functional testing once OPC point data is available. No longer blocked by template persistence. Spec reference: DD-13-018 (CX-POINT-CONTEXT for PointDataSegment), context-menu-implementation-spec.md §16.2.

**Action Required:**
1. Configure OPC server or SimBLAH simulator with point data
2. Create/seed log template with PointDataSegment
3. Retry full E2E test flow: create log instance → open in editor → right-click point row → verify menu
