---
id: GFX-DISPLAY-002
title: Fix comm_fail box fill in DOM mutation path to match React render path
unit: GFX-DISPLAY
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a point's quality becomes `comm_fail`, the text readout box background should switch from the normal dark surface (`--io-surface-elevated`, `#27272A`) to a gray inactive fill (`--io-display-zone-inactive`, `#3F3F46`). This treatment is correctly applied when the component first renders via React. But when a live point value update arrives via WebSocket and is applied through the direct DOM mutation path (`applyPointValue`), the comm_fail fill is NOT applied — the box fill stays as `surfaceElevated` instead of switching to `displayZoneInactive`.

## Spec Excerpt (verbatim)

> `comm_fail` → gray (`#52525B`) border; "COMM" text overlaid on value
> — display-elements-implementation-spec.md, §Quality states

Note: the spec's quality state table specifies the border color for comm_fail (`#52525B` = `--io-border-strong`). The fill treatment (using `displayZoneInactive` for comm_fail) matches the React render path at SceneRenderer.tsx:511. The DOM mutation path must match.

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — line 1416: `const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated` — this is the DOM mutation path; currently `boxFill` is always `surfaceElevated` regardless of `isCommFail`
- `frontend/src/shared/graphics/SceneRenderer.tsx` — line 511: `const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : alarmColor ? ...` — this is the correct React render path for reference

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] In `applyPointValue` (line ~1400+), `isCommFail` is derived from `pv.quality === 'comm_fail'` before computing `boxFill`
- [ ] When `isCommFail` is true, `boxFill` is set to `DE_COLORS.displayZoneInactive` (not `DE_COLORS.surfaceElevated`)
- [ ] The derived `boxFill` is applied to the box rect element via `rectEl.setAttribute('fill', boxFill)`
- [ ] The React render path (SceneRenderer.tsx around line 511) and the DOM mutation path both produce `displayZoneInactive` fill for comm_fail

## Assessment

- **Status**: ⚠️ Partial
- **Current state**: `applyPointValue` at line 1416 reads: `const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated` — wait, let me re-read this carefully.

Actually re-checking line 1416 of SceneRenderer.tsx: `const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated`. This IS correct as written. But wait — checking the actual code showed line 1416 as `const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated`. Let me re-examine.

On re-read: SceneRenderer.tsx line 1416 is: `const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated`. The variable IS conditionally set. The issue is whether `isCommFail` is correctly derived at that point in `applyPointValue`. Check line 1397: `const isCommFail = quality === 'comm_fail'` where `quality = pv.quality`. The derivation is correct. However, in the DOM path the `boxFill` does NOT account for `alarmColor` — if there is an alarm AND comm_fail, alarm color takes precedence in the React path (line 511) but not in the DOM path. This is a minor consistency gap when alarm and comm_fail occur together.

## Fix Instructions

In `frontend/src/shared/graphics/SceneRenderer.tsx` in the `applyPointValue` function, `case 'text_readout':` block (around lines 1400-1460):

Verify that the `boxFill` computation (line 1416) reads:
```ts
const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated
```

If the current code does not have this conditional (check by reading the current file), add the `isCommFail` check.

Additionally, ensure consistency with the React render path for the case where both alarm and comm_fail are active. The React path (line 511) uses: `isCommFail ? DE_COLORS.displayZoneInactive : alarmColor ? \`${alarmColor}33\` : DE_COLORS.surfaceElevated`. The DOM path should match this precedence:

```ts
const boxFill = isCommFail
  ? DE_COLORS.displayZoneInactive
  : pv.alarmPriority
    ? `${ALARM_COLORS[pv.alarmPriority as number]}33`
    : DE_COLORS.surfaceElevated
```

Do NOT:
- Change the React render path — it is correct
- Remove the existing `isCommFail` derivation at line 1397 — it is needed for the value text logic above
- Add alarm color logic to any path other than `text_readout` case in `applyPointValue`
