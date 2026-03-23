---
id: DD-12-013
unit: DD-12
title: Historical Playback Bar missing from forensics investigation workspace for graphic snapshot control
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-12/CURRENT.md
---

## What to Build

Per DD-12-010, the datetime-local input for graphic snapshot timestamp in the investigation workspace should be replaced with the Historical Playback Bar component. The investigation workspace was inspected during UAT and no Playback Bar was found — the stages panel shows "+ Add Stage" but no playback controls exist.

The Playback Bar should be accessible within the investigation workspace to control the time position for graphic snapshot evidence items.

## Acceptance Criteria

- [ ] Investigation workspace contains a Historical Playback Bar component
- [ ] The Playback Bar controls the timestamp shown in graphic snapshot evidence panels
- [ ] No datetime-local input used for graphic snapshot timestamp selection

## Verification Checklist

- [ ] Navigate to /forensics, open an investigation
- [ ] Add a graphic snapshot evidence item to a stage
- [ ] Confirm a Playback Bar appears (not a datetime-local input) for controlling snapshot time

## Do NOT

- Do not remove the stage-based investigation model — Playback Bar should integrate within it

## Dev Notes

UAT failure from 2026-03-23: Investigation workspace (/forensics/7ee1ac54...) showed toolbar, Included Points, Stages, and Analysis Results panels. No Historical Playback Bar component found anywhere in the workspace. Spec reference: DD-12-010, CX-PLAYBACK.
