---
id: DD-10-010
unit: DD-10
title: Dashboard widgets render "Unknown widget type" for alarm-count-by-severity and 3 other types
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

When opening any dashboard in the viewer (e.g., the "Active Alarms" system dashboard), all 4 widgets render "Unknown widget type: <type-name>" instead of actual widget content. The affected widget types are:
- alarm-count-by-severity
- unack-count
- alarm-rate
- alarm-list

The widget renderer/registry does not have implementations registered for these types. The widget component lookup falls through to an "unknown" fallback.

## Acceptance Criteria

- [ ] alarm-count-by-severity widget renders a chart or count display of alarms grouped by severity
- [ ] unack-count widget renders a numeric count of unacknowledged alarms
- [ ] alarm-rate widget renders an alarm rate trend or value
- [ ] alarm-list widget renders a list of active alarms
- [ ] No "Unknown widget type" text appears when opening these system dashboards

## Verification Checklist

- [ ] Navigate to /dashboards, open "Active Alarms" dashboard → all 4 widgets render without "Unknown widget type" text
- [ ] Each widget shows meaningful content (count, chart, or list — even empty state is acceptable)
- [ ] No console errors about unknown widget type

## Do NOT

- Do not stub with empty divs — each widget type must render its intended content
- Do not remove the system dashboards to "fix" the issue

## Dev Notes

UAT failure from 2026-03-23: Opening /dashboards/b9ea58a2-f2de-4f23-b51d-4dc0860a7cf9 (Active Alarms) shows all 4 widget cards with "Unknown widget type: X" instead of content.
Spec reference: DD-10-007 (widget values display)
