# I/O Design System — Light Theme Palette

**Source files:**
- `frontend/src/shared/theme/tokens.ts` — `lightTokens` object (JS, applied at runtime via `setTheme()`)
- `frontend/src/index.css` — `[data-theme="light"]` block (CSS baseline/fallback)
- `frontend/src/shared/theme/theme-colors.ts` — `themeColors.light` (canvas/chart libraries only)

**How it works:** `tokens.ts` applies CSS custom properties directly to `:root` via `document.documentElement.style.setProperty()`. On mobile devices (User-Agent check), Light is the default theme for outdoor readability (design-docs/20).

**Base hue:** Gray (Tailwind Gray scale) for surfaces/text. Midnight Teal 600-level (`#0d9488`) accent — darker for WCAG contrast on white.

---

## Surface & Layout

| Token | Value | Notes |
|---|---|---|
| `--io-surface-primary` | `#ffffff` | White. App shell, main canvas |
| `--io-surface-secondary` | `#f9fafb` | Gray-50. Sidebar, cards, panels |
| `--io-surface-elevated` | `#ffffff` | White. Modals (elevation via shadow, not color) |
| `--io-surface-sunken` | `#f3f4f6` | Gray-100. Inputs, inset areas |
| `--io-surface-overlay` | `rgba(0,0,0,0.5)` | Modal backdrop, drawer scrim |

---

## Text

| Token | Value | Notes |
|---|---|---|
| `--io-text-primary` | `#111827` | Gray-900. Main body text |
| `--io-text-secondary` | `#6b7280` | Gray-500. Labels, secondary info |
| `--io-text-muted` | `#9ca3af` | Gray-400. Placeholders, hints, timestamps |
| `--io-text-inverse` | `#ffffff` | White text on teal accent backgrounds |
| `--io-text-link` | `#0d9488` | Matches `--io-accent` |
| `--io-text-disabled` | `#d1d5db` | Gray-300. Disabled control labels |

---

## Accent (Midnight Teal — 600-level)

| Token | Value | Notes |
|---|---|---|
| `--io-accent` | `#0d9488` | Teal-600. Primary interactive color |
| `--io-accent-hover` | `#0f766e` | Teal-700. Hover state |
| `--io-accent-active` | `#115e59` | Teal-800. Pressed/active state |
| `--io-accent-foreground` | `#ffffff` | White text on accent backgrounds |
| `--io-accent-subtle` | `rgba(13,148,136,0.08)` | Tinted row hover, badge fill |

> **Why 600-level?** Teal-400 (`#2dd4bf`) used in dark mode fails WCAG AA on white at 1.8:1 contrast. Teal-600 (`#0d9488`) achieves 3.1:1 on white, meeting WCAG AA for large text/UI components.

---

## Borders & Focus

| Token | Value | Notes |
|---|---|---|
| `--io-border` | `#e5e7eb` | Gray-200. Default borders, dividers |
| `--io-border-subtle` | `#f3f4f6` | Gray-100. Soft/invisible separators |
| `--io-border-strong` | `#d1d5db` | Gray-300. Emphasis borders, headers |
| `--io-focus-ring` | `#14b8a6` | Teal-500. Keyboard focus outline |

---

## Alarm Priority (ISA-101 / ISA-18.2 — NOT user-customizable)

| Token | Value | Priority Level | Notes |
|---|---|---|---|
| `--io-alarm-critical` | `#dc2626` | Urgent / P1 | Red-600. Darker for light bg contrast |
| `--io-alarm-high` | `#d97706` | High / P2 | Amber-600 |
| `--io-alarm-medium` | `#ca8a04` | Medium / P3 | Yellow-600 |
| `--io-alarm-advisory` | `#0891b2` | Advisory / P4 | Cyan-700 |
| `--io-alarm-custom` | `#6d28d9` | Custom | Violet-800 |
| `--io-alarm-fault` | `#c026d3` | Fault | Fuchsia-600 |

> **Note:** All alarm colors are one shade darker in light mode vs dark mode to maintain legibility on white/light backgrounds. These are NOT identical to the dark theme alarm colors.

---

## Operational Status

