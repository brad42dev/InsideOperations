# Alarm Token Rename — Implementation Plan

## Overview

This plan renames and revalues alarm-related CSS custom property tokens across the entire frontend. Work through the steps in order. Steps 1–5 update token definition files. Steps 6–12 update individual component files with surgical edits. Step 13 handles batch renames across dashboard widgets and the rounds/designer files. Step 14 updates the canvas color library chain. Step 15 handles the `--io-fill-normal` value change and opacity additions. Step 16 updates documentation. Step 17 is verification.

**Do not start step 2 before completing step 1.** All other steps within a group are independent and can be parallelised.

---

## Step 1 — Update `frontend/src/shared/theme/tokens.ts`

File: `/home/io/io-dev/io/frontend/src/shared/theme/tokens.ts`

Make the following edits to all three token objects. Line numbers reference the current file.

### 1a. `darkTokens` — Alarm Priority block (lines 44–51)

Replace the entire alarm priority section (lines 44–51) plus the operational status section alarm entries (lines 59–61) with:

```ts
  // Alarm Priority (ISA-101 — NOT user-customizable)
  "--io-alarm-urgent": "#ef4444",
  "--io-alarm-high": "#f97316",
  "--io-alarm-low": "#eab308",
  "--io-alarm-diagnostic": "#f4f4f5",
  "--io-alarm-custom": "#60a5fa",
  "--io-alarm-shelved": "#d946ef",
```

And in the Operational Status section (lines 59–61), replace:

```ts
  "--io-alarm-normal": "#22c55e",
  "--io-alarm-suppressed": "#a78bfa",    // remove this line
  "--io-alarm-disabled": "#71717a",
```

with:

```ts
  "--io-alarm-normal": "#22c55e",
  "--io-alarm-disabled": "#52525b",
```

Note: `--io-alarm-shelved` has moved up into the Alarm Priority block. `--io-alarm-fault` is deleted. `--io-alarm-suppressed` is deleted (replaced by `--io-alarm-shelved` which is now in the priority block).

Full resulting darkTokens alarm + operational block:
```ts
  // Alarm Priority (ISA-101 — NOT user-customizable)
  "--io-alarm-urgent": "#ef4444",
  "--io-alarm-high": "#f97316",
  "--io-alarm-low": "#eab308",
  "--io-alarm-diagnostic": "#f4f4f5",
  "--io-alarm-custom": "#60a5fa",
  "--io-alarm-shelved": "#d946ef",

  // Operational Status
  "--io-alarm-normal": "#22c55e",
  "--io-alarm-disabled": "#52525b",
```

### 1b. `lightTokens` — Alarm Priority block (lines 241–248) and Operational Status (lines 255–258)

Replace lines 241–248 with:
```ts
  // Alarm Priority
  "--io-alarm-urgent": "#dc2626",
  "--io-alarm-high": "#d97706",
  "--io-alarm-low": "#ca8a04",
  "--io-alarm-diagnostic": "#0891b2",
  "--io-alarm-custom": "#6d28d9",
  "--io-alarm-shelved": "#7c3aed",
```

Replace lines 255–258 with:
```ts
  // Operational Status
  "--io-alarm-normal": "#16a34a",
  "--io-alarm-disabled": "#9ca3af",
```

(Remove `--io-alarm-suppressed: #7c3aed` — it becomes `--io-alarm-shelved: #7c3aed` in the priority block above. Remove `--io-alarm-fault: #c026d3` entirely.)

### 1c. `hphmiTokens` — Alarm Priority block (lines 439–446) and Operational Status (lines 453–457)

Replace lines 439–446 with:
```ts
  // Alarm Priority
  "--io-alarm-urgent": "#ef4444",
  "--io-alarm-high": "#f59e0b",
  "--io-alarm-low": "#eab308",
  "--io-alarm-diagnostic": "#06b6d4",
  "--io-alarm-custom": "#7c3aed",
  "--io-alarm-shelved": "#a78bfa",
```

Replace lines 453–457 with:
```ts
  // Operational Status
  "--io-alarm-normal": "#22c55e",
  "--io-alarm-disabled": "#64748b",
```

(Remove `--io-alarm-suppressed: #a78bfa` — becomes `--io-alarm-shelved: #a78bfa` in priority block above. Remove `--io-alarm-fault: #d946ef` entirely.)

