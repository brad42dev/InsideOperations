---
id: GFX-DISPLAY-009
unit: GFX-DISPLAY
title: Alarm flash priority CSS keyframes and class rules still absent from stylesheet
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/GFX-DISPLAY/CURRENT.md
---

## What to Build

The alarm flash CSS rules required by the spec have never made it into the loaded stylesheet.
Despite two prior task cycles (GFX-DISPLAY-004, GFX-DISPLAY-007, GFX-DISPLAY-008), the
browser still only contains a single `@keyframes io-alarm-flash` rule (opacity 1→0.25).

The following are entirely absent from `document.styleSheets` at runtime:
- `@keyframes io-alarm-flash-high-text`
- `@keyframes io-alarm-flash-medium-text`
- `@keyframes io-alarm-flash-advisory-text`
- `@keyframes io-alarm-flash-custom-text`
- `.io-alarm-flash-high` class rule (no stroke rule, no text fill rule)
- `.io-alarm-flash-medium` class rule (no stroke rule, no text fill rule)
- `.io-alarm-flash-advisory` class rule (no stroke rule, no text fill rule)
- `.io-alarm-flash-custom` class rule (no stroke rule, no text fill rule)

The CSS must be written into the file that is actually imported/loaded by the frontend
(likely `alarmFlash.css` or equivalent). Check that this file is imported in the app entry
point or the display elements component — the CSS may exist in a file that is never imported.

## Acceptance Criteria

- [ ] `@keyframes io-alarm-flash-high-text` exists in loaded stylesheet with `fill: #F97316` / `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-medium-text` exists with `fill: #EAB308` / `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-advisory-text` exists with `fill: #06B6D4` / `fill: #808080` transitions
- [ ] `@keyframes io-alarm-flash-custom-text` exists with `fill: #7C3AED` / `fill: #808080` transitions
- [ ] `.io-alarm-flash-high` class has a `> *` stroke animation rule AND a `text` fill animation rule referencing `io-alarm-flash-high-text`
- [ ] `.io-alarm-flash-medium` class has a `> *` stroke animation rule AND a `text` fill animation rule referencing `io-alarm-flash-medium-text`
- [ ] `.io-alarm-flash-advisory` class has a `> *` stroke animation rule AND a `text` fill animation rule referencing `io-alarm-flash-advisory-text`
- [ ] `.io-alarm-flash-custom` class has a `> *` stroke animation rule AND a `text` fill animation rule referencing `io-alarm-flash-custom-text`

## Verification Checklist

- [ ] Navigate to /designer, run in browser console:
  `Array.from(document.styleSheets).flatMap(s => { try { return Array.from(s.cssRules); } catch(e) { return []; } }).filter(r => r instanceof CSSKeyframesRule).map(r => r.name)`
  — result must include all 4 `io-alarm-flash-*-text` names
- [ ] Run: `Array.from(document.styleSheets).flatMap(s => { try { return Array.from(s.cssRules); } catch(e) { return []; } }).filter(r => r instanceof CSSStyleRule && r.selectorText && r.selectorText.includes('io-alarm-flash-')).map(r => r.selectorText)`
  — result must include selectors for all 4 priority classes with both `> *` and `text` variants
- [ ] Each priority class selector with `text` has `animation-name` set to the corresponding keyframe

## Do NOT

- Do not stub this with a TODO comment — this feature has been "verified" multiple times without the CSS actually loading
- Check that the CSS file containing these rules is actually imported in the component or app entry — writing CSS to a file that is never imported is the likely root cause
- Do not implement only one priority level — all four (high, medium, advisory, custom) must be present

## Dev Notes

UAT failure from 2026-03-24: browser evaluation of `document.styleSheets` shows only
`io-alarm-flash` (opacity animation) — zero priority-specific text keyframes or class rules.
Spec references: GFX-DISPLAY-004, GFX-DISPLAY-007, GFX-DISPLAY-008 (all prior attempts at this same feature)
