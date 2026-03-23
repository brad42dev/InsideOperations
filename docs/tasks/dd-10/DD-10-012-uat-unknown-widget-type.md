---
id: DD-10-012
unit: DD-10
title: "Unknown widget type" error on non-alarm dashboards
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

When opening dashboards such as Operations Overview, Equipment Health, Executive Summary, or Process Area Overview, every widget displays an "Unknown widget type" error. Only dashboards using alarm-specific widget types (alarm-count-by-severity, unack-count, alarm-rate, alarm-list) render correctly.

The dashboard widget renderer does not handle the general-purpose widget types used by non-alarm dashboards. The widget type registry is missing registrations for these types.

## Acceptance Criteria

- [ ] All 9 seeded dashboards (Operations Overview, Equipment Health, Executive Summary, Process Area Overview, Reactor Unit 1 KPIs, Active Alarms, Alarm KPI Summary, Environmental Compliance) render without "Unknown widget type" errors
- [ ] Widget types used by non-alarm dashboards (line-chart, bar-chart, value-display, gauge, table, etc.) render their content
- [ ] Adding a new Line Chart widget and saving to a dashboard persists and renders correctly

## Verification Checklist

- [ ] Navigate to /dashboards, open "Operations Overview" — no "Unknown widget type" text visible
- [ ] Navigate to /dashboards, open "Equipment Health" — no "Unknown widget type" text visible
- [ ] Navigate to /dashboards, open "Executive Summary" — no "Unknown widget type" text visible
- [ ] All widget types render at minimum an empty/no-data state rather than an error message

## Do NOT

- Do not stub the missing widget types with empty placeholders that silently ignore data
- Do not only fix alarm dashboards — fix the generic widget type rendering

## Dev Notes

UAT failure from 2026-03-23: Opening non-alarm dashboards showed "Unknown widget type" error for all widgets on the page.
Active Alarms dashboard (alarm-specific widget types) rendered correctly in the same session.
Screenshot: docs/uat/DD-10/dashboard-detail.png
Spec reference: DD-10-006 (widget config), DD-10-010 (dashboard rendering)
