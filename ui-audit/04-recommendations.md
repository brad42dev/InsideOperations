# UI Audit Recommendations

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation, authoritative)
**Date:** 2026-05-27

---

## Section 1 — Target Architecture

The user's working hypothesis stated three claims. Each is evaluated against the audit evidence.

### Claim A: App shell (top bar, left nav, routing, theme) should be shared across all modules

**Supported — partially already true, partially aspirational.**

All three modules draw from the same `index.css` 138-token registry (Cat 1, List 1 Item 1). The `shared/components/ContextMenu` component, `VersionRecoveryDialog`/`SaveConfirmDialog`, and `ConfirmDialog` are already cross-module shared infrastructure (Cat 4 List 1 Item 3; Cat 11 notes). The AppShell sidebar design pattern (`--io-sidebar-width: 240px`, active left-border accent) exists and is implemented, but all three modules deviate from it with hardcoded 220px and missing active indicators (Cat 5, Deviations). The token registry is the correct shared foundation; the gap is that modules define their own overrides, reference undefined tokens, and ignore defined tokens for height, modal backdrop, z-index, and button styles.

**Refined target:** The app shell provides the token registry, routing, top bar, sidebar chrome, and a small set of shared primitive components. Modules consume these without redefining them. No module defines its own token namespace; undefined token references are zero; every module uses the same constants for sidebar width, modal backdrop, and z-index stacking.

### Claim B: Each module should share an underlying framework implemented uniformly

**Partially supported — the right framing is a thin shared-constants layer, not a component library.**

The audit found no shared Button component, no shared Input component, no shared Dialog wrapper, and no shared form label component spanning all three modules. However, it also found that the `settingsStyles.ts` approach — a named export from a module-level constants file — is already the closest to a shared standard and is the pattern most easily extended (Cat 7, List 1; Cat 6, List 3 Items 1, 3). Designer's `IconBtn` and `FieldLabel` are module-local reusable primitives that would require minimal adaptation to promote to `shared/components/` (Cat 6; Cat 9, List 3 Item 6).

A heavyweight component library is not warranted given the app's scale. The evidence supports a **thin shared-constants and shared-primitives layer**: a small file of style constant objects (`btnPrimary`, `btnSecondary`, `inputStyle`, `labelStyle`) plus two or three React components (`FieldLabel`, `StatusBadge`, `Dialog`) promoted into `shared/components/`. Hover and focus states should be CSS-driven rather than DOM-mutation-driven (Cat 2 List 1 Item 9), which is achievable with a small `shared/styles/` Tailwind-class or CSS-module approach without a full component system.

**Refined target:** A `shared/styles/` constants file and no more than four new shared components replace the per-module duplicates. No module defines its own button system, input style, or dialog backdrop independently.

### Claim C: The main canvas/work area should share a rendering engine with per-module functionality layered on top

**Partially supported with a critical clarification about what "rendering engine" means.**

The shared graphics layer (`SceneRenderer`, `TimeSeriesChart`/`ChartRenderer`, `DataTable`, and the CSS files `alarmFlash.css`, `operationalState.css`, `lod.css`) is already a shared rendering engine consumed inside Console panes. This is working correctly and should continue (Cat 10, Shared Infrastructure entries). The evidence does NOT support merging the work-surface containers: Console's `WorkspaceGrid` (react-grid-layout tile dashboard) and Designer's `DesignerCanvas.tsx` (12,067-line SVG editor with FSM interaction model) serve fundamentally different work modes and share no meaningful interaction semantics (Cat 10, Implementation). Converging the containers would introduce false coupling without shared benefit.

**Refined target:** The shared rendering engine exists and should be maintained. The work-surface container is intentionally module-specific. The correct convergence work in Cat 10 is fixing bugs in the shared infrastructure (selection token prefix bug, alarmFlash.css theme hardcoding) and ensuring each module's canvas follows the same token conventions for its local chrome — not merging the containers.

---

### Consolidated target architecture statement

When this work is complete:

1. The `index.css` token registry is the sole source for all color, spacing, radius, shadow, and z-index values. No undefined tokens are referenced anywhere in the frontend. No module defines its own token namespace.

2. A `shared/styles/` constants file provides named style objects for buttons, inputs, and field labels used uniformly across Console, Designer, and Settings. No module duplicates a button or input style system independently.

