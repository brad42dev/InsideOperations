# I/O Design System — HPHMI Theme Palette

**Source files:**
- `frontend/src/shared/theme/tokens.ts` — `hphmiTokens` object (JS, applied at runtime via `setTheme()`)
- `frontend/src/index.css` — `[data-theme="hphmi"]` block (CSS baseline/fallback)
- `frontend/src/shared/theme/theme-colors.ts` — `themeColors["high-contrast"]` (canvas/chart libraries only)

**What is HPHMI?** High-Performance HMI — a control room display standard designed to reduce operator cognitive load. Characteristics:
- **Muted/desaturated process graphics** so alarm colors stand out sharply
- **No bright colors in the UI chrome** — backgrounds stay in deep navy/slate tones
- **Alarm colors are high-saturation** against the muted background for immediate detection
- Derived from ISA-101 and EEMUA 191 HMI design guidance

**Base hue:** Slate (Tailwind Slate scale) for surfaces/text — bluer and more desaturated than dark mode's Zinc. Midnight Teal 500-level (`#14b8a6`) accent.

**Key distinction from Dark mode:** HPHMI uses Slate (cool blue-gray) vs Dark's Zinc (neutral gray). Surfaces are noticeably bluer. This is intentional — it mimics the traditional control room gray-blue display aesthetic.

---

## Surface & Layout

| Token | Value | Notes |
|---|---|---|
| `--io-surface-primary` | `#0f172a` | Slate-900. Deepest background, app shell |
| `--io-surface-secondary` | `#1e293b` | Slate-800. Sidebar, cards, panels |
| `--io-surface-elevated` | `#334155` | Slate-700. Modals, popovers, raised surfaces |
| `--io-surface-sunken` | `#0c1525` | Deeper than primary. Inputs, inset areas |
| `--io-surface-overlay` | `rgba(0,0,0,0.7)` | Modal backdrop, drawer scrim |

> **Comparison to Dark:** Dark uses Zinc (`#09090b / #18181b / #27272a`). HPHMI uses Slate (`#0f172a / #1e293b / #334155`) — distinctly bluer at all levels.

---

## Text

| Token | Value | Notes |
|---|---|---|
| `--io-text-primary` | `#e2e8f0` | Slate-200. Main body text |
| `--io-text-secondary` | `#94a3b8` | Slate-400. Labels, secondary info |
| `--io-text-muted` | `#64748b` | Slate-500. Placeholders, hints, timestamps |
| `--io-text-inverse` | `#0f172a` | Dark text on teal accent backgrounds |
| `--io-text-link` | `#14b8a6` | Matches `--io-accent` |
| `--io-text-disabled` | `#475569` | Slate-600. Disabled control labels |

> **Note:** HPHMI text is slightly less bright than dark mode (`#e2e8f0` vs `#f9fafb`) and tinted blue. This reduces eye strain in extended control room use.

---

## Accent (Midnight Teal — 500-level)

| Token | Value | Notes |
|---|---|---|
| `--io-accent` | `#14b8a6` | Teal-500. Primary interactive color |
| `--io-accent-hover` | `#2dd4bf` | Teal-400. Hover state |
| `--io-accent-active` | `#5eead4` | Teal-300. Pressed/active state |
| `--io-accent-foreground` | `#0f172a` | Dark text on accent backgrounds |
| `--io-accent-subtle` | `rgba(45,212,191,0.08)` | Tinted row hover (lower opacity than dark) |

> **Why 500-level?** Sits between dark (400-level `#2dd4bf`) and light (600-level `#0d9488`). Slightly more muted than dark to blend with the HPHMI aesthetic, while maintaining contrast on dark slate backgrounds.

---

## Borders & Focus

| Token | Value | Notes |
|---|---|---|
| `--io-border` | `#475569` | Slate-600. Default borders, dividers |
| `--io-border-subtle` | `#2d3f53` | Custom dark slate. Soft separators |
| `--io-border-strong` | `#64748b` | Slate-500. Emphasis borders, headers |
| `--io-focus-ring` | `#14b8a6` | Teal-500. Keyboard focus outline |

---

## Alarm Priority (ISA-101 / ISA-18.2 — NOT user-customizable)

| Token | Value | Priority Level | Notes |
|---|---|---|---|
| `--io-alarm-critical` | `#ef4444` | Urgent / P1 | Red-500. **Identical to dark mode** |
| `--io-alarm-high` | `#f59e0b` | High / P2 | Amber-500. **Identical to dark mode** |
| `--io-alarm-medium` | `#eab308` | Medium / P3 | Yellow-500. **Identical to dark mode** |
| `--io-alarm-advisory` | `#06b6d4` | Advisory / P4 | Cyan-500. **Identical to dark mode** |
| `--io-alarm-custom` | `#7c3aed` | Custom | Violet-700. **Identical to dark mode** |
| `--io-alarm-fault` | `#d946ef` | Fault | Fuchsia-500. **Identical to dark mode** |

> **HPHMI design rationale:** Alarm colors are deliberately identical to dark mode and use full-saturation values. Against the muted Slate background, these colors pop with maximum contrast — which is the entire point of HPHMI. Do NOT desaturate alarm colors in this theme.

---

## Operational Status

