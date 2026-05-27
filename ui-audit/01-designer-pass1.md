# Designer UI Audit — Pass 1: Visual Shell

Scope: categories 1–4 only (color palette/theme tokens, typography, toolbars, menus).
Files read: `index.tsx`, `DesignerHome.tsx`, `DesignerGraphicsList.tsx` (header only),
`DesignerToolbar.tsx`, `DesignerModeTabs.tsx`, `DesignerTabBar.tsx`,
`DesignerStatusBar.tsx`, `DesignerImport.tsx` (header/styles block),
`SymbolLibrary.tsx` (header/button layer), `frontend/src/index.css`.

---

## Category 1 — Color Palette and Theme Tokens

**Implementation:** `inline-styles` — all color references via CSS custom properties from the app-shell token registry (`index.css`). No Designer-specific token declarations; no module-local CSS files; no Tailwind class-based color usage in any shell file.

**Source-of-truth files:**
- `frontend/src/index.css` lines 19–219 — 138-token registry, dark (default) and light overrides
- `frontend/src/shared/theme/tokens.ts` — JS mirror consumed by `ThemeContext`

**Visual properties actually applied (concrete values from dark theme):**

| Token / value | Usage location |
|---|---|
| `var(--io-surface)` → `var(--io-surface-elevated)` → `#27272a` | Toolbar, ModeTabs, TabBar, StatusBar container backgrounds |
| `var(--io-surface-elevated)` → `#27272a` | Active tab bg, hover bg, dropdown bg, dialog bg |
| `var(--io-surface-secondary)` → `#18181b` | DesignerHome page bg; loading skeleton left/right panels |
| `var(--io-surface-primary)` → `#09090b` | Loading skeleton canvas area |
| `var(--io-border)` → `#3f3f46` | All horizontal/vertical dividers; input borders; separator bars |
| `var(--io-accent)` → `#2dd4bf` | Active tool button bg; active tab bottom border; Save/Publish text; active mode button bg |
| `var(--io-accent-foreground)` → `#09090b` | Active mode/scope/preset button text (routed via token) |
| `var(--io-text-primary)` → `#f9fafb` | Active tab label; dialog titles; dropdown item text |
| `var(--io-text-secondary)` → `#a1a1aa` | Inactive tab labels; toolbar button icons; segment text (StatusBar) |
| `var(--io-text-muted)` → `#71717a` | Dialog labels; disabled icons; shortcut text; zoom chevron |
| `var(--io-text-disabled)` → `#52525b` | Disabled Save/Publish text |
| `var(--io-danger)` → `#ef4444` | Delete button text when enabled |
| `var(--io-warning)` → `#f59e0b` | Modified dot in TabBar (with fallback `#f59e0b` hardcoded as well) |

**Hardcoded colors that bypass tokens (deviations):**

| Hardcoded value | Location | Token equivalent (dark) |
|---|---|---|
| `#09090b` (active IconBtn text) | DesignerToolbar:925 | `var(--io-accent-foreground)` — doesn't adapt in light theme |
| `#f97316` (dirty indicator dot) | DesignerToolbar:1590 | Same as `--io-alarm-high` dark value; not a token reference |
| `rgba(234,179,8,0.15)`, `rgba(234,179,8,0.4)`, `#eab308` (READ-ONLY badge) | DesignerToolbar:1601–1614 | No token equivalent; fully hardcoded |
| `#f87171` (tab close button hover fg) | DesignerTabBar:232 | No token equivalent |
| `#22c55e` / `#ef4444` (WS status dot) | DesignerStatusBar:208–209 | Same as `--io-alarm-normal` / `--io-alarm-urgent` dark values; not token references |
| `#f97316` (unresolved binding count text) | DesignerStatusBar:228 | Same as `--io-alarm-high` dark value; not a token reference |
| `#4ade80`, `rgba(74,222,128,*)`, `rgba(239,68,68,*)` (TEST MODE indicator) | DesignerStatusBar:319–340 | No tokens; hardcoded entirely |
| `rgba(0,0,0,0.6)` (NewGraphicDialog backdrop) | index.tsx:236 | `var(--io-modal-backdrop)` = `rgba(0,0,0,0.7)` dark / `rgba(0,0,0,0.5)` light |

