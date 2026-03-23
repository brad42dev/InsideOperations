---
id: DD-34-007
unit: DD-34
title: No DCS import job history list — import wizard shows no history of past imports
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-34/CURRENT.md
---

## What to Build

The DCS Graphics Import feature at /designer/import only shows the new-import wizard (6 steps). There is no job history or management section showing past import jobs, their status, or results. The spec requires users to view and manage past import jobs.

## Acceptance Criteria

- [ ] Import job history/list visible at /designer/import or a sub-route
- [ ] Past import jobs shown with status (completed, failed, in-progress)
- [ ] Empty state shown when no imports have been run yet ("No import history" or similar)

## Verification Checklist

- [ ] Navigate to /designer/import or /designer/import/history
- [ ] Confirm import job list or empty state is visible
- [ ] Past imports show status and platform used

## Do NOT

- Do not replace the import wizard — add the history alongside it

## Dev Notes

UAT failure 2026-03-23: /designer/import only shows the 6-step new-import wizard with no job history section.
Spec reference: DD-34-004
