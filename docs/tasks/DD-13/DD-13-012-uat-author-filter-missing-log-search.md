---
id: DD-13-012
unit: DD-13
title: Author filter missing from log search UI
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

UAT Scenario [DD-13-007]: The log search/filter panel should include an author filter to filter log entries by who created them. During UAT, no author filter field was found in the log search interface. The author filter is part of DD-13-007 search filters specification.

## Acceptance Criteria

- [ ] Author filter field visible in log search/filter panel
- [ ] Selecting an author filters the log entry list
- [ ] Filter can be cleared to show all entries

## Verification Checklist

- [ ] Navigate to /log, open search/filter panel
- [ ] Confirm author filter input/dropdown is present
- [ ] Select an author and verify the list filters correctly

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: Author filter not found in log search panel. Spec reference: DD-13-007