3. Four shared components exist in `shared/components/`: `FieldLabel` (promoted from Designer), `StatusBadge` (promoted from Settings Import pattern), `Dialog` (wrapper with ARIA, `--io-modal-backdrop`, and a coordinated z-index), and `ConfirmDialog` (already exists; usage extended to all modules).

4. The shared graphics rendering layer (`SceneRenderer`, the CSS infrastructure files) is maintained as-is. The work-surface containers (WorkspaceGrid, DesignerCanvas) remain module-specific.

5. All interactive elements have visible focus indicators. DOM-mutation hover (`onMouseEnter`/`onMouseLeave` style writes) is replaced with CSS `:hover` rules or React state.

---

## Section 2 — Per-Element Convergence Recommendations

### Category 1 — Color Palette and Theme Tokens

**Standardize on:** The existing `index.css` 138-token registry. No changes to the registry structure; only fix what is broken in the token graph.

**Actions:**

- **Define missing tokens** — add to `index.css`:
  - `--io-bg` (used in Console but undefined — alias to `--io-surface-primary` or `--io-bg: var(--io-surface-primary)`)
  - `--io-text` (used in Console and Designer — alias to `--io-text-primary`)
  - `--io-surface-hover` (used in Designer zoom dropdown — alias to `--io-surface-elevated`)
  - `--io-font-sans` (used in Designer zoom dropdown — define with the same font stack as the document)
  - `--io-text-on-accent` (used in Settings btnPrimary — alias to `--io-accent-foreground`)
  - `--io-error` (used in DesignerCanvas context menu — alias to `--io-danger`)
  - **Status: Implemented 2026-05-27 (Claim A / 2b).** All six tokens above defined. Additional tokens also resolved in same pass: `--io-surface-raised` (A7, alias for `--io-surface-elevated`), `--io-overlay` (A9, alias for `--io-modal-backdrop`), `--io-accent-rgb` (A10, per-theme), `--io-alarm-inactive` (A11, #808080), `--io-sidebar-width` updated to 220px (A14). `--io-accent-muted` intentionally not defined (A8 — single consumer updated at call site instead). `--io-text-inverse` confirmed already defined (A12 — plan claim was incorrect).

- **Replace hardcoded hex with tokens** — highest-value cases:
  - Console published dot `#10b981` → `var(--io-success)`
  - Console alarm priority badges (PriorityBadge hardcoded rgba) → `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, etc.
  - Designer WS dot `#22c55e`/`#ef4444` → `var(--io-success)`/`var(--io-danger)`
  - Designer dirty indicator `#f97316` → `var(--io-warning)`
  - Designer READ-ONLY badge `#eab308` → `var(--io-warning)`
  - All modules: connection dot glow shadow `#22c55e` → `var(--io-success)`
  - `alarmFlash.css`: migrate hardcoded hex to `--io-alarm-*` tokens (see Cat 8 and Cat 10 notes)

- **Do not change:** `operationalState.css` hardcoded ISA-101 colors — documented intentional exception.

**Build new vs adopt:** No new infrastructure. Token registry is already the correct approach; this is a fill-the-gaps exercise.

---

### Category 2 — Typography

**Standardize on:** Raw pixel inline styles as the de-facto standard for component-level typography. The 16 `--io-text-*` scale tokens exist but have zero usage across all three modules; mandating adoption is a wide-blast refactor for low functional gain unless font-size theming is a product requirement.

**What to standardize now:** Document a fixed set of semantic size/weight values for recurring label contexts. Adopt these values uniformly rather than letting each module drift:

| Context | Value | Basis |
|---|---|---|
| Page title | 18px / 600 / `--io-text-primary` | Settings `SettingsPageLayout` |
| Section/palette group label | 11px / 600 / uppercase / 0.06em / `--io-text-muted` | Console palette, Designer SectionHeader agree |
| Form field label | 11px / 600 / uppercase / 0.05em / `--io-text-muted` | Designer `FieldLabel` (after minor size alignment) |
| Tab label active / inactive | 13px / 600 / 400 | Console + Designer tab strips agree |
| Table column header | 11px / 600 / uppercase / 0.06em | Console + Settings agree |

**Actions:**
- Fix: `fontFamily: monospace` → `var(--io-font-mono)` in all three modules (after defining `--io-font-sans` unblocks confidence in the font token approach)
- Adopt: Settings `SettingsPageLayout` as the shared page-title component (see Cat 9)
- Adopt: Designer `FieldLabel` as the shared form label component (see Cat 9)
- Eliminate: Sub-minimum font sizes (Console SubGroupLabel 9px, PaneTypeBadge 10px should be raised to 11px minimum)

**Do not attempt now:** Migrating all raw pixels to `--io-text-*` scale tokens. Defer until font-size scaling is a product requirement.

---

### Category 3 — Toolbars

**Standardize on:** Module-local toolbar components remain the right approach — toolbar structure is inherently module-specific. Converge on the *visual properties* shared between Console and Designer.

**Adopt:** The Console/Designer shared visual convention that already exists:
- `background: var(--io-surface)` / `borderBottom: 1px solid var(--io-border)`
- Active tab underline: `2px solid var(--io-accent)`
- Tab label: 13px / 600 active / 400 inactive
- Icon button: 32×32 with `var(--io-radius)` radius and `transition: background 0.1s, color 0.1s`

**Actions:**
- Fix: Duplicate Publish button in Console (two render blocks; remove one)
- Fix: Designer loading skeleton 40px → 44px (layout shift on load)
- Fix: Designer StatusBar segments (`<div onClick>`) → `<button>` for keyboard navigation
- Fix: All toolbar heights hardcoded — not a blocker but add a `--io-toolbar-height` token if/when height theming is needed
- Fix: Designer toolbar text-action buttons use `borderRadius: 6` integer while `IconBtn` uses `var(--io-radius)` — standardize on `var(--io-radius)` throughout

**Build new:** None. Shared constants for the visual convention are sufficient.

---

### Category 4 — Menus

**Standardize on:** `shared/components/ContextMenu` as the sole menu primitive. Settings demonstrates this is sufficient for a complex module (Cat 4, List 3 Item 5).

**Actions:**
- Fix: `ContextMenu` danger item color: `var(--io-alarm-urgent)` → `var(--io-danger)` in `shared/components/ContextMenu.tsx`
- Fix: Designer File menu — add Escape key handler to close
- Fix: Designer zoom dropdown hover — `var(--io-surface-hover)` → `var(--io-surface-elevated)` (after defining `--io-surface-hover` as an alias) — **Status: Token prerequisite implemented 2026-05-27 (Claim A / 2b — A3). Code change in zoom dropdown component deferred (Claim B).**
- Fix: Designer zoom dropdown box-shadow → use `--io-shadow-lg` token if defined, or a consistent hardcoded value matching the File menu
- Migrate: Console export quick-format dropdown → replace with `ContextMenu` usage (low-risk; existing pattern is one custom dropdown)
- Evaluate: Designer File menu — if `ContextMenu` can represent a triggered (non-right-click) menu, migrate; otherwise keep but fix the Escape handler and hover state

**Build new:** None.

---

### Category 5 — Side Panels

**Standardize on:** Module-local panel components remain the right approach (panels differ structurally across modules). Converge on visual properties.

**Adopt:** Console + Settings convention: `background: var(--io-surface-secondary)`, `borderRight: 1px solid var(--io-border)`.

**Actions (highest priority first):**
- **Fixed 2026-05-27** (functional regression): `shared/clipboard/selection/selection.css` — `var(--accent)` → `var(--io-accent)` (lines 2 and 9). `MarqueeLayer.tsx` — `var(--accent)` → `var(--io-accent)` (line 101) and `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (line 100). Selection highlight and marquee border now render with teal accent color.
- Fix: Align Designer left palette background: `var(--io-surface)` → `var(--io-surface-secondary)` to match Console and Settings — **Status: Implemented 2026-05-27 (Claim A / 2c — B1). `DesignerLeftPalette.tsx:2436` updated.**
- Fix: Resolve `--io-sidebar-width` discrepancy — either update the token to 220px to match current practice, or update all three modules to 240px. Pick one and be consistent. — **Status: Implemented 2026-05-27 (Claim A / 2b — A14). Token set to 220px; no module code changes required (all three already at 220px).**
- Fix: Settings active nav item — add `borderLeft: 2px solid var(--io-accent)` on active state to match AppShell pattern — **Status: Implemented 2026-05-27 (Claim A / 2c — B2). `settings/index.tsx:211–214` updated with accent border + uniform padding.**
- Fix: Replace DOM-mutation hover in Console palette (`e.currentTarget.style.*`) with CSS `:hover` or React state
- Fix: Designer `CanvasLayerRow` `--io-surface-raised` undefined → use `var(--io-surface-elevated)` — **Status: Partially implemented 2026-05-27 (Claim A / 2b — A7). Token `--io-surface-raised` defined as alias for `var(--io-surface-elevated)`. Code in `CanvasLayerRow` still references the token name (now resolves via alias); direct code replacement deferred to Claim B.**
- Fix: Section label typography — standardize on 11px/600/uppercase/0.06em per Cat 2 table (Console and Designer already agree; bring Settings nav group into alignment) — **Status: Partially implemented 2026-05-27 (Claim A / 2c — B4). Settings nav group `letterSpacing` corrected 0.08em→0.06em. Console and Designer already at 0.06em. Other label contexts with letterSpacing drift (Designer RightPanel, Settings table headers) deferred to Claim B.**

**Build new:** None for panel containers. Shared `FieldLabel` (Cat 9) and `StatusBadge` (Cat 8) are the shared components this category depends on.

---

### Category 6 — Buttons

**Standardize on:** `settingsStyles.ts` named-variant pattern as the starting point. Promote to `shared/styles/buttons.ts` accessible across all modules.

**Adopt:** The four named variants `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` with corrected token references. Do not build a React `<Button>` component — named style constant objects are sufficient and the existing patterns already use this approach.

**Actions:**
- Create: `frontend/src/shared/styles/buttons.ts` with corrected variants:
  - `btnPrimary`: `var(--io-accent)` bg, `var(--io-accent-foreground)` text (replaces `--io-text-on-accent` and hardcoded `#fff`/`#09090b`), `var(--io-radius)`, add hover state via `transition: opacity 0.1s` or `var(--io-btn-hover)` token
  - `btnSecondary`: transparent bg, `var(--io-text-secondary)` text, `1px solid var(--io-border)`, `var(--io-radius)`, matching font-weight (600)
  - `btnDanger`: same structure as secondary but `var(--io-danger)` text and border
  - `btnSmall`: size modifier only
- Migrate: Console toolbar + modal buttons to the shared file
- Migrate: Designer text-action buttons and Stencil/Import primary buttons to the shared file; leave `IconBtn` as-is (it is already a good local primitive)
- Merge: `BulkUpdate.tsx` `BTN_PRIMARY`/etc. → import from shared file
- Fix: Designer StatusBar segments `<div onClick>` → `<button>` (see Cat 3)
- Fix: Add CSS hover states to all button variants; remove all `onMouseEnter`/`onMouseLeave` style mutations on buttons
- Fix: `DesignerImport` fallback `#3b82f6` primary button background → `var(--io-accent)`
- Fix: All destructive button inconsistency in Designer (ghost rgba vs solid fill) → standardize on `btnDanger` solid pattern

**Build new:** `shared/styles/buttons.ts` (constants file, not a component).

---

### Category 7 — Form Inputs

**Standardize on:** `settingsStyles.ts inputStyle` pattern. Same approach as buttons: promote to `shared/styles/inputs.ts`.

**Adopt:** Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`. Use `--io-input-bg` and `--io-input-border` tokens where applicable (Designer's ShapePointSelector already does this correctly and can serve as validation that the tokens work).

**Actions:**
- Create: `frontend/src/shared/styles/inputs.ts` with `inputStyle` and `labelStyle` objects
- Migrate: Console `PaneConfigModal`, `PaneWrapper`, `ConsolePalette` inputs to shared inputStyle
- Migrate: Designer `DesignerRightPanel inputStyle`, `PointPickerModal` inputs to shared inputStyle
- Migrate: Settings `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` (the current diverging cases) to the shared inputStyle
- Fix (accessibility — all modules): Remove `outline: none` and replace with `outline: 2px solid var(--io-accent)` on `:focus-visible`. This is a wide change; use the shared constants file so it's fixed in one place.
- Fix: `fontFamily: monospace` → `var(--io-font-mono)` in Console `PaneConfigModal` and Settings `Groups.tsx`
- Fix: `AuthProviders.tsx` — remove the `<style>` tag injected for checkbox `accent-color`; use the `accentColor: "var(--io-accent)"` inline style already used by other pages
- Keep: Designer `ThemedColorSelect` as a module-local specialized component (restricts to ISA-101 token pairs — this is domain logic, not a shared concern)

**Build new:** `shared/styles/inputs.ts` (constants file, not a component).

---

### Category 8 — Status Indicators

**Standardize on:** Settings `Import.tsx` token-pair pattern (`background: var(--io-success-subtle)`, `color: var(--io-success)`) as the canonical StatusBadge implementation.

**Build new:** `shared/components/StatusBadge.tsx` — a simple component accepting `status` (connected/disconnected/error/warning/info/running/etc.) and optional `label` props, rendering with the correct token pair for each state. This is the one new component where a React component (not just a constants object) is warranted, because the rendering logic (which token pair, whether to show dot vs pill vs text) is non-trivial and repeated five different ways in Settings alone.

**Actions:**
- Fix (functional regression): `OpcSources StatusBadge` hex-alpha concat bug — `${color}20` → `color-mix(in srgb, ${color} 12%, transparent)` or migrate to shared `StatusBadge` component
- Migrate: All five Settings StatusBadge implementations → shared component
- Migrate: Console connection dots and priority/state/quality badges → shared component or token-based inline styles
- Migrate: Designer WS dot, dirty indicator, READ-ONLY badge → use token colors (minimum); migrate to shared component where appropriate
- Fix: Designer TEST MODE `<style>` tag injection → CSS class + token-based keyframe, remove the inline `<style>` element
- Fix: Console published dot `#10b981` → `var(--io-success)`
- Fix: All connection dot glow shadows `#22c55e` → `var(--io-success)` (or remove glow if it introduces complexity)
- Fix: `alarmFlash.css` — migrate `#ef4444`, `#f97316`, `#eab308`, `#f4f4f5`, `#60a5fa` to `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, `--io-alarm-diagnostic`, `--io-alarm-custom` tokens. This is the correct fix for theme adaptation; the off-state `#808080` has no token equivalent and should be defined (`--io-alarm-inactive: #808080`).

**Do not change:** `operationalState.css` — ISA-101 hardcoded colors are intentional and documented.

---

### Category 9 — Labels and Headers

**Standardize on:** Two shared components to promote:
1. `SettingsPageLayout.tsx` for page-level heading (already a shared component within Settings; extend access to Console and Designer views)
2. `FieldLabel` from `DesignerRightPanel` — promote to `shared/components/FieldLabel.tsx`

**Actions:**
- Promote: `DesignerRightPanel.tsx` `FieldLabel` (lines 201–203) → `shared/components/FieldLabel.tsx`. Minimal changes: standardize size to 11px (from 10px) to align with the Cat 2 table convention; keep other properties (`/600/uppercase/0.05em/--io-text-muted`).
- Adopt: `FieldLabel` in Console `PaneConfigModal` and Settings pages to replace inline `<div>`-based form labels
- Adopt: `SettingsPageLayout` pattern — evaluate extending it to Console's `PaneConfigModal` header and Designer's view-level headers as applicable
- Fix: `var(--io-text)` undefined in Console/Designer dialog titles → `var(--io-text-primary)`
- Fix: Inconsistent `letterSpacing` across uppercase labels → standardize on 0.06em
- Fix: Console — no semantic heading elements anywhere; add `<h2>` for page/section titles where appropriate
- Fix: Designer `SymbolLibrary` — `<h2>` elements with inconsistent sizes (15px/600 vs 16px/700 within same file) → pick one and apply consistently
- Do not change: Settings `SettingsPageLayout` `<h2>` page title — correct semantic for a sub-page context

---

### Category 10 — Canvas / Main Work Area

**Standardize on:** Module-specific canvas containers are correct and should not be merged. Shared graphics infrastructure should be the focus.

**Actions (by priority):**

- **Fixed 2026-05-27** (functional regression, was highest priority): `shared/clipboard/selection/selection.css` and `MarqueeLayer.tsx` — `var(--accent)` → `var(--io-accent)` (selection.css lines 2 and 9; MarqueeLayer.tsx line 101). `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (MarqueeLayer.tsx line 100). Selection highlight and marquee border now render with teal accent color.
- Fix: `alarmFlash.css` — migrate alarm hex colors to `--io-alarm-*` tokens (see Cat 8). Required for light/HPHMI theme support.
- Fix: Console `WorkspaceGrid` container `var(--io-bg)` (undefined) → `var(--io-surface-primary)` (after defining `--io-bg` alias in Cat 1 token work, this becomes automatic)
- Fix: DesignerCanvas canvas border `rgba(255,255,255,0.08)` → define a token or use `var(--io-border)` with opacity; grid lines `rgba(128,128,128,0.12/0.28)` → acceptable to leave as-is if theme support is not required for the grid appearance
- Fix: DesignerCanvas resize handles `fill="white"` → `fill="var(--io-text-inverse)"` or keep `white` with a formal comment documenting it as intentional in dark-theme-only contexts
- Fix: `--io-error` references in DesignerCanvas → `--io-danger` (after defining `--io-error` alias in Cat 1 token work, this becomes automatic)
- Fix: Guide line colors (`rgba(0,200,255,0.5)`, `rgba(255,160,0,0.5)`) — low priority, canvas-only; acceptable as-is if guide colors are intentional design choices
- Fix: "Paste as…" submenu items for `table`/`temporary-graphic` always render disabled — separate bug, out of scope for UI consistency work but worth a task file

**Do not change:** `lod.css` (no deviations), `operationalState.css` (intentional exception).

---

### Category 11 — Modals and Dialogs

**Standardize on:** Build one shared `Dialog` wrapper component. Radix Dialog (already used in Settings for PointManagement, AuthProviders, Email) is the best implementation and should be the standard for new dialogs. The shared wrapper provides: `--io-modal-backdrop` backdrop, `role="dialog"` + `aria-modal="true"`, `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)`, and a coordinated z-index.

**Actions:**

- Fix (token): Standardize z-index values. `--io-z-modal: 300` is misaligned with actual usage (1000–9999). Either raise the token to 1000 minimum, or define a z-index scale (`--io-z-dropdown: 200`, `--io-z-modal: 1000`, `--io-z-toast: 2000`). Do not leave the token at 300 when no dialog uses it. — **Status: Implemented 2026-05-27 (Claim A / 2b — A13). Full scale chosen (Option B): dropdown:500, modal:1000, command:1200, visual-lock:1500, kiosk-auth:1800, toast:2000, emergency:3000. Applied to all three themes. `CommandPalette.tsx` wired to `var(--io-z-command)`. Code-level migration of hardcoded z-index values deferred to Claim B.**
- Fix (token): `--io-modal-backdrop` is already defined and used in ≥6 Settings files. Console and Designer should migrate to it from hardcoded `rgba(0,0,0,0.5–0.6)`.
- Fix (accessibility, urgent): `RestorePreviewModal.tsx` — add `role="dialog"` and `aria-modal="true"`. This is the highest-priority ARIA gap because it appears on a destructive-adjacent action path.
- Fix (accessibility): Console inline modals (3 dialogs in `index.tsx`) — add `role="dialog"` and `aria-modal`.
- Fix (accessibility): Settings `Import.tsx` Modal/Drawer and `OpcSources ManageCategoriesModal` — add ARIA.
- Fix: Replace all 8 `window.confirm()` calls with `ConfirmDialog`:
  - OpcSources.tsx (3 calls)
  - Import.tsx (3 calls)
  - CameraStreams.tsx (1 call)
  - SupplementalConnectorsTab.tsx (1 call)
- Fix: Standardize `borderRadius` to `var(--io-radius-lg)` across all modals (currently 8, 9, 10, 12px scattered)
- Fix: Standardize modal content background to `var(--io-surface-elevated)` (currently mixed with `--io-surface`, `--io-surface-secondary`, `--io-surface-primary`)
- Fix: Designer primary button text in dialogs — `#09090b`/`#fff` hardcoded → `var(--io-accent-foreground)` (after shared buttons.ts is in place, this is automatic)
- Fix: Designer error color mixing (`--io-alarm-high` for errors in wrong domain, `--io-error` undefined) → use `--io-danger` consistently — **Status: Token prerequisite implemented 2026-05-27 (Claim A / 2b — A6). `--io-error` defined as alias for `--io-danger`; references in DesignerCanvas context menu now resolve. Code-level audit of `--io-alarm-high` misuses deferred to Claim B.**
- Fix: Designer step indicator inconsistency across 5 wizard dialogs — define one step indicator pattern (not blocked by other work but needs its own task)