**Undefined tokens referenced:**
- `var(--io-surface-hover)` — DesignerToolbar:1459 (zoom dropdown item hover bg). Not in `index.css` or `tokens.ts`; resolves to empty string; hover has no visual feedback.
- `var(--io-font-sans)` — DesignerToolbar:1457 (zoom dropdown item font-family). Not a registered token; resolves to empty string; falls back to browser default.

**Deviations from app shell:** The app shell uses the same token registry. The deviations are that Designer shell components contain 9 hardcoded color values that don't route through tokens and reference 2 undefined tokens.

**Notes:** `DesignerGraphicsList.tsx` defines its own `SCOPE_COLORS` and `MODE_COLORS` constant objects (lines 47–56) with hardcoded `rgba()` values for badge backgrounds/text. These are used for graphic-card type badges and are not in the token registry.

---

## Category 2 — Typography

**Implementation:** `inline-styles` — all font sizes, weights, and families set via bare px integers or numeric literals in inline style objects. No module-local CSS class declarations. No Tailwind typography utilities in the Designer shell files.

**Source-of-truth files:**
- `frontend/src/index.css` lines 178–218 — 16 size tokens (`--io-text-*`) + one font-stack token (`--io-font-mono`)
- `frontend/src/shared/theme/tokens.ts` — JS mirror

**Visual properties actually applied (concrete values):**

| Component | Context | Font-size | Weight | Color token |
|---|---|---|---|---|
| DesignerModeTabs | Mode tab label | 13px | 500 (active) / 400 | `var(--io-text-primary)` / `var(--io-text-secondary)` |
| DesignerModeTabs | Mode tab icon span | 11px or 13px (report emoji) | — | inherited |
| DesignerModeTabs | File dropdown trigger | 13px | — | `var(--io-text-secondary)` |
| DesignerModeTabs | File dropdown arrow | 10px | — | — |
| DesignerModeTabs | File dropdown items | 13px | — | `var(--io-text-primary)` / `var(--io-accent)` |
| DesignerModeTabs | File dropdown shortcuts | 11px | — | `var(--io-text-muted)` |
| DesignerTabBar | Tab label | 12px | 600 (active) / 400 | `var(--io-text-primary)` / `var(--io-text-secondary)` |
| DesignerTabBar | Modified dot | 14px | — | `var(--io-warning, #f59e0b)` |
| DesignerTabBar | Close button (×) | 14px | — | `var(--io-text-muted)` |
| DesignerToolbar | Zoom input | 12px | — | `var(--io-text-secondary)` |
| DesignerToolbar | Zoom input font-family | `var(--io-font-mono)` | — | — |
| DesignerToolbar | Zoom dropdown arrow | 9px | — | — |
| DesignerToolbar | Zoom dropdown items | 12px | — | `var(--io-text-primary)` |
| DesignerToolbar | Zoom dropdown font-family | `var(--io-font-sans)` (undefined) | — | — |
| DesignerToolbar | Test/Phone button labels | 11px | — | inherited |
| DesignerToolbar | New/Delete/Save/Publish buttons | 12px | — | varies |
| DesignerToolbar | READ-ONLY badge | 11px | 600 | `#eab308` (hardcoded) |
| DesignerStatusBar | All segment text | 11px | — | `var(--io-text-secondary)` |
| DesignerStatusBar | TEST MODE label | inherited | 600 | `#4ade80` (hardcoded) |
| index.tsx NewGraphicDialog | Title | 15px | 600 | `var(--io-text-primary)` |
| index.tsx NewGraphicDialog | Form labels | 11px | 600 | `var(--io-text-muted)` |
| index.tsx NewGraphicDialog | Inputs | 13px | — | `var(--io-text-primary)` |
| DesignerHome | "Designer" subtitle | 13px | — | `var(--io-text-muted)` |
| DesignerHome | Primary button | 13px | 600 | `var(--io-accent-foreground)` |
| DesignerHome | Secondary button | 13px | 500 | `var(--io-text-secondary)` |
| DesignerImport | Form labels | 12px | 600 | `var(--io-text-muted)` |