| Token | Value | Notes |
|---|---|---|
| `--io-alarm-normal` | `#22c55e` | Green-500. Point in normal state |
| `--io-alarm-suppressed` | `#a78bfa` | Violet-400. Suppressed/shelved |
| `--io-alarm-disabled` | `#64748b` | Slate-500. Disabled alarm (vs Zinc-500 in dark) |

---

## Semantic Status

| Token | Value | Notes |
|---|---|---|
| `--io-danger` | `#ef4444` | Red-500 |
| `--io-success` | `#22c55e` | Green-500 |
| `--io-warning` | `#f59e0b` | Amber-500 |
| `--io-info` | `#3b82f6` | Blue-500 |

---

## Chart & Visualization

| Token | Value | Notes |
|---|---|---|
| `--io-chart-bg` | `#1e293b` | Slate-800 canvas background |
| `--io-chart-grid` | `#3d5166` | Custom slate. Slightly blue-shifted grid lines |
| `--io-chart-axis` | `#94a3b8` | Slate-400. Axis labels and tick marks |
| `--io-chart-crosshair` | `#64748b` | Slate-500. Crosshair cursor line |
| `--io-chart-tooltip-bg` | `#1e293b` | Slate-800 tooltip background |

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
| `--io-btn-bg` | `#14b8a6` |
| `--io-btn-hover` | `#2dd4bf` |
| `--io-btn-active` | `#5eead4` |
| `--io-btn-text` | `#0f172a` |
| `--io-btn-secondary-bg` | `#1e293b` |
| `--io-btn-secondary-border` | `#475569` |

### Sidebar
| Token | Value |
|---|---|
| `--io-sidebar-bg` | `#1e293b` |
| `--io-sidebar-active-border` | `#14b8a6` |
| `--io-sidebar-hover-bg` | `rgba(45,212,191,0.08)` |
| `--io-sidebar-width` | `240px` |
| `--io-sidebar-collapsed` | `48px` |

### Top Bar
| Token | Value |
|---|---|
| `--io-topbar-bg` | `#0f172a` |
| `--io-topbar-border` | `#1e293b` |
| `--io-topbar-height` | `48px` |

### Card
| Token | Value |
|---|---|
| `--io-card-bg` | `#1e293b` |
| `--io-card-border` | `#475569` |
| `--io-card-radius` | `6px` |
| `--io-card-shadow` | `0 1px 2px rgba(0,0,0,0.3)` |

### Table
| Token | Value |
|---|---|
| `--io-table-header-bg` | `#0c1525` |
| `--io-table-row-hover` | `rgba(45,212,191,0.08)` |
| `--io-table-row-selected` | `rgba(45,212,191,0.08)` |
| `--io-table-row-compact` | `28px` |
| `--io-table-row-default` | `36px` |
| `--io-table-row-comfortable` | `44px` |

### Input
| Token | Value |
|---|---|
| `--io-input-bg` | `#0c1525` |
| `--io-input-border` | `#475569` |
| `--io-input-focus-border` | `#14b8a6` |
| `--io-input-placeholder` | `#64748b` |
| `--io-input-height` | `36px` |

### Modal
| Token | Value |
|---|---|
| `--io-modal-bg` | `#334155` |
| `--io-modal-backdrop` | `rgba(0,0,0,0.7)` |
| `--io-modal-radius` | `9px` |

### Toast
| Token | Value |
|---|---|
| `--io-toast-bg` | `#334155` |
| `--io-toast-border` | `#475569` |
| `--io-toast-shadow` | `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)` |

---

## Shadow

| Token | Value |
|---|---|
| `--io-shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--io-shadow` | `0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)` |
| `--io-shadow-lg` | `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)` |
| `--io-shadow-none` | `none` |

> **Note:** Shadow values are identical to dark mode. Both are dark-background themes requiring higher-opacity shadows.

---

## Theme Comparison: HPHMI vs Dark

| Category | Dark | HPHMI | Difference |
|---|---|---|---|
| Surface base | Zinc (`#09090b`) | Slate (`#0f172a`) | HPHMI is bluer |
| Surface secondary | `#18181b` | `#1e293b` | HPHMI is lighter and bluer |
| Surface elevated | `#27272a` | `#334155` | HPHMI is lighter and bluer |
| Text primary | `#f9fafb` (near white) | `#e2e8f0` (slate-200) | HPHMI is slightly dimmer, blue-tinted |
| Accent | `#2dd4bf` (Teal-400) | `#14b8a6` (Teal-500) | HPHMI slightly more muted |
| Alarm colors | Full saturation | Full saturation | **Identical** — intentional |
| Borders | Zinc-700 (`#3f3f46`) | Slate-600 (`#475569`) | HPHMI is bluer |
| Shadow | Same | Same | Identical |

---

## Static Tokens (identical across all themes)

See Dark Theme document for the full listing of:
- Spacing (`--io-space-0` through `--io-space-48`)
- Border Radius (`--io-radius-sm` through `--io-radius-full`)
- Animation Duration (`--io-duration-fast/medium/slow`)
- Z-Index Scale (`--io-z-base` through `--io-z-emergency`)
- Typography Scale (`--io-text-4xl` through `--io-text-code-sm`)