---

## Step 2 — Update `frontend/src/index.css`

File: `/home/io/io-dev/io/frontend/src/index.css`

### 2a. Dark theme block — `:root,[data-theme="dark"]` (lines 42–59)

Replace the alarm priority block (lines 42–48) with:
```css
  /* Alarm Priority — ISA-101 / ISA-18.2 (7, NOT customizable) */
  --io-alarm-urgent: #ef4444;
  --io-alarm-high: #f97316;
  --io-alarm-low: #eab308;
  --io-alarm-diagnostic: #f4f4f5;
  --io-alarm-custom: #60a5fa;
  --io-alarm-shelved: #d946ef;
```

Change `--io-fill-normal` at line 51:
```css
  --io-fill-normal: #475569;
```

Replace the Operational Status block (lines 56–59) with:
```css
  /* Operational Status (2) */
  --io-alarm-normal: #22c55e;
  --io-alarm-disabled: #52525b;
```

### 2b. Light theme block — `[data-theme="light"]` (lines 244–261)

Replace the alarm priority lines (244–250) with:
```css
  --io-alarm-urgent: #dc2626;
  --io-alarm-high: #d97706;
  --io-alarm-low: #ca8a04;
  --io-alarm-diagnostic: #0891b2;
  --io-alarm-custom: #6d28d9;
  --io-alarm-shelved: #7c3aed;
```

Replace the operational status lines (259–261) with:
```css
  --io-alarm-normal: #16a34a;
  --io-alarm-disabled: #9ca3af;
```

### 2c. HPHMI theme block — `[data-theme="hphmi"]` (lines 441–458)

Replace alarm priority lines (441–447) with:
```css
  --io-alarm-urgent: #ef4444;
  --io-alarm-high: #f59e0b;
  --io-alarm-low: #eab308;
  --io-alarm-diagnostic: #06b6d4;
  --io-alarm-custom: #7c3aed;
  --io-alarm-shelved: #a78bfa;
```

Replace operational status lines (455–458) with:
```css
  --io-alarm-normal: #22c55e;
  --io-alarm-disabled: #64748b;
```

### 2d. Data Quality CSS classes (lines 683–694)

Line 684: `outline: 1px dashed var(--io-alarm-critical);`
→ `outline: 1px dashed var(--io-alarm-urgent);`

Line 694: `outline: 1px solid var(--io-alarm-advisory);`
→ `outline: 1px solid var(--io-alarm-diagnostic);`

---

## Step 3 — Update `frontend/src/shared/graphics/alarmFlash.css`

File: `/home/io/io-dev/io/frontend/src/shared/graphics/alarmFlash.css`

Rename all keyframes and class selectors:

| Old string | New string |
|---|---|
| `io-alarm-flash-critical` | `io-alarm-flash-urgent` |
| `io-alarm-flash-critical-text` | `io-alarm-flash-urgent-text` |
| `io-alarm-flash-medium` | `io-alarm-flash-low` |
| `io-alarm-flash-medium-text` | `io-alarm-flash-low-text` |
| `io-alarm-flash-advisory` | `io-alarm-flash-diagnostic` |
| `io-alarm-flash-advisory-text` | `io-alarm-flash-diagnostic-text` |

Also update hardcoded hex values inside keyframe bodies:
- `@keyframes io-alarm-flash-custom` and `io-alarm-flash-custom-text`: change `#7c3aed` → `#60a5fa`
- All others: hex values remain as-is (urgent stays `#ef4444`, low stays `#eab308`, etc.)

---

## Step 4 — Update `frontend/src/shared/graphics/displayElementColors.ts`

File: `/home/io/io-dev/io/frontend/src/shared/graphics/displayElementColors.ts`

Replace the `ALARM_COLORS` object entirely:

```ts
export const ALARM_COLORS: Record<number, string> = {
  1: "var(--io-alarm-urgent,     #EF4444)", // P1 Urgent
  2: "var(--io-alarm-high,       #F97316)", // P2 High
  3: "var(--io-alarm-low,        #EAB308)", // P3 Low
  4: "var(--io-alarm-diagnostic, #F4F4F5)", // P4 Diagnostic
  5: "var(--io-alarm-custom,     #60A5FA)", // Custom
};
```

