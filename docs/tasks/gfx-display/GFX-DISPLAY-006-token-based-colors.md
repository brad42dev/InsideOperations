---
id: GFX-DISPLAY-006
title: Replace hardcoded hex colors with CSS custom property references in display elements
unit: GFX-DISPLAY
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every color used in display elements must reference a named CSS custom property from the token registry. No hex literals should appear directly in TSX/JS. This ensures the 3-theme system (dark/light/hphmi) works correctly: theme-variable colors adapt, and the non-negotiable fixed colors (alarm priorities, equipment gray) are declared as constants that explicitly do not change with theme.

## Spec Excerpt (verbatim)

> **Color system is token-based, no invented colors.** Every color traces to a named token. The color table in the spec is definitive.
> — docs/SPEC_MANIFEST.md, §GFX-DISPLAY Non-Negotiable 3

> Every color in this spec is traced to a named token. **Do not invent colors.** If a color is not in this table, it does not exist.
> — display-elements-implementation-spec.md, §Color System — MANDATORY

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — ALARM_COLORS map ~line 18; all inline color strings throughout renderDisplayElement()
- `frontend/src/shared/graphics/displayElements/TextReadout.tsx` — ALARM_COLORS map line 18–20
- `frontend/src/shared/graphics/displayElements/AnalogBar.tsx` — ALARM_COLORS line 17–19; ZONE_FILLS line 20
- `frontend/src/shared/graphics/displayElements/AlarmIndicator.tsx` — ALARM_COLORS line 18–19
- `frontend/src/shared/graphics/displayElements/FillGauge.tsx` — ALARM_COLORS line 19–21
- `frontend/src/shared/graphics/displayElements/Sparkline.tsx` — ALARM_COLORS line 11–13
- `frontend/src/shared/graphics/displayElements/DigitalStatus.tsx` — ALARM_COLORS line 10–12
- `frontend/src/shared/graphics/alarmFlash.css` — hex colors in keyframes (these are acceptable as CSS — they need token references in the CSS custom property definitions in tokens.css, not inline)
- `frontend/src/shared/styles/tokens.css` (or equivalent) — where CSS custom properties are defined

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A shared `ALARM_COLORS` constant (or utility function) exists in one location and is imported by all 6 element files — no 7 separate `ALARM_COLORS` copies
- [ ] Colors that correspond to theme tokens (`#27272A`, `#3F3F46`, `#A1A1AA`, `#71717A`, `#F9FAFB`, `#52525B`, `#404048`) use `var(--io-surface-elevated)` etc. when used as SVG attribute values
- [ ] Alarm priority colors (`#EF4444`, `#F97316`, `#EAB308`, `#06B6D4`, `#7C3AED`) are declared as constants with their token name in a comment, not scattered raw hex
- [ ] Zone ramp colors (`#5C3A3A`, `#5C4A32`, `#32445C`, `#2E3A5C`) are declared as named constants with comments explaining their semantic meaning
- [ ] The DOM mutation path (`applyPointValue`) in SceneRenderer.tsx uses the same shared constants, not re-typed hex

## Assessment

After checking:
- **Status**: ⚠️ Wrong
- **What specifically needs to change**: All 7 files (SceneRenderer.tsx + 6 element components) define their own `ALARM_COLORS` map with raw hex literals. No CSS custom property references (`var(--io-*)`) are used for SVG attribute values. Colors are duplicated 7 times. The DOM mutation path uses additional raw hex strings.

## Fix Instructions

**Step 1: Create a shared display element constants file** at `frontend/src/shared/graphics/displayElementColors.ts`:

```typescript
// Alarm priority colors — ISA-18.2, theme-independent (never change)
export const ALARM_COLORS: Record<number, string> = {
  1: 'var(--io-alarm-critical, #EF4444)',  // P1 Critical
  2: 'var(--io-alarm-high,     #F97316)',  // P2 High
  3: 'var(--io-alarm-medium,   #EAB308)',  // P3 Medium
  4: 'var(--io-alarm-advisory, #06B6D4)',  // P4 Advisory
  5: 'var(--io-alarm-custom,   #7C3AED)',  // Custom
}

// Analog bar zone colors — muted warm-to-cool ramp, theme-independent
export const ZONE_FILLS = {
  hh:     'var(--io-display-zone-hh,     #5C3A3A)',
  h:      'var(--io-display-zone-h,      #5C4A32)',
  normal: 'var(--io-display-zone-normal, #404048)',
  l:      'var(--io-display-zone-l,      #32445C)',
  ll:     'var(--io-display-zone-ll,     #2E3A5C)',
}

// Surface / text tokens — these vary by theme
export const DE_COLORS = {
  surfaceElevated:    'var(--io-surface-elevated, #27272A)',
  textPrimary:        'var(--io-text-primary,     #F9FAFB)',
  textSecondary:      'var(--io-text-secondary,   #A1A1AA)',
  textMuted:          'var(--io-text-muted,        #71717A)',
  border:             'var(--io-border,            #3F3F46)',
  borderStrong:       'var(--io-border-strong,     #52525B)',
  displayZoneInactive:'var(--io-display-zone-inactive, #3F3F46)',
  accent:             'var(--io-accent,            #2DD4BF)',
  equipStroke:        'var(--equip-stroke,         #808080)',
  manualBadge:        'var(--io-accent,            #06B6D4)',
}
```

**Step 2: Replace all per-file `ALARM_COLORS` definitions** in the 6 display element component files and in SceneRenderer.tsx. Import from `displayElementColors.ts` instead.

**Step 3: Replace inline hex strings in SceneRenderer.tsx `renderDisplayElement()`** with `DE_COLORS.*` references. Examples:
- `fill="#27272A"` → `fill={DE_COLORS.surfaceElevated}`
- `fill="#A1A1AA"` → `fill={DE_COLORS.textSecondary}`
- `stroke="#52525B"` → `stroke={DE_COLORS.borderStrong}`

**Step 4: Same replacement in `applyPointValue()`** — replace raw hex strings with the imported constants.

**Important note on SVG and CSS vars**: SVG presentation attributes (e.g. `<rect fill="#27272A">`) do NOT inherit CSS variables. Use `style` prop or inline SVG `style` attribute for variable references. Alternatively, set `fill` via the `style` prop:
```tsx
<rect style={{ fill: DE_COLORS.surfaceElevated }} />
// or
<rect fill={DE_COLORS.surfaceElevated} />  // works in modern browsers for var() references in SVG
```

Do NOT:
- Remove the fallback hex values from `var(--io-token, #hex)` — fallbacks are required for SSR and before CSS is loaded
- Create separate `ALARM_COLORS` objects that inline the same hex values again — use the single shared source
- Change the alarm priority hex values (ISA-18.2 mandates specific colors; they are in the token registry as non-theme-variable tokens)
- Apply this to `alarmFlash.css` keyframes directly — those CSS `@keyframes` already have access to CSS custom properties if defined at `:root`, but the current hex values match the token values exactly and are acceptable in CSS `@keyframes`