| Token | Value | Notes |
|---|---|---|
| `--io-alarm-normal` | `#16a34a` | Green-600. Point in normal state |
| `--io-alarm-suppressed` | `#7c3aed` | Violet-700. Suppressed/shelved |
| `--io-alarm-disabled` | `#9ca3af` | Gray-400. Disabled alarm |

---

## Semantic Status

| Token | Value | Notes |
|---|---|---|
| `--io-danger` | `#dc2626` | Red-600. Destructive actions, errors |
| `--io-success` | `#16a34a` | Green-600. Confirmations |
| `--io-warning` | `#d97706` | Amber-600. Warnings, caution states |
| `--io-info` | `#2563eb` | Blue-600. Informational |

---

## Chart & Visualization

| Token | Value | Notes |
|---|---|---|
| `--io-chart-bg` | `#ffffff` | White canvas background |
| `--io-chart-grid` | `#f5f6f8` | Near-white grid lines |
| `--io-chart-axis` | `#6b7280` | Gray-500. Axis labels and tick marks |
| `--io-chart-crosshair` | `#9ca3af` | Gray-400. Crosshair cursor line |
| `--io-chart-tooltip-bg` | `#ffffff` | White tooltip background |

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
| `--io-btn-bg` | `#0d9488` |
| `--io-btn-hover` | `#0f766e` |
| `--io-btn-active` | `#115e59` |
| `--io-btn-text` | `#ffffff` |
| `--io-btn-secondary-bg` | `#f9fafb` |
| `--io-btn-secondary-border` | `#e5e7eb` |

### Sidebar
| Token | Value |
|---|---|
| `--io-sidebar-bg` | `#f9fafb` |
| `--io-sidebar-active-border` | `#0d9488` |
| `--io-sidebar-hover-bg` | `rgba(13,148,136,0.08)` |
| `--io-sidebar-width` | `240px` |
| `--io-sidebar-collapsed` | `48px` |

### Top Bar
| Token | Value |
|---|---|
| `--io-topbar-bg` | `#ffffff` |
| `--io-topbar-border` | `#f3f4f6` |
| `--io-topbar-height` | `48px` |

### Card
| Token | Value |
|---|---|
| `--io-card-bg` | `#f9fafb` |
| `--io-card-border` | `#e5e7eb` |
| `--io-card-radius` | `6px` |
| `--io-card-shadow` | `0 1px 2px rgba(0,0,0,0.05)` |

### Table
| Token | Value |
|---|---|
| `--io-table-header-bg` | `#f3f4f6` |
| `--io-table-row-hover` | `rgba(13,148,136,0.08)` |
| `--io-table-row-selected` | `rgba(13,148,136,0.08)` |
| `--io-table-row-compact` | `28px` |
| `--io-table-row-default` | `36px` |
| `--io-table-row-comfortable` | `44px` |

### Input
| Token | Value |
|---|---|
| `--io-input-bg` | `#f3f4f6` |
| `--io-input-border` | `#e5e7eb` |
| `--io-input-focus-border` | `#0d9488` |
| `--io-input-placeholder` | `#9ca3af` |
| `--io-input-height` | `36px` |

### Modal
| Token | Value |
|---|---|
| `--io-modal-bg` | `#ffffff` |
| `--io-modal-backdrop` | `rgba(0,0,0,0.5)` |
| `--io-modal-radius` | `9px` |

### Toast
| Token | Value |
|---|---|
| `--io-toast-bg` | `#ffffff` |
| `--io-toast-border` | `#e5e7eb` |
| `--io-toast-shadow` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` |

---

## Shadow

| Token | Value |
|---|---|
| `--io-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--io-shadow` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` |
| `--io-shadow-lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` |
| `--io-shadow-none` | `none` |

> **Note:** Shadow opacities are significantly lower in light mode (0.05–0.1) vs dark mode (0.3–0.5). Elevation in light mode is conveyed primarily through shadow intensity rather than surface color contrast.

---

## Static Tokens (identical across all themes)

See Dark Theme document for the full listing of:
- Spacing (`--io-space-0` through `--io-space-48`)
- Border Radius (`--io-radius-sm` through `--io-radius-full`)
- Animation Duration (`--io-duration-fast/medium/slow`)
- Z-Index Scale (`--io-z-base` through `--io-z-emergency`)
- Typography Scale (`--io-text-4xl` through `--io-text-code-sm`)