Note: Fallback hex for P4 changes from `#06B6D4` → `#F4F4F5`. Fallback for P5 changes from `#7C3AED` → `#60A5FA`. Fallback for P2 changes from `#F59E0B` → `#F97316`.

---

## Step 5 — Update ALARM_PRIORITY_NAMES maps

### 5a. `frontend/src/shared/graphics/displayElements/AlarmIndicator.tsx`

Update the `names` map inside `getFlashClass` (lines 28–34):

```ts
  const names: Record<number, string> = {
    1: "urgent",
    2: "high",
    3: "low",
    4: "diagnostic",
    5: "custom",
  };
  return `io-alarm-flash-${names[priority] ?? "urgent"}`;
```

### 5b. `frontend/src/shared/graphics/SceneRenderer.tsx`

Update `ALARM_PRIORITY_NAMES` at line 2712:

```ts
const ALARM_PRIORITY_NAMES: Record<number, string> = {
  1: "urgent",
  2: "high",
  3: "low",
  4: "diagnostic",
  5: "custom",
};
```

---

## Step 6 — Update `frontend/src/api/alarms.ts`

File: `/home/io/io-dev/io/frontend/src/api/alarms.ts`

### 6a. `AlarmPriority` type union (~line 8)

```ts
export type AlarmPriority = "urgent" | "high" | "low" | "diagnostic";
```

### 6b. Default fallback value in `mapHistoryItem` (~line 34)

Change `"advisory"` → `"diagnostic"` (the fallback when priority is unrecognized).

### 6c. `AlarmDefinitionPriority` type — remove "medium"

This type includes backend values. Remove `"medium"` if present; the enum now has `urgent, high, low, diagnostic` (no medium at CSS level, and the backend enum also has no "medium" in practice for OPC alarms).

---

## Step 7 — Update `frontend/src/shared/components/ForensicsPlaybackBar.tsx`

File: `/home/io/io-dev/io/frontend/src/shared/components/ForensicsPlaybackBar.tsx`

Lines 25–30 — replace the `ALARM_PRIORITY_COLORS` map:

```ts
const ALARM_PRIORITY_COLORS: Record<AlarmPriority, string> = {
  urgent: "var(--io-alarm-urgent)",
  high: "var(--io-alarm-high)",
  low: "var(--io-alarm-low)",
  diagnostic: "var(--io-alarm-diagnostic)",
};
```

(Fixes pre-existing bug: old key `"advisory"` did not match `alarm_priority_enum` value `"diagnostic"`.)

---

## Step 8 — Update `frontend/src/shared/components/HistoricalPlaybackBar.tsx`

File: `/home/io/io-dev/io/frontend/src/shared/components/HistoricalPlaybackBar.tsx`

Lines 31–36 — same replacement as ForensicsPlaybackBar:

```ts
const ALARM_PRIORITY_COLORS: Record<AlarmPriority, string> = {
  urgent: "var(--io-alarm-urgent)",
  high: "var(--io-alarm-high)",
  low: "var(--io-alarm-low)",
  diagnostic: "var(--io-alarm-diagnostic)",
};
```

---

## Step 9 — Update `frontend/src/shared/components/ContextMenu.tsx`

Line 241: `"var(--io-alarm-critical)"` → `"var(--io-alarm-urgent)"`

---

## Step 10 — Update `frontend/src/shared/layout/AppShell.tsx`

Three locations — change `--io-alarm-critical` to `--io-alarm-urgent`:

- Line 417: `"var(--io-alarm-critical)"` → `"var(--io-alarm-urgent)"`
- Line 1536: `"var(--io-alarm-critical, #ef4444)"` → `"var(--io-alarm-urgent, #ef4444)"`
- Line 1563: `"var(--io-alarm-critical, #ef4444)"` → `"var(--io-alarm-urgent, #ef4444)"`

The fallback hex `#ef4444` is still correct for urgent red.

---

## Step 11 — Update TypeScript type unions in component files

### 11a. `frontend/src/pages/console/panes/AlarmListPane.tsx`

Line 11: `priority: "critical" | "high" | "medium" | "low"` → `"urgent" | "high" | "low" | "diagnostic"`

