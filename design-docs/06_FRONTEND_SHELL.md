# Inside/Operations - Frontend Shell

## Overview

The Frontend Shell provides the application framework including navigation, theming, global search, layout management, and the visual design foundation that all 11 modules inherit.

## Design Philosophy

**Aesthetic direction: "Professional Calm"**

I/O must look modern, polished, and enterprise-quality — differentiated from both dated SCADA/HMI aesthetics and generic framework defaults. The target is the intersection of Grafana's information density, Linear's precision and polish, and ISA-101's color discipline.

Core principles:

- **Clean, purposeful UI.** Every pixel earns its place. Spacing does the work of separation instead of borders. Reduced visual noise with maintained hierarchy.
- **Color for abnormal, gray for normal.** Follows ISA-101/HPHMI: operational views (Console, Process) use muted palettes where alarm states pop. Non-operational views (Settings, Reports) can use conventional enterprise aesthetics.
- **Precise alignment.** Vertical and horizontal alignment of labels, icons, and buttons is felt subconsciously rather than noticed explicitly. The 4px grid enforces this.
- **Data-first.** Typography, spacing, and color choices optimize for reading hundreds of live values over 12-hour shifts, not for marketing aesthetics.

---

## Design Token Architecture

I/O uses a 4-layer design token system. Simple at the top (pick a theme), fully granular below for customization.

### Layer 1: Theme Presets (User-Facing)

One-click theme selection in Settings > Display:

| Preset | Description | Default For |
|--------|-------------|-------------|
| **Light** | White background, Midnight Teal accent (600-level), clean corporate feel | Desktop (office/management) |
| **Dark** | True dark (#09090b), Midnight Teal accent (400-level), IDE-like feel | Engineers, Forensics work |
| **HPHMI** | Dark blue-gray background, Midnight Teal accent (500-level), ISA-101 muted palette, color reserved for abnormal | Control room operators |

Each preset defines the full set of semantic tokens. Users pick one and everything cascades.

### Layer 2: Theme Parameters (Power Users)

Exposed in Settings > Display > Advanced. Each parameter modifies the active preset's generated token set.

| Parameter | Options | Default |
|-----------|---------|---------|
| **Accent color** | Alarm-safe presets only: Midnight Teal (hue 180, default), Signal Green (hue 162), Neon Mint (hue 158), Hot Signal / Magenta (hue 330). See [Color System > Accent Color](#accent-color). | Midnight Teal |
| **Border radius** | Sharp (2px), Subtle (6px), Rounded (12px) | Subtle (6px) |
| **Density** | Compact, Default, Comfortable | Default |
| **Font scale** | Small (13px body), Default (14px body), Large (16px body) | Default (14px) |

ISA-101 alarm colors are NOT exposed as parameters — they are standards-compliant, safety-critical, and non-customizable by users. See [Color System > ISA-101 Alarm Colors](#isa-101-alarm-colors).

### Layer 3: Semantic Tokens

The layer that components consume. Every component references these tokens, never raw color values. Auto-generated from the Layer 1 preset + Layer 2 parameters.

```css
/* Surface & Layout */
--io-surface-primary       /* Main app background */
--io-surface-secondary     /* Sidebar, card backgrounds */
--io-surface-elevated      /* Modals, popovers, dropdowns */
--io-surface-sunken        /* Input fields, code blocks */
--io-surface-overlay       /* Overlay backdrop */

/* Text */
--io-text-primary          /* Primary content text */
--io-text-secondary        /* Supporting/secondary text */
--io-text-muted            /* Placeholder, tertiary text */
--io-text-inverse          /* Text on accent backgrounds */
--io-text-link             /* Link text */

/* Interactive */
--io-accent                /* Primary interactive (buttons, links, focus) */
--io-accent-hover          /* Hover state */
--io-accent-active         /* Pressed state */
--io-accent-foreground     /* Text on accent background */
--io-accent-subtle         /* Selected row, active tab background */

/* Borders & Separators */
--io-border                /* Default border */
--io-border-subtle         /* Table cell borders, light separators */
--io-border-strong         /* Selected item, emphasized borders */
--io-focus-ring            /* Focus indicator ring (2px, offset) */

/* Alarm / Status (ISA-101 + IEC 60073 — NOT customizable) */
--io-alarm-critical        /* Red — immediate danger */
--io-alarm-high            /* Amber — abnormal, needs attention */
--io-alarm-normal          /* Green — within range (used sparingly per HPHMI) */
--io-alarm-advisory        /* Blue — informational */
--io-alarm-suppressed      /* Blue variant — shelved/suppressed */
--io-alarm-disabled        /* Gray — out of service */

/* Semantic Status */
--io-danger                /* Destructive actions, error states */
--io-success               /* Completion, confirmation */
--io-warning               /* Caution messages */

/* Chart & Visualization */
--io-chart-bg              /* Chart background */
--io-chart-grid            /* Grid lines */
--io-chart-axis            /* Axis labels and ticks */
--io-pen-1 through --io-pen-8  /* Default trend pen colors */
```

Alarm colors are auto-adjusted per theme to maintain WCAG AA contrast against the theme's background, but the hues and relative urgency are fixed per ISA-101. Users cannot make critical alarms green.

### Layer 4: Component Tokens

Per-component overrides, rarely touched. Examples:

```css
--io-btn-bg                /* Button background */
--io-btn-hover             /* Button hover */
--io-sidebar-bg            /* Sidebar background */
--io-sidebar-width         /* 240px expanded */
--io-sidebar-collapsed     /* 48px collapsed */
--io-topbar-height         /* 48px */
--io-card-border           /* Card border color */
--io-table-row-compact     /* 28px */
--io-table-row-default     /* 36px */
--io-table-row-comfortable /* 44px */
```

### OKLCH Color Generation

All theme palettes are defined in OKLCH color space for perceptual uniformity. Each accent preset generates a 10-step scale with consistent lightness/chroma curves — only the hue axis changes between presets.

**Default accent: Midnight Teal (hue 180)**

```
Token          OKLCH                          Hex (approx)   Usage
──────────────────────────────────────────────────────────────────────
--accent-50    oklch(0.975 0.018 180)         #F0FDFA        Subtle background tint
--accent-100   oklch(0.945 0.048 180)         #CCFBF1        Hover state background (light theme)
--accent-200   oklch(0.900 0.090 180)         #99F6E4        Selected row, tag background
--accent-300   oklch(0.845 0.135 180)         #5EEAD4        Borders, secondary badges
--accent-400   oklch(0.775 0.155 180)         #2DD4BF        Dark theme primary accent
--accent-500   oklch(0.685 0.145 180)         #14B8A6        HPHMI theme primary accent, logo slash
--accent-600   oklch(0.590 0.122 180)         #0D9488        Light theme primary accent
--accent-700   oklch(0.505 0.098 180)         #0F766E        Active/pressed, focus ring on dark bg
--accent-800   oklch(0.430 0.078 180)         #115E59        Text accent on light backgrounds
--accent-900   oklch(0.375 0.063 180)         #134E4A        High-contrast text
--accent-950   oklch(0.270 0.044 180)         #042F2E        Darkest text
```

**Theme-specific primary accent mapping:**

| Theme | Primary Token | OKLCH Step | Contrast Target |
|-------|--------------|------------|-----------------|
| Light | `--io-accent` = `--accent-600` | L ≈ 0.59 | 4.5:1+ on white |
| Dark | `--io-accent` = `--accent-400` | L ≈ 0.77 | 4.5:1+ on #09090B |
| HPHMI | `--io-accent` = `--accent-500` | L ≈ 0.69 | 4.5:1+ on #0F172A |

This is standard practice in multi-theme design systems — the same 500-level value cannot meet WCAG AA contrast on both white and near-black backgrounds, so each theme selects the appropriate step from the shared scale.

Switching accent presets (Layer 2 parameter) rotates all 10 steps on the hue axis. Lightness and chroma curves remain consistent. Tailwind v4 supports OKLCH natively via `@theme` directive.

---

## Typography

### Font Selection

| Role | Font | License | Usage |
|------|------|---------|-------|
| **Primary UI** | Inter (variable) | SIL OFL 1.1 | All body text, headings, labels, navigation |
| **Monospace** | JetBrains Mono (variable) | SIL OFL 1.1 | Code, data values, point IDs, OPC paths, timestamps, expression builder |

Two font families only. No display font — Inter at weight 600 handles headings. Variable fonts mean a single file per family (~100KB WOFF2 each).

### OpenType Features

- **Tabular figures** (`tnum`): Applied globally to all numeric data displays. Prevents layout jitter when live values update (e.g., "111.1" vs "888.8" take equal width).
- **Slashed zero** (`zero`): Applied to technical contexts (OPC paths, tag IDs) for disambiguation.
- **Ligatures** (`liga`, `calt`): Default on for body text.

### Type Scale

16 tokens, rem-based for accessibility (respects browser font size settings):

| Token | Size | rem | Weight | Use Case |
|-------|------|-----|--------|----------|
| `--io-text-4xl` | 36px | 2.25 | 600 | Dashboard titles, empty state headings |
| `--io-text-3xl` | 28px | 1.75 | 600 | Page titles |
| `--io-text-2xl` | 22px | 1.375 | 600 | Section headings |
| `--io-text-xl` | 18px | 1.125 | 600 | Card headers, panel titles |
| `--io-text-lg` | 16px | 1.0 | 600 | Sub-section headings |
| `--io-text-base` | 14px | 0.875 | 400 | Default body text |
| `--io-text-sm` | 13px | 0.8125 | 400 | Secondary body, descriptions |
| `--io-text-xs` | 12px | 0.75 | 400 | Captions, helper text, timestamps |
| `--io-text-2xs` | 11px | 0.6875 | 400 | Badges, chart axis labels, dense table footers |
| `--io-text-label` | 12px | 0.75 | 500 | Form labels, table headers |
| `--io-text-label-sm` | 11px | 0.6875 | 500 | Small form labels, filter chips |
| `--io-text-value` | 14px | 0.875 | 500 | Live data values (with tabular-nums) |
| `--io-text-value-lg` | 18px | 1.125 | 500 | Dashboard KPI values |
| `--io-text-value-xl` | 24px | 1.5 | 500 | Hero metrics (single-value widgets) |
| `--io-text-code` | 13px | 0.8125 | 400 | Code blocks, expressions (JetBrains Mono) |
| `--io-text-code-sm` | 12px | 0.75 | 400 | Inline code, tag IDs (JetBrains Mono) |

Design decisions:
- **14px body default** (not 16px): Standard for data-dense UIs (matches Carbon Productive, Grafana, Linear). 16px wastes space when displaying hundreds of values.
- **600 weight headings** (not 700): Inter at 600 provides clear hierarchy without feeling heavy. 700 reserved for in-text emphasis.
- **500 weight for labels/values**: Slightly heavier than body, makes them scannable without being "bold."
- **Tighter line heights for values** (1.2): Live data values don't wrap — saves vertical space in tables and graphics.

### Font Loading

```css
@font-face {
  font-family: 'InterVariable';
  src: url('/fonts/InterVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono Variable';
  src: url('/fonts/JetBrainsMono-Variable.woff2') format('woff2');
  font-weight: 100 800;
  font-display: swap;
}
```

Inter is preloaded in `<head>` (`rel="preload"`). JetBrains Mono loads lazily (not needed for initial paint in most views). `font-display: swap` shows system font immediately, swaps when loaded.

---

## Spacing & Grid

### 4px Base Grid

All spacing, sizing, and positioning values snap to multiples of 4px. This eliminates sub-pixel rendering issues and ensures consistent visual rhythm across all modules.

### Spacing Scale

17-step scale, each value multiplied by the 4px base:

| Token | Multiplier | Value |
|-------|-----------|-------|
| `--io-space-0` | 0 | 0px |
| `--io-space-1` | 1 | 4px |
| `--io-space-2` | 2 | 8px |
| `--io-space-3` | 3 | 12px |
| `--io-space-4` | 4 | 16px |
| `--io-space-5` | 5 | 20px |
| `--io-space-6` | 6 | 24px |
| `--io-space-8` | 8 | 32px |
| `--io-space-10` | 10 | 40px |
| `--io-space-12` | 12 | 48px |
| `--io-space-14` | 14 | 56px |
| `--io-space-16` | 16 | 64px |
| `--io-space-20` | 20 | 80px |
| `--io-space-24` | 24 | 96px |
| `--io-space-32` | 32 | 128px |
| `--io-space-40` | 40 | 160px |
| `--io-space-48` | 48 | 192px |

Usage: `--io-space-1` (4px) for micro adjustments (icon-to-text gap), `--io-space-2` (8px) as primary rhythm unit, `--io-space-4` (16px) for standard padding, `--io-space-6` (24px) for section spacing.

### Density Modes

3 system-wide density modes, toggled in user preferences (Settings > Display). Affects all components — tables, forms, cards, toolbars.

| Mode | Row Height | Padding Scale | Use Case |
|------|-----------|--------------|----------|
| **Compact** | 28px | Reduced by 25% | Control room displays: maximize visible rows |
| **Default** | 36px | Standard | General desktop use |
| **Comfortable** | 44px | Increased by 25% | Touch/tablet, review/editing workflows |

Density is a user preference stored in `user_preferences` JSONB. Synced across windows via BroadcastChannel.

---

## Color System

### Accent Color

**Default: Midnight Teal** — `oklch(0.685 0.145 180)` ≈ #14B8A6

Midnight Teal is I/O's default accent color. It communicates technical precision and calm monitoring — the natural palette for industrial process software. Hue 180 (true teal) sits between green and cyan, validated by industry precedent (Ignition SCADA, New Relic).

The accent color is a **Layer 2 theme parameter** — users can change it per-site or per-user. The full OKLCH 10-step scale and theme-specific mappings are defined in [OKLCH Color Generation](#oklch-color-generation) above.

**Logo slash color:** The slash in "I / O" is always Midnight Teal regardless of the user's accent preference. It is a fixed brand color, not tied to the accent parameter.

#### Alarm-Safe Accent Presets

Only hues that do not conflict with ISA-101 alarm colors are offered as accent presets. Each preset generates a full 10-step OKLCH scale by rotating the hue axis while keeping lightness and chroma curves constant.

| Preset | Hue | OKLCH (500) | Hex (approx) | Character |
|--------|-----|-------------|-------------|-----------|
| **Midnight Teal** (default) | 180 | `oklch(0.685 0.145 180)` | #14B8A6 | Technical calm, precision instruments |
| **Signal Green** | 162 | `oklch(0.696 0.170 162)` | #10B981 | Operational confidence, systems nominal |
| **Neon Mint** | 158 | `oklch(0.740 0.170 158)` | #34D399 | Fresh, modern monitoring |
| **Hot Signal / Magenta** | 330 | `oklch(0.655 0.250 330)` | #D946A8 | Bold, maximally distinct from all alarms |

**Removed presets (alarm conflicts):**
- ~~Blue~~ — conflicts with P4 Low cyan alarm (hue ~207)
- ~~Orange~~ — conflicts with P3 Medium alarm (hue ~55)
- ~~Purple~~ — conflicts with Diagnostic alarm (hue ~293)

### ISA-101 Alarm Colors

**NOT customizable by users.** These are safety-critical, standards-compliant (ISA-101 + IEC 60073), and non-negotiable.

| Priority | Color | Hex (Dark) | Hex (Light) | OKLCH Hue | Shape |
|----------|-------|-----------|-------------|-----------|-------|
| Critical (P1) | Red | #EF4444 | #DC2626 | ~25 | Rectangle |
| High (P2) | Amber | #F59E0B | #D97706 | ~84 | Triangle |
| Medium (P3) | Orange | #F97316 | #EA580C | ~55 | Inverted Triangle |
| Low (P4) | Cyan | #22D3EE | #0891B2 | ~207 | Diamond |
| Diagnostic | Purple | #A78BFA | #7C3AED | ~293 | Ellipse |

Alarm color behavior:
- **Auto-adjusted per theme** for WCAG AA (4.5:1) contrast against the theme's background — lighter on dark backgrounds, darker on light backgrounds
- Hue and relative urgency relationships are **fixed**
- Shape coding is always present alongside color (ISA-101 requirement for colorblind accessibility)
- Maximum 7-8 meaningful colors per display per ISA-101 guidelines
- Users **cannot** reassign alarm colors, change priorities, or make critical alarms green

### Equipment Status Colors (HPHMI)

Equipment in graphics uses **gray for normal state**, following HPHMI principles (gray means normal, color means abnormal). Equipment colors adapt to the active theme's neutral palette.

| State | Color | Notes |
|-------|-------|-------|
| Running / Normal | Light gray / white outline | Adapts to theme neutral palette |
| Stopped | Dark gray | Subtle, not alarming |
| No Feedback | Medium gray | Distinguishable from running/stopped |
| Alarm | Bright alarm color (per priority) | The only state that uses color |

### Border Radius

Layer 2 parameter, user-selectable:

| Option | Value | Feel |
|--------|-------|------|
| **Sharp** | 2px | Industrial, precise |
| **Subtle** | 6px | Modern default (recommended) |
| **Rounded** | 12px | Softer, friendlier |

Applied via `--io-radius` token. Components reference `--io-radius-sm` (half), `--io-radius` (standard), `--io-radius-lg` (1.5x), `--io-radius-full` (9999px for pills/avatars).

---

## Icons

- **General icons**: Lucide (ISC license) — ~1,500 icons, tree-shakeable, consistent 24px grid with 1.5px stroke, React components with TypeScript types. Integrates with the shadcn/ui ecosystem already in I/O's stack.
- **Industrial icons**: ~50-60 custom SVG icons for domain-specific needs (valves, pumps, vessels, heat exchangers, compressors, etc.). Designed to match Lucide's 24px grid and stroke weight for visual consistency. Maintained in `@io/ui` package alongside Lucide imports.

---

## Authentication Integration

- Login page with username/password form
- JWT token management (access + refresh)
- Automatic token refresh before expiration
- Logout with session cleanup
- Protected routes (redirect to login if not authenticated)

---

## Navigation System

### Sidebar (3-State)

| State | Width | Behavior |
|-------|-------|----------|
| **Expanded** | 240px | Full labels + icons. Module grouping separators. Badge counts (unread alerts, active rounds). |
| **Collapsed** | 48px | Icons only. Active module: accent-color left border. Tooltip on hover (instant, no delay). |
| **Hidden** | 0px | Nothing visible. Left edge is content boundary. Hover-to-reveal on left edge (200ms dwell, 150ms slide). |

**Module navigation** (11 modules, grouped with visual separators):

Monitoring:
1. Console — Multi-pane real-time graphics display
2. Process — Large-scale single-pane process views

Analysis:
3. Dashboards — Real-time data visualization widgets
4. Reports — Historical data reports and export
5. Forensics — Data correlation and investigation

Operations:
6. Log — Operational logbook with rich formatting
7. Rounds — Equipment inspection checklists
8. Alerts — Human-initiated alerts, emergency notifications, muster command center (doc 31)

Management:
9. Shifts — Shift schedules, crew rosters, presence tracking, mustering (doc 30)
10. Settings — System configuration and user management
11. Designer — Graphics editor and template creation

**Permission-gated visibility:** Modules the user lacks permission for are hidden entirely (not grayed out). Shifts requires `shifts:read`, Alerts requires `alerts:read`.

**State transitions:**

```
                    Ctrl+\                     Ctrl+Shift+\
  Expanded (240px) ←────→ Collapsed (48px) ←────────────→ Hidden (0px)
       ↑                                                       ↑
       └───── Ctrl+Shift+\ (direct toggle to Hidden) ─────────┘
```

**Collapsed hover behavior:** Mouse remains over collapsed sidebar for 300ms → sidebar expands as a floating overlay (240px, `position: fixed`) on top of content. No content reflow. Mouse leaves overlay area → retracts after 200ms delay. Clicking a module navigates and retracts.

**Hidden edge-hover behavior:** Mouse within 8px of left viewport edge → after 200ms dwell, a translucent chevron handle (24x48px) fades in at 150ms → clicking the handle slides the sidebar in as a full overlay (240px, 250ms ease-out). Subtle drop shadow on right edge, no backdrop scrim. Mouse leaving sidebar area → slides out after 400ms delay. `Escape` slides out immediately. "Pin" icon in overlay header → transitions from Hidden to Collapsed.

**Hide button:** Small `<<` icon at the bottom of the sidebar in Expanded/Collapsed states. Clicking transitions to Hidden. Provides mouse-only access to Hidden state without keyboard shortcuts.

**Persistence:** Sidebar state stored in `user_preferences` JSONB, key `sidebar_state`. Per-window independence — each browser window maintains its own state. BroadcastChannel syncs the preference but windows can override locally.

### Top Bar (2-State)

| State | Height | Content |
|-------|--------|---------|
| **Visible** | ~48px (density-dependent) | Logo, breadcrumbs, global search / Ctrl+K trigger, alert notification bell + badge, user profile dropdown, theme switcher |
| **Hidden** | 0px | Nothing visible. Hover-to-reveal on top edge. |

**Toggle:** `Ctrl+Shift+T` or hide button (`▲` icon at right end of top bar). Both sidebar and top bar have explicit show/hide toggle buttons, even outside kiosk mode.

**Hidden edge-hover behavior:** Same pattern as sidebar — mouse within 8px of top edge → 200ms dwell → translucent handle fades in → click slides top bar down as overlay (250ms) → mouse leaving slides it back (400ms delay). "Pin" icon → transitions to Visible.

**Persistence:** State stored in `user_preferences` JSONB, key `topbar_visible`. Per-window independent. Kiosk mode overrides to Hidden; pre-kiosk state restored on exit.

**Alert Notification Indicator:** Bell icon with unacknowledged alert count badge. Clicking opens an alert panel (dropdown slide-out) showing recent alerts sorted by severity (EMERGENCY → CRITICAL → WARNING → INFO). Each alert row shows severity icon, title, timestamp, and an "Acknowledge" button (requires `alerts:acknowledge` permission). Badge hides when count is zero. Real-time count updates via WebSocket subscription.

### Breadcrumbs

Auto-generated from route hierarchy, rendered below the top bar (part of the top bar component).

**Pattern:** `Module > Context > Item > Sub-item`

Examples:
- `Console > Main Control Room > Pane 3`
- `Designer > Graphics > FCC-Overview > Edit`
- `Reports > Templates > Daily Production`
- `Settings > Users > jsmith@refinery.com`

Rules:
- Maximum 4 levels (matches ISA-101 display hierarchy)
- Each segment is clickable except the last (current location, plain text)
- On narrow screens, intermediate segments collapse to `...` with dropdown reveal

---

## Command Palette

**Trigger:** `Ctrl+K` (Windows/Linux) / `Cmd+K` (Mac)

**Library:** `cmdk` (MIT license, used by Linear and Vercel). Headless/unstyled — I/O controls all theming. Zero dependencies. Accessible by default. Fuzzy search via `command-score`.

### Structure

```
┌──────────────────────────────────────────────┐
│  🔍  Type a command or search...    [Ctrl+K] │
├──────────────────────────────────────────────┤
│  Recent                                      │
│  ├ Main Control Room (Console Workspace)     │
│  ├ FCC Overview (Process Graphic)            │
│  └ Daily Production (Report Template)        │
│                                              │
│  Quick Actions                               │
│  ├ 📝 New Log Entry              Ctrl+N     │
│  ├ 🔔 Acknowledge All Alerts     Ctrl+A     │
│  └ 📊 Create Dashboard           Ctrl+D     │
│                                              │
│  Navigation                                  │
│  ├ Go to Console                  G C        │
│  ├ Go to Process                  G P        │
│  └ Go to Settings                 G S        │
└──────────────────────────────────────────────┘
```

### Search Scopes (Prefix-Based)

| Prefix | Scope | What's Searched |
|--------|-------|-----------------|
| (none) | Everything | Modules, graphics, dashboards, reports, points, recent items |
| `>` | Commands | Actions: create, acknowledge, export, run report, change theme, toggle settings |
| `@` | Points | Point tagnames and descriptions. Results show tagname, description, current value, unit |
| `/` | Graphics | Graphics and process views by name |
| `#` | Entities | Dashboards, reports, workspaces, round templates |

### Behavior

- **Fuzzy matching:** `command-score` algorithm ranks by substring position, consecutive character matches, and word boundary alignment. "mcr" matches "Main Control Room."
- **Contextual awareness:** Active module's items and actions are boosted. In Console, recent workspaces appear first. In Forensics, recent investigations appear first.
- **Recent items:** Last 10 navigated-to items, persisted in localStorage.
- **Keyboard navigation:** Arrow keys to move, Enter to select, Escape to close.
- **Maximum 20 results** shown per query, grouped by category, with "Show all N results" link.

### Performance

- Palette opens in <50ms
- Local results (modules, recent, actions) in <100ms
- All search queries (not just points) debounce to 200ms then query `GET /api/search` (doc 21). Results return grouped by category with relevance ranking.

---

## G-Key Navigation

Two-keystroke module jumping (Gmail/Linear pattern). Press `G`, then a module key:

| Sequence | Destination |
|----------|-------------|
| `G` then `C` | Console |
| `G` then `P` | Process |
| `G` then `D` | Designer |
| `G` then `B` | Dashboards (Boards) |
| `G` then `R` | Reports |
| `G` then `F` | Forensics |
| `G` then `L` | Log |
| `G` then `O` | Rounds |
| `G` then `S` | Settings |
| `G` then `H` | Shifts |
| `G` then `A` | Alerts |

On `G` press, a visual hint overlay appears near the sidebar showing available targets with their key bindings. The overlay auto-dismisses after 2 seconds if no second key is pressed, or immediately on second key press or Escape.

**Disabled** when a text input, textarea, or contenteditable element is focused — the `G` key types normally.

---

## Kiosk Mode

Kiosk mode hides I/O's own navigation (sidebar + top bar), maximizing screen real estate for monitoring displays. This is NOT browser fullscreen — it removes I/O's application chrome.

### Available Modules

Console and Process are the primary kiosk targets. All 11 modules technically support kiosk mode, but Console and Process are the designed-for use cases.

### Entry

| Method | Details |
|--------|---------|
| URL parameter | `?mode=kiosk` — enters kiosk on page load. Bookmarkable for control room displays. |
| Keyboard shortcut | `Ctrl+Shift+K` (toggle) |
| Command palette | `>Enter kiosk mode` |
| UI button | User profile dropdown: "Enter Kiosk Mode" |

### What Happens on Entry

1. Sidebar state saved to memory, transitions to Hidden (0px)
2. Top bar state saved to memory, transitions to Hidden (0px)
3. Content area expands to fill the full viewport
4. URL parameter `?mode=kiosk` added (refresh stays in kiosk)
5. Also stored in `sessionStorage` (survives in-app navigation)
6. Brief toast (2s): "Kiosk mode active. Press Escape to exit."
7. Browser enters fullscreen ONLY if entry was via URL parameter or UI button. Keyboard shortcut does NOT auto-fullscreen.

### Behavior

- **No idle timeout.** Kiosk displays run indefinitely.
- **Data flow:** Continuous. WebSocket subscriptions remain active. All real-time updates render normally.
- **Navigation chrome:** All hidden. Edge-hover patterns are the only way to access sidebar and top bar.
- **Read-only base layer:** Data flows, alarms display, graphics render. No edit controls or configuration panels visible.
- **Authenticated interactive layer:** Clicking to interact prompts authentication (see Visual Lock below). After auth, write operations are available per RBAC for a configurable duration (default 15 minutes, per-role).

### Per-Window Independence

Multi-window setups can have different kiosk states. The main window could be interactive while detached Process views are in kiosk. Each window's kiosk state is independent.

Window Group presets include a `kiosk: boolean` flag per window, enabling configurations like "Wall Display" (all kiosk) or "Supervisor Station" (main interactive, overview monitors in kiosk).

### Exit

| Method | Details |
|--------|---------|
| `Escape` | If in fullscreen: first press exits fullscreen, second exits kiosk. Otherwise: single press exits kiosk. |
| `Ctrl+Shift+K` | Toggle — exits kiosk |
| Command palette | `>Exit kiosk mode` |
| Visual lock auth | After authenticating, "Exit Kiosk" option appears |

On exit: sidebar restored to pre-kiosk state, top bar restored to Visible, `?mode=kiosk` removed from URL, fullscreen exited if active.

### Command Palette in Kiosk

`Ctrl+K` works in kiosk mode. When not authenticated, the palette opens in **restricted mode**: only read-only navigation commands (switch graphic, go to module, search points for display). No create/edit/delete actions. Palette header shows "Kiosk Mode — Limited" badge. This lets operators quickly change what's on screen without full login.

### Mobile Kiosk (Tablet)

Tablets at operator stations may run kiosk via `?mode=kiosk` as a PWA bookmark. Swipe from left edge reveals sidebar overlay. Swipe from top reveals top bar overlay. Tap triggers the visual lock auth. All touch targets remain 60px minimum (gloved operation).

---

## Visual Lock Overlay

The visual lock is triggered by per-role idle timeout. It is NOT shown proactively — the screen looks identical after timeout until the user attempts interaction.

### Behavior

1. User is idle for the role-configured timeout period (default 30 minutes)
2. Session transitions to locked state: **no visible change**. Data continues to flow. Screen looks identical.
3. User moves mouse, clicks, or presses a key → lock overlay fades in over 300ms:
   - Semi-transparent dark backdrop (`rgba(0,0,0,0.6)`) over the entire viewport
   - Centered lock card: user avatar, username, password/PIN field, "Unlock" button
   - Data remains visible (dimmed) behind the overlay — operators can still read values
4. If password entered correctly → overlay fades out (200ms), full interactive session restored, idle timer resets
5. If no password entry within **60 seconds** → overlay fades away (300ms), returns to monitoring-only display. Next interaction attempt triggers the overlay again.
6. Three failed password attempts → follows existing auth lockout policy (doc 29)

### CSS Architecture

```css
/* Data layer continues updating — never blocked */
.io-content-layer {
  pointer-events: none;  /* When locked — prevents interaction, data still renders */
}

/* Lock overlay sits on top */
.io-lock-overlay {
  z-index: var(--io-z-visual-lock);  /* 500 */
  pointer-events: auto;
}
```

Data continues updating behind the overlay at all times. The lock prevents interaction, not data flow.

### Visual Lock + Navigation Interaction

When locked, edge-hover for sidebar/top bar triggers the lock overlay instead of showing navigation. Rationale: showing navigation before authentication would allow unauthorized module switching.

### Kiosk Visual Lock

Kiosk mode's visual lock differs from standard:
- Mouse **movement** triggers edge-hover handles (sidebar/top bar), NOT the lock overlay
- Mouse **clicks, keypresses (except Escape and Ctrl+K), and touch taps** trigger the lock overlay
- Clicking an edge-hover handle when unauthenticated → lock overlay appears. After auth, the requested sidebar/top bar slides in automatically.
- Authenticated kiosk sessions have a countdown timer (configurable per role, default 15 minutes). When the session expires, chrome hides and the lock resets.

---

## Loading / Empty / Error States

### Loading States

Module-shaped **skeleton screens**, not generic spinners. Each module's loading state matches the shape of its expected content:

- Console: Gray placeholder rectangles in the grid layout
- Dashboards: Widget-shaped skeleton cards
- Tables (Log, Rounds, Reports): Row-shaped horizontal bars
- Process: Canvas-sized placeholder with subtle pulse animation

Skeleton screens use `--io-surface-secondary` background with a subtle shimmer animation (CSS `@keyframes`, no JavaScript).

### Empty States

Tailored per module with guidance on next steps:

- **Title** describing what goes here (e.g., "No Workspaces Yet")
- **Brief description** of what the user can do
- **Primary CTA button** (e.g., "Create Workspace", "Import Graphic")
- Uses `--io-text-4xl` for title, `--io-text-base` for description

### Error States

Inline, unobtrusive — NOT full-page error screens:

- Error icon + message text + **Retry** button
- Displayed within the component that failed (chart, widget, table)
- If an entire module fails to load: centered error card with message, retry, and "Contact administrator" link
- Stale data indicators (point-level staleness) follow the existing specification from doc 16/19

---

## Animation

### Speed Tokens

| Token | Duration | Use |
|-------|----------|-----|
| `--io-duration-fast` | 150ms | Hover/focus states, tooltip appear |
| `--io-duration-medium` | 250ms | Sidebar/panel transitions, overlay slide |
| `--io-duration-slow` | 350ms | Visual lock fade, complex transitions |

Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (default), `ease-out` for entries, `ease-in` for exits.

### Reduced Motion

All non-essential animation is disabled when `prefers-reduced-motion: reduce` is active. Transitions become instant (0ms). Functional delays (edge-hover dwell times, mouse-out delays) are unchanged — they prevent accidental triggers, not aesthetic.

### Live Data Rule

**Live data NEVER animates.** Point values, alarm states, and equipment status update instantly with no transitions. Animating data changes would introduce visual latency in a safety-critical monitoring context and obscure rapid changes. This is non-negotiable.

### Animation Timing Reference

| Animation | Duration | Notes |
|-----------|----------|-------|
| Sidebar expand/collapse (Expanded ↔ Collapsed) | 200ms ease-in-out | Content reflows |
| Sidebar overlay slide in (from Hidden) | 250ms ease-out | No reflow |
| Sidebar overlay slide out | 200ms ease-in | |
| Top bar overlay slide down | 250ms ease-out | |
| Top bar overlay slide up | 200ms ease-in | |
| Edge-hover handle fade in | 150ms ease-out | After 200ms dwell |
| Edge-hover handle fade out | 100ms ease-in | |
| Mouse-out delay before overlay retract | 400ms | Prevents accidental dismissal |
| Collapsed sidebar hover-expand delay | 300ms | Before floating panel |
| Visual lock overlay fade in | 300ms ease-out | |
| Visual lock overlay fade out (unlock) | 200ms ease-in | |
| Visual lock overlay fade out (timeout) | 300ms ease-out | |
| Dashboard playlist transition | 500ms ease-in-out | Disabled in Compact density |

---

## Scaling & Accessibility

### rem-Based Sizing

All CSS sizing uses `rem` units (relative to root font size). Users who increase their browser's default font size get proportionally larger UI elements. This is a WCAG requirement.

### Global UI Scale

A `--io-scale` preference allows users to scale the entire UI (80% / 90% / 100% / 110% / 120%) independent of browser zoom. Applied via `font-size` on `<html>` element, which cascades through all `rem` values.

### Browser Zoom

The application supports browser zoom (Ctrl+/Ctrl-) naturally due to rem-based sizing. No layout breakage up to 200% zoom.

### Accessibility Foundations

- ARIA labels on all interactive elements
- Keyboard navigation support throughout
- Focus management for modals and overlays
- Focus ring: 2px solid `--io-accent`, 2px offset
- High contrast: HPHMI theme meets WCAG AAA (7:1) for outdoor/sunlight use

---

## Z-Index Stacking Order

| Layer | z-index | Component |
|-------|---------|-----------|
| Content | 0 | Module content area |
| Inline panels | 10 | Detail panel, properties panel (push content) |
| Sidebar | 100 | Sidebar (inline and overlay modes) |
| Top bar | 100 | Top bar (inline and overlay modes) |
| Edge-hover handles | 150 | Chevron handles at viewport edges |
| Dropdown / Quick View | 200 | Dropdowns, popovers, quick view overlay |
| Modal | 300 | Modal dialogs |
| Command palette | 400 | Ctrl+K overlay |
| Visual lock | 500 | Lock backdrop + auth card |
| Kiosk auth | 600 | Kiosk-mode authenticated overlay (above lock for layering) |
| Toast notifications | 700 | Transient notifications (above everything except emergency) |
| Emergency alert banner | 800 | Doc 27 emergency overlay — ALWAYS visible, highest priority |

The emergency alert banner must always be visible, even above the visual lock overlay. An emergency situation takes priority over session security UI.

---

## Keyboard Shortcuts — Complete Map

### Global Shortcuts

| Shortcut | Action | Works in Kiosk? |
|----------|--------|-----------------|
| `Ctrl+K` | Open command palette | Always (restricted if unauthenticated in kiosk) |
| `Ctrl+\` | Toggle sidebar Expanded ↔ Collapsed | Yes (if authenticated) |
| `Ctrl+Shift+\` | Toggle sidebar Hidden ↔ previous state | Yes (if authenticated) |
| `Ctrl+Shift+T` | Toggle top bar Visible ↔ Hidden | Yes (if authenticated) |
| `Ctrl+Shift+K` | Toggle kiosk mode | Always |
| `Escape` | Close topmost layer (see priority stack) | Always |
| `G` then key | Module navigation (see G-Key section) | Yes (if authenticated) |
| `Ctrl+I` | Open Point Detail panel for selected point | Yes (if authenticated) |
| `?` | Keyboard shortcuts help overlay | Yes (if authenticated) |

### Escape Key Priority Stack

`Escape` closes the topmost layer, one per press:

1. Command palette (if open)
2. Modal dialog (if open)
3. Quick View overlay panel (if open)
4. Detail panel (if open)
5. Visual lock overlay (dismisses overlay, returns to passive display — does NOT authenticate)
6. Kiosk sidebar/top bar overlay (slides them back out)
7. Kiosk mode itself (exits kiosk, restores chrome)
8. Fullscreen (browser-level)

---

## Theme System

### Theme Presets (Detailed)

**Light:**
- Background: white (#FFFFFF), subtle gray cards (#F8FAFC)
- Text: dark gray (#111827 primary, #6B7280 secondary)
- Accent: Blue (#3B82F6) — or user-selected hue
- Corporate/office feel for reviewing reports, configuring settings

**Dark:**
- Background: true dark (#09090B), elevated surfaces (#18181B)
- Text: white (#F8FAFC primary, #A1A1AA secondary)
- Accent: Purple/Violet (#8B5CF6) — visually distinct from HPHMI
- IDE-like feel for engineers doing Forensics, data analysis

**HPHMI (High-Performance HMI):**
- Background: dark blue-gray (#0F172A, Tailwind slate-900), panels (#1E293B, slate-800)
- Text: white (#F8FAFC primary, #94A3B8 secondary)
- Accent: Teal/Cyan (#06B6D4) — distinctive, not red/green (alarm-reserved)
- Equipment: white/gray outlines on dark background (ISA-101 running state)
- ISA-101 alarm colors pop against dark background
- The "control room" theme: calm, authoritative, data-focused

**What ties all themes together:** Same spacing, typography, icon system, density, animation, and component structure. Only colors change.

### Theme Storage

Theme preference stored in localStorage. Instant switching via `data-theme` attribute on `<html>` — no re-render. BroadcastChannel syncs theme changes to all windows (main + detached).

---

## Global Search

Global search is accessed via the command palette (Ctrl+K). The top bar search icon triggers the command palette.

Search across all modules:
- Graphics by name
- Workspaces by name
- Dashboards by name
- Log entries by content
- Points by tagname/description
- Users, reports, round templates

Typeahead search (<200ms response). Recent searches persisted in localStorage. See Command Palette section for full specification.

---

## State Management

- **Auth Store (Zustand):** user, tokens, login/logout functions
- **Theme Store (Zustand):** current theme, setTheme function
- **Navigation Store (Zustand):** sidebar state, top bar state, kiosk mode, per-window overrides
- **Search Store (Zustand):** search query, results, recent searches

---

## Routing

- React Router v6
- Protected routes HOC
- Lazy loading for all 11 modules (code splitting)
- Route-based breadcrumbs
- Kiosk mode URL parameter (`?mode=kiosk`)
- Detached window routes (see Multi-Window Architecture)

---

## Performance

- Initial load < 2 seconds
- Route transitions < 100ms
- Theme switch instant (no flash)
- Command palette opens in < 50ms
- Search typeahead < 200ms

---

## API Integration

**Endpoints:**
- `POST /api/auth/login` — User login
- `POST /api/auth/logout` — User logout
- `POST /api/auth/refresh` — Refresh access token
- `GET /api/search?q=<query>` — Global search

---

## Success Criteria

- Users can login and navigate to all modules
- Theme switching works instantly across all windows
- Command palette provides fast access to any content or action
- Kiosk mode runs stable on control room displays for days without intervention
- Navigation is intuitive and responsive
- App loads quickly (< 2s initial load)
- Skeleton loading states prevent layout shift
- Visual lock overlay is invisible until interaction, never blocks data display
- My Exports link accessible from user profile dropdown
- About page displays version, build info, and open source licenses

---

## About Page

Accessible from: **User profile dropdown → "About Inside/Operations"**

The About page is a shell-level utility page (not a module) that displays application metadata and open source licensing information.

### Layout

**Top section — Application Info:**

| Field | Source |
|-------|--------|
| Product name | "Inside/Operations" |
| Version | Build-time `APP_VERSION` env var (semver) |
| Build | Git commit short hash + build timestamp |
| EULA version | Current active EULA version from `eula_versions` |
| Server | Hostname of the I/O server |

**Bottom section — Open Source Licenses (tabbed):**

Two tabs: **Backend** and **Frontend**.

Each tab displays a searchable, sortable table of third-party dependencies:

| Column | Description |
|--------|-------------|
| Package | Crate/npm package name |
| Version | Installed version |
| License | SPDX identifier (MIT, Apache-2.0, BSD-3-Clause, etc.) |
| Copyright | Copyright holder(s) from LICENSE file |

Expanding a row reveals the full license text for that dependency.

**Data source:**

- Backend: Auto-generated at build time by `cargo-about` → `backend-licenses.json` (bundled as a static asset)
- Frontend: Auto-generated at build time by `license-checker` → `frontend-licenses.json` (bundled as a static asset)
- Both JSON files follow the same schema: `[{ "name", "version", "license", "copyright", "text" }]`

**Grouping option:** Toggle between "By Package" (default) and "By License" views. The "By License" view groups packages under their license type and shows the license text once with all covered packages listed.

**Special handling:**

- **MPL 2.0** (resvg): Includes a "Source Code" link pointing to the crate's repository URL
- **Apache 2.0** with NOTICE files: NOTICE text appended after the license text
- **OFL** (Inter, JetBrains Mono fonts): Listed with font foundry copyright

**SBOM download:** A "Download SBOM" button exports CycloneDX JSON format (generated at build time by `cargo-cyclonedx` and `@cyclonedx/cyclonedx-npm`). Available to any authenticated user — no special permission required.

### API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/system/about` | JWT | Application version, build info, server hostname |
| `GET` | `/api/system/licenses/backend` | JWT | Backend license manifest JSON |
| `GET` | `/api/system/licenses/frontend` | JWT | Frontend license manifest JSON |
| `GET` | `/api/system/sbom` | JWT | Download CycloneDX SBOM (JSON) |

---

## Multi-Window Architecture

### Window Types

- **Main window**: The full I/O application — app shell, all 11 modules, sidebar navigation, settings, everything.
- **Detached window**: A stripped-down browser window showing a single content view. No sidebar, no module switcher, no top navigation bar.

### Detached Window Routes

The React app includes routes for detached views:
- `/detached/console/:workspaceId` — Console workspace grid only
- `/detached/process/:viewId` — Process graphic view only
- `/detached/dashboard/:dashboardId` — Dashboard view only

These routes render a **minimal shell**:
- Thin title bar showing content name + connection status indicator (green dot = connected, red = disconnected)
- The content view itself (workspace grid / process graphic / dashboard)
- Basic controls: pane swap, resize, zoom, fullscreen toggle
- Right-click context menus for pane operations (same as main app)

### SharedWorker WebSocket Connection Pooling

All browser windows (main + detached) share a single WebSocket connection to the data broker. The primary mechanism is a SharedWorker; a BroadcastChannel-based fallback covers browsers that lack SharedWorker support.

**Primary: SharedWorker (Chrome, Firefox, Edge)**

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Main Window  │  │ Secondary 1  │  │ Secondary 2  │
│ (Console)    │  │ (Process)    │  │ (Dashboard)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │ MessagePort      │ MessagePort      │ MessagePort
       └────────┬─────────┴────────┬─────────┘
                │                  │
         ┌──────▼──────────────────▼──────┐
         │         SharedWorker            │
         │  ┌─────────────────────────┐   │
         │  │ Subscription Registry   │   │
         │  │ (union of all windows)  │   │
         │  └─────────────────────────┘   │
         │  ┌─────────────────────────┐   │
         │  │ WebSocket Connection    │   │
         │  │ (single connection to   │   │
         │  │  data broker)           │   │
         │  └─────────────────────────┘   │
         └────────────────────────────────┘
                        │
                   wss://broker
```

How it works:
- Each window registers its point subscriptions with the SharedWorker via MessagePort
- SharedWorker maintains the **union** of all window subscriptions — only the union is sent to the server
- Point updates flow: WebSocket → SharedWorker → routed to each window that subscribed to that point
- When a window closes, its subscriptions are removed; SharedWorker unsubscribes points no longer needed by any window
- Server sees ONE client per user, regardless of window count — no changes to server-side data broker
- See doc 16 for full SharedWorker protocol specification

**Fallback: BroadcastChannel Leader Election (Safari/iOS)**

Safari (including all iOS browsers, which use the WebKit engine) does not support SharedWorker. The fallback uses BroadcastChannel (supported in Safari 15.4+) to coordinate a single WebSocket connection across tabs:

- On startup, each tab feature-detects `window.SharedWorker`. If unavailable, it enters BroadcastChannel leader-election mode.
- Tabs communicate via a dedicated BroadcastChannel named `io-ws-leader`.
- **Leader election**: When a tab opens and finds no active leader, it claims leadership by broadcasting a `leader:claim` message with its tab ID and timestamp. If multiple tabs claim simultaneously, the highest-timestamp-wins rule resolves the conflict (latest timestamp becomes leader). The leader holds the single WebSocket connection to the data broker.
- **Data distribution**: The leader tab receives point updates via WebSocket and rebroadcasts them to all other tabs via BroadcastChannel messages. Other tabs send subscription changes to the leader via the same channel.
- **Leader loss detection**: Each tab expects periodic `leader:heartbeat` messages (every 2 seconds). If no heartbeat arrives within 6 seconds, the leader is assumed lost (tab closed, crashed, or navigated away). Remaining tabs initiate a new leader election.
- **New leader takeover**: The newly elected leader opens a fresh WebSocket connection, re-registers the union of all tab subscriptions, and begins rebroadcasting updates.
- Server sees ONE client per user, same as the SharedWorker path — no server-side differences.

**Detection logic:**

```typescript
if (typeof SharedWorker !== 'undefined') {
  // Primary path: SharedWorker manages WebSocket
  initSharedWorkerConnection();
} else if (typeof BroadcastChannel !== 'undefined') {
  // Fallback path: BroadcastChannel leader election
  initLeaderElectionConnection();
} else {
  // Last resort: direct WebSocket per tab (no connection sharing)
  initDirectConnection();
}
```

No user-facing difference in behavior between the two paths. The fallback is transparent — same subscription API, same data flow, same single-connection-per-user guarantee.

### BroadcastChannel State Sync

A BroadcastChannel named `io-app-sync` synchronizes lightweight state across all windows:

| Message Type | Payload | Purpose |
|---|---|---|
| `auth:refresh` | `{ accessToken, expiresAt }` | Token refresh in any window propagates to all windows |
| `theme:change` | `{ theme }` | Theme change in main window propagates to all detached windows |
| `density:change` | `{ density }` | Density mode change propagates to all windows |
| `session:lock` | `{ }` | Visual lock in any window locks all windows |
| `session:unlock` | `{ }` | Unlock in any window unlocks all windows |
| `window:closing` | `{ windowId, isMain }` | Main window closing → detached windows save state and close |
| `window:opened` | `{ windowId, type, contentId }` | New window announces itself for SharedWorker coordination |
| `alert:emergency` | `{ alertId, severity, title, message, requiresAcknowledgment, fullScreenTakeover }` | Propagates emergency alert overlay to all windows including detached |

### Auth Flow for Detached Windows

1. Main window holds access token in memory (existing design from doc 03)
2. `window.open()` spawns detached window — same-origin, shares httpOnly refresh token cookie
3. Detached window loads → calls `POST /api/auth/refresh` using the shared refresh token cookie → gets its own access token in memory
4. BroadcastChannel syncs subsequent token refreshes — when any window refreshes, all windows update their in-memory token

No changes to server-side auth. Session tracking remains per-user, not per-window.

### Window Management API (Progressive Enhancement)

The Window Management API enables precise multi-monitor window positioning. This is a progressive enhancement — the feature works without it.

**When available** (Chrome/Edge, requires user permission grant):
- `getScreenDetails()` enumerates all connected monitors with resolutions and positions
- Window Groups save screen-relative positions: `{ screenIndex, x, y, width, height }`
- "Launch" opens windows at exact saved positions on specific monitors

**When NOT available** (Firefox, or permission denied):
- Windows open at default browser positions
- User manually arranges them on their monitors
- "Save positions" captures current positions via `window.screenX/screenY` (less precise but functional)

### Window Groups

A Window Group is a saved multi-window configuration that can be launched with one click. It defines:
- What content the main window shows
- How many detached windows to open, each with its content assignment and target screen position

```typescript
interface WindowGroup {
  groupId: string;
  name: string;
  ownerId: string;
  isPublished: boolean;
  mainWindow: {
    module: 'console' | 'process' | 'dashboard';
    contentId: string; // workspaceId, viewId, or dashboardId
  };
  secondaryWindows: Array<{
    module: 'console' | 'process' | 'dashboard';
    contentId: string;
    screen: number;       // screen index (Window Management API)
    x: number;            // position relative to screen
    y: number;
    width: number;
    height: number;
    kiosk: boolean;       // per-window kiosk flag
  }>;
}
```

Stored in the `window_groups` database table as JSONB (see doc 04). Publishable and shareable like Console workspaces.

**Window Group Management UI:**
- Create: Arrange windows manually, then "Save as Window Group" captures current layout
- Launch: One-click opens all windows at saved positions
- Edit: Modify window assignments or positions
- Publish: Share with other users (published groups appear in a shared list)
- Delete: Remove a window group

API endpoints for Window Groups are defined in doc 21.

---

## Emergency Alert Overlay

The shell owns the emergency alert overlay. Individual modules do NOT implement their own — all modules inherit this behavior automatically from the shell layout.

### Placement and Dimensions

The emergency alert banner renders between the top navigation bar and the module content area. It is a persistent banner that **pushes content down** (not a floating overlay) — nothing is hidden underneath. The top navigation bar stays anchored at its normal position.

```
┌─────────────────────────────────────────────────────────┐
│  Top Navigation Bar (anchored, unaffected)               │
├─────────────────────────────────────────────────────────┤
│  ⚠ EMERGENCY: [Alert message text]    12:34:05  [ACK]  │  ← Emergency Alert Banner
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Module Content Area (pushed down)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Width**: Full application width (100%)
- **Height**: 48–60px
- **Z-index**: `--io-z-emergency` (800) — above everything, including visual lock

### Styling

- High-contrast red background (`#DC2626` or similar)
- White text
- Meets WCAG AAA contrast ratio (minimum 7:1)

### Content Layout

- **Left**: Alert severity icon
- **Center**: Alert message text and timestamp
- **Right**: Dismiss/acknowledge button (requires `alerts:acknowledge` permission)

### Audio

- Configurable audible alert plays on first banner appearance
- Audio can be muted globally in Settings
- Respects browser autoplay policies (audio starts on first user interaction if autoplay is blocked)

### Multiple Emergencies

If multiple emergency alerts are active simultaneously, the banner shows a count badge (e.g., "3 active alerts") with an expandable list. Acknowledging one alert removes it from the list; the banner remains until all are acknowledged or resolved.

### Behavior

- Banner appears instantly via WebSocket emergency alert subscription at the shell level (not per-module)
- Dismiss/acknowledge removes the banner, but it returns if a new emergency arrives
- Content area pushes down — the application remains fully functional with the banner displayed
- All modules inherit this behavior from the shell — no module-specific emergency overlay handling is needed
- In multi-window mode, the banner propagates to all windows (main + detached) via BroadcastChannel (`alert:emergency` message type). Acknowledgment from any window dismisses the banner on all windows via WebSocket update.

### Window Lifecycle

- **Opening**: Main window calls `window.open()` for each detached window. Each detached window authenticates independently via refresh token cookie, connects to SharedWorker, and announces itself via BroadcastChannel.
- **Closing a detached window**: SharedWorker removes that window's subscriptions. No effect on other windows.
- **Closing the main window**: Browser shows confirmation dialog: "Closing will also close N detached windows. Continue?" If confirmed, main window sends `window:closing` via BroadcastChannel → all detached windows save any unsaved state and close.
- **SharedWorker crash**: All windows detect MessagePort disconnect → main window (or first available window) re-creates the SharedWorker → all windows reconnect and re-register subscriptions.
- **Browser/tab crash**: SharedWorker detects closed MessagePort → removes that window's subscriptions. Other windows unaffected.

---

## Connection Loss Behavior

Defines desktop browser behavior when the WebSocket connection to the server is lost.

### Connection Banner (Shell-Level)

When the WebSocket drops, a non-dismissible yellow banner appears below the top navigation bar:

```
┌─────────────────────────────────────────────────────────┐
│  Top Navigation Bar (anchored, unaffected)               │
├─────────────────────────────────────────────────────────┤
│  ⚠ Connection lost — reconnecting...                    │
│    Last update: 12:34:56            [Reconnect Now]     │  ← Connection Banner
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Module Content Area (pushed down)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Initial state (yellow)**: "Connection lost — reconnecting... Last update: HH:MM:SS" with a manual **Reconnect Now** button
- **After 5 minutes disconnected (red)**: Banner escalates to red: "Server unreachable — all data is stale"
- **Non-dismissible**: Banner cannot be closed by the user — it disappears only when the connection restores
- **Same visual treatment as the emergency alert overlay**: Pushes content down, does not obscure it. If both an emergency alert banner and a connection banner are active, the emergency alert banner stacks above the connection banner.

### Stale Visual Treatment

- All point values on-screen stay visible (last known values) but receive the `io-stale` CSS class (dashed outlines, muted text per doc 35 Shape Library)
- Calculated expressions and timers freeze — everything freezes simultaneously. No partial updates.
- Alarm indicators freeze in their last state — alarms do NOT clear during an outage

### Module-Specific Behavior During Outage

| Module | Behavior |
|--------|----------|
| Console / Process | Freeze with stale treatment on all data-bound elements |
| Dashboards | Widgets freeze, show "Last updated: HH:MM:SS" in widget footer |
| Forensics / Reports | Continue working against cached/historical data; new API calls may fail if server is also down |
| Log / Rounds | Queue submissions locally via IndexedDB sync queue (same mechanism as mobile offline, see doc 20) |
| Settings | Read-only mode, "Offline" badge on save buttons, edits blocked |
| Designer | Continue local editing (all state is client-side), save/publish disabled until reconnected |
| Alerts | Send disabled, existing alerts list frozen |
| Shifts | Presence data frozen, badge events queue on server side |

### Recovery

- On WebSocket reconnect, Data Broker pushes current cached values for all subscribed points
- Stale indicators clear per-point as fresh data arrives (not all at once — gradual visual recovery)
- Connection banner disappears when WebSocket is fully reconnected
- Queued Log/Rounds submissions sync automatically via the IndexedDB drain mechanism
- Designer save/publish re-enabled

**Cross-references:** Doc 16 (WebSocket reconnection, staleness detection), Doc 19 (Graphics stale rendering), Doc 35 (Shape Library `io-stale` CSS class), Doc 20 (Mobile offline sync queue).

---

## Help System

In-app user assistance using a layered approach — from guided walkthroughs for new users to contextual reference for experienced operators.

### Layer 1 — Guided Tours (react-joyride, MIT)

Step-by-step walkthroughs highlighting UI elements with spotlight overlay, tooltips, and Next/Back/Skip controls.

- Triggered on first login (app overview tour), first visit to each module, and after major version upgrades
- Tour definitions stored as JSON configuration, bundled at build time
- "Don't show again" preference per tour, per user (stored in `user_preferences` table)
- Tour content reviewed and updated with each release

Example tours:
- **"Welcome to I/O"** — shell overview (sidebar navigation, command palette, user menu)
- **"Console Basics"** — workspaces, graphics, alarm panel
- **"Designer Quick Start"** — 3 design modes (graphic, dashboard, report)
- **"Settings for Admins"** — system configuration, user management, OPC sources

### Layer 2 — Contextual Help Panel

- Keyboard shortcut `?` (when not in a text input) or Help button in user menu opens a slide-out panel from the right
- Panel auto-selects help content based on current route (e.g., `/console` → Console help articles)
- Help content authored as markdown files, bundled at build time, rendered with `react-markdown` (MIT)
- Searchable via Fuse.js (Apache 2.0) for fuzzy full-text search across all help articles
- Panel shows: article title, breadcrumb (module > topic), content, and "Related articles" links
- Content structure: one markdown file per topic, organized by module (`help/console/workspaces.md`, `help/designer/point-binding.md`, etc.)

### Layer 3 — Tooltip-Based Field Help

- Info icons (ⓘ) next to complex configuration fields in Settings, Designer property panels, and wizard interfaces
- Hover reveals a tooltip with a brief explanation (1-2 sentences)
- Tooltip content sourced from the same markdown help files (extracted via frontmatter or heading anchors)
- No new dependency — uses existing tooltip UI component

### Layer 4 — Command Palette Integration

- Add "Help" category to the existing Ctrl+K command palette
- User types a question → matching help articles appear alongside navigation results
- Same Fuse.js search index as the help panel
- Selecting a help result opens the contextual help panel to that article

### Layer 5 — What's New

- On first login after a version upgrade, a modal shows release highlights
- Content from a `RELEASES.md` file bundled at build time, filtered to current version
- Dismissible, with "Don't show for this version" checkbox
- Also accessible from Help menu: "What's New in v1.x"

---

## System Status Indicator

**Location:** Top navigation bar, right side, near user profile/avatar area.

### Visual

Small dot indicator with three states:

| Color | Meaning |
|-------|---------|
| **Green** | All healthy |
| **Yellow** | Degraded — some non-critical services failing, or WebSocket reconnecting |
| **Red** | Critical — WebSocket disconnected >5 min, or OPC sources offline, or key services unreachable |

### Click Popover (All Authenticated Users)

Compact status summary:

| Item | States |
|------|--------|
| WebSocket | Connected / Reconnecting / Disconnected |
| OPC Data | Flowing / Stale / Offline (summarized across all configured sources) |
| Server | Reachable / Unreachable |
| Last data update | Timestamp |

For users with admin role: additional **"Open System Health →"** link navigating to Settings > System Health.

### Data Source

- Reads from WebSocket `connection-status` messages for real-time connectivity state
- Periodic lightweight `GET /health/live` calls to API Gateway for server reachability (no heavy polling)
- OPC source status derived from Data Broker heartbeat messages on the WebSocket

**Cross-references:** Doc 36 (Observability) for the full System Health admin page in Settings.

---

## Print Support

### Browser Print (`@media print`)

A global `@media print` stylesheet provides clean printed output from any page via Ctrl+P or the browser's Print menu. This is the "quick print" path — zero server round-trip, prints what's on screen.

#### Print Color Normalization (Default On)

Dark mode printing wastes ink and produces illegible output. The print stylesheet applies color normalization by default:

1. **Force light background**: `background-color: white !important` on all containers, cards, panels, and page backgrounds. No dark theme background reaches the printer.
2. **Force dark text**: Any text color with OKLCH lightness > 0.6 is swapped to `#1a1a1a` (near-black). This catches light gray text, colored text designed for dark backgrounds, muted/secondary text — everything that would vanish on white paper.
3. **Preserve semantic color**: ISA-101 alarm colors (red `#CC0000`, yellow `#FFD700`, green `#00AA00`) are kept because they carry meaning. Gray equipment (`#808080`) stays gray — dark enough for paper and correct per ISA-101.
4. **Strip decorative backgrounds**: Gradient fills, colored card backgrounds, alternating row shading, sidebar backgrounds — all go white.
5. **Darken light borders**: Any border lighter than `#999999` is darkened to `#999999` so table grids and dividers remain visible.

**"Print as displayed" toggle**: A checkbox injected into the page via the `beforeprint` event handler. When checked, all normalization CSS is removed and the page prints exactly as shown on screen (dark background, light text, everything). This supports troubleshooting use cases where the exact screen appearance matters. Off by default.

#### Layout Normalization

- **Hidden elements**: Sidebar navigation, top navigation bar, command palette, status indicators, toast notifications, WebSocket status, emergency alert banner (the alert itself is logged — the banner is a live UI element)
- **Full-width content**: Content area expands to fill the page, padding/margins removed
- **Page breaks**: `page-break-before` on major section boundaries (report sections, log date groups, table section headers)
- **Table headers**: `<thead>` repeats on every printed page via `display: table-header-group`
- **Graphics**: SVG prints natively at full vector quality from the browser — no rasterization

#### Data Freezing

On the `beforeprint` event, the handler:
1. Freezes all real-time values by stamping current WebSocket values into text elements
2. Adds a "Printed: {timestamp}" footer to the page
3. Removes any loading spinners or skeleton states

### Print Button

A **Print** button in the module toolbar (next to the existing Export button). Behavior varies by module context:

| Module | Print Button Behavior |
|--------|----------------------|
| **Console** | Opens print dialog: graphic-only or graphic+data, page size (Letter through A1), wall-mount or reference format. See doc 07. |
| **Process** | Same as Console but for the single-pane view. See doc 08. |
| **Dashboards** | Triggers browser print (equivalent to Ctrl+P). Dashboard widgets laid out for paper via `@media print`. |
| **Reports** | Triggers PDF download (reports already produce page-oriented PDF output). |
| **Log** | Prints current filtered log entries as formatted entries with timestamps and author attribution. |
| **Rounds** | Print dialog: current round results OR blank checklist template for paper-backup field use. See doc 14. |
| **Forensics** | Prints current analysis view with charts and correlation results. |
| **Shifts** | Prints current shift roster or schedule view. |
| **Alerts** | Prints active alert list or muster status. |
| **Settings** | No print button (admin configuration is not a printable artifact). |
| **Designer** | No print button (use Export for graphic output). |

### Server-Side Print PDF

When the Print button opens a dialog (Console, Process, Rounds), the generated PDF uses the same Typst pipeline as Universal Export (doc 25) with print-specific enhancements. See doc 25 for page sizes, watermark, and format details.

---

## Change Log

- **v1.6**: Fixed stale `genpdf` reference in Server-Side Print PDF section — replaced with Typst (doc 01 v2.0, doc 25 v0.5).
- **v1.5**: Fixed stale alarm token names: `--io-alarm-warning` → `--io-alarm-high`, `--io-alarm-info` → `--io-alarm-advisory` (ISA-18.2 alignment with doc 38 v0.2).
- **v1.4**: Fixed stale Alerts permission reference in sidebar visibility: `alerts_module:access` → `alerts:read`. The `alerts_module:*` namespace was merged into `alerts:*` in doc 03 v1.5. See doc 38 for complete route map with permission guards.
- **v1.3**: Added `Ctrl+I` global keyboard shortcut for Point Detail panel. See doc 32 for Point Detail floating panel component specification.
- **v1.2**: Added Print Support section. Browser print (`@media print`) with print color normalization (force white background, darken light text above OKLCH L>0.6, preserve ISA-101 semantic colors, strip decorative backgrounds, darken light borders). "Print as displayed" toggle for troubleshooting. Layout normalization (hide chrome, full-width content, page breaks, repeating table headers). Data freezing via `beforeprint` handler. Print button with per-module behavior table (11 modules). Server-side print PDF delegates to doc 25 pipeline.
- **v1.1**: Added Connection Loss Behavior section (freeze + degrade + queue pattern with module-specific behavior table). Added Help System section (5-layer approach: react-joyride guided tours, contextual help panel with Fuse.js search, tooltip field help, command palette integration, What's New modal). Added System Status Indicator in top navigation (green/yellow/red dot with click popover for all users, admin link to Settings > System Health). See doc 36 (Observability).
- **v1.0**: Added About page (user profile dropdown → "About Inside/Operations"). Application info (version, build, EULA version, server). Open source license browser with Backend/Frontend tabs, searchable/sortable package table, expandable full license text, group-by-license view. MPL 2.0 source links, Apache 2.0 NOTICE handling, OFL font attribution. CycloneDX SBOM download button. Build-time generation via cargo-about + license-checker. 4 API endpoints under `/api/system/`.
- **v0.9**: Finalized Midnight Teal as default accent color (`oklch(0.685 0.145 180)` ≈ #14B8A6), full OKLCH 10-step scale with theme-specific primary mappings (Light→600, Dark→400, HPHMI→500). Alarm-safe accent preset picker: Midnight Teal (default), Signal Green, Neon Mint, Hot Signal/Magenta — removed Blue, Orange, Purple presets (alarm conflicts). ISA-101 alarm colors confirmed non-customizable with auto-adjustment per theme for WCAG contrast. Logo slash fixed as Midnight Teal brand color independent of user accent preference. Equipment colors confirmed gray-for-normal per HPHMI.
- **v0.8**: Deep dive: "Professional calm" aesthetic direction. Added 4-layer design token architecture (presets, parameters, semantic tokens, component tokens) with OKLCH color generation. Typography: Inter + JetBrains Mono, 16-token type scale, rem-based sizing, tabular figures for live data. Spacing: 4px base grid, 17-step scale, 3 density modes (Compact 28px / Default 36px / Comfortable 44px). Color system: ISA-101 alarm colors (non-customizable), HPHMI equipment grays, OKLCH accent scales, placeholder teal accent. 3-state sidebar (Expanded 240px / Collapsed 48px / Hidden 0px) with hover-to-reveal and edge-hover patterns. 2-state top bar with explicit show/hide toggles. Command palette (Ctrl+K) with `cmdk` library, prefix-based scoping (`>` commands, `@` points, `/` graphics, `#` entities). G-key two-keystroke module navigation. Kiosk mode for Console/Process with read-only base layer, authenticated interactive layer, per-window independence. Visual lock overlay (hidden-until-interaction, 60s auto-dismiss, data always visible). Loading/empty/error state patterns. Animation tokens (fast 150ms / medium 250ms / slow 350ms) with prefers-reduced-motion support and live-data-never-animates rule. Z-index stacking order (8 layers, content 0 through emergency 800). Border radius parameter (sharp/subtle/rounded). Lucide + custom industrial icons. Global UI scale preference. Renamed themes to Light/Dark/HPHMI.
- **v0.7**: Updated module navigation from 9 to 11 modules. Added Shifts (doc 30) and Alerts (doc 31) to sidebar navigation with permission gates (`shifts:read` and `alerts_module:access`). Updated multi-window references from 9 to 11 modules.
- **v0.6**: Added BroadcastChannel leader-election fallback for Safari/iOS where SharedWorker is unavailable. Detection at startup with automatic fallback. Leader holds single WebSocket, rebroadcasts via BroadcastChannel. Heartbeat-based leader loss detection with re-election. No user-facing difference.
- **v0.5**: Rewrote Emergency Alert Overlay as shared shell-level component. Persistent banner between nav and content area (pushes content down, not a floating overlay). Full-width red banner (#DC2626), 48-60px, WCAG AAA contrast. Severity icon, message, timestamp, acknowledge button. Multiple emergencies show count badge with expandable list. Audio configurable. Modules inherit automatically — no module-specific implementation needed.
- **v0.4**: Added Alert Notification Indicator to Top Bar (bell icon with unacknowledged count badge, alert panel dropdown). Added `alert:emergency` BroadcastChannel message type. Added Emergency Alert Overlay section (full-screen overlay for EMERGENCY alerts across all windows, alarm audio, acknowledgment required). See 27_ALERT_SYSTEM.md.
- **v0.3**: Fixed "retoken" prose references to "refresh token" throughout. Fixed typo "token rebefore expiration" to "token refresh before expiration". Fixed "Reaccess token" to "Refresh access token" in API endpoint description.
- **v0.2**: Added Multi-Window Architecture section — detached window routes, SharedWorker WebSocket pooling, BroadcastChannel state sync, Window Management API progressive enhancement, Window Group saved configurations, and window lifecycle management
- **v0.1**: Added "My Exports" link to user profile dropdown. My Exports is a user-level utility page (not a module tab) for viewing export job status, downloading completed exports, and managing in-progress jobs. See 25_EXPORT_SYSTEM.md Section 7.