**Deviations from app shell:**

1. **No designer shell file uses the 16-token typographic scale.** The tokens `--io-text-xs` (12px), `--io-text-sm` (13px), `--io-text-label` (12px), `--io-text-label-sm` (11px) exactly match the px values used, but are never referenced via `var()`. All font sizes are bare pixel literals.

2. **`var(--io-font-sans)` is referenced (DesignerToolbar:1457) but is not a registered token.** Only `--io-font-mono` exists in `index.css`. Using `var(--io-font-sans)` in the zoom preset dropdown falls back to browser default sans-serif, not the intended stack.

3. **`var(--io-font-mono)` is used for the zoom input** (DesignerToolbar:1352) — correct usage, the only registered font-stack token.

4. **No typographic weight tokens exist** in the registry (consistent with app shell behavior; weights 500 and 600 are used directly everywhere).

**Notes:** DesignerImport.tsx defines a module-local `label` style object at lines 55–62 with 12px / 600 weight / `var(--io-text-muted)` / uppercase / 0.05em letter-spacing — a pattern duplicated verbatim in `index.tsx` `labelStyle` and elsewhere in the designer without a shared abstraction.

---

## Category 3 — Toolbars

**Implementation:** `module-local-component`. Four dedicated components stacked vertically at the Designer shell layer. All are inline-styled, no Tailwind or external CSS.

| Component | Height | Role |
|---|---|---|
| `DesignerModeTabs.tsx` | 36px | Mode switcher + File dropdown (above toolbar) |
| `DesignerToolbar.tsx` | 44px | Tool actions, undo/redo, zoom, view toggles, save/publish |
| `DesignerTabBar.tsx` | 36px | Multi-document tab strip (between toolbar and canvas) |
| `DesignerStatusBar.tsx` | 28px | Status indicators (WS, bindings, grid, zoom, mode) |

**Source-of-truth files:**
- `frontend/src/pages/designer/DesignerToolbar.tsx` lines 1159–1169 (container), 904–948 (IconBtn)
- `frontend/src/pages/designer/DesignerModeTabs.tsx` lines 207–217 (container), 219–268 (tabs)
- `frontend/src/pages/designer/DesignerTabBar.tsx` lines 363–376 (container), 144–178 (tab item)
- `frontend/src/pages/designer/DesignerStatusBar.tsx` lines 192–203 (container), 174–184 (segment style)

**Visual properties actually applied:**

**DesignerToolbar container:**
- `height: 44`, `flexShrink: 0`, `gap: 2`, `padding: "0 8px"`
- `background: "var(--io-surface)"`, `borderBottom: "1px solid var(--io-border)"`, `overflow: "hidden"`

**IconBtn (reusable button primitive within toolbar):**
- `width: 32`, `height: 32`, `borderRadius: "var(--io-radius)"`
- Active: `background: "var(--io-accent)"`, `color: "#09090b"` (hardcoded)
- Inactive: `background: "transparent"`, `color: "var(--io-text-secondary)"`
- Disabled: `color: "var(--io-text-muted)"`, `opacity: 0.4`
- Hover (not active): `background: "var(--io-surface-elevated)"`
- Transition: `background 0.1s, color 0.1s`

**Toolbar separator (Sep):** `width: 1`, `height: 20`, `background: "var(--io-border)"`, `margin: "0 4px"`

**Text action buttons (New/Delete/Save/Publish) in toolbar:**
- `borderRadius: 6` (hardcoded integer, not `var(--io-radius)`)
- `padding: "4px 10px"`, `fontSize: 12`
- No background (transparent), bordered via `border: "1px solid var(--io-border)"`

**DesignerModeTabs container:** `height: 36`, `background: "var(--io-surface)"`, `borderBottom: "1px solid var(--io-border)"`

