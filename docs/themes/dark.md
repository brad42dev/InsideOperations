# I/O Design System — Dark Theme Palette

**Source files:**
- `frontend/src/shared/theme/tokens.ts` — `darkTokens` object (JS, applied at runtime via `setTheme()`)
- `frontend/src/index.css` — `:root, [data-theme="dark"]` block (CSS baseline/fallback)
- `frontend/src/shared/theme/theme-colors.ts` — `themeColors.dark` (canvas/chart libraries only)

**How it works:** `tokens.ts` applies CSS custom properties directly to `:root` via `document.documentElement.style.setProperty()`. The JS values override the CSS baseline on load. **JS tokens.ts values are authoritative at runtime.**

**Base hue:** Zinc (Radix/Tailwind Zinc scale) for surfaces/text. Midnight Teal 400-level (`#2dd4bf`) accent.

---

## Surface & Layout

| Token | Value | Notes |
|---|---|---|
| `--io-surface-primary` | `#09090b` | Zinc-950. Deepest background, app shell |
| `--io-surface-secondary` | `#18181b` | Zinc-900. Sidebar, cards, panels |
| `--io-surface-elevated` | `#27272a` | Zinc-800. Modals, popovers, raised surfaces |
| `--io-surface-sunken` | `#09090b` | Same as primary. Inputs, inset areas |
| `--io-surface-overlay` | `rgba(0,0,0,0.7)` | Modal backdrop, drawer scrim |

---

## Text

| Token | Value | Notes |
|---|---|---|
| `--io-text-primary` | `#f9fafb` | Gray-50. Main body text |
| `--io-text-secondary` | `#a1a1aa` | Zinc-400. Labels, secondary info |
| `--io-text-muted` | `#71717a` | Zinc-500. Placeholders, hints, timestamps |
| `--io-text-inverse` | `#09090b` | Dark text on teal accent backgrounds |
| `--io-text-link` | `#2dd4bf` | Matches `--io-accent` |
| `--io-text-disabled` | `#52525b` | Zinc-600. Disabled control labels |

---

## Accent (Midnight Teal — 400-level)

| Token | Value | Notes |
|---|---|---|
| `--io-accent` | `#2dd4bf` | Teal-400. Primary interactive color |
| `--io-accent-hover` | `#5eead4` | Teal-300. Hover state |
| `--io-accent-active` | `#99f6e4` | Teal-200. Pressed/active state |
| `--io-accent-foreground` | `#09090b` | Text on accent backgrounds |
| `--io-accent-subtle` | `rgba(45,212,191,0.1)` | Tinted row hover, badge fill |

---

## Borders & Focus

| Token | Value | Notes |
|---|---|---|
| `--io-border` | `#3f3f46` | Zinc-700. Default borders, dividers |
| `--io-border-subtle` | `#27272a` | Zinc-800. Soft/invisible separators |
| `--io-border-strong` | `#52525b` | Zinc-600. Emphasis borders, headers |
| `--io-focus-ring` | `#2dd4bf` | Keyboard focus outline |

---

## Alarm Priority (ISA-101 / ISA-18.2 — NOT user-customizable)

| Token | Value | Priority Level | Notes |
|---|---|---|---|
| `--io-alarm-urgent` | `#ef4444` | P1 — Urgent | Red-500. Operator action required immediately. |
| `--io-alarm-high` | `#f97316` | P2 — High | Orange-500. Operator action required soon. |
| `--io-alarm-low` | `#eab308` | P3 — Low | Yellow-500. Operator action required eventually. |
| `--io-alarm-diagnostic` | `#f4f4f5` | P4 — Diagnostic | Zinc-100 (white). Diagnostic/Journal; no urgency implied. |
| `--io-alarm-custom` | `#60a5fa` | Custom | Blue-400. User-defined; circle indicator shape. |
| `--io-alarm-shelved` | `#d946ef` | Shelved | Fuchsia-500. Alarm active but operator-suppressed. |

---

## Operational Status

| Token | Value | Notes |
|---|---|---|
| `--io-alarm-normal` | `#22c55e` | Green-500. Point in normal state |
| `--io-alarm-disabled` | `#52525b` | Zinc-600. Disabled alarm; no action possible |

