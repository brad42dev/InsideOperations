---
id: GFX-DISPLAY-004
title: Add alarm flash text fill keyframes for P2-P5 alarm indicator priorities
unit: GFX-DISPLAY
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Unacknowledged alarm indicators flash at 1Hz alternating between the alarm priority color and equipment gray (`#808080`). Both the shape stroke AND the priority number text inside the shape must flash together. Currently only P1 (Critical) has a separate text fill keyframe. P2–P5 use the `> *` selector which animates `stroke` only — this does not affect SVG text `fill`, so the text inside the indicator stays static while the shape border flashes.

## Spec Excerpt (verbatim)

> ### Flash Behavior (unacknowledged)
> - 1Hz flash: alarm color ↔ `#808080` (gray)
> - Uses CSS `step-end` timing (sharp on/off, NOT fade)
> - **Both stroke and text flash together**
> — display-elements-implementation-spec.md, §Alarm Indicator Flash Behavior

```css
@keyframes alarm-flash-critical {
  0%, 49.99% { stroke: #EF4444; }
  50%, 100%  { stroke: #808080; }
}
@keyframes alarm-flash-critical-text {
  0%, 49.99% { fill: #EF4444; }
  50%, 100%  { fill: #808080; }
}
```
> — display-elements-implementation-spec.md, §Alarm Indicator Flash CSS

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/alarmFlash.css` — all alarm flash keyframes and class rules at lines 1–41
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `getFlashClass()` (actually inline in renderDisplayElement alarm_indicator case ~line 526) — verify flash class applied to parent `<g>`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `alarmFlash.css` has `@keyframes io-alarm-flash-high-text` with `fill: #F97316` / `fill: #808080` transitions
- [ ] `alarmFlash.css` has `@keyframes io-alarm-flash-medium-text` with `fill: #EAB308` / `fill: #808080` transitions
- [ ] `alarmFlash.css` has `@keyframes io-alarm-flash-advisory-text` with `fill: #06B6D4` / `fill: #808080` transitions
- [ ] `alarmFlash.css` has `@keyframes io-alarm-flash-custom-text` with `fill: #7C3AED` / `fill: #808080` transitions
- [ ] Each `io-alarm-flash-{priority}` class has both a `> *` stroke rule AND a `text` fill rule applying the corresponding text keyframe

## Assessment

After checking:
- **Status**: ⚠️ Wrong
- **What specifically needs to change**: `alarmFlash.css` lines 28–31 define `io-alarm-flash-high > *`, `io-alarm-flash-medium > *`, etc. using `stroke` animations only. There is no text fill animation for P2–P5. Only P1 (`.io-alarm-flash-critical text`) has the separate fill rule (line 27). The `> *` selector does select `<text>` children but only animates their `stroke`, not their `fill`. SVG text color is controlled by `fill`, so the number inside the indicator stays at its last static color.

## Fix Instructions

In `frontend/src/shared/graphics/alarmFlash.css`, add text-specific keyframes and rules for P2–P5, matching the existing P1 pattern:

```css
@keyframes io-alarm-flash-high-text {
  0%, 49.99% { fill: #F97316; }
  50%, 100%  { fill: #808080; }
}
@keyframes io-alarm-flash-medium-text {
  0%, 49.99% { fill: #EAB308; }
  50%, 100%  { fill: #808080; }
}
@keyframes io-alarm-flash-advisory-text {
  0%, 49.99% { fill: #06B6D4; }
  50%, 100%  { fill: #808080; }
}
@keyframes io-alarm-flash-custom-text {
  0%, 49.99% { fill: #7C3AED; }
  50%, 100%  { fill: #808080; }
}

/* Add text rule to existing class selectors */
.io-alarm-flash-high text    { animation: io-alarm-flash-high-text     1s steps(1) infinite; }
.io-alarm-flash-medium text  { animation: io-alarm-flash-medium-text   1s steps(1) infinite; }
.io-alarm-flash-advisory text { animation: io-alarm-flash-advisory-text 1s steps(1) infinite; }
.io-alarm-flash-custom text  { animation: io-alarm-flash-custom-text   1s steps(1) infinite; }
```

Insert these after the existing `io-alarm-flash-custom > *` line (line 31). Keep the `> *` stroke rules — they correctly animate the shape border stroke. The new `text` rules add the text fill animation in parallel.

Do NOT:
- Remove the `> *` stroke rules — they are still needed for the shape stroke animation
- Use `opacity` toggling instead of color alternation — spec requires color-to-gray alternation, not fade
- Use `fill` property on the `> *` rule instead of a separate `text` rule — SVG shapes use `stroke` for their outline color, not `fill`
