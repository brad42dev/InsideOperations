# Designer UI Audit — Consolidated

Merged from:
- `01-designer-pass1.md` → categories 1, 2, 3, 4
- `01-designer-pass1-supplement.md` → categories 6, 8, 9 (visual shell portion)
- `01-designer-pass2.md` → categories 5, 7, 9 (DesignerRightPanel portion)
- `01-designer-pass3.md` → categories 10, 11

Category 9 is merged from two source files (01-designer-pass1-supplement.md and
01-designer-pass2.md); both sets of findings are preserved and attributed.

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

---

## Category 5 — Side Panels

**Implementation:** `module-local-component`. All four files implement inline-styled
panels with no shared side-panel primitive. The right panel is split between a
tab-strip top half and a permanent canvas-layers bottom half.

**Source-of-truth files:**

| Panel | File | Key lines |
|---|---|---|
| Left palette container | `DesignerLeftPalette.tsx` | 2430–2438 |
| `SectionHeader` button | `DesignerLeftPalette.tsx` | 59–99 |
| `PaletteSection` resize handle | `DesignerLeftPalette.tsx` | 178–207 |
| Equipment category tile (expanded) | `DesignerLeftPalette.tsx` | 995–1047 |
| Display element tile (expanded) | `DesignerLeftPalette.tsx` | 807–858 |
| Stencil tile (expanded) | `DesignerLeftPalette.tsx` | 1601–1659 |
| Chart widget tile | `DesignerLeftPalette.tsx` | 1800–1852 |
| Right panel container | `DesignerRightPanel.tsx` | 5961–5992 |
| `TabBar` component | `DesignerRightPanel.tsx` | 5101–5153 |
| `CanvasLayersPanel` | `DesignerRightPanel.tsx` | 5459–5546 |
| `CanvasLayerRow` | `DesignerRightPanel.tsx` | 5241–5456 |
| `ShapePointSelector` container | `ShapePointSelector.tsx` | 378–393 |
| `PointPickerModal` dialog | `PointPickerModal.tsx` | 44–55 |

**Visual properties actually applied:**

**DesignerLeftPalette container:**
- `background: "var(--io-surface)"`, `borderRight: "1px solid var(--io-border)"`
- Full-height flex column; `overflow: hidden`

**`SectionHeader` (collapsible section button):**
- `padding: "6px 10px"`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "uppercase"`,
  `letterSpacing: "0.06em"`, `color: "var(--io-text-muted)"`, `borderBottom: "1px solid var(--io-border)"`
- Hover: `background: "var(--io-surface-elevated)"` — set by `onMouseEnter` DOM mutation
  (not CSS `:hover`); `onMouseLeave` resets to `"transparent"`
- Chevron: 12×12 SVG, animated `transform: rotate(90deg)` on open

**`PaletteSection` resize handle:**
- `height: 4`, `cursor: "ns-resize"`, `borderBottom: "1px solid var(--io-border)"`
- Inactive: transparent; hover and active-drag: `background: "var(--io-accent)"` (via event mutation)

**Palette tile matrix (expanded / collapsed):**

| Tile type | Expanded size | Collapsed size | Background |
|---|---|---|---|
| Equipment category | `calc(50% - 4px)` × auto, wraps | 36×36 | `var(--io-surface-sunken)` |
| Display element | 72×64 | 32×32 | `var(--io-surface-elevated)` |
| Custom shape | 64×64 | 32×32 | `var(--io-surface-elevated)` |
| Stencil | 64×48 | 28×28 | `var(--io-surface-elevated)` |
| Chart widget | 48×48 | 32×32 | `var(--io-surface-elevated)` |
| Report element | 48×48 | 32×32 | `var(--io-surface-elevated)` |

- All tile hover: `borderColor: "var(--io-accent)"` via `onMouseEnter` DOM mutation
- Equipment tile hover additionally changes bg: `color-mix(in srgb, var(--io-accent) 8%, var(--io-surface-sunken))`
- All tiles: `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `cursor: "grab"`, `userSelect: "none"`

**Drag ghost (shared across all palette drag sources):**
- `position: "fixed"`, `zIndex: 9999`, `background: "var(--io-accent)"`,
  `color: "#09090b"` (hardcoded), `borderRadius: "4px"` (hardcoded integer), `fontSize: 11`, `fontWeight: 600`
- Created as an imperative DOM element appended to `document.body`; Escape key cancels

**Point browser section:**
- Delegates to `PointsBrowserPanel` (app-shell shared component)
- Wrapping div: `maxHeight: 280`, `overflow: "hidden"`, `flexDirection: "column"`

**DesignerRightPanel container:**
- `background: "var(--io-surface)"`, `borderLeft: "1px solid var(--io-border)"`,
  `width` from prop, flex column, `overflow: hidden`, `height: "100%"`
- Collapsed state: 9px `writingMode: "vertical-lr"` label "INSPECTOR", `color: "var(--io-text-muted)"`

**`TabBar` component:**
- Container: `flexShrink: 0`, `borderBottom: "1px solid var(--io-border)"`, `background: "var(--io-surface)"`, `overflowX: auto`
- Tab button: `padding: "6px 8px"`, `fontSize: 10`, `textTransform: "uppercase"`, `letterSpacing: "0.06em"`, `whiteSpace: "nowrap"`
- Active: `fontWeight: 700`, `borderBottom: "2px solid var(--io-accent)"`, `color: "var(--io-text-primary)"`
- Inactive: `fontWeight: 500`, `borderBottom: "2px solid transparent"`, `color: "var(--io-text-muted)"`
- Doc tab: `flex: "0 0 auto"`, `marginLeft: "auto"` — always pushed rightmost

**Two-section right panel layout:**
- Tab content: `flex: 1`, `overflowY: auto`, `paddingTop: 8` — scrollable
- `CanvasLayersPanel`: always visible below; `borderTop: "1px solid var(--io-border)"`

**`CanvasLayersPanel` header:**
- `padding: "5px 10px 5px 12px"`, `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`,
  `letterSpacing: "0.08em"`, `color: "var(--io-text-muted)"`

**`CanvasLayerRow`:**
- `padding: "2px 4px 2px {4 + depth * 14}px"` (depth-indented)
- Selected: `background: "var(--io-accent-subtle, rgba(99,102,241,0.1))"`, `borderLeft: "2px solid var(--io-accent)"` (left accent stripe)
- Unselected: transparent background, `borderLeft: "2px solid transparent"`
- Node name: `fontSize: 11`; type badge: `fontSize: 8`, `fontWeight: 700`, `letterSpacing: "0.04em"`
- Binding tag: `fontSize: 9`, `maxWidth: 56`
- Icon buttons (16×16): visibility toggle (👁/○), lock toggle (🔒/○), reorder arrows (↑/↓)

**ShapePointSelector container:**
- CSS grid: `gridTemplateColumns: "40% 1fr"`, `gridTemplateRows: "auto auto 1fr auto"`, `columnGap: 12`, `rowGap: 6`

**PointPickerModal overlay and dialog:**
- Overlay: `position: "fixed"`, `zIndex: 1100`, `background: "rgba(0,0,0,0.55)"`
- Dialog: `width: "560px"`, `maxWidth: "90vw"`, `maxHeight: "70vh"`, `background: "var(--io-surface-elevated)"`, `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `overflow: hidden`
- Header: `padding: "12px 16px"`, `borderBottom: "1px solid var(--io-border)"`, `fontWeight: 600`, `fontSize: "14px"`
- Footer: `padding: "10px 16px"`, `borderTop: "1px solid var(--io-border)"`

**Deviations from app shell:**

1. **Equipment tiles use `var(--io-surface-sunken)`; all other palette tiles use
   `var(--io-surface-elevated)`.** Two different surface tiers for palette items of equivalent
   semantic weight (draggable source objects). `var(--io-surface-sunken)` was not enumerated
   in the pass 1 token survey; it may or may not be registered in `index.css`.

2. **Drag ghost hardcodes `borderRadius: "4px"` (integer not `var(--io-radius)`)** and
   `color: "#09090b"` — consistent with the toolbar's IconBtn hardcoded foreground from pass 1
   (category 1 deviation), but still bypasses the token.

3. **Stencil tile (expanded) renders a ⬜ emoji as a placeholder thumbnail** while equipment
   tiles render a real `ShapeThumbnail` SVG and display element tiles render a spec-accurate
   `DisplayElementPreview` SVG. Three different thumbnail strategies with no visual parity.

4. **CanvasLayerRow uses emoji icons (👁, 🔒) for visibility and lock toggles.**
   The rest of the Designer uses `<svg>` inline elements or Unicode symbols for icons.
   No shared icon convention is applied.

5. **`CanvasLayerRow` selected background is `var(--io-accent-subtle, rgba(99,102,241,0.1))`.** The fallback
   `rgba(99,102,241,0.1)` is indigo — the app's accent is teal (`#2dd4bf`). If
   `var(--io-accent-subtle)` is not registered, the selection highlight renders with the wrong
   hue. This is a silent correctness risk on any environment where the token is absent.