---

## Section 3 — Rough Migration Order

The dependency structure has four phases. Items within a phase are largely independent of each other.

### Phase 1 — Token registry (unblocks everything downstream)

No component changes. Pure token additions to `index.css`.

1. Define missing tokens: `--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent` (alias to `--io-accent-foreground`), `--io-error` (alias to `--io-danger`), `--io-alarm-inactive: #808080`, `--io-text-inverse`. — **Status: Implemented 2026-05-27 (Claim A / 2b).** All listed tokens defined. `--io-text-inverse` confirmed already defined (skipped). Additional tokens also added: `--io-surface-raised`, `--io-overlay`, `--io-accent-rgb`, `--io-surface-hover`. `--io-accent-muted` handled at consumer site instead.
2. Fix z-index token: raise `--io-z-modal` to a realistic value (recommend 1000); optionally define `--io-z-dropdown: 500` and `--io-z-toast: 2000`. — **Status: Implemented 2026-05-27 (Claim A / 2b — A13).** Full scale set: dropdown:500, modal:1000, command:1200, visual-lock:1500, kiosk-auth:1800, toast:2000, emergency:3000.
3. Resolve sidebar width: pick 220px or 240px; update token or code to match. — **Status: Implemented 2026-05-27 (Claim A / 2b — A14).** 220px chosen. Token updated; no module code changes needed (all three modules already at 220px).

