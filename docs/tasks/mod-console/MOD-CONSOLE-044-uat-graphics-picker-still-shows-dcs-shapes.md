---
id: MOD-CONSOLE-044
unit: MOD-CONSOLE
title: Console graphics picker still shows DCS shape library shapes instead of process graphics
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The Graphics section of the Console left nav panel still shows DCS shape library shapes (Air Cooler / Fin-Fan, Ball Valve, Butterfly Valve, Centrifugal Pump, Compressor, etc.) instead of filtering to only show process graphics tagged `module='console'`.

This was supposed to be fixed in MOD-CONSOLE-033 which filtered the API query to only return `type='graphic'` records tagged `module='console'`. The fix was marked verified but the bug is still present in the browser.

## Acceptance Criteria

- [ ] Console Graphics section shows ONLY process graphics (type='graphic', module='console') — not DCS equipment symbols
- [ ] DCS shape names (Ball Valve, Centrifugal Pump, Compressor, etc.) do NOT appear in the Console graphics picker
- [ ] If no process graphics exist, the section shows an appropriate empty state
- [ ] Shape library shapes remain accessible in Designer (no regression)

## Verification Checklist

- [ ] Navigate to /console → expand Graphics section in left nav
- [ ] Confirm items like "Ball Valve", "Centrifugal Pump", "Air Cooler / Fin-Fan" are NOT present
- [ ] Confirm only proper process graphic names appear (or empty state)
- [ ] Navigate to /designer → confirm shape library still shows shapes in palette

## Do NOT

- Do not remove the Graphics section entirely — it should show proper process graphics
- Do not break the Designer shape library access while fixing the Console filter

## Dev Notes

UAT failure from 2026-03-26: Console Graphics section shows ~50+ DCS shape library items including: Air Cooler / Fin-Fan, Alarm Annunciator (Graphical Horn), Ball Valve, Butterfly Valve, Centrifugal Pump, Centrifugal Pump (Graphical), Centrifugal Pump (ISA), Compressor, Control Valve, etc. These are shape library shapes, not process graphics. Fix from MOD-CONSOLE-033 did not take effect.
Spec reference: MOD-CONSOLE-033