6. **All panel hover effects are applied via `onMouseEnter`/`onMouseLeave` DOM mutations**
   rather than CSS `:hover`. This is consistent across DesignerLeftPalette and mirrors the
   pattern established in the toolbar layer (pass 1 observation), but means the hover
   state is lost if the user's pointer leaves without triggering `onMouseLeave` (e.g., rapid
   focus change).

7. **`PointPickerModal` uses a `rgba(0,0,0,0.55)` backdrop.** The pass 1 audit found
   `index.tsx` uses `rgba(0,0,0,0.6)` and the registered token `--io-modal-backdrop` is
   `rgba(0,0,0,0.7)` (dark) / `rgba(0,0,0,0.5)` (light). Three different backdrop opacities
   are now in use across the designer with none matching the registered token.

8. **`RowSection` collapsible (used heavily in the RightPanel for display element config)
   uses `background: "var(--io-surface-raised)"` for its header.** This token was not
   found in the pass 1 token registry survey. If unregistered, the header background
   resolves to empty (no background).

9. **`PointPickerModal` point list rows use `<div onClick>` not `<button>`.** All list items
   in Browse/Search/Favorites/Recent tabs are non-semantic clickable divs. No keyboard
   navigation (Tab/Enter) is possible without mouse interaction.

**Notes:** The Points section in the left palette delegates entirely to the shared
`PointsBrowserPanel` component (app-shell scope). The visual pattern of that component
is outside this audit's scope. The palette resize handle is the only interactive surface
in the palette that does not have a visible hover indicator in the default Tailwind sense —
the 4px bar is invisible (transparent) until hovered or during drag.

---

## Category 6 — Buttons (Primary, Secondary, Icon Variants)

**Implementation:** `mix`. No shared `<Button>` component exists; all button
patterns are inline-styled individually. Five distinct patterns are in use
across the shell: primary (filled accent), secondary (bordered transparent),
destructive (danger fill or ghost), icon (IconBtn primitive), and toggle/chip.

**Source-of-truth files:**

| Pattern | File | Lines |
|---|---|---|
| IconBtn primitive | `DesignerToolbar.tsx` | 904–948 |
| Toolbar text actions (Delete/Save/Publish) | `DesignerToolbar.tsx` | 1618–1693 |
| Read-only badge | `DesignerToolbar.tsx` | 1598–1615 |
| Tab close button | `DesignerTabBar.tsx` | 208–238 |
| Scroll arrow buttons | `DesignerTabBar.tsx` | 273–300 |
| StatusBar TEST MODE pause/resume | `DesignerStatusBar.tsx` | 327–352 |
| Home screen primary / secondary | `DesignerHome.tsx` | 55–84 |
| GraphicsList header "New Graphic" | `DesignerGraphicsList.tsx` | 927–955 |
| GraphicsList hover overlay Edit / Delete | `DesignerGraphicsList.tsx` | 342–379 |
| GraphicsList empty-state "Create Graphic" | `DesignerGraphicsList.tsx` | 715–730 |
| GraphicsList DeleteDialog Cancel / Delete | `DesignerGraphicsList.tsx` | 608–641 |
| Import primaryBtn / secondaryBtn / disabledBtn | `DesignerImport.tsx` | 64–90 |
| SymbolLibrary "Upload SVG" | `SymbolLibrary.tsx` | 356–376 |
| SymbolLibrary "Delete" (custom shape row) | `SymbolLibrary.tsx` | 233–260 |
| NewGraphicDialog mode/scope/preset toggles | `index.tsx` | 290–390 |
| NewGraphicDialog proportional lock | `index.tsx` | 435–450 |

**Visual properties actually applied (concrete values):**

**Primary button (filled accent):**

| Location | background | color | border | radius | padding | fontSize | weight |
|---|---|---|---|---|---|---|---|
| DesignerHome "New" | `var(--io-accent)` | `var(--io-accent-foreground)` | none | `var(--io-radius)` | 9px 22px | 13 | 600 |
| GraphicsList "New Graphic" | `var(--io-accent)` | `#fff` (hardcoded) | none | `var(--io-radius)` | 7px 16px | 13 | 600 |
| GraphicsList hover "Edit" | `var(--io-accent)` | `#fff` (hardcoded) | none | `var(--io-radius)` | 7px 18px | 13 | 600 |
| GraphicsList empty "Create Graphic" | `var(--io-accent)` | `#fff` (hardcoded) | none | `var(--io-radius)` | 9px 20px | 13 | 600 |
| DesignerImport `primaryBtn` | `var(--io-accent, #3b82f6)` | `#fff` (hardcoded) | none | `var(--io-radius, 6px)` | 8px 18px | 13 | 600 |
| SymbolLibrary "Upload SVG" | `var(--io-accent)` | `#09090b` (hardcoded) | none | `var(--io-radius)` | 7px 14px | 12 | 600 |

**Secondary button (bordered, transparent bg):**