**Why first:** Every downstream fix that replaces hardcoded hex or undefined token references becomes a one-word change once these tokens exist. Without them, each fix requires two changes (add the token AND update the reference).

### Phase 2 — Functional regressions (urgent; no dependency on Phase 1 being complete)

These are bugs visible at runtime, not polish issues.

1. ~~`selection.css` + `MarqueeLayer.tsx`: `var(--accent)` → `var(--io-accent)`, `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`. (2-file change.)~~ **Fixed 2026-05-27.**
2. ~~`OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.~~ **Fixed 2026-05-27.** `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `color-mix(in srgb, ${color} 25%, transparent)`. Fix scoped to the local `StatusBadge` function in `OpcSources.tsx` (lines 168–170); matches the `color-mix` pattern already used by `SystemHealth.tsx`. **Note:** The same `${color}20`/`${color}40` hex-alpha pattern also appears in `Users.tsx` (Badge, line 108/110), `Roles.tsx` (Badge, line 51/53), `CameraStreams.tsx` (line 785/787), and `MaintenanceTicketsPanel.tsx` (line 52) — these were not fixed here and remain broken when CSS variable strings are passed as the color argument.
3. `alarmFlash.css`: migrate hex to `--io-alarm-*` tokens. (This affects theme support, not current dark-theme functionality, but the hardcoded values are wrong in principle and block HPHMI work.)
4. Critical ARIA fixes: `RestorePreviewModal` + Console inline modals + Import/OpcSources dialogs. (Accessibility regression on destructive paths.)
5. Replace 8 `window.confirm()` calls with `ConfirmDialog`.
6. Console duplicate Publish button — remove one render block.