Line ~20: `ApiAlarm.severity` type: change `"critical" | "high" | "medium" | "low" | "info"` → `"urgent" | "high" | "low" | "diagnostic" | "info"`

Line ~32 — `PRIORITY_COLOR` map: rename keys and update values:
```ts
const PRIORITY_COLOR: Record<AlarmRow["priority"], string> = {
  urgent: "#EF4444",
  high: "#F97316",
  low: "#EAB308",
  diagnostic: "#F4F4F5",
};
```

Line ~39 — `PRIORITY_LABEL` map: rename `critical` → `urgent`, `medium` → `low`, add `diagnostic` key.

Also scan for any `priority === "critical"` or `priority === "medium"` string comparisons in this file and update.

### 11b. `frontend/src/api/points.ts`

Line 149: `priority: "critical" | "high" | "medium" | "low" | string`
→ `priority: "urgent" | "high" | "low" | "diagnostic" | string`

### 11c. `frontend/src/shared/components/charts/renderers/chart12-alarm-indicator.tsx`

Line 20: `priority?: "critical" | "high" | "medium" | "low"` → `"urgent" | "high" | "low" | "diagnostic"`

Line 23: `AlarmLevel` type: `"urgent" | "high" | "low" | "diagnostic" | "normal"`

Lines 25–31: `LEVEL_ORDER` array:
```ts
const LEVEL_ORDER: AlarmLevel[] = ["urgent", "high", "low", "diagnostic", "normal"];
```

Scan rest of file for string literals `"critical"` or `"medium"` and update.

---

## Step 12 — Exception: Rounds "skipped" status — use `--io-warning`

These two files use `--io-alarm-suppressed` for a non-alarm purpose (the violet color for "skipped" rounds badge). They must NOT become `--io-alarm-shelved`. They should use `--io-warning` (amber) instead.

### 12a. `frontend/src/pages/rounds/RoundHistory.tsx`

Line 12: `text: "var(--io-alarm-critical)"` → `text: "var(--io-alarm-urgent)"`
Line 15: `text: "var(--io-alarm-suppressed)"` → `text: "var(--io-warning)"`

### 12b. `frontend/src/pages/rounds/ActiveRounds.tsx`

Line 12: `text: "var(--io-alarm-critical)"` → `text: "var(--io-alarm-urgent)"`
Line 15: `text: "var(--io-alarm-suppressed)"` → `text: "var(--io-warning)"`

---

## Step 13 — Batch rename: dashboard widgets, rounds player, designer

Apply these token substitutions in the listed files:
- `var(--io-alarm-critical)` → `var(--io-alarm-urgent)`
- `resolveToken("--io-alarm-critical")` → `resolveToken("--io-alarm-urgent")`
- `var(--io-alarm-medium)` → `var(--io-alarm-low)`
- Object keys `critical:` → `urgent:`, `medium:` → `low:` where they appear as map keys

**Files and relevant line numbers:**