**Mode tab button:**
- `minWidth: 120`, `padding: "0 16px"`, `fontSize: 13`
- Active: `background: "var(--io-surface-elevated)"`, `borderBottom: "2px solid var(--io-accent)"`, `color: "var(--io-text-primary)"`, weight 500
- Inactive: `background: "transparent"`, `borderBottom: "2px solid transparent"`, `color: "var(--io-text-secondary)"`, weight 400
- Hover: `background: "var(--io-surface-elevated)"`

**DesignerTabBar container:** `height: 36`, `background: "var(--io-surface)"`, `borderBottom: "1px solid var(--io-border)"`

**Tab item:**
- `padding: "0 10px 0 12px"`, `fontSize: 12`, `borderRight: "1px solid var(--io-border)"`
- Active: `background: "var(--io-surface-elevated)"`, `borderBottom: "2px solid var(--io-accent)"`, `color: "var(--io-text-primary)"`, weight 600
- Inactive: `background: "var(--io-surface)"`, `borderBottom: "2px solid transparent"`, `color: "var(--io-text-secondary)"`, weight 400
- Hover: `background: "var(--io-surface-elevated)"`

**DesignerStatusBar container:** `height: 28`, `background: "var(--io-surface)"`, `borderTop: "1px solid var(--io-border)"`

**Segment style:** `padding: "0 12px"`, `height: 28`, `gap: 5`, `fontSize: 11`, `color: "var(--io-text-secondary)"`, `whiteSpace: "nowrap"`

**Segment divider:** `width: 1`, `height: 16`, `background: "var(--io-border)"`

**Deviations from app shell:**

1. **Text action buttons in DesignerToolbar use `borderRadius: 6` (integer literal)** rather than `var(--io-radius)`. Both resolve to 6px under the current theme but the toolbar's own `IconBtn` correctly uses `var(--io-radius)`, creating inconsistency within the same component.

2. **All four toolbar heights are hardcoded** (44, 36, 36, 28 px) with no token. The app-shell defines only `--io-topbar-height: 48px` for the global nav bar. No registry entry governs inner chrome heights; this is consistent with the app shell convention but means heights are untracked literals.

3. **No Tailwind utility classes used** anywhere in the four toolbar components. The app shell (`AppShell.tsx`) mixes Tailwind with inline styles; Designer's toolbar layer is entirely inline-only.

**Notes:** The loading skeleton in `index.tsx` (lines 759–812) uses `height: 40` for its toolbar placeholder rather than the actual 44px, a small discrepancy visible during load.

---

## Category 4 — Menus

**Implementation:** `mix`. Three distinct patterns are used:
1. Custom inline dropdown — DesignerModeTabs File menu (`position: absolute`, custom event handling)
2. Custom inline dropdown — DesignerToolbar zoom preset menu (`position: fixed`, `getBoundingClientRect()` anchoring)
3. Shared component — DesignerTabBar tab context menu (uses `shared/components/ContextMenu.tsx`)

**Source-of-truth files:**
- `frontend/src/pages/designer/DesignerModeTabs.tsx` lines 317–389 — File menu dropdown
- `frontend/src/pages/designer/DesignerToolbar.tsx` lines 1373–1469 — Zoom preset dropdown
- `frontend/src/pages/designer/DesignerTabBar.tsx` lines 102–143 (items), 246–253 (render) — Tab context menu
- `frontend/src/shared/components/ContextMenu.tsx` — shared component (app-shell scope)

**Visual properties actually applied:**