**Why second:** These are observable regressions. They are small-scope, can be reviewed independently, and should not wait for the broader convergence work.

### Phase 3 — Shared style constants (enables consistent convergence without component work)

Depends on: Phase 1 token fixes (so constants reference valid tokens).

1. Create `shared/styles/buttons.ts` with corrected `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` variants.
2. Create `shared/styles/inputs.ts` with standard `inputStyle` (including focus ring; remove `outline: none`).
3. Migrate Console button and input inline styles to shared constants.
4. Migrate Designer text-action buttons and import buttons to `buttons.ts`; migrate `DesignerRightPanel inputStyle` and `PointPickerModal` to `inputs.ts`.
5. Migrate Settings `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` diverging buttons and inputs to shared constants.
6. Fix `accentColor` / font-family regressions (OpcSources `<style>` tag, monospace font references) as part of input migration.

**Unblocks:** Phase 4 modal work (button styles inside dialogs) and Cat 6/7 cleanup across all modules.

### Phase 4 — Shared components (highest coordination cost)

Depends on: Phase 3 constants (dialogs need buttons; StatusBadge needs token pairs from Phase 1).

1. Promote `FieldLabel` to `shared/components/FieldLabel.tsx`. Migrate usage in Console and Settings.
2. Build `shared/components/StatusBadge.tsx`. Migrate all five Settings implementations, Console priority/state/quality badges, Designer badge indicators.
3. Build `shared/components/Dialog.tsx` (thin wrapper: ARIA, backdrop token, z-index, standard container styles). Migrate Console inline modals and Designer non-Radix dialogs to use it.
4. Fix Designer TEST MODE `<style>` tag injection → CSS keyframe class.
5. Extend `SettingsPageLayout` accessibility or create a simpler page-title shared component for Console and Designer views.