| File | Lines with tokens to rename |
|---|---|
| `pages/dashboards/widgets/AlarmListWidget.tsx` | 25 (critical→urgent), 27 (medium→low); also rename object keys |
| `pages/dashboards/widgets/ApiResponseTimeWidget.tsx` | 24 (critical→urgent), 26 (medium→low) |
| `pages/dashboards/widgets/OpenAlertsWidget.tsx` | 11, 125 (critical→urgent); 13, 128 (medium→low); rename object keys |
| `pages/dashboards/widgets/AlarmCountBySeverityWidget.tsx` | 21 (critical→urgent), 23 (medium→low); rename keys |
| `pages/dashboards/widgets/RoundsCompletionWidget.tsx` | 106 (medium→low) |
| `pages/dashboards/widgets/ProductionStatusWidget.tsx` | 49, 65, 221 — critical→urgent on 49; medium→low on 65, 221 |
| `pages/dashboards/widgets/UnackCountWidget.tsx` | 47 (critical→urgent), 49 (medium→low) |
| `pages/dashboards/widgets/ServiceHealthWidget.tsx` | 12 (medium→low), 13 (critical→urgent); rename keys |
| `pages/dashboards/widgets/GaugeWidget.tsx` | 84, 95 (critical→urgent) |
| `pages/dashboards/widgets/KpiCard.tsx` | 28 (critical→urgent) |
| `pages/dashboards/widgets/SystemUptimeWidget.tsx` | 76 (medium→low), 160 (medium→low), 183 (critical→urgent) |
| `pages/dashboards/widgets/AlarmKpiWidget.tsx` | 66 (critical→urgent), 68 (medium→low) |
| `pages/dashboards/widgets/AreaStatusTableWidget.tsx` | 28 (critical→urgent), 30 (medium→low); rename keys |
| `pages/dashboards/widgets/AlertStatusWidget.tsx` | 27 (critical→urgent), 29 (medium→low); rename keys |
| `pages/dashboards/widgets/PointStatusTableWidget.tsx` | 45 (critical→urgent), 47 (medium→low) |
| `pages/dashboards/widgets/AlarmHealthKpiWidget.tsx` | 41 (medium→low), 43 (critical→urgent), 163 (medium→low), 209 (critical→urgent) |
| `pages/dashboards/widgets/ServiceHealthTableWidget.tsx` | 23 (medium→low), 24 (critical→urgent); rename keys |
| `pages/rounds/RoundPlayer.tsx` | critical→urgent at lines 71, 225, 525, 671, 704, 1001, 1011, 1051, 1053, 1083, 1093, 1133, 1135, 1164, 1549, 1733, 1915, 2010 |
| `pages/rounds/index.tsx` | 49 (critical→urgent), 239 (high unchanged), 441 (critical→urgent) |
| `pages/rounds/RoundSchedules.tsx` | 310 (critical→urgent) |
| `pages/rounds/TemplateDesigner.tsx` | 255, 408, 676, 746, 1341 (all critical→urgent) |
| `pages/designer/index.tsx` | 788 (critical→urgent) |
| `pages/designer/components/PromoteToShapeWizard.tsx` | Lines 634, 1919, 1921 — high unchanged |
| `pages/designer/components/SaveAsStencilDialog.tsx` | Lines 216, 218 — high unchanged |

---

## Step 14 — Update canvas color library: `theme-colors.ts` and `echarts-themes.ts`

### 14a. `frontend/src/shared/theme/theme-colors.ts`

**Interface** `ThemeColorSet` (~lines 26–29): rename fields:
```ts
  alarmUrgent: string;
  alarmHigh: string;
  alarmLow: string;
  alarmDiagnostic: string;
```

**`light` object** (~lines 54–58): rename keys, preserve hex values:
```ts
    alarmUrgent: "#dc2626",
    alarmHigh: "#d97706",
    alarmLow: "#ca8a04",
    alarmDiagnostic: "#0891b2",
```

**`dark` object** (~lines 79–83): rename keys, update to new dark hex:
```ts
    alarmUrgent: "#ef4444",
    alarmHigh: "#f97316",
    alarmLow: "#eab308",
    alarmDiagnostic: "#f4f4f5",
```

**`high-contrast` object** (~lines 104–108): rename keys, preserve hex:
```ts
    alarmUrgent: "#ef4444",
    alarmHigh: "#f59e0b",
    alarmLow: "#eab308",
    alarmDiagnostic: "#06b6d4",
```

### 14b. `frontend/src/shared/theme/echarts-themes.ts`

Find the `alarm` sub-object (lines ~92–97) and update keys and field references:
```ts
    alarm: {
      urgent: c.alarmUrgent,
      high: c.alarmHigh,
      low: c.alarmLow,
      diagnostic: c.alarmDiagnostic,
    },
```

---

## Step 15 — Update `--io-fill-normal` usage in graphics components

The token value changes from `rgba(71,85,105,0.5)` to `#475569` (opaque). Components that use this for normal fill must add `opacity: 0.6` so the visual result is equivalent.

### 15a. `frontend/src/shared/graphics/displayElements/FillGauge.tsx`

Find the fallback fill color calculation (~line 52). Replace hardcoded rgba fallback with the token and add an opacity variable:

```ts
  const fillColor = alarmPriority
    ? `${ALARM_COLORS[alarmPriority]}4D`
    : "var(--io-fill-normal)";
  const fillOpacity = alarmPriority ? 1 : 0.6;
```

Then on the `<rect>` element that renders the fill level, add `opacity={fillOpacity}`.