**DesignerModeTabs File dropdown:**
- Trigger: `<button>`, `padding: "0 16px"`, `fontSize: 13`, `color: "var(--io-text-secondary)"`, `border: "none"`, `borderBottom: "2px solid transparent"`, hover: `background: "var(--io-surface-elevated)"`
- Container: `position: "absolute"`, `top: "100%"`, `right: 0`, `background: "var(--io-surface-elevated)"`, `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `boxShadow: "0 4px 16px rgba(0,0,0,0.35)"`, `zIndex: 300`, `minWidth: 200`, `overflow: "hidden"`
- Item: `padding: "6px 14px"`, `fontSize: 13`, normal: `color: "var(--io-text-primary)"`, accent: `color: "var(--io-accent)"`, hover bg: `var(--io-surface)`
- Shortcut: `fontSize: 11`, `color: "var(--io-text-muted)"`, `flexShrink: 0`
- Divider: `height: 1`, `background: "var(--io-border)"`, `margin: "2px 0"`
- Keyboard dismiss: `document.addEventListener("mousedown")` outside-click pattern

**DesignerToolbar Zoom preset dropdown:**
- Anchor: `position: "fixed"`, coords from `getBoundingClientRect()` stored in state
- Container: `background: "var(--io-surface-elevated)"`, `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `boxShadow: "0 4px 12px rgba(0,0,0,0.4)"`, `zIndex: 2000`, `padding: "4px 0"`, `minWidth: 160`
- Item: `display: "block"`, `width: "100%"`, `padding: "6px 12px"`, `fontSize: 12`, `color: "var(--io-text-primary)"`, hover bg: `var(--io-surface-hover)` (undefined token), `fontFamily: "var(--io-font-sans)"` (undefined token)
- Contents: 4 items — "1:1 Pixels", "Fit to Canvas", "Fit to Window", "Full Screen"
- Keyboard dismiss: `document.addEventListener("mousedown")` outside-click pattern

**DesignerTabBar tab right-click context menu:**
- Trigger: `onContextMenu` on tab div; uses `useContextMenu` hook from `shared/hooks/useContextMenu`
- Renders: `<ContextMenu>` from `shared/components/ContextMenu.tsx` — visual appearance governed by that shared component
- Items: Rename…, Close (with divider), Close Others, Close All, Copy Name (with divider) — 5 items

**Deviations from app shell:**

1. **Three different menu patterns in one module.** The File menu and zoom dropdown use custom inline implementations; the tab context menu uses the shared `ContextMenu` component. The app shell provides `ContextMenu` as a general-purpose component; the two custom dropdowns do not use it.

2. **Zoom dropdown uses `position: fixed` with manual coord tracking** (DesignerToolbar:1378–1380) while the File menu uses `position: absolute`. The `position: fixed` approach is needed here because the toolbar can be inside a CSS-transformed container — consistent with CLAUDE.md guidance about `position: fixed` inside transforms — but the pattern differs from the File menu approach and from `ContextMenu`.

3. **Zoom dropdown hover uses `var(--io-surface-hover)`** — an undefined token (confirmed absent from `index.css` and `tokens.ts`). Hover state produces no visual feedback on zoom preset items.

4. **Zoom dropdown font uses `var(--io-font-sans)`** — an undefined token. Zoom menu items fall back to browser default font rather than the design system font stack.

5. **Box-shadow values differ between menus and from registry tokens:**
   - File menu: `0 4px 16px rgba(0,0,0,0.35)`
   - Zoom dropdown: `0 4px 12px rgba(0,0,0,0.4)`
   - Registry `--io-shadow-lg`: `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)` — neither custom dropdown uses this token

6. **`zIndex` values are inconsistent and do not use z-index tokens:**
   - File menu: `zIndex: 300` (matches `--io-z-modal` value by coincidence)
   - Zoom dropdown: `zIndex: 2000` (above `--io-z-emergency: 800`, no token reference)
   - Tab context menu: delegated to `ContextMenu` shared component

7. **File menu item hover background uses `var(--io-surface)`** rather than `var(--io-surface-elevated)` or an accent-subtle token, creating a subtle contrast difference from toolbar button hover which uses `var(--io-surface-elevated)`.

**Notes:** The File dropdown menu in DesignerModeTabs has 12 items across 4 sections (New, Open, Save | Properties, Rename | Import, Export SVG, Export .iographic | Version History, Validate Bindings | Publish). The Publish item conditionally appears with `color: "var(--io-accent)"` as a visual accent. Menu is dismissed by outside-click only; no Escape key handler present in DesignerModeTabs (Escape handling may exist in the parent or keyboard shortcut registry).