### Phase 5 — Polish and alignment (deferred; no functional impact)

Depends on: Phases 1–4 being stable.

1. Typography: standardize on documented size/weight/spacing values across section labels, field labels, tab labels, page titles.
2. Toolbar heights: define `--io-toolbar-height` token; update Designer skeleton placeholder.
3. Hover/focus: replace remaining DOM-mutation hover with CSS `:hover` pseudo-classes or React state.
4. DesignerCanvas grid line colors, canvas border, guide line colors: token-ify or formally document as intentional.
5. Semantic headings: add `<h2>`/`<h3>` where currently bare `<div>`.
6. Section label `letterSpacing` standardization to 0.06em.

---

## Section 4 — Risks and Unknowns

### R1 — `--io-z-modal: 300` is unusable as-is

Every dialog in all three modules uses z-index values between 1000 and 9999. Raising the token will fix any code that correctly references it, but code currently using hardcoded integers (the majority) will be unaffected until individually migrated. There is a risk that the migration is incomplete and layers will stack incorrectly in edge cases (e.g., a console modal rendered inside a designer tab). A z-index audit across all `zIndex` values in the frontend would be needed to produce a safe z-index scale before setting definitive token values.

### R2 — Light theme and HPHMI theme are not yet implemented; audit was dark-theme-only