### 15b. `frontend/src/shared/graphics/SceneRenderer.tsx`

Find the analogous fallback (~line 1476):
```ts
: "rgba(71,85,105,0.6)"; // rgba fallback intentional — no token for translucent fill
```

Change to:
```ts
: "var(--io-fill-normal)"; // token value; opacity applied on fill rect
```

Then locate the `<rect>` or `setAttribute` call that applies this `fillColor` value and add `opacity="0.6"` (SVG attribute). There may be both a React render path and a DOM mutation path — update both. Search for usages of the `fillColor` variable in this file after line 1476.

---

## Step 16 — Update `docs/themes/dark.md`

File: `/home/io/io-dev/io/docs/themes/dark.md`

### 16a. Alarm Priority section (lines 62–72) — replace table

```md
## Alarm Priority (ISA-101 / ISA-18.2 — NOT user-customizable)

| Token | Value | Priority Level | Notes |
|---|---|---|---|
| `--io-alarm-urgent` | `#ef4444` | P1 — Urgent | Red-500. Operator action required immediately. |
| `--io-alarm-high` | `#f97316` | P2 — High | Orange-500. Operator action required soon. |
| `--io-alarm-low` | `#eab308` | P3 — Low | Yellow-500. Operator action required eventually. |
| `--io-alarm-diagnostic` | `#f4f4f5` | P4 — Diagnostic | Zinc-100 (white). Diagnostic/Journal; no urgency implied. |
| `--io-alarm-custom` | `#60a5fa` | Custom | Blue-400. User-defined; circle indicator shape. |
| `--io-alarm-shelved` | `#d946ef` | Shelved | Fuchsia-500. Alarm active but operator-suppressed. |
```

### 16b. Operational Status section (lines 76–82) — replace table

```md
## Operational Status

| Token | Value | Notes |
|---|---|---|
| `--io-alarm-normal` | `#22c55e` | Green-500. Point in normal state |
| `--io-alarm-disabled` | `#52525b` | Zinc-600. Disabled alarm; no action possible |
```

### 16c. Update "Graphics Display Elements" section

The section already exists. Update the `--io-fill-normal` row:

Old: `| \`--io-fill-normal\` | \`rgba(71,85,105,0.5)\` | Fill gauge level color — applied at 60% opacity on the element |`

New:
```md
| `--io-fill-normal` | `#475569` | Slate-600. Normal (non-alarm) fill for FillGauge and pipe fills. **Components apply `opacity: 0.6` on the fill element** — the visual result approximates the previous `rgba(71,85,105,0.5)`. |
```

Add a note below the table:
```md
> **v0.7 change:** `--io-fill-normal` changed from `rgba(71,85,105,0.5)` to `#475569`. Opacity is now applied on the SVG element (`opacity: 0.6`) rather than in the color value.
```

### 16d. Add change log at bottom

```md
---

## Change Log

### v0.7 — Alarm Token Rename
- `--io-alarm-critical` → `--io-alarm-urgent` (hex unchanged: `#ef4444`)
- `--io-alarm-high` hex updated: `#f59e0b` → `#f97316` (Amber → Orange-500)
- `--io-alarm-medium` → `--io-alarm-low` (hex unchanged: `#eab308`)
- `--io-alarm-advisory` → `--io-alarm-diagnostic` (hex changed: `#06b6d4` → `#f4f4f5`)
- `--io-alarm-custom` hex updated: `#7c3aed` → `#60a5fa` (Violet → Blue-400)
- `--io-alarm-suppressed` → `--io-alarm-shelved`; moved from Operational Status into Alarm Priority
- `--io-alarm-fault` removed; all usages replaced with `--io-alarm-shelved`
- `--io-alarm-disabled` hex updated: `#71717a` → `#52525b` (Zinc-500 → Zinc-600)
- `--io-fill-normal` changed from `rgba(71,85,105,0.5)` to `#475569`; components apply `opacity: 0.6`
```

---

## Step 17 — Verification

### 17a. Zero-results check

```bash
grep -rn "io-alarm-critical\|io-alarm-medium\|io-alarm-advisory\|io-alarm-fault\|io-alarm-suppressed" frontend/src/
```

Expected: **zero matches.** If any remain, fix before proceeding.

### 17b. TypeScript build

```bash
cd frontend && pnpm build
```

Expected: zero TypeScript errors. Common failure modes:
- `AlarmPriority` type mismatch if any switch/case still uses `"critical"` or `"medium"`
- `ThemeColorSet` interface mismatch if `echarts-themes.ts` still references `c.alarmCritical`
- `Record<AlarmRow["priority"], string>` errors if `PRIORITY_COLOR` maps still have old keys

### 17c. Tests

```bash
cd frontend && pnpm test
```

### 17d. Visual smoke check (three themes)

1. Dark theme — alarm indicators: urgent=red `#ef4444`, high=orange `#f97316`, low=yellow `#eab308`, diagnostic=white `#f4f4f5`, custom=blue `#60a5fa`, shelved=fuchsia `#d946ef`
2. Light theme — same alarm indicators at lighter values
3. HPHMI theme — alarm indicators at HPHMI values
4. FillGauge normal state renders at ~50% opacity (same as before)
5. Console Alarm List pane — priority column colors match new values
6. ForensicsPlaybackBar and HistoricalPlaybackBar — alarm tick marks render correctly
7. Rounds "skipped" badge — shows amber/yellow (`--io-warning`) not fuchsia

