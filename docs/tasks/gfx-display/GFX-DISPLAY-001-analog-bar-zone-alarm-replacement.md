---
id: GFX-DISPLAY-001
title: Implement analog bar zone alarm replacement (ISA alarm priority colors per zone)
unit: GFX-DISPLAY
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The analog bar has 5 threshold zones (HH, H, Normal, L, LL). Each zone has two visual layers. Layer 1 is the always-visible muted warm-to-cool ramp (structural). Layer 2 activates when an alarm fires: the zone where the current value sits AND which has an active alarm has its fill color replaced by the full ISA alarm priority color assigned to that threshold. This replacement is per-threshold, per-point — not based on zone position.

## Spec Excerpt (verbatim)

> **Layer 2: Alarm activation (only when alarm fires)**
> When the current value is in a zone AND that zone's configured alarm has fired:
> - The threshold color is **replaced** by the full ISA alarm priority color for that threshold's configured priority
> - The alarm color used depends on what priority the engineer assigned to that specific threshold — NOT on zone position
> — display-elements-implementation-spec.md, §Analog Bar Threshold Zone Colors

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `renderDisplayElement()` case `'analog_bar'` at line 553, zone rendering at lines 566–576; `applyPointValue()` case `'analog_bar'` at lines 1027–1063
- `frontend/src/shared/graphics/displayElements/AnalogBar.tsx` — standalone component (less important — SceneRenderer is used at runtime)
- `frontend/src/shared/types/graphics.ts` — `AnalogBarConfig` type — check if `thresholds` has per-threshold alarm priority fields

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `AnalogBarConfig.thresholds` type includes a per-threshold `alarmPriority` field (e.g., `thresholds.hh` has an `alarmPriority?: 1|2|3|4|5` sub-field)
- [ ] `renderDisplayElement()` for `analog_bar` reads per-threshold alarm priority and replaces zone fill color with the ISA priority color when the point's current alarm priority matches that threshold's configured priority AND the current value is within that zone
- [ ] Zone fill replacement only triggers when an alarm is ACTIVE on that specific threshold — not on all zones simultaneously
- [ ] Normal zone fill (`#404048`) is restored when no alarm is active (no permanent color change)
- [ ] `applyPointValue()` for `analog_bar` also applies zone fill replacement via DOM mutation on the zone `<rect>` elements (requires `data-role="zone-hh"` etc. on each zone rect)

## Assessment

After checking:
- **Status**: ❌ Missing
- **What specifically needs to change**: Zone fills in SceneRenderer.tsx lines 566–576 always use the static muted ramp colors. There is no per-threshold alarm priority substitution. The `applyPointValue()` analog_bar path also does not update zone fill colors.

## Fix Instructions

**Step 1: Update `AnalogBarConfig` type** in `frontend/src/shared/types/graphics.ts`.

The `thresholds` object needs per-threshold `alarmPriority` fields:
```typescript
thresholds?: {
  hh?: number; hhAlarmPriority?: 1 | 2 | 3 | 4 | 5
  h?: number;  hAlarmPriority?:  1 | 2 | 3 | 4 | 5
  l?: number;  lAlarmPriority?:  1 | 2 | 3 | 4 | 5
  ll?: number; llAlarmPriority?: 1 | 2 | 3 | 4 | 5
}
```

**Step 2: Add zone data-role attributes** in `renderDisplayElement()` analog_bar case (SceneRenderer.tsx ~line 576). Each zone `<rect>` needs a `data-role="zone-hh"` / `zone-h` / `zone-normal` / `zone-l` / `zone-ll` attribute so the DOM mutation path can target them.

**Step 3: Compute zone fill in React render** (SceneRenderer.tsx ~line 566). Determine which zone contains the current value:
```typescript
// Determine which zone the current value falls in
const valueZone = (() => {
  if (value === null) return null
  const { hh, h, l, ll } = cfg.thresholds ?? {}
  if (hh !== undefined && value >= hh) return 'hh'
  if (h  !== undefined && value >= h)  return 'h'
  if (ll !== undefined && value < ll)  return 'll'
  if (l  !== undefined && value < l)   return 'l'
  return 'normal'
})()

// Zone fill with alarm replacement
const zoneFills = {
  hh: (valueZone === 'hh' && alarmPriority && cfg.thresholds?.hhAlarmPriority)
      ? ALARM_COLORS[cfg.thresholds.hhAlarmPriority] : ZONE_FILLS.hh,
  h:  (valueZone === 'h'  && alarmPriority && cfg.thresholds?.hAlarmPriority)
      ? ALARM_COLORS[cfg.thresholds.hAlarmPriority]  : ZONE_FILLS.h,
  normal: ZONE_FILLS.normal,  // Normal zone never in alarm
  l:  (valueZone === 'l'  && alarmPriority && cfg.thresholds?.lAlarmPriority)
      ? ALARM_COLORS[cfg.thresholds.lAlarmPriority]  : ZONE_FILLS.l,
  ll: (valueZone === 'll' && alarmPriority && cfg.thresholds?.llAlarmPriority)
      ? ALARM_COLORS[cfg.thresholds.llAlarmPriority] : ZONE_FILLS.ll,
}
```

**Step 4: Update `applyPointValue()` analog_bar case** (SceneRenderer.tsx ~line 1027). After updating pointer position, also update zone fill colors using `el.querySelector('[data-role="zone-hh"]')` etc. Pass alarm priority and threshold config to the function (the `config` parameter already carries `AnalogBarConfig`).

Do NOT:
- Replace ALL zone fills when any alarm is active — only replace the zone containing the current value
- Use the global `alarmPriority` from the point for zone color — use the per-threshold `hhAlarmPriority` / `hAlarmPriority` etc.
- Change the Normal zone fill — it never gets an alarm color (the normal operating range has no configured threshold alarm)
