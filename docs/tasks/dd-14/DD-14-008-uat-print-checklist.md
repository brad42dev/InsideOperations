---
id: DD-14-008
unit: DD-14
title: Print checklist feature not implemented — no print button in rounds
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-14/CURRENT.md
---

## What to Build

The Rounds module is missing a print/export checklist feature. There is no print button visible in the rounds interface, and no print/Print references exist in the rounds source files. The spec requires a print checklist with two modes: "blank" (empty form for field use) and "current results" (completed responses).

## Acceptance Criteria

- [ ] Print/Export button visible when viewing a round or round template
- [ ] Print dialog shows two mode options: "Blank checklist" and "Current results"
- [ ] Clicking either mode initiates print or PDF download

## Verification Checklist

- [ ] Navigate to /rounds, open a round or template
- [ ] Confirm print/export button is visible in the UI
- [ ] Click print — confirm dialog appears with blank/current-results mode options
- [ ] No silent no-op: clicking print produces visible print dialog or download

## Do NOT

- Do not stub with a TODO comment
- Do not implement only blank mode — both modes are required

## Dev Notes

UAT failure 2026-03-23: No print/Print references found in frontend/src/pages/rounds/*.tsx. No print button visible anywhere in the Rounds UI.
Spec reference: DD-14-004
