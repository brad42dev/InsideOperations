---
id: GFX-DISPLAY-008
unit: GFX-DISPLAY
title: Implement missing alarm flash text-fill keyframes and priority class CSS rules
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/GFX-DISPLAY/CURRENT.md
---

## What to Build

UAT confirmed that the alarm flash text-fill CSS keyframes and priority class rules are entirely missing from the loaded stylesheets. Browser inspection of `document.styleSheets` (4 stylesheets total) found only `io-alarm-flash`, `io-pulse`, and `io-shimmer` keyframes — none of the 4 required text-fill keyframes exist.

The `alarmFlash.css` file is missing these implementations:

1. `@keyframes io-alarm-flash-high-text` — transitions `fill: #F97316` ↔ `fill: #808080`
2. `@keyframes io-alarm-flash-medium-text` — transitions `fill: #EAB308` ↔ `fill: #808080`
3. `@keyframes io-alarm-flash-advisory-text` — transitions `fill: #06B6D4` ↔ `fill: #808080`
4. `@keyframes io-alarm-flash-custom-text` — transitions `fill: #7C3AED` ↔ `fill: #808080`

Additionally, the priority CSS classes are missing entirely — no `.io-alarm-flash-{priority}` rules exist:
- `.io-alarm-flash-high` — must have `> *` stroke animation AND `text` fill animation using `io-alarm-flash-high-text`
- `.io-alarm-flash-medium` — must have `> *` stroke animation AND `text` fill animation using `io-alarm-flash-medium-text`
- `.io-alarm-flash-advisory` — must have `> *` stroke animation AND `text` fill animation using `io-alarm-flash-advisory-text`
- `.io-alarm-flash-custom` — must have `> *` stroke animation AND `text` fill animation using `io-alarm-flash-custom-text`

## Acceptance Criteria

- [ ] `@keyframes io-alarm-flash-high-text` exists in the loaded stylesheet with `fill: #F97316` and `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-medium-text` exists with `fill: #EAB308` and `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-advisory-text` exists with `fill: #06B6D4` and `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-custom-text` exists with `fill: #7C3AED` and `fill: #808080` transitions
- [ ] `.io-alarm-flash-high` class has both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-high-text`
- [ ] `.io-alarm-flash-medium` class has both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-medium-text`
- [ ] `.io-alarm-flash-advisory` class has both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-advisory-text`
- [ ] `.io-alarm-flash-custom` class has both a `> *` stroke animation rule and a `text` fill animation using `io-alarm-flash-custom-text`

## Verification Checklist

- [ ] Navigate to /designer, evaluate `Array.from(document.styleSheets).flatMap(s => { try { return Array.from(s.cssRules); } catch(e) { return []; } }).filter(r => r instanceof CSSKeyframesRule).map(r => r.name)` — must include all 4 `io-alarm-flash-*-text` names
- [ ] Verify `.io-alarm-flash-high`, `.io-alarm-flash-medium`, `.io-alarm-flash-advisory`, `.io-alarm-flash-custom` class rules appear in `document.styleSheets`
- [ ] Each priority class has both a `> *` (stroke) rule and a `text` (fill) rule

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not only add keyframes without adding the class rules that reference them

## Dev Notes

UAT failure 2026-03-24: Browser evaluation of all 4 stylesheets at /designer confirmed only `io-alarm-flash`, `io-pulse`, `io-shimmer` keyframes exist. All 4 text-fill keyframes (`io-alarm-flash-high-text`, `-medium-text`, `-advisory-text`, `-custom-text`) absent. No `.io-alarm-flash-*` class rules found at all. This is a pure CSS authoring gap in `alarmFlash.css`.

Spec reference: GFX-DISPLAY-004, GFX-DISPLAY-007 (original task that was marked verified but UAT found unimplemented)