---

## Summary: All 23 Files to Modify

| # | File | Change type |
|---|---|---|
| 1 | `frontend/src/shared/theme/tokens.ts` | Token renames + value updates (all 3 objects) |
| 2 | `frontend/src/index.css` | Token renames + value updates (all 3 blocks + 2 class lines) |
| 3 | `frontend/src/shared/graphics/alarmFlash.css` | Keyframe + class name renames + custom hex update |
| 4 | `frontend/src/shared/graphics/displayElementColors.ts` | Token names + fallback hex |
| 5 | `frontend/src/shared/graphics/displayElements/AlarmIndicator.tsx` | Flash class name map |
| 6 | `frontend/src/shared/graphics/SceneRenderer.tsx` | Flash class name map + fill-normal opacity |
| 7 | `frontend/src/api/alarms.ts` | `AlarmPriority` type union + fallback |
| 8 | `frontend/src/shared/components/ForensicsPlaybackBar.tsx` | Map keys + token refs |
| 9 | `frontend/src/shared/components/HistoricalPlaybackBar.tsx` | Map keys + token refs |
| 10 | `frontend/src/shared/components/ContextMenu.tsx` | One token ref |
| 11 | `frontend/src/shared/layout/AppShell.tsx` | Three token refs |
| 12 | `frontend/src/pages/console/panes/AlarmListPane.tsx` | Type union + color map keys |
| 13 | `frontend/src/api/points.ts` | `PointAlarmEvent.priority` type union |
| 14 | `frontend/src/shared/components/charts/renderers/chart12-alarm-indicator.tsx` | Type union + LEVEL_ORDER |
| 15 | `frontend/src/pages/rounds/RoundHistory.tsx` | `suppressed`→`warning` (exception) + `critical`→`urgent` |
| 16 | `frontend/src/pages/rounds/ActiveRounds.tsx` | `suppressed`→`warning` (exception) + `critical`→`urgent` |
| 17 | `frontend/src/pages/rounds/RoundPlayer.tsx` | `critical`→`urgent` (18 occurrences) |
| 18 | `frontend/src/pages/rounds/index.tsx` | `critical`→`urgent` |
| 19 | `frontend/src/pages/rounds/RoundSchedules.tsx` | `critical`→`urgent` |
| 20 | `frontend/src/pages/rounds/TemplateDesigner.tsx` | `critical`→`urgent` |
| 21 | `frontend/src/pages/designer/index.tsx` | `critical`→`urgent` |
| 22+ | `frontend/src/pages/dashboards/widgets/*.tsx` | `critical`→`urgent`, `medium`→`low` (17 widget files) |
| 23 | `frontend/src/shared/theme/theme-colors.ts` | Interface field renames + value updates |
| 24 | `frontend/src/shared/theme/echarts-themes.ts` | Field refs + object key renames |
| 25 | `frontend/src/shared/graphics/displayElements/FillGauge.tsx` | fill-normal token + opacity |
| 26 | `docs/themes/dark.md` | Alarm table, operational status, graphics section, change log |