| Location | background | color | border | radius | padding | fontSize | weight |
|---|---|---|---|---|---|---|---|
| DesignerHome "Open Existing" | transparent | `var(--io-text-secondary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 9px 22px | 13 | 500 |
| DesignerImport `secondaryBtn` | transparent | `var(--io-text-muted)` | `1px solid var(--io-border)` | `var(--io-radius, 6px)` | 8px 18px | 13 | 500 |
| Toolbar Delete | transparent | `var(--io-danger)` (enabled) / `var(--io-text-disabled)` | `1px solid var(--io-border)` | `6` (integer) | 4px 10px | 12 | — |
| Toolbar Save | transparent | `var(--io-accent)` (dirty) / `var(--io-text-disabled)` | `1px solid var(--io-border)` | `6` (integer) | 4px 10px | 12 | — |
| Toolbar Publish | transparent | `var(--io-accent)` (enabled) / `var(--io-text-disabled)` | `1px solid var(--io-border)` | `6` (integer) | 4px 10px | 12 | — |
| DeleteDialog "Cancel" | `var(--io-surface-elevated)` | `var(--io-text-primary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 8px 18px | 13 | 500 |
| SymbolLibrary shape "Delete" | transparent | `var(--io-text-muted)` | `1px solid var(--io-border)` | `var(--io-radius)` | 4px 10px | 11 | — |

**Destructive button:**

| Location | Style | background | color |
|---|---|---|---|
| GraphicsList hover overlay "Delete" | ghost | `rgba(239,68,68,0.15)`, border `rgba(239,68,68,0.5)` | `#f87171` |
| GraphicsList DeleteDialog "Delete" confirm | solid | `#ef4444` | `#fff` |

**Icon button (IconBtn):**
- Size: 32×32, `borderRadius: "var(--io-radius)"`, no border
- Active: `background: "var(--io-accent)"`, `color: "#09090b"` (hardcoded)
- Inactive: `background: "transparent"`, `color: "var(--io-text-secondary)"`
- Hover (inactive): `background: "var(--io-surface-elevated)"`
- Disabled: `color: "var(--io-text-muted)"`, `opacity: 0.4`
- Transition: `background 0.1s, color 0.1s`

**Toggle/chip buttons (NewGraphicDialog mode/scope/preset selectors):**
- Mode/scope: active `background: "var(--io-accent)"`, `color: "var(--io-accent-foreground)"`; inactive `background: "var(--io-surface)"`, `color: "var(--io-text-secondary)"`; `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `fontSize: 12`
- Preset chips: same active/inactive logic; `borderRadius: "calc(var(--io-radius) * 2)"` (pill shape), `fontSize: 11`

**Tab close button (DesignerTabBar:208–238):**
- 16×16, `borderRadius: 3` (hardcoded integer), `color: "var(--io-text-muted)"`, `fontSize: 14`
- Hover: `background: "rgba(239,68,68,0.15)"`, `color: "#f87171"` (hardcoded, no token)

**StatusBar TEST MODE pause/resume (DesignerStatusBar:327–352):**
- `borderRadius: 3` (hardcoded), height 20, `fontSize: 13`, `padding: "0 5px"`
- Paused: `background: "rgba(74,222,128,0.12)"`, `border: "1px solid rgba(74,222,128,0.4)"`, `color: "#4ade80"` — all hardcoded
- Live: `background: "rgba(239,68,68,0.12)"`, `border: "1px solid rgba(239,68,68,0.4)"`, `color: "#ef4444"` — all hardcoded

**Deviations from app shell:**

1. **Primary button text color inconsistency.** DesignerHome "New" correctly uses `var(--io-accent-foreground)`. Every other primary button in the shell uses `#fff` or `#09090b` hardcoded. In the light theme `--io-accent-foreground` resolves to `#fff` (light theme value differs from dark), so these hardcoded values will not adapt. SymbolLibrary "Upload SVG" uses `#09090b` which is the dark-mode accent foreground value — correct for dark but wrong for light.

2. **DesignerImport `primaryBtn` has a wrong fallback.** `background: "var(--io-accent, #3b82f6)"` — the fallback `#3b82f6` (blue) does not match the accent token (`#2dd4bf` in dark theme). The fallback is unreachable in practice but is incorrect.

3. **Toolbar text action buttons use `borderRadius: 6` (integer literal)** rather than `var(--io-radius)`. IconBtn in the same toolbar uses `var(--io-radius)`. Both resolve to 6px currently but the inconsistency is present.

4. **Tab close button and StatusBar button use `borderRadius: 3` (hardcoded integer)** — no token reference.

5. **No shared button primitive for primary/secondary/destructive patterns.** Six files each define their own inline-style primary button with minor variations (different padding, slightly different color token usage). No `<Button>` component exists.

6. **Two incompatible destructive button styles.** Ghost destructive (rgba red background + red border + `#f87171` text) used for hover-overlay delete; solid destructive (`#ef4444` fill + `#fff` text) used for modal confirm. No system governs which to use where.

7. **StatusBar clickable segments are `<div>` elements, not `<button>` elements.** Grid, zoom, and binding-summary clickable segments use `<div onClick>` with `cursor: "pointer"`. This bypasses keyboard navigation and accessibility semantics.

8. **Secondary button color token varies.** DesignerHome secondary uses `--io-text-secondary`; DesignerImport secondary uses `--io-text-muted`; toolbar Save/Delete use `--io-accent` / `--io-danger` for active state. No consistent secondary button color convention.

**Notes:** The DesignerModeTabs mode tab buttons function as primary navigation buttons (role=button, onClick sets mode). They are styled as tabs (active bottom border, font-weight change) rather than as buttons. They are not captured in the above patterns but share the active/inactive token convention of toggle buttons.

---

## Category 7 — Form Inputs

**Implementation:** `mix`. DesignerRightPanel defines a reusable `inputStyle` constant
and wraps it in `NumberInput`, `SelectInput`, `ColorInput`, and `ThemedColorSelect`
helper components — the densest form input system in the Designer. ShapePointSelector
uses its own `inputStyle` with different token references. PointPickerModal defines
style constants at module level and uses bare unstyled tag inputs throughout.

**Source-of-truth files:**

| Element | File | Lines |
|---|---|---|
| `inputStyle` constant | `DesignerRightPanel.tsx` | 219–229 |
| `FieldLabel` component | `DesignerRightPanel.tsx` | 201–217 |
| `Field` wrapper | `DesignerRightPanel.tsx` | 231–243 |
| `NumberInput` | `DesignerRightPanel.tsx` | 246–277 |
| `SelectInput` | `DesignerRightPanel.tsx` | 433–458 |
| `ColorInput` | `DesignerRightPanel.tsx` | 301–374 |
| `ThemedColorSelect` | `DesignerRightPanel.tsx` | 389–431 |
| `RowSection` collapsible | `DesignerRightPanel.tsx` | 3385–3447 |
| Checkbox inline pattern | `DesignerRightPanel.tsx` | 790–845 (TransformSection) |
| `inputStyle` (ShapePointSelector) | `ShapePointSelector.tsx` | 363–375 |
| Search input (PointPickerModal) | `PointPickerModal.tsx` | 68–78 |
| Tab chip buttons | `PointPickerModal.tsx` | 80–89 |
| Footer buttons | `PointPickerModal.tsx` | 112–128 |

**Visual properties actually applied:**

**DesignerRightPanel `inputStyle` (applies to all text/number/select inputs):**

| Property | Value |
|---|---|
| `padding` | `"4px 7px"` |
| `background` | `"var(--io-surface)"` |
| `border` | `"1px solid var(--io-border)"` |
| `borderRadius` | `"var(--io-radius)"` |
| `color` | `"var(--io-text-primary)"` |
| `fontSize` | `12` (bare integer) |
| `outline` | `"none"` |
| `width` | `"100%"` |
| `boxSizing` | `"border-box"` |

**`FieldLabel` component:**
- `fontSize: 10`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.05em"`,
  `color: "var(--io-text-muted)"`, `marginBottom: 3`
- Renders as `<label>` — semantically correct

**`Field` wrapper:**
- `marginBottom: 10` — uniform spacing below every field group

**`ColorInput` composite:**
- Outer div: 28×28 swatch (`background: value`, `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`)
- `<input type="color">` positioned absolutely inside swatch (`opacity: 0`) — invisible native picker trigger
- Adjacent hex text input: `{...inputStyle, flex: 1}` — hex direct edit
- If value is not a valid hex, shows "Theme default" in 10px monospace instead of hex input
- Reserved color warning: `fontSize: 9`, `color: "#f97316"` (hardcoded — the same alarm-high value from pass 1 findings)

**`ThemedColorSelect`:**
- 20×20 swatch + `<select>` with 3 options (White/Gray/Muted, ISA-101 compliant)
- Options map to `var(--io-text-primary)`, `var(--io-text-secondary)`, `var(--io-text-muted)` only
- Default option: "Default" → reverts to caller-provided `defaultValue`

**Checkbox pattern (inline form controls):**
- `<label>` wrapper, flex row, `gap: 4`, `fontSize: 11`, `cursor: "pointer"`, `color: "var(--io-text-secondary)"` or `var(--io-text-muted)`
- Bare `<input type="checkbox">`, no custom styling

**`RowSection` collapsible (display element config sub-sections):**
- Container: `border: "1px solid var(--io-border)"`, `borderRadius: 4` (integer, not `var(--io-radius)`), `overflow: hidden`
- Header div: `padding: "5px 8px"`, `background: "var(--io-surface-raised)"` (potentially unregistered), cursor pointer (div onClick, not a `<button>`)
- Title text: `fontSize: 11`, `fontWeight: 600`, `color: "var(--io-text-secondary)"` — NOT uppercase (contrast with `FieldLabel`)
- Open/close glyph: ▲/▼ Unicode, `fontSize: 8`, `color: "var(--io-text-muted)"`
- Body: `padding: "8px 8px 4px"`, `borderTop: "1px solid var(--io-border)"`

**Layout toggle buttons (TextReadoutArray):**
- Vertical/Horizontal selector: flex pair of `<button>` elements, `flex: 1`, `padding: "3px 0"`, `fontSize: 11`
- Active: `border: "1px solid var(--io-accent)"`, `borderRadius: "var(--io-radius)"`, `background: "color-mix(in srgb, var(--io-accent) 15%, transparent)"`, `color: "var(--io-accent)"`
- Inactive: `border: "1px solid var(--io-border)"`, transparent bg, `color: "var(--io-text-muted)"`

**ShapePointSelector `inputStyle`:**

| Property | Value |
|---|---|
| `height` | `26` |
| `background` | `"var(--io-input-bg)"` |
| `border` | `"1px solid var(--io-input-border)"` |
| `color` | `"var(--io-text-primary)"` |
| `fontSize` | `"1em"` (relative) |
| `padding` | `"0 8px"` |
| `borderRadius` | `4` (integer, not token) |

**ShapePointSelector drop zone / slot assignment chip:**
- Empty zone: `border: "1px dashed {color-mix(in srgb, var(--io-accent) 35%, var(--io-border))}"`, `padding: "14px 12px"`, `bg: "color-mix(in srgb, var(--io-accent) 4%, var(--io-surface))"`
- Drag-over zone: `border: "1px dashed var(--io-accent)"`, `bg: "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface))"`
- Filled chip: `background: "var(--io-surface-secondary)"`, `border: "1px solid var(--io-border)"`, `borderRadius: 3`, tag text: `fontFamily: "JetBrains Mono, monospace"`, `fontSize: "0.95em"`
- Point list item hover bg: `"var(--io-surface-hover)"` (confirmed undefined, pass 1)

**PointPickerModal input styles:**
- Search input: `padding: "8px 12px 8px 32px"` (left offset for icon), `background: "var(--io-surface-sunken)"`, `fontSize: "13px"` (string), `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`
- Tab chip buttons (active): `background: "var(--io-accent-subtle)"`, `border: "1px solid var(--io-accent)"`, `color: "var(--io-accent)"`, `fontSize: "12px"` (string), `fontWeight: 600`
- Tab chip buttons (inactive): `border: "1px solid var(--io-border)"`, `color: "var(--io-text-secondary)"`; `fontWeight: 400`
- Row dividers: `borderBottom: "1px solid var(--io-border-subtle)"` (potentially unregistered)
- Cancel button: `padding: "6px 14px"`, `border: "1px solid var(--io-border)"`, transparent bg, `color: "var(--io-text-secondary)"`, `fontSize: "12px"`, `borderRadius: "var(--io-radius)"`
- Select (primary) button: `background: "var(--io-accent)"`, `color: "#09090b"` (hardcoded), `fontWeight: 600`, no border

**Deviations from app shell:**

1. **Three different input background tokens across three files.** DesignerRightPanel:
   `var(--io-surface)`. ShapePointSelector: `var(--io-input-bg)`. PointPickerModal:
   `var(--io-surface-sunken)`. No consistent input-field background convention exists.

2. **`var(--io-input-bg)` and `var(--io-input-border)` in ShapePointSelector are not
   in the pass 1 token registry (138 tokens in `index.css`).** If unregistered, inputs
   in ShapePointSelector have no background and no border.

3. **`var(--io-surface-raised)` in RowSection header background is not in the pass 1
   token registry.** If unregistered, RowSection section headers have no background
   (renders same as transparent).

4. **`var(--io-accent-subtle)` used as active tab background in PointPickerModal and as
   selected-row background in CanvasLayerRow.** Its fallback in CanvasLayerRow is
   `rgba(99,102,241,0.1)` — indigo, which is the wrong hue if the token resolves to teal.
   The token was not enumerated in pass 1; requires verification against `index.css`.

5. **`var(--io-border-subtle)` in PointPickerModal row dividers is not enumerated in
   pass 1.** If unregistered, list rows have no bottom separator.

6. **`var(--io-surface-hover)` in ShapePointSelector point list item hover** is confirmed
   undefined (pass 1, category 1 and 4). Hover produces no visual feedback on list items.

7. **ShapePointSelector uses `fontSize: "1em"` (relative)** while all other form inputs
   in the designer use bare pixel integers (12). This is the only relative font-size
   unit in the pass 2 files' input surfaces.

8. **ShapePointSelector uses `borderRadius: 4` (integer)** rather than `var(--io-radius)`.
   DesignerRightPanel's `inputStyle` correctly uses `var(--io-radius)`. Within the
   designer, the two most-used form input surfaces differ in border radius tokens.

9. **`RowSection` header is a `<div onClick>`, not a `<button>`.** The collapsible section
   header captures clicks but has no focus ring, no keyboard Enter handler, and no ARIA
   role. This affects all display element configuration sub-sections in the right panel.

10. **PointPickerModal primary button hardcodes `color: "#09090b"`.** Consistent with
    the pattern identified in pass 1 (category 6), but the hardcoded foreground color
    fails to adapt in the light theme.

11. **`FieldLabel` uses `letterSpacing: "0.05em"` while `RowSection` titles use none.**
    Both are sub-group labels for form sections but diverge in uppercase treatment
    (FieldLabel: uppercase; RowSection: regular case) and color tier (muted vs secondary).

12. **`ColorInput` reserved-color warning renders in `color: "#f97316"`** — the same
    hardcoded alarm-high orange identified in pass 1 (category 1 deviation), bypassing
    `var(--io-alarm-high)`.

13. **TextBlock background default values hardcoded as `fill: "#27272A"`, `stroke: "#3F3F46"`**
    when enabling "Background Box". These are dark-theme hex values with no token
    reference; light theme would apply dark surface colors to a text box background.

**Notes:** `NumberInput` uses `type="number"` with a native browser spinner — no custom
increment/decrement UI. The range limits (`min`, `max`) are set per-field; there is no
shared validation layer. The `SelectInput` component and bare `<select>` elements are
styled identically; both correctly apply `cursor: "pointer"` which bare selects usually
lack. `ThemedColorSelect` is the most defensible form input pattern in the file: it
restricts options to safe ISA-101 compliant tokens and uses a live swatch preview.

---

## Category 8 — Status Indicators

**Implementation:** `inline-styles`, all module-local. No shared status indicator
component. Indicators are scattered across DesignerToolbar (dirty dot, read-only
badge), DesignerTabBar (modified dot), and DesignerStatusBar (WS dot, binding
summary, mode label, auto-save label, TEST MODE).

**Source-of-truth files:**

| Indicator | File | Lines |
|---|---|---|
| WS connection dot | `DesignerStatusBar.tsx` | 204–216 |
| Point binding summary | `DesignerStatusBar.tsx` | 220–234 |
| Grid size segment | `DesignerStatusBar.tsx` | 238–245 |
| Zoom level segment | `DesignerStatusBar.tsx` | 249–309 |
| Mode indicator (Edit / Read-Only) | `DesignerStatusBar.tsx` | 313–358 |
| TEST MODE indicator + pause/resume | `DesignerStatusBar.tsx` | 314–353 |
| Auto-save indicator | `DesignerStatusBar.tsx` | 363–371 |
| Dirty / unsaved-changes dot | `DesignerToolbar.tsx` | 1584–1597 |
| READ-ONLY badge | `DesignerToolbar.tsx` | 1598–1615 |
| Modified dot in tab | `DesignerTabBar.tsx` | 181–193 |

**Visual properties actually applied (concrete values):**

**WS connection dot (DesignerStatusBar:204–216):**
- Glyph: `●` (U+25CF), `fontSize: 8`, `lineHeight: 1`
- Connected: `color: "#22c55e"` (hardcoded)
- Disconnected: `color: "#ef4444"` (hardcoded)
- Adjacent label: "Connected" / "Disconnected", 11px, `var(--io-text-secondary)`

**Point binding summary (DesignerStatusBar:220–234):**
- Normal state: "Points: N bound" — 11px, `var(--io-text-secondary)`, entire segment clickable
- Unresolved state: appends `({unresolved} unresolved)` in `color: "#f97316"` (hardcoded orange)

**Dirty indicator (DesignerToolbar:1584–1597):**
- 7×7px `<div>`, `borderRadius: "50%"`, `background: "#f97316"` (hardcoded orange)
- Title tooltip: "Unsaved changes"

**READ-ONLY badge (DesignerToolbar:1598–1615):**
- Text: "READ-ONLY", `fontSize: 11`, `fontWeight: 600`, `letterSpacing: "0.05em"`
- `padding: "3px 8px"`, `borderRadius: "var(--io-radius)"`
- `background: "rgba(234,179,8,0.15)"`, `border: "1px solid rgba(234,179,8,0.4)"`, `color: "#eab308"` — all hardcoded

**Modified dot in TabBar (DesignerTabBar:181–193):**
- Glyph: `&#9679;` (●), `fontSize: 14`, `lineHeight: 1`
- `color: "var(--io-warning, #f59e0b)"` — uses token with fallback (only status indicator that references a token)

**TEST MODE indicator (DesignerStatusBar:314–340):**
- Text: "TEST MODE", `fontWeight: 600`, `letterSpacing: "0.06em"`, `color: "#4ade80"` (hardcoded)
- Animated: CSS keyframes injected via inline `<style>` — `@keyframes io-test-mode-glow { 0%,100% { text-shadow: 0 0 6px #4ade80; opacity:1; } 50% { text-shadow: 0 0 14px #4ade80, 0 0 28px #4ade80; opacity:0.9; } }`
- Pause/resume button: colors fully hardcoded (#4ade80 / #ef4444), `borderRadius: 3`

**Auto-save indicator (DesignerStatusBar:363–371):**
- Text: "Auto-saved N ago" — 11px, `var(--io-text-secondary)`, right-aligned via flex spacer
- Conditional render: only appears when `lastAutoSave != null`

**Deviations from app shell:**

1. **WS dot colors bypass tokens.** `#22c55e` / `#ef4444` are the dark-mode values of `--io-alarm-normal` / `--io-alarm-urgent` respectively, but are not referenced via tokens. Light-theme adaptation fails.

2. **Dirty indicator uses `#f97316`.** Same hex as `--io-alarm-high` dark value, not a token reference.

3. **Unresolved bindings text uses `#f97316`.** Same pattern — hardcoded rather than `var(--io-alarm-high)`.

4. **READ-ONLY badge uses fully hardcoded yellow palette.** Token `--io-warning: #f59e0b` exists in the registry but is not used; the badge uses `#eab308` (a slightly different yellow) with `rgba()` background/border variants.

5. **TEST MODE indicator fully hardcoded.** `#4ade80` (green) and `rgba(74,222,128,*)` are used throughout; no token maps to this color. The animated glow keyframe is injected as a raw `<style>` tag inside the JSX, creating a new `<style>` element on every render cycle when testMode is active.

6. **TabBar modified dot is the only status indicator that uses a token.** `var(--io-warning, #f59e0b)` is correct usage. All other status indicators bypass the token system.

7. **No semantic severity taxonomy.** Three separate "warning" states (dirty indicator, READ-ONLY badge, unresolved bindings) all use different oranges/yellows (`#f97316`, `#eab308`, `rgba(234,179,8,*)`) with no shared token or visual convention linking them.

**Notes:** The mode indicator in the non-test-mode case ("Edit" / "Read-Only") renders in plain `var(--io-text-secondary)` with no visual differentiation between edit and read-only states beyond the text label. The READ-ONLY badge in the toolbar is the only distinct visual signal for the read-only permission state.

---

## Category 9 — Labels and Headers

_Merged from two source files: `01-designer-pass1-supplement.md` (visual shell scope) and
`01-designer-pass2.md` (DesignerRightPanel scope). Both sets of findings are preserved below._

**Implementation:** `inline-styles`. No shared heading or label component exists across
the module. The `FieldLabel` component in `DesignerRightPanel.tsx` is the only reusable
label primitive in any Designer file. Semantic HTML heading elements (`h1`, `h2`, `h3`)
are used only in SymbolLibrary and DesignerGraphicsList; all other headers are styled
`<div>` or `<span>` elements with bare font-size and weight literals.

---

### 9A — Visual Shell (source: `01-designer-pass1-supplement.md`)

**Source-of-truth files:**

| Element | File | Lines |
|---|---|---|
| Page h1 "Symbol Library" | `SymbolLibrary.tsx` | 495–501 |
| Page subtitle (SymbolLibrary) | `SymbolLibrary.tsx` | 503–511 |
| Section h2 "ISA-101 Equipment Shapes" | `SymbolLibrary.tsx` | 519–524 |
| Section h2 "Custom Shapes" | `SymbolLibrary.tsx` | 335–344 |
| Category card label | `SymbolLibrary.tsx` | 97–103 |
| Category card description | `SymbolLibrary.tsx` | 119–126 |
| Page breadcrumb "Designer" link | `DesignerGraphicsList.tsx` | 899–912 |
| Breadcrumb separator "/" | `DesignerGraphicsList.tsx` | 913 |
| Page breadcrumb "Process Graphics" (current) | `DesignerGraphicsList.tsx` | 914–922 |
| GraphicCard name | `DesignerGraphicsList.tsx` | 439–449 |
| GraphicCard description | `DesignerGraphicsList.tsx` | 453–467 |
| GraphicCard timestamp | `DesignerGraphicsList.tsx` | 469–479 |
| DeleteDialog h3 "Delete Graphic" | `DesignerGraphicsList.tsx` | 583–590 |
| DeleteDialog body text | `DesignerGraphicsList.tsx` | 592–606 |
| DesignerHome "Designer" subtitle | `DesignerHome.tsx` | 44–54 |
| NewGraphicDialog title | `index.tsx` | 259–271 |
| NewGraphicDialog form labels (`labelStyle`) | `index.tsx` | 223–231 |
| DesignerImport form `label` style | `DesignerImport.tsx` | 55–62 |
| DesignerImport step indicator labels | `DesignerImport.tsx` | 149–163 |
| Mode tab labels ("Graphic" / "Dashboard" / "Report") | `DesignerModeTabs.tsx` | 219–267 |
| File dropdown trigger "File" | `DesignerModeTabs.tsx` | 313–314 |
| Tab bar labels (graphic name) | `DesignerTabBar.tsx` | 195–204 |
| StatusBar segment labels | `DesignerStatusBar.tsx` | 174–184 |
| TEST MODE label | `DesignerStatusBar.tsx` | 319–325 |

**Visual properties actually applied (concrete values):**

**Page-level headers:**

| Element | Tag | fontSize | weight | color |
|---|---|---|---|---|
| "Symbol Library" h1 | `<h1>` | "20px" | 700 | `var(--io-text-primary)` |
| "Custom Shapes" h2 | `<h2>` | "16px" | 700 | `var(--io-text-primary)` |
| "ISA-101 Equipment Shapes" h2 | `<h2>` | "15px" | 600 | `var(--io-text-primary)` |
| "Process Graphics" breadcrumb | `<span>` | 14 | 600 | `var(--io-text-primary)` |
| DeleteDialog "Delete Graphic" h3 | `<h3>` | 16 | 600 | `var(--io-text-primary)` |

**Form / dialog titles:**

| Element | fontSize | weight | color |
|---|---|---|---|
| NewGraphicDialog title | 15 | 600 | `var(--io-text-primary)` |

**Uppercase form field labels:**

| Location | fontSize | weight | color | transforms |
|---|---|---|---|---|
| `index.tsx labelStyle` | 11 | 600 | `var(--io-text-muted)` | uppercase, 0.05em letter-spacing, marginBottom 4 |
| `DesignerImport label` style | 12 | 600 | `var(--io-text-muted)` | uppercase, 0.05em letter-spacing, marginBottom 6 |

**Subtitle / descriptive text:**

| Element | fontSize | color | notes |
|---|---|---|---|
| DesignerHome "Designer" subtitle | 13 | `var(--io-text-muted)` | letterSpacing 0.03em |
| SymbolLibrary page subtitle | "13px" | `var(--io-text-secondary)` | — |
| SymbolLibrary "Custom Shapes" subtitle | "12px" | `var(--io-text-secondary)` | below h2 |

**Breadcrumb:**

| Element | fontSize | weight | color |
|---|---|---|---|
| "Designer" link | 13 | — | `var(--io-text-muted)` |
| "/" separator | 13 | — | `var(--io-border)` |
| "Process Graphics" (current) | 14 | 600 | `var(--io-text-primary)` |

**Card content labels:**

| Element | fontSize | weight | color |
|---|---|---|---|
| GraphicCard name | 14 | 600 | `var(--io-text-primary)` |
| GraphicCard description | 12 | — | `var(--io-text-muted)` |
| GraphicCard timestamp | 11 | — | `var(--io-text-muted)` |
| CategoryCard label | "14px" | 600 | `var(--io-text-primary)` |
| CategoryCard description | "12px" | — | `var(--io-text-secondary)` |

**Navigation / toolbar labels:**

| Element | fontSize | weight | color |
|---|---|---|---|
| Mode tab label (active) | 13 | 500 | `var(--io-text-primary)` |
| Mode tab label (inactive) | 13 | 400 | `var(--io-text-secondary)` |
| Mode tab icon (◆/▦) | 11 | — | inherited |
| Mode tab icon (📄) | 13 | — | inherited |
| File dropdown trigger "File" | 13 | — | `var(--io-text-secondary)` |
| Tab bar label (active) | 12 | 600 | `var(--io-text-primary)` |
| Tab bar label (inactive) | 12 | 400 | `var(--io-text-secondary)` |
| StatusBar segment text | 11 | — | `var(--io-text-secondary)` |
| TEST MODE label | inherited | 600 | `#4ade80` (hardcoded) |

**DesignerImport step indicator labels:**
- Active step: `fontSize: 12`, `fontWeight: 600`, `color: "var(--io-text-primary)"`
- Done step: `fontSize: 12`, `fontWeight: 400`, `color: "var(--io-text-secondary, #475569)"` (with light-theme fallback)
- Future step: `fontSize: 12`, `fontWeight: 400`, `color: "var(--io-text-muted)"`

**Deviations (visual shell):**

1. **Section header sizes are inconsistent within SymbolLibrary.** "Custom Shapes" h2 is 16px/weight 700 while "ISA-101 Equipment Shapes" h2 is 15px/weight 600 — same file, same semantic level, different values. There is no size/weight convention for section headings.

2. **Uppercase form label duplicated with divergent values.** `index.tsx labelStyle` (11px, marginBottom 4) and `DesignerImport label` (12px, marginBottom 6) serve the same purpose (uppercase section label above a form field) but are not shared and differ in font size and bottom margin. A third instance of the same pattern appears in `DesignerImport.tsx`'s rendered form body.

3. **Subtitle text color uses different token tiers for the same semantic role.** DesignerHome "Designer" subtitle (`--io-text-muted`, #71717a) vs SymbolLibrary page subtitle (`--io-text-secondary`, #a1a1aa) — both are 13px descriptive text directly beneath a page-level heading.

4. **No `--io-text-*` scale tokens used anywhere.** All font sizes are bare pixel integer literals (11, 12, 13, 14, 15, 16, 20) or string literals with units ("14px", "12px" in SymbolLibrary). The registered token scale (`--io-text-xs: 12px`, `--io-text-sm: 13px`, `--io-text-label: 12px`, `--io-text-label-sm: 11px`) is never referenced. Consistent with the finding in category 2.

5. **Heading element inconsistency.** SymbolLibrary uses semantic `<h1>`/`<h2>` tags. DesignerGraphicsList "Process Graphics" uses `<span>`. NewGraphicDialog title is a `<div>`. DeleteDialog uses `<h3>`. No module-level convention for when to use semantic vs presentational elements.

6. **Mixed font-size notation in SymbolLibrary.** CategoryCard uses `fontSize: "14px"` and `"12px"` (string with CSS unit), while all other Designer shell files use bare integer literals (`14`, `12`). React inline styles accept both; the inconsistency is within the same file subtree.

7. **DesignerImport step indicator includes a light-theme fallback directly in JSX** (`color: "var(--io-text-secondary, #475569)"`) — the only instance in the shell files where a token fallback specifies a light-theme value. `#475569` is a slate-gray that would be correct in light mode but is inconsistent with how other files handle fallbacks (which use dark-mode hex values as fallbacks).

**Notes (visual shell):** The DesignerHome "Designer" subtitle at DesignerHome.tsx:44–54 is a module identifier label, not a page heading — it appears on the splash screen when no graphic is open. No toolbar or mode-tab bar renders visible section titles or headers; all labeling at the toolbar level is handled via icon tooltips (`title` attributes) rather than visible text labels.

---

### 9B — DesignerRightPanel (source: `01-designer-pass2.md`)

**Source-of-truth files:**

| Element | File | Lines |
|---|---|---|
| `FieldLabel` component | `DesignerRightPanel.tsx` | 201–217 |
| `TabBar` tab labels | `DesignerRightPanel.tsx` | 5121–5148 |
| `CanvasLayersPanel` "Layers" header | `DesignerRightPanel.tsx` | 5490–5511 |
| `RowSection` section title | `DesignerRightPanel.tsx` | 3416–3427 |
| "Shape Info" card header | `DesignerRightPanel.tsx` | 1711–1722 |
| Type badge in `CanvasLayerRow` | `DesignerRightPanel.tsx` | 5312–5323 |
| Hint/helper text boxes | `DesignerRightPanel.tsx` | 1510–1521 (PipeStyleSection) |
| `PointResolutionIndicator` labels | `DesignerRightPanel.tsx` | 119–145 |
| Collapsed "INSPECTOR" label | `DesignerRightPanel.tsx` | 5706–5712 |
| `NavigationLinkEditor` toggle button | `DesignerRightPanel.tsx` | 479–497 |

**Visual properties actually applied (concrete values):**

**`FieldLabel` (used for all form field labels throughout the file):**

| Property | Value |
|---|---|
| Tag | `<label>` |
| `fontSize` | `10` |
| `fontWeight` | `600` |
| `textTransform` | `"uppercase"` |
| `letterSpacing` | `"0.05em"` |
| `color` | `"var(--io-text-muted)"` |
| `marginBottom` | `3` |

**`TabBar` tab button labels:**

| State | `fontSize` | `fontWeight` | `color` | `letterSpacing` |
|---|---|---|---|---|
| Active | `10` | `700` | `var(--io-text-primary)` | `"0.06em"` |
| Inactive | `10` | `500` | `var(--io-text-muted)` | `"0.06em"` |
| All | uppercase | — | — | `textTransform: "uppercase"` |

**`CanvasLayersPanel` "Layers" header:**
- `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`, `letterSpacing: "0.08em"`, `color: "var(--io-text-muted)"`

**`RowSection` collapsible section title:**
- `fontSize: 11`, `fontWeight: 600`, `color: "var(--io-text-secondary)"` — **no uppercase, no letterSpacing**

**"Shape Info" card header (SymbolInstanceShapeTab):**
- `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`, `letterSpacing: "0.06em"`, `color: "var(--io-text-muted)"`

**Type badge in CanvasLayerRow (SYM, DE, GEO, etc.):**
- `fontSize: 8`, `fontWeight: 700`, `color: "var(--io-text-muted)"`, `letterSpacing: "0.04em"`, `minWidth: 24`

**Hint/helper text boxes (e.g., PipeStyleSection, SymbolInstanceShapeTab):**
- Wrapper: `padding: "6px 8px"`, `background: "var(--io-surface-elevated)"`, `borderRadius: "var(--io-radius)"`
- Text: `fontSize: 10`, `color: "var(--io-text-muted)"` (some instances use `fontSize: 10`, others inherit)

**`PointResolutionIndicator` labels:**
- Checking (`…`): `fontSize: 10`, `color: "var(--io-text-muted)"`
- Found (✓): `fontSize: 10`, `color: "#22c55e"` (hardcoded — same as WS dot in pass 1)
- Not found (⚠ not found): `fontSize: 10`, `color: "#facc15"` (hardcoded yellow)

**Collapsed "INSPECTOR" label:**
- `fontSize: 9`, `color: "var(--io-text-muted)"`, `writingMode: "vertical-lr"`, `transform: "rotate(180deg)"`

**NavigationLinkEditor toggle button:**
- `fontSize: 11`, `color: hasLink ? "var(--io-accent)" : "var(--io-text-secondary)"` — changes color semantically based on state (good pattern)
- Disclosure glyph: `fontSize: 9`, inline Unicode ▲/▼

**Letter-spacing survey across all uppercase label contexts in RightPanel:**

| Context | `letterSpacing` |
|---|---|
| `FieldLabel` | `0.05em` |
| `TabBar` tabs | `0.06em` |
| `CanvasLayersPanel` header | `0.08em` |
| "Shape Info" card | `0.06em` |
| Type badge | `0.04em` |
| `RowSection` title | none (not uppercase) |

**Deviations (DesignerRightPanel):**

1. **`RowSection` section title is 11px, regular case, `var(--io-text-secondary)`.** `FieldLabel`
   is 10px, uppercase, `var(--io-text-muted)`. Both delimit sub-groups of form controls within
   the same panel, but use different size, transform, and color tier. No shared primitive
   unifies these two label levels.

2. **Four different `letterSpacing` values (0em, 0.04em, 0.05em, 0.06em, 0.08em) appear across
   uppercase label contexts in the same file.** The app shell defines no token for
   letter-spacing; this is consistent with the absence found in pass 1, but the variation
   is wider here (five distinct values vs. the two or three seen in the toolbar shell files).

3. **`PointResolutionIndicator` hardcodes `#22c55e` (found) and `#facc15` (not found)** rather
   than using `var(--io-alarm-normal)` and `var(--io-alarm-low)` or equivalent tokens. The `#22c55e`
   hardcoding is consistent with the WS dot finding in pass 1 (category 8).

4. **No semantic heading elements in DesignerRightPanel.** All structural labels are `<div>`,
   `<span>`, or `<label>`. Section-level headers that could use `<h3>` (e.g., "Shape Info"
   card, CanvasLayersPanel header) do not. Consistent with the inconsistency found in pass 1
   but at a greater scale (the entire inspector panel).

5. **`RowSection` header is a `<div onClick>` without ARIA role.** It acts as a disclosure
   button but is not accessible to keyboard users and does not receive focus. (Repeated from
   category 7 where it is reported as a form input deviation; listed here as it is also a
   label/header deviation.)

6. **Disclosure glyphs are Unicode characters (▲/▼, ▶/▼) not SVG icons.** `RowSection`
   uses ▲/▼ at `fontSize: 8`. `CanvasLayerRow` expand toggle uses ▶/▼ at `fontSize: 8`.
   Consistent within the file, but different from the `IconChevron` SVG used in the left
   palette's `SectionHeader`, and different from the toolbar's text glyphs.

7. **Tab labels use `fontWeight: 700` for active state** while the left palette's section
   headers use `fontWeight: 600` at the same label scale (11px vs. 10px). Neither matches
   the tab weight conventions from the `DesignerTabBar` (which uses 600/400 active/inactive).
   Three different weight conventions for "active vs. inactive" tab/section labeling across
   the designer panels.

**Notes (DesignerRightPanel):** The right panel contains more label diversity in a single file than all the
toolbar shell files combined. The `FieldLabel` component is the one stable convention —
it is used consistently for every form field label in the inspector and could serve as a
foundation for a shared label system if the letterSpacing and size conventions were
consolidated.

---

## Category 10 — Canvas / Main Work Area

**Implementation:** `module-specific-component`. The entire canvas is a single
12,067-line component (`DesignerCanvas.tsx`). All canvas rendering is inline SVG
via React; no external canvas library in the hot path. Scene graph is managed by
`sceneStore`; ephemeral interaction state by `uiStore` (Mode B FSM via `interactionRef`).

**Source-of-truth files:**

| Area | File | Key lines |
|---|---|---|
| Outer container + cursor map | `DesignerCanvas.tsx` | 7452–7481 |
| Canvas background rect | `DesignerCanvas.tsx` | 7499–7506 |
| Grid overlay (adaptive major/minor) | `DesignerCanvas.tsx` | 7508–7566 |
| Dashboard 12-col grid overlay | `DesignerCanvas.tsx` | 7569–7618 |
| Canvas border | `DesignerCanvas.tsx` | 7620–7630 |
| Canvas boundary dashed edge | `DesignerCanvas.tsx` | 7634–7692 |
| interactionRef FSM | `DesignerCanvas.tsx` | 3373–3441 |
| handleMouseDown / pointer entry | `DesignerCanvas.tsx` | 3443–3501 |
| Cursor map | `DesignerCanvas.tsx` | 7248–7259 |
| SelectionOverlay component | `DesignerCanvas.tsx` | 1511–2043 |
| _rotateCursorUrl | `DesignerCanvas.tsx` | 1441–1474 |
| _resizeCursorUrl | `DesignerCanvas.tsx` | 1476–1509 |
| DesignerContextMenuContent | `DesignerCanvas.tsx` | 10091–12067 |
| RulersOverlay component | `DesignerCanvas.tsx` | 9669–9970 |
| NameGroupPrompt dialog (inline) | `DesignerCanvas.tsx` | 300–421 |
| Test mode SceneRenderer ctx menu | `DesignerCanvas.tsx` | 8000–8093 |

**Visual properties actually applied:**

**Outer container div:**
- `background: "var(--io-surface-sunken)"` — the area outside the canvas bounds
- `flex: 1, overflow: "hidden", position: "relative", outline: "none"`
- Cursor from `cursorMap[activeTool]` (see table below); `placeMode?.phase === "floating"` overrides to `"crosshair"`

**Cursor map:**

| Tool | CSS cursor |
|---|---|
| `select` | `default` |
| `pan` | `grab` |
| `rect`, `ellipse`, `line`, `pen`, `freehand`, `pipe` | `crosshair` |
| `text` | `text` |
| `image` | `copy` |
| place mode floating | `crosshair` |
| Fallback | `default` |

Resize handles render custom SVG data-URI cursors (8-point, per-rotation angle),
generated by `_resizeCursorUrl`. Rotation handles render custom SVG data-URI cursors
generated by `_rotateCursorUrl` with per-theme fill/outline from `ROTATE_CURSOR_COLORS`
(constants for `dark`, `light`, `hphmi` — not in token registry).

**Canvas SVG wrapper:**
- `display: block, overflow: visible, position: absolute, inset: 0, width/height: 100%`

**Canvas background `<rect>`:**
- `fill: doc?.canvas.backgroundColor ?? "var(--io-surface-primary)"`
- Color is live from `doc.canvas.backgroundColor` (set via CanvasPropertiesDialog); fallback only when no doc is loaded

**Canvas border `<rect>` (no fill, always rendered):**
- `stroke: "rgba(255,255,255,0.08)"` — hardcoded, not a token
- `strokeWidth: 1`

**Canvas boundary dashed edge (shown when viewport extends outside canvas):**
- `stroke: "var(--io-border-subtle)"` (valid token: `#27272a` dark) + `strokeOpacity: 0.5`
- `strokeDasharray: 8/zoom, 4/zoom` (scales with zoom for crisp rendering)
- Auto-height mode: draws three-sided path + page guide line, same stroke style

**Grid overlay:**
- Minor lines: `stroke: "rgba(128,128,128,0.12)"` — hardcoded rgba
- Major lines: `stroke: "rgba(128,128,128,0.28)"` — hardcoded rgba
- Adaptive: minor grid suppressed when it would render below ~6 screen px density
- Dashboard 12-col overlay: column lines `rgba(255,255,255,0.06)`, row lines `rgba(255,255,255,0.04)` — both hardcoded

**Rulers overlay:**
- Background (both axes): `fill: "var(--io-surface-elevated)"`
- Corner square: `background: "var(--io-surface-elevated)"`, `borderRight/Bottom: "1px solid var(--io-border)"`
- Guide line (unlocked): `rgba(0,200,255,0.5)` — hardcoded
- Guide line (locked): `rgba(255,160,0,0.5)` — hardcoded

**Selection overlay (SVG, inside canvas transform group):**
- Selection border: `stroke: "var(--io-accent)"`, `strokeWidth: 1/zoom`, `strokeDasharray: 4/zoom,2/zoom`
- Resize handle squares: `fill: "white"`, `stroke: "var(--io-accent)"` — `"white"` is hardcoded (not a token; will not adapt in light/HPHMI themes)
- Rotation handles: custom SVG data-URI cursors; per-theme via internal constants, not CSS tokens

**Context menu (Radix ContextMenuPrimitive — correct per spec invariant):**

| Element | Key styles |
|---|---|
| Content | `background: var(--io-surface)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `boxShadow: 0 8px 24px rgba(0,0,0,0.4)`, `minWidth: 180`, `fontSize: 12`, `zIndex: 1000` |
| Item | `padding: 6px 14px`, `fontSize: 12`, `color: var(--io-text-primary)` |
| Separator | `height: 1`, `background: var(--io-border)`, `margin: 2px 0` |
| Destructive item | `color: var(--io-error, #ef4444)` — `--io-error` is undefined; fallback `#ef4444` applies |
| SubContent | inherits contentStyle, `minWidth: 160` |

**Interaction FSM:**

The `interactionRef` mutable ref tracks FSM state for Mode B selection (correct per
`docs/decisions/selection-behavior.md` requirement). States:

`none | drag | draw | pan | pipe | marquee | rotate | resize | freehand`

Pointer entry: `handleMouseDown` on the container div. Middle mouse button (`e.button === 1`)
immediately enters `"pan"` state without checking `activeTool`. Mouse move/up use
`document.addEventListener` global listeners (added on mousedown, removed on mouseup);
pointer capture API is not used.

**Clipboard integration (designerCopyHandler.ts / designerPasteTarget.ts):**
- Copy correctly uses `buildIOClipboardPayload` + `useIOClipboardStore.getState().writeToClipboard`
- Paste target `accepts()` returns: `native, shapes, points, style, style+layout, text, new-graphic`
- `"shapes"` paste enters two-phase place mode via `io-designer:enter-place-mode` DOM custom event
- `"new-graphic"` paste dispatches `io-designer:new-graphic-from-clipboard` on `window`
- Text blocks created by `points` / `text` paste use `fill: "var(--io-text-primary)"` (token-correct)

**Deviations from app shell:**
- Grid line strokes (`rgba(128,128,128,*)`) and canvas border (`rgba(255,255,255,0.08)`) are hardcoded; no token equivalents defined.
- Guide line colors (`rgba(0,200,255,0.5)` / `rgba(255,160,0,0.5)`) are hardcoded with no token equivalent.
- Selection resize handles use `fill: "white"` (hardcoded); does not adapt to light or HPHMI themes.
- Destructive context menu item references `var(--io-error, #ef4444)` — `--io-error` is undefined; the registered token is `--io-danger`.
- Test mode SceneRenderer context menu (lines 8000–8093) duplicates `contentStyle`/`itemStyle`/`sepStyle` as inline objects rather than sharing the `DesignerContextMenuContent` style constants.
- Guide context menu (inside RulersOverlay) similarly duplicates context menu styles inline instead of reusing the shared style objects.
- `DESIGNER_PASTE_AS_ORDER` in `DesignerContextMenuContent` lists `table` and `temporary-graphic` modes; neither is returned by `designerPasteTarget.accepts()`, so these options permanently render as disabled in the "Paste as…" submenu.

**Notes:**
- The `NameGroupPrompt` inline dialog (for group naming) is correctly rendered with `position: fixed` to escape any CSS transform context; see Category 11 for its style details.
- `doc.canvas.backgroundColor` is the live-editable canvas background. When undefined (pre-save state), it falls back to `var(--io-surface-primary)`.
- The `io-multiselect-active` class is added to the SVG when `selectedNodeIds.size > 1` but the class has no observable CSS rule — it appears to be a hook for future styling or external CSS.

---

## Category 11 — Modals and Dialogs

**Implementation:** `mix`. All dialogs are independent inline-styled components.
No shared `<Dialog>` or `<Modal>` wrapper exists. Radix primitives are used only
in `ContextMenuPrimitive` and `VersionRecoveryDialog` (app-shell). All designer-specific
dialogs render their own `position: fixed` backdrop + container.

**Source-of-truth files:**

| Dialog | File | Line range (render / overlay) |
|---|---|---|
| NameGroupPrompt | `DesignerCanvas.tsx` | 300–421 |
| TabClosePrompt | `TabClosePrompt.tsx` | full (126 lines) |
| IographicExportDialog | `IographicExportDialog.tsx` | full (225 lines) |
| SaveAsStencilDialog | `SaveAsStencilDialog.tsx` | full (263 lines) |
| ValidateBindingsDialog | `ValidateBindingsDialog.tsx` | full (249 lines) |
| CanvasPropertiesDialog | `CanvasPropertiesDialog.tsx` | full (701 lines) |
| CategoryShapeWizard | `CategoryShapeWizard.tsx` | 752–1341 (render section) |
| ShapeDropDialog | `ShapeDropDialog.tsx` | 1799–2323 (render section) |
| PromoteToShapeWizard | `PromoteToShapeWizard.tsx` | 2085–2368 (render section) |
| RecognitionWizard | `RecognitionWizard.tsx` | 90–1424 (render section) |
| IographicImportWizard | `IographicImportWizard.tsx` | 57–1684 |
| VersionHistoryDialog | `VersionHistoryDialog.tsx` | full (36 lines — wrapper only) |

**Visual properties actually applied:**

**Z-index layering across dialogs:**

| Dialog | Backdrop zIndex | Content zIndex | Notes |
|---|---|---|---|
| Context menu | — | 1000 | Radix Portal; no backdrop |
| Guide context menu | — | 1000 | Radix Portal; no backdrop |
| IographicExportDialog | 1100 (combined) | — | single container |
| CategoryShapeWizard | 1100 (combined) | — | single flexbox container |
| ShapeDropDialog | 1100 (combined) | — | single flexbox container |
| IographicImportWizard | 1100 (combined) | — | single flexbox container |
| RecognitionWizard | 1200 (combined) | — | single flexbox container |
| SaveAsStencilDialog | 2000 | 2001 | separate backdrop + content divs |
| PromoteToShapeWizard | 2000 | 2001 | separate backdrop + content divs |
| NameGroupPrompt | 2000 (combined) | — | flexbox center |
| TabClosePrompt | 3000 (combined) | — | flexbox center |
| VersionHistoryDialog | delegated to `VersionRecoveryDialog` | — | app-shell component |

No unified z-index tier. TabClosePrompt (3000) sits highest; five dialogs share 1100.
The registered app-shell `--io-modal-backdrop` color (`rgba(0,0,0,0.7)` dark) is not used by any designer dialog.

**Backdrop colors (all hardcoded):**

| Value | Dialogs using it |
|---|---|
| `rgba(0,0,0,0.5)` | SaveAsStencilDialog, PromoteToShapeWizard, NameGroupPrompt |
| `rgba(0,0,0,0.55)` | CategoryShapeWizard, ShapeDropDialog |
| `rgba(0,0,0,0.6)` | IographicExportDialog, TabClosePrompt, RecognitionWizard, IographicImportWizard |

**Dialog container backgrounds:**

| Token | Dialogs |
|---|---|
| `var(--io-surface-elevated)` | IographicExportDialog, CategoryShapeWizard, ShapeDropDialog, RecognitionWizard, IographicImportWizard, NameGroupPrompt |
| `var(--io-surface)` | SaveAsStencilDialog, PromoteToShapeWizard |
| `var(--io-surface-secondary)` | CanvasPropertiesDialog container |

**Dialog borders and radii:**

Most dialogs: `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`.
Exceptions using `var(--io-radius-lg)`: SaveAsStencilDialog, PromoteToShapeWizard.
Exceptions with `boxShadow: var(--io-shadow-lg)`: SaveAsStencilDialog, PromoteToShapeWizard.
`var(--io-radius-lg)` and `var(--io-shadow-lg)` are valid tokens (9px, layered box-shadow).

**Title bar patterns:**

| Dialog | fontSize | fontWeight | Color |
|---|---|---|---|
| NameGroupPrompt | 13 | 600 | `var(--io-text-primary)` |
| TabClosePrompt | 15 | 600 | `var(--io-text-primary)` |
| IographicExportDialog | 15 | 600 | `var(--io-text-primary)` |
| SaveAsStencilDialog | 15 | 600 | `var(--io-text-primary)` |
| PromoteToShapeWizard | 15 | 600 | `var(--io-text-primary)` |
| RecognitionWizard | 15 | **700** | `var(--io-text-primary)` |
| IographicImportWizard | 15 | 600 | `var(--io-text-primary)` |
| ShapeDropDialog | **14** | 600 | `var(--io-text-primary)` |
| CategoryShapeWizard | **14** | 600 | `var(--io-text-primary)` |
| ValidateBindingsDialog | **13** | 600 | `var(--io-text-primary)` |

RecognitionWizard uses `fontWeight: 700` (heavier than all other dialogs).
ShapeDropDialog and CategoryShapeWizard use `fontSize: 14` (one step below the 15px majority).

**Step indicator patterns (wizard dialogs):**

No consistent pattern. Four different approaches:
- `ShapeDropDialog`: plain text `"Step N of 3"` (no visual component)
- `CategoryShapeWizard`: dot pills — active pill width 20px, inactive 8px, height 8px
- `PromoteToShapeWizard`: horizontal progress bars — flex-row of `height: 3, borderRadius: 2` divs; active `var(--io-accent)`, done `var(--io-accent-muted, #3b82f6)` (undefined token with fallback), pending `var(--io-border)`
- `RecognitionWizard`: numbered circle pills (20×20px) with connectors
- `IographicImportWizard`: numbered circle badges (20×20px) in a row with step label text

**Close button styles:**

Inconsistent font sizes across dialogs: 14px (ValidateBindingsDialog), 18px (IographicExportDialog, ShapeDropDialog), 20px (IographicImportWizard), others implicitly inherited. All use `background: transparent/none`, `border: none`, `color: var(--io-text-muted)`, `cursor: pointer`. No `aria-label` on any close button.

**Primary button accent-text color:**

All dialogs using accent background use `color: "#09090b"` hardcoded, except SaveAsStencilDialog which uses `"#fff"`. Neither uses `var(--io-accent-foreground)`. The consistent correct token would be `var(--io-accent-foreground)` (defined as `#09090b` in dark theme).

**Error state rendering:**

| Dialog | Error bg | Error text |
|---|---|---|
| IographicExportDialog | `rgba(239,68,68,0.1)` | `#ef4444` — hardcoded (should be `var(--io-danger)`) |
| SaveAsStencilDialog | `rgba(239,68,68,0.1)` | `var(--io-alarm-high)` — alarm-domain token (wrong context; should be `var(--io-danger)`) |
| CanvasPropertiesDialog OOB warning | `rgba(234,179,8,0.1)`, border `rgba(234,179,8,0.3)` | `#eab308` — hardcoded (should be `var(--io-warning)`) |

**Undefined tokens referenced in dialogs:**

| Token | Location | Fallback | Correct token |
|---|---|---|---|
| `var(--io-error)` | DesignerCanvas.tsx:10322 (ctx menu), 8075 (test mode overlay) | `#ef4444` | `var(--io-danger)` |
| `var(--io-accent-muted)` | PromoteToShapeWizard.tsx:2168 | `#3b82f6` | No equivalent defined |
| `var(--io-surface-raised)` | ShapeDropDialog.tsx:891, 927, 963, 997 | browser default (empty) | No equivalent defined |
| `var(--io-surface-hover)` | DesignerToolbar.tsx:1459 (pass 1 finding; carried forward) | empty | No equivalent defined |

**ValidateBindingsDialog — floating panel (not a modal):**
- Rendered `position: absolute` inside the canvas container, not `position: fixed` — behaves as a floating panel anchored to the canvas area (`top: 40px, right: 16px`)
- Width: 340px, max-height: 400px, `overflow: hidden` (scrollable body inside)
- Background: `var(--io-surface-elevated)`, `boxShadow: 0 4px 16px rgba(0,0,0,0.15)` — lower shadow than modal dialogs
- Status indicator: uses `var(--io-success)`, `var(--io-warning)`, `var(--io-danger)` (all valid tokens); `var(--io-border-subtle)` for row separators (valid token)
- No backdrop; no close-on-click-outside behavior

**VersionHistoryDialog — wrapper-only:**
- 36-line wrapper; delegates entirely to `shared/components/versioning/VersionRecoveryDialog`
- No local styling applied; wrapper adds no `className`, `style`, or layout div
- `onLoadVersion` callback extracts `version_number` and `scene_data` from `GraphicVersionContent`
- All visual properties are app-shell scope — not audited here per plan

**Accessibility:**
- `RecognitionWizard` alone adds `role="dialog"`, `aria-modal="true"`, `aria-label="Recognize Image"` (lines 110–112)
- No other designer dialog has `role="dialog"` or aria attributes
- `NameGroupPrompt` handles `Escape` key via `onKeyDown` manually; no other dialog has keyboard dismiss handling visible in the sampled sections
- No focus trap or focus restoration on open/close in any designer-specific dialog

**Deviations from app shell:**
- No shared `<Dialog>` component. All dialogs are individually inline-styled with no shared layout primitive.
- Backdrop colors are four distinct hardcoded values, none matching `--io-modal-backdrop`.
- Z-index layering is uncoordinated (1000, 1100, 1200, 2000, 2001, 3000).
- Primary button text uses `#09090b` or `#fff` hardcoded; should use `var(--io-accent-foreground)`.
- Error colors mix hardcoded hex, `var(--io-alarm-high)` (alarm-domain), and `var(--io-error)` (undefined) — none use `var(--io-danger)` directly.
- Step indicator patterns are inconsistent across five wizard dialogs.
- `var(--io-surface-raised)` referenced in ShapeDropDialog is undefined and resolves to empty; visible as missing background on DE config option cards.
- `var(--io-accent-muted)` referenced in PromoteToShapeWizard step progress uses a `#3b82f6` fallback (a blue inconsistent with the teal accent palette).

**Notes:**
- All designer dialogs render with `position: fixed` at the document root level, which correctly avoids the CSS transform context of the canvas. This is the right pattern for this module.
- CanvasPropertiesDialog is a floating non-modal panel (no backdrop, positioned via the toolbar's "Canvas Properties" action); it does not use `position: fixed` for the outer container but instead uses `position: absolute` or positioning within the toolbar's anchor — consistent with its non-blocking design intent.