---

## Semantic Status

| Token | Value | Notes |
|---|---|---|
| `--io-danger` | `#ef4444` | Red-500. Destructive actions, errors |
| `--io-success` | `#22c55e` | Green-500. Confirmations |
| `--io-warning` | `#f59e0b` | Amber-500. Warnings, caution states |
| `--io-info` | `#3b82f6` | Blue-500. Informational |
| `--io-success-subtle` | `rgba(34,197,94,0.12)` | Success tinted backgrounds (CSS only) |
| `--io-warning-subtle` | `rgba(251,191,36,0.15)` | Warning tinted backgrounds (CSS only) |
| `--io-danger-subtle` | `rgba(239,68,68,0.12)` | Danger tinted backgrounds (CSS only) |

---

## Chart & Visualization

| Token | Value | Notes |
|---|---|---|
| `--io-chart-bg` | `#18181b` | uPlot/ECharts canvas background |
| `--io-chart-grid` | `#3f3f46` | Grid lines (**JS value**; CSS baseline has `#27272a`) |
| `--io-chart-axis` | `#a1a1aa` | Axis labels and tick marks |
| `--io-chart-crosshair` | `#71717a` | Crosshair cursor line |
| `--io-chart-tooltip-bg` | `#27272a` | Tooltip / legend background |

> **Discrepancy note:** `--io-chart-grid` in `index.css` is `#27272a` but `tokens.ts` overrides it to `#3f3f46` at runtime. The JS value (`#3f3f46`) is what renders.

---

## Trend Pen Colors (static across all themes)

| Token | Value | Notes |
|---|---|---|
| `--io-pen-1` | `#2563eb` | Blue-600 |
| `--io-pen-2` | `#dc2626` | Red-600 |
| `--io-pen-3` | `#16a34a` | Green-600 |
| `--io-pen-4` | `#d97706` | Amber-600 |
| `--io-pen-5` | `#7c3aed` | Violet-700 |
| `--io-pen-6` | `#0891b2` | Cyan-700 |
| `--io-pen-7` | `#db2777` | Pink-600 |
| `--io-pen-8` | `#65a30d` | Lime-600 |

---

## Component Tokens

### Button
| Token | Value |
|---|---|
| `--io-btn-bg` | `#2dd4bf` |
| `--io-btn-hover` | `#5eead4` |
| `--io-btn-active` | `#99f6e4` |
| `--io-btn-text` | `#09090b` |
| `--io-btn-secondary-bg` | `#18181b` |
| `--io-btn-secondary-border` | `#3f3f46` |

### Sidebar
| Token | Value |
|---|---|
| `--io-sidebar-bg` | `#18181b` |
| `--io-sidebar-active-border` | `#2dd4bf` |
| `--io-sidebar-hover-bg` | `rgba(45,212,191,0.1)` |
| `--io-sidebar-width` | `240px` |
| `--io-sidebar-collapsed` | `48px` |

### Top Bar
| Token | Value |
|---|---|
| `--io-topbar-bg` | `#09090b` |
| `--io-topbar-border` | `#27272a` |
| `--io-topbar-height` | `48px` |

### Card
| Token | Value |
|---|---|
| `--io-card-bg` | `#18181b` |
| `--io-card-border` | `#3f3f46` |
| `--io-card-radius` | `6px` |
| `--io-card-shadow` | `0 1px 2px rgba(0,0,0,0.3)` |

### Table
| Token | Value |
|---|---|
| `--io-table-header-bg` | `#09090b` |
| `--io-table-row-hover` | `rgba(45,212,191,0.1)` |
| `--io-table-row-selected` | `rgba(45,212,191,0.1)` |
| `--io-table-row-compact` | `28px` |
| `--io-table-row-default` | `36px` |
| `--io-table-row-comfortable` | `44px` |

### Input
| Token | Value |
|---|---|
| `--io-input-bg` | `#09090b` |
| `--io-input-border` | `#3f3f46` |
| `--io-input-focus-border` | `#2dd4bf` |
| `--io-input-placeholder` | `#71717a` |
| `--io-input-height` | `36px` |

