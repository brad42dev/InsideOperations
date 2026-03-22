---
id: GFX-DISPLAY-005
title: Implement signal line for text_readout, fill_gauge, sparkline, and digital_status
unit: GFX-DISPLAY
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

A signal line is an optional dashed SVG `<line>` that connects a display element back to its associated shape or instrument bubble. It is a visual association cue — not required but available to users. When `cfg.showSignalLine` is true, the dashed line should draw from the display element's attachment edge back to the parent shape's origin. Currently only `analog_bar` implements this; the other four element types do not.

## Spec Excerpt (verbatim)

> **Signal line** — dashed connector from display element back to parent SymbolInstance when `cfg.showSignalLine`. Drawn in SVG as `<line>` with `strokeDasharray="3 2"`.
> — docs/SPEC_MANIFEST.md, §GFX-DISPLAY Non-Negotiable 7

> ### Signal Lines
> Optional dashed lines connecting display elements to their associated shape or instrument bubble:
> - **Stroke**: `#52525B` (`--io-border-strong`)
> - **Width**: 0.75px
> - **Dash**: `3 2`
> — display-elements-implementation-spec.md, §Signal Lines

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `renderDisplayElement()`, analog_bar signal line at lines 599–613 (reference implementation to copy from)
- `frontend/src/shared/types/graphics.ts` — `TextReadoutConfig`, `FillGaugeConfig`, `SparklineConfig`, `DigitalStatusConfig` — check if `showSignalLine` field exists on each config type
- `frontend/src/shared/graphics/displayElements/AnalogBar.tsx` — the AnalogBar standalone component also has `showSignalLine` in config (line 23) — same pattern needed for other element standalone components

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `TextReadoutConfig` type has a `showSignalLine?: boolean` field
- [ ] `FillGaugeConfig` type has a `showSignalLine?: boolean` field
- [ ] `SparklineConfig` type has a `showSignalLine?: boolean` field
- [ ] `DigitalStatusConfig` type has a `showSignalLine?: boolean` field
- [ ] `renderDisplayElement()` text_readout case renders a signal line `<line>` when `cfg.showSignalLine && parentOffset`
- [ ] `renderDisplayElement()` fill_gauge case renders a signal line when `cfg.showSignalLine && parentOffset`
- [ ] `renderDisplayElement()` sparkline case renders a signal line when `cfg.showSignalLine && parentOffset`
- [ ] `renderDisplayElement()` digital_status case renders a signal line when `cfg.showSignalLine && parentOffset`

## Assessment

After checking:
- **Status**: ❌ Missing for 4 of 5 element types
- **What specifically needs to change**: Only `analog_bar` has signal line logic (SceneRenderer.tsx:599–613). The other four cases (`text_readout`, `fill_gauge`, `sparkline`, `digital_status`) have no `showSignalLine` check. The config types may not have the `showSignalLine` field — check `graphics.ts` first.

## Fix Instructions

**Step 1: Add `showSignalLine?: boolean` to the missing config types** in `frontend/src/shared/types/graphics.ts`. Check which of the 4 types are missing it; add the field to each.

**Step 2: Add signal line rendering** to each of the 4 element types in `renderDisplayElement()` (SceneRenderer.tsx). Follow the analog_bar pattern exactly (lines 599–613):

```tsx
{cfg.showSignalLine && parentOffset && (() => {
  const ex = -parentOffset.x
  const ey = -parentOffset.y
  // Origin of this element (relative to itself) connects back to parent origin
  return (
    <line
      x1={0} y1={h / 2}  // or appropriate attachment edge for this element type
      x2={ex} y2={ey}
      stroke="#52525B"
      strokeWidth={0.75}
      strokeDasharray="3 2"
    />
  )
})()}
```

Attachment edge `x1,y1` per element type:
- `text_readout`: left edge center → `x1={0} y1={h / 2}`
- `fill_gauge` (standalone): `x1={0} y1={bh / 2}` (left edge center)
- `sparkline`: `x1={0} y1={H / 2}` (left edge center, H=18)
- `digital_status`: `x1={0} y1={h / 2}` (left edge center, h=22)

Do NOT:
- Render a signal line when `parentOffset` is undefined (standalone elements have no parent shape)
- Render a signal line inside the `FillGauge` or `Sparkline` standalone component files — this logic belongs in `renderDisplayElement()` in SceneRenderer only
- Use `strokeDasharray="4 2"` — the spec is `"3 2"`, distinct from the bad/stale quality dash pattern