The audit verified token references but could not test whether visual output is correct in non-dark themes. `alarmFlash.css` is confirmed dark-theme-only (colors are hardcoded hex matching dark-theme token values). `operationalState.css` is intentionally non-adaptive. Any module-local hardcoded hex values will also fail to adapt. If theme switching is a near-term requirement, the Phase 2 alarmFlash fix and Phase 1 token additions should be front-loaded.

### R3 — DesignerCanvas.tsx at 12,067 lines is high-risk to touch

Multiple Phase 4 items (Dialog promotion, token fixes) require changes inside or adjacent to DesignerCanvas. Any change here should be minimally invasive — prefer aliasing tokens (Phase 1) over in-file search-and-replace of hardcoded values, since the token alias approach reduces the number of touch points in this file.

### R4 — `window.confirm()` replacements require confirming render context

Eight `window.confirm()` calls need to become `ConfirmDialog` renders. Some are inside contexts (OpcSources, Import) that render large tables or multi-step wizard flows. Each replacement needs to verify that the `ConfirmDialog` can be portal-rendered correctly from the calling component's position in the tree, since some callers may be inside transformed ancestors (CLAUDE.md invariant: `position: fixed` inside react-grid-layout transforms breaks — use `createPortal`).

### R5 — BulkUpdate.tsx is a parallel button system inside Settings