### Modal
| Token | Value |
|---|---|
| `--io-modal-bg` | `#27272a` |
| `--io-modal-backdrop` | `rgba(0,0,0,0.7)` |
| `--io-modal-radius` | `9px` |

### Toast
| Token | Value |
|---|---|
| `--io-toast-bg` | `#27272a` |
| `--io-toast-border` | `#3f3f46` |
| `--io-toast-shadow` | `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)` |

---

## Shadow

| Token | Value |
|---|---|
| `--io-shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--io-shadow` | `0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)` |
| `--io-shadow-lg` | `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)` |
| `--io-shadow-none` | `none` |

---

## Static Tokens (identical across all themes)

### Spacing
`0px, 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 56px, 64px, 80px, 96px, 128px, 160px, 192px`
Tokens: `--io-space-0` through `--io-space-48`

### Border Radius
| Token | Value |
|---|---|
| `--io-radius-sm` | `3px` |
| `--io-radius` | `6px` |
| `--io-radius-lg` | `9px` |
| `--io-radius-full` | `9999px` |

### Animation Duration
| Token | Value |
|---|---|
| `--io-duration-fast` | `150ms` |
| `--io-duration-medium` | `250ms` |
| `--io-duration-slow` | `350ms` |

### Z-Index Scale
| Token | Value | Layer |
|---|---|---|
| `--io-z-base` | `0` | Default content |
| `--io-z-panel` | `10` | Panels, drawers |
| `--io-z-sidebar` | `100` | Sidebar |
| `--io-z-topbar` | `100` | Top bar |
| `--io-z-edge-hover` | `150` | Edge hover triggers |
| `--io-z-dropdown` | `200` | Dropdowns, menus |
| `--io-z-modal` | `300` | Modals, dialogs |
| `--io-z-command` | `400` | Command palette |
| `--io-z-visual-lock` | `500` | Visual lock overlay |
| `--io-z-kiosk-auth` | `600` | Kiosk auth screen |
| `--io-z-toast` | `700` | Toast notifications |
| `--io-z-emergency` | `800` | Emergency alert overlay |

### Typography Scale
| Token | Value |
|---|---|
| `--io-text-4xl` | `2.25rem` |
| `--io-text-3xl` | `1.75rem` |
| `--io-text-2xl` | `1.375rem` |
| `--io-text-xl` | `1.125rem` |
| `--io-text-lg` | `1rem` |
| `--io-text-base` | `0.875rem` |
| `--io-text-sm` | `0.8125rem` |
| `--io-text-xs` | `0.75rem` |
| `--io-text-2xs` | `0.6875rem` |
| `--io-text-label` | `0.75rem` |
| `--io-text-label-sm` | `0.6875rem` |
| `--io-text-value` | `0.875rem` |
| `--io-text-value-lg` | `1.125rem` |
| `--io-text-value-xl` | `1.5rem` |
| `--io-text-code` | `0.8125rem` |
| `--io-text-code-sm` | `0.75rem` |

---

## Change Log

### v0.7 — Alarm Token Rename
- `--io-alarm-critical` → `--io-alarm-urgent` (hex unchanged: `#ef4444`)
- `--io-alarm-high` hex updated: `#f59e0b` → `#f97316` (Amber → Orange-500)
- `--io-alarm-medium` → `--io-alarm-low` (hex unchanged: `#eab308`)
- `--io-alarm-advisory` → `--io-alarm-diagnostic` (hex changed: `#06b6d4` → `#f4f4f5`)
- `--io-alarm-custom` hex updated: `#7c3aed` → `#60a5fa` (Violet → Blue-400)
- `--io-alarm-suppressed` → `--io-alarm-shelved`; moved from Operational Status into Alarm Priority block
- `--io-alarm-fault` removed; usages replaced with `--io-alarm-shelved`
- `--io-alarm-disabled` hex updated: `#71717a` → `#52525b` (Zinc-500 → Zinc-600)
- `--io-fill-normal` changed from `rgba(71,85,105,0.5)` to `#475569`; components apply `opacity: 0.6` on fill element
