---
id: GFX-DISPLAY-001
title: Fix text readout alarm flash to use per-priority color instead of hardcoded Critical red
unit: GFX-DISPLAY
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When a text readout element has an unacknowledged alarm, its box and background should flash at 1Hz between the alarm's priority color and the normal gray. A P2 High alarm (orange, `#F97316`) should flash orange. A P4 Advisory alarm (cyan, `#06B6D4`) should flash cyan. Currently every unacknowledged alarm flashes with Critical red `#EF4444` regardless of the actual alarm priority.

## Spec Excerpt (verbatim)

> **Unacknowledged**: border and background alternate alarm color ↔ gray at 1Hz. Text NEVER flashes.
> — display-elements-implementation-spec.md, §Text Readout, In Alarm State

> When an alarm fires and the value is in that zone, the threshold color is **replaced** by the full ISA alarm priority color configured for that threshold's configured priority
> — display-elements-implementation-spec.md, §Color System

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/alarmFlash.css` — line 54-60: the generic `.io-alarm-flash` class and `io-alarm-box-flash` keyframe that hardcodes Critical red
- `frontend/src/shared/graphics/SceneRenderer.tsx` — line 523: `flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''` — always applies the generic class regardless of priority

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `alarmFlash.css` has per-priority box flash keyframes for all 5 priorities (critical, high, medium, advisory, custom) that each use the correct ISA alarm color
- [ ] Each per-priority box keyframe alternates between `fill: <alarm-color>33; stroke: <alarm-color>` and `fill: var(--io-surface-elevated, #27272A); stroke: var(--io-border, #3F3F46)` — NOT hardcoded `#27272A`/`#3F3F46`
- [ ] SceneRenderer.tsx `flashClass` derivation maps alarm priority (1-5) to the correct per-priority class name (e.g. priority 2 → `io-alarm-box-flash-high`)
- [ ] A P1 Critical unacknowledged alarm applies `io-alarm-box-flash-critical` class
- [ ] A P2 High unacknowledged alarm applies `io-alarm-box-flash-high` class (orange flash, not red)
- [ ] Text within the box never flashes (only `rect` is targeted by the animation)

## Assessment

- **Status**: ⚠️ Partial
- **Current state**: `alarmFlash.css` has per-priority classes for `AlarmIndicator` elements (`io-alarm-flash-critical`, `io-alarm-flash-high`, etc.). Text readout uses a separate generic `io-alarm-flash` class (line 54) whose `io-alarm-box-flash` keyframe hardcodes Critical red (`#EF4444`, line 58) and surface colors (`#27272A`, `#3F3F46`, line 58-59). SceneRenderer.tsx line 523 applies the same `'io-alarm-flash'` class regardless of `alarmPriority`.

## Fix Instructions

**In `frontend/src/shared/graphics/alarmFlash.css`:**

Remove the current `.io-alarm-flash` / `io-alarm-box-flash` block (lines 53-60).

Add 5 per-priority box flash keyframes, one per alarm priority. Each should alternate between the alarm color (at 20% opacity fill + full-opacity stroke) and the token-referenced defaults:

```css
@keyframes io-alarm-box-flash-critical {
  0%, 49.99% { fill: rgba(239,68,68,0.2); stroke: #EF4444; }
  50%, 100%  { fill: var(--io-surface-elevated, #27272A); stroke: var(--io-border, #3F3F46); }
}
@keyframes io-alarm-box-flash-high {
  0%, 49.99% { fill: rgba(249,115,22,0.2); stroke: #F97316; }
  50%, 100%  { fill: var(--io-surface-elevated, #27272A); stroke: var(--io-border, #3F3F46); }
}
@keyframes io-alarm-box-flash-medium {
  0%, 49.99% { fill: rgba(234,179,8,0.2); stroke: #EAB308; }
  50%, 100%  { fill: var(--io-surface-elevated, #27272A); stroke: var(--io-border, #3F3F46); }
}
@keyframes io-alarm-box-flash-advisory {
  0%, 49.99% { fill: rgba(6,182,212,0.2); stroke: #06B6D4; }
  50%, 100%  { fill: var(--io-surface-elevated, #27272A); stroke: var(--io-border, #3F3F46); }
}
@keyframes io-alarm-box-flash-custom {
  0%, 49.99% { fill: rgba(124,58,237,0.2); stroke: #7C3AED; }
  50%, 100%  { fill: var(--io-surface-elevated, #27272A); stroke: var(--io-border, #3F3F46); }
}

.io-alarm-box-flash-critical rect { animation: io-alarm-box-flash-critical 1s steps(1) infinite; }
.io-alarm-box-flash-high rect     { animation: io-alarm-box-flash-high 1s steps(1) infinite; }
.io-alarm-box-flash-medium rect   { animation: io-alarm-box-flash-medium 1s steps(1) infinite; }
.io-alarm-box-flash-advisory rect { animation: io-alarm-box-flash-advisory 1s steps(1) infinite; }
.io-alarm-box-flash-custom rect   { animation: io-alarm-box-flash-custom 1s steps(1) infinite; }
```

**In `frontend/src/shared/graphics/SceneRenderer.tsx` around line 523:**

Replace:
```tsx
const flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''
```
With a priority-to-class map:
```tsx
const ALARM_BOX_FLASH_CLASS: Record<number, string> = {
  1: 'io-alarm-box-flash-critical',
  2: 'io-alarm-box-flash-high',
  3: 'io-alarm-box-flash-medium',
  4: 'io-alarm-box-flash-advisory',
  5: 'io-alarm-box-flash-custom',
}
const flashClass = unacked && priority ? (ALARM_BOX_FLASH_CLASS[priority] ?? '') : ''
```

This map can be defined once near the top of the file or in `displayElementColors.ts`.

Do NOT:
- Add JS animation via `setInterval` or `requestAnimationFrame` — CSS-only is the spec requirement
- Flash the text element — only the `rect` box flashes; text never flashes
- Use the existing `io-alarm-flash-*` classes (those are for AlarmIndicator, which toggles stroke on SVG shapes, not box fill)
- Introduce a 7th priority level or new color not in the ISA color table