`BulkUpdate.tsx` defines its own full button style set (`BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER`) independent of `settingsStyles.ts`. Before cross-module button standardization is clean, this file needs to be migrated to the shared constants. If it is overlooked, Settings will still have two competing button systems internally, undermining the shared approach.

### R6 — Audit scope was limited to Console, Designer, and Settings

Other frontend modules (OPC config detail views, camera streams, supplemental connectors, display element config panels, SAML/auth provider pages) were not audited. The undefined token references (`--io-text-on-accent`, `--io-overlay`, `--io-accent-rgb`) and `window.confirm()` calls found in Settings suggest that scope extensions would find additional deviations. Phase 1 token fixes will automatically resolve references to newly-defined tokens across all modules; component migrations would require a separate audit pass.

### R7 — Focus ring removal is a wide-scope accessibility regression

Every interactive element in all three modules suppresses the native focus ring via `outline: none` with no CSS replacement. Fixing this requires touching every input, button, and interactive div — hundreds of instances. The shared constants files (Phase 3) provide the leverage point to fix this in one place for buttons and inputs, but custom interactive elements (palette tiles, canvas nodes, tab strips, status bar segments) need individual fixes. A full accessibility pass scoped to just focus states may be warranted as a standalone workstream.

### R8 — Audit detail limitations in specific areas

The audit did not include source-level review of:
- `CategoryShapeWizard.tsx`, `ShapeDropDialog.tsx`, `RecognitionWizard.tsx`, `IographicImportWizard.tsx` (Designer) — only top-level structural facts were captured; step indicator patterns were noted as inconsistent but not enumerated
- Camera streams and supplemental connectors (Settings) — flagged for `window.confirm()` calls only
- Report scheduling, SMS providers, EULA admin (Settings) — referenced in the reconciliation log as using `--io-modal-backdrop` correctly; not fully audited

These gaps mean the "consistent deviations" counts may understate actual scope.
