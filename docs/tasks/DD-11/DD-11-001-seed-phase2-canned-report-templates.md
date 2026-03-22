---
id: DD-11-001
title: Seed Phase 2 canned report templates (18 missing)
unit: DD-11
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Reports module ships with 38 pre-built canned report templates organized into 8 categories. Currently only 20 Phase 1 templates are seeded. The remaining 18 Phase 2 templates must be seeded via the same auth-service startup function so they appear in the template browser.

## Spec Excerpt (verbatim)

> I/O ships with 38 pre-built report templates organized into 8 categories. Canned reports are seed templates stored using the same Designer-based report template format as user-created templates. They are marked `is_system_template = true` and cannot be deleted, but users can duplicate and customize them. All templates are populated via the same report generation engine.
> — design-docs/11_REPORTS_MODULE.md, §Canned Report Templates

> **Phase 1**: 20 reports (core operational and compliance reports needed for initial deployment)
> **Phase 2**: 18 additional reports (analytical, trend, and advanced audit reports)
> **Total**: 38 canned report templates
> — design-docs/11_REPORTS_MODULE.md, §Phase Summary

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/reports.rs` — `seed_report_templates()` at line 943; currently seeds 20 templates
- `design-docs/11_REPORTS_MODULE.md` — §Canned Report Templates lists all 38 with category and description

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `seed_report_templates()` in auth-service contains all 38 template entries (currently has 20)
- [ ] The following Phase 2 templates are included: "Time to Acknowledge", "Shelved & Suppressed Alarms", "Exceedance Report", "Data Quality Report", "Period Comparison", "Log Entry Search", "Operator Activity Report", "Equipment Health Trend", "Alarm Rationalization Status", "Disabled Alarms Audit", "OPC Connection Health", "Missed Readings Report", "Alert Channel Delivery", "Escalation Report", "Attendance Report", "Audit Trail Report", "Safety Metrics Summary", "Operational Summary"
- [ ] All 18 new templates have `is_system_template = true`
- [ ] All 18 new templates are assigned the correct category matching design-doc §Canned Report Templates
- [ ] `report_generator.rs::execute_report_query()` either handles the new template names or falls through to `placeholder_report()` (Phase 2 can use placeholder — seeding is the priority)

## Assessment

After checking:
- **Status**: ❌ Missing — 18 Phase 2 templates entirely absent

## Fix Instructions

In `services/auth-service/src/handlers/reports.rs`, extend the `templates` slice inside `seed_report_templates()` (currently ending at line 1053) with the following 18 Phase 2 entries. Copy the pattern already used for Phase 1 entries: `("Name", "Category", "Description")`.

Phase 2 entries to add (from design-doc §Canned Report Templates):

**Alarm Management:**
- `("Time to Acknowledge", "Alarm Management", "Distribution of alarm acknowledgment times with percentile markers (median, p90, p95). Breakdown by priority.")`
- `("Shelved & Suppressed Alarms", "Alarm Management", "Currently shelved alarms with auto-unshelve countdown, shelving frequency, compliance with ISA-18.2 shelving time limits.")`

**Process Data:**
- `("Exceedance Report", "Process Data", "Time duration and percentage a value was above/below a configured threshold. Critical for environmental compliance.")`
- `("Data Quality Report", "Process Data", "Data gaps, bad OPC quality periods, stale data, points with persistent quality issues. Worst offenders ranked.")`
- `("Period Comparison", "Process Data", "Side-by-side comparison of same points across two time ranges (this week vs. last week, this month vs. same month last year).")`

**Operational Logs:**
- `("Log Entry Search", "Operational Logs", "Full-text search results across log entries for a date range, formatted for investigation/audit documentation.")`
- `("Operator Activity Report", "Operational Logs", "All log entries by a specific operator across all templates in a time range. Grouped by log instance/template.")`

**Rounds & Inspections:**
- `("Equipment Health Trend", "Rounds & Inspections", "Historical readings for a specific checkpoint/equipment over time. Shows degradation trends with alarm thresholds and statistical summary.")`

**Equipment & Maintenance:**
- `("Alarm Rationalization Status", "Equipment & Maintenance", "How many alarms are documented/rationalized/approved per ISA-18.2 lifecycle. Unrationalized alarms ranked by annunciation frequency.")`
- `("Disabled Alarms Audit", "Equipment & Maintenance", "Permanently suppressed alarms with reason, review date. Alarms disabled >90 days without review flagged. MOC compliance.")`
- `("OPC Connection Health", "Equipment & Maintenance", "OPC UA connection uptime, reconnection events, downtime per source, point quality summary per source.")`
- `("Missed Readings Report", "Equipment & Maintenance", "Checkpoints skipped within otherwise-completed rounds. Partial completion tracking by template over time.")`

**Environmental & Compliance:**
- `("Alert Channel Delivery", "Environmental & Compliance", "Delivery success rates across alert channels (WebSocket, email, SMS, voice, radio, PA, push). Failed delivery details.")`
- `("Escalation Report", "Environmental & Compliance", "Alert escalation frequency beyond Level 0. Indicates inadequate initial routing or insufficient staffing.")`

**Security & Access:**
- `("Attendance Report", "Security & Access", "Badge-in/badge-out history per person, hours on site per day/week.")`
- `("Audit Trail Report", "Security & Access", "Complete audit trail for configurable entity or time range. Chronological, filterable, searchable.")`

**Executive & Management:**
- `("Safety Metrics Summary", "Executive & Management", "Safety event count, emergency alerts, critical alarms, round exceptions, safety-tagged log entries. Trend vs. prior period.")`
- `("Operational Summary", "Executive & Management", "Configurable executive KPI report combining selected widgets. Template customizable per site.")`

No changes to `execute_report_query()` are required — Phase 2 templates will fall through to `placeholder_report()` which returns placeholder data, which is correct for Phase 2.

Do NOT:
- Create separate seed migrations for these — keep them all in `seed_report_templates()` alongside the Phase 1 set
- Delete or modify the 20 existing Phase 1 entries
- Skip the `EXISTS` check — the function already deduplicates by name for idempotent restarts
