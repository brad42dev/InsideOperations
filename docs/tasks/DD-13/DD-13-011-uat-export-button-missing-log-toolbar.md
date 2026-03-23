---
id: DD-13-011
unit: DD-13
title: Export button missing from log list toolbar
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

UAT Scenario [DD-13-006]: The log module toolbar should have an export button for exporting log entries. During UAT, the export button was not found in the log list toolbar. The export functionality is specified as part of DD-13-006 but appears to be incomplete or missing from the rendered UI.

## Acceptance Criteria

- [ ] Export button visible in log list toolbar
- [ ] Clicking export button opens format selection (CSV, PDF, etc.)
- [ ] Export initiates download of log entries

## Verification Checklist

- [ ] Navigate to /log, check toolbar for export button
- [ ] Click export button — format selector or download must appear
- [ ] No silent no-op: button must produce visible change

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: Export button not found in log list toolbar. Spec reference: DD-13-006
