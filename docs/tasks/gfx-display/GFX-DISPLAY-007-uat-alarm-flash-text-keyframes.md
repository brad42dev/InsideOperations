---
id: GFX-DISPLAY-007
unit: GFX-DISPLAY
title: Add alarm flash text fill keyframes and priority classes for P2–P5
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/GFX-DISPLAY/CURRENT.md
---

## What to Build

The UAT session confirmed that `alarmFlash.css` (or the equivalent stylesheet) only contains a single
`@keyframes io-alarm-flash` rule (which animates opacity) and a single `.io-unack` class. The P2–P5
priority-specific text fill keyframes and their corresponding CSS classes are completely absent.

Per GFX-DISPLAY-004 spec, `alarmFlash.css` must have:

1. Four new `@keyframes` rules animating SVG `fill` (for text elements inside alarm indicators):
   - `io-alarm-flash-high-text` — `fill: #F97316` ↔ `fill: #808080`
   - `io-alarm-flash-medium-text` — `fill: #EAB308` ↔ `fill: #808080`
   - `io-alarm-flash-advisory-text` — `fill: #06B6D4` ↔ `fill: #808080`
   - `io-alarm-flash-custom-text` — `fill: #7C3AED` ↔ `fill: #808080`

2. Four CSS classes, one per priority, each with:
   - A `> *` rule applying the priority's stroke keyframe animation
   - A `text` (or `text, tspan`) rule applying the corresponding text fill keyframe above

Observed in browser: `document.styleSheets` contained only `io-pulse`, `io-shimmer`, and `io-alarm-flash`
keyframes. No priority-specific keyframes or classes were found.

## Acceptance Criteria

- [ ] `@keyframes io-alarm-flash-high-text` exists in the loaded stylesheet with `fill: #F97316` and `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-medium-text` exists with `fill: #EAB308` and `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-advisory-text` exists with `fill: #06B6D4` and `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-custom-text` exists with `fill: #7C3AED` and `fill: #808080` transitions
- [ ] `.io-alarm-flash-high` class exists with both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-high-text`
- [ ] `.io-alarm-flash-medium` class exists with both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-medium-text`
- [ ] `.io-alarm-flash-advisory` class exists with both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-advisory-text`
- [ ] `.io-alarm-flash-custom` class exists with both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-custom-text`

## Verification Checklist

- [ ] Navigate to /designer, open browser DevTools → Styles, verify all 4 new `@keyframes` names are present in stylesheet
- [ ] Verify `document.styleSheets` via console returns all 4 `io-alarm-flash-{priority}-text` keyframe names
- [ ] Verify `.io-alarm-flash-high`, `.io-alarm-flash-medium`, `.io-alarm-flash-advisory`, `.io-alarm-flash-custom` class rules exist
- [ ] Each priority class has both a stroke animation rule (`> *`) and a text fill animation rule (`text`)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not only add keyframes without also adding the priority-specific CSS classes that use them
- Do not rename existing keyframes — `io-alarm-flash` must remain unchanged for `.io-unack` to work

## Dev Notes

UAT failure from 2026-03-24: browser_evaluate of document.styleSheets returned only 3 keyframes —
io-pulse, io-shimmer, io-alarm-flash. All 4 priority text keyframes and all 4 priority classes missing.
Spec reference: GFX-DISPLAY-004 (original task), docs/tasks/gfx-display/GFX-DISPLAY-004-alarm-flash-text-p2-p5.md
