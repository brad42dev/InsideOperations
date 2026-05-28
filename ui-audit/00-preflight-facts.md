# Preflight Facts — Workstream 5 (Claim C) Pre-Work Investigation

**Date:** 2026-05-28  
**Method:** Read-only. No code or artifact files modified.  
**Sources:** `frontend/src/index.css`, `frontend/src/pages/designer/DesignerCanvas.tsx`, `frontend/src/pages/console/WorkspaceGrid.tsx`, `frontend/src/pages/designer/index.tsx`, `frontend/src/shared/theme/ThemeContext.tsx`, `frontend/src/pages/profile/PreferencesTab.tsx`, `frontend/src/pages/settings/{PointManagement,Import}.tsx`, `frontend/src/shared/components/StatusBadge.tsx`, git status.

---

## Section 1 — Theme Status

**Finding: Light and HPHMI themes are LIVE — fully implemented with distinct values and a working UI switcher.**

### CSS blocks

All three theme blocks exist in `frontend/src/index.css` with real, non-placeholder values:

| Selector | Lines | Status |
|----------|-------|--------|
| `:root, [data-theme="dark"]` | 21–232 | Full — dark zinc palette |
| `[data-theme="light"]` | 235–437 | Full — real light values (white/gray surfaces, dark text) |
| `[data-theme="hphmi"]` | 440–642 | Full — ISA-101 dark blue-gray palette |

Sample evidence that light/HPHMI are not copies of dark:

| Token | dark | light | hphmi |
|-------|------|-------|-------|
| `--io-surface-primary` | `#09090b` | `#ffffff` | `#0f172a` |
| `--io-text-primary` | `#f9fafb` | `#111827` | `#e2e8f0` |
| `--io-accent` | `#2dd4bf` | `#0d9488` | `#14b8a6` |
| `--io-border` | `#3f3f46` | `#e5e7eb` | `#475569` |

### Theme switcher in the UI

`frontend/src/pages/profile/PreferencesTab.tsx` lines 138–158 renders three buttons labeled "Dark", "Light", "HPHMI" (exact button text not extracted, but the active/click logic is: `active={theme === "dark"/"light"/"hphmi"}`, `onClick={() => applyTheme("dark"/"light"/"hphmi")}`). The function `applyTheme()` calls `setTheme(t)` from `shared/theme/tokens` which writes `data-theme` to the document root.

`ThemeContext.tsx` exposes `useSetTheme()` for programmatic switching. The switcher is in the user Preferences tab (Settings → Profile or similar entry point).

**State: LIVE. All three themes have real values and are user-selectable via Preferences.**

---

## Section 2 — DesignerCanvas Z-Index Inventory

**Finding: ConfirmDialog-at-1000 stacking concern is real. All 19 z-index values in DesignerCanvas are hardcoded integers; zero use var(--io-z-*) tokens.**

### Full inventory

| Line | Value | Element description |
|------|-------|---------------------|
| 332 | **2000** | Fixed full-screen modal backdrop (position:fixed, inset:0, rgba(0,0,0,0.5)) |
| 3750 | **9999** | Drag-cursor overlay (position:fixed, pointer-events:none, inline style string) |
| 7689 | **-1** | SVG guide/grid line (pointerEvents=none) |
| 7994 | **10** | Canvas container overlay div |
| 8038 | **1000** | Canvas-internal overlay/badge (fontSize:12, overflow:hidden) |
| 8222 | **10** | Element tooltip (padding, boxShadow, whiteSpace:nowrap) |
| 8302 | **15** | Selection highlight overlay (inset:0, pointerEvents:none) |
| 8377 | **20** | Inline text editor (overflow:hidden, whiteSpace:pre) |
| 8621 | **1200** | Fixed full-screen dialog backdrop (rgba(0,0,0,0.55)) |
| 8928 | **3000** | Point picker full-screen overlay (cursor:crosshair) |
| 9426 | **2000** | Slot assignment popover (var(--io-surface-elevated) bg) |
| 9605 | **2000** | Canvas bottom status/toolbar overlay (transform:translateX(-50%)) |
| 9792 | **10** | Ruler bar (top) |
| 9814 | **10** | Ruler bar (left) |
| 9837 | **11** | Ruler corner tile (above rulers) |
| 9863 | **9** | Vertical guide line drag handle |
| 9876 | **9** | Horizontal guide line drag handle |
| 9917 | **1000** | Tooltip/inline overlay (fontSize:12, overflow:hidden) |
| 10271 | **1000** | Tooltip/inline overlay (fontSize:12, overflow:hidden) |

### Distribution summary

| Range | Count | Values |
|-------|-------|--------|
| Negative | 1 | -1 |
| 1–99 | 9 | 9, 9, 10, 10, 10, 10, 11, 15, 20 |
| 100–999 | 0 | — |
| 1000+ | 9 | 1000, 1000, 1000, 1200, 2000, 2000, 2000, 3000, 9999 |
| Using `var(--io-z-*)` tokens | **0** | all hardcoded integers |

### Stacking concern assessment

`--io-z-modal = 1000`. Three separate elements inside DesignerCanvas are also at z=1000 (lines 8038, 9917, 10271 — all appear to be inline tooltip/badge overlays). If ConfirmDialog renders as a page-level portal, its z=1000 backdrop competes with these elements depending on stacking context. Additionally, DesignerCanvas has an internal fixed dialog backdrop at z=1200 (line 8621) and a full-screen overlay at z=3000 (line 8928) that would render above a ConfirmDialog at z=1000 if the dialog were triggered during those states. **The z-index audit required for Claim C is real work, not a precaution.**

---

## Section 3 — Alarm Token Existence

**Finding: All six tokens are defined in all three themes. --io-alarm-inactive is identical across all themes (intentional neutral gray). No placeholders or missing definitions.**

### Values per theme

| Token | dark (line) | light (line) | hphmi (line) | Notes |
|-------|-------------|--------------|--------------|-------|
| `--io-alarm-urgent` | `#ef4444` (58) | `#dc2626` (271) | `#ef4444` (476) | Light slightly darker |
| `--io-alarm-high` | `#f97316` (59) | `#d97706` (272) | `#f59e0b` (477) | All three differ |
| `--io-alarm-low` | `#eab308` (60) | `#ca8a04` (273) | `#eab308` (478) | Dark=HPHMI; light darker |
| `--io-alarm-diagnostic` | `#f4f4f5` (61) | `#0891b2` (274) | `#06b6d4` (479) | **Largest spread** — dark=near-white, light/hphmi=cyan |
| `--io-alarm-custom` | `#60a5fa` (62) | `#6d28d9` (275) | `#7c3aed` (480) | All three differ |
| `--io-alarm-inactive` | `#808080` (74) | `#808080` (287) | `#808080` (492) | **Identical** across all themes |

### Flags

- **`--io-alarm-inactive` identical in all themes**: `#808080` everywhere. This is likely intentional — it represents a neutral "not alarming" state where a theme-neutral gray is semantically correct. No placeholder behavior.
- **`--io-alarm-diagnostic`**: spans near-white (dark) to cyan (light/HPHMI). This is real ISA-101 behavior — diagnostic category is low-contrast in dark (subtle), uses a colored indicator in light. Not a gap.
- No tokens are missing. No token has the same value across all three themes except `--io-alarm-inactive` and a few that coincidentally share values.

---

## Section 4 — React-Grid-Layout Portal Context

**Finding: DesignerCanvas does NOT render inside a react-grid-layout context. The position:fixed portal concern does not apply to DesignerCanvas. It applies only to components inside WorkspaceGrid panes (Console).**

### Evidence

**WorkspaceGrid uses react-grid-layout:**  
`frontend/src/pages/console/WorkspaceGrid.tsx:9` — `import { GridLayout, noCompactor, type LayoutItem } from "react-grid-layout"`.  
WorkspaceGrid is the Console pane container; all Console panes (including GraphicPane) render inside a GridLayout transform.

**DesignerCanvas component tree:**  
`frontend/src/pages/designer/index.tsx:47` — imports DesignerCanvas.  
`frontend/src/pages/designer/index.tsx:3428` — renders `<DesignerCanvas ... />` directly inside a flex layout.  
`frontend/src/pages/designer/index.tsx` — does NOT import or use react-grid-layout at any line (search returned zero results).

The Designer page is a plain flex-column/flex-row layout: `[TopBar] [LeftPalette | DesignerCanvas | RightPanel]`. No GridLayout ancestor. No CSS transform wrapping DesignerCanvas.

**Implication for Claim C:**  
`position: fixed` dialogs inside DesignerCanvas will render correctly relative to the viewport (no transform breaks them). This means `Dialog.tsx` (which uses `position: fixed`) can be used for `SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard` without a portal — but those dialogs are also instantiated from canvas interactions, so a portal to `document.body` remains defensible for cleanliness. The CLAUDE.md invariant is not triggered by DesignerCanvas itself.

---

## Section 5 — Git and Commit Workflow

**Finding: Git is fully operational on branch `main`. No source code uncommitted changes. Only .claude/ internal files are dirty. `git diff HEAD` will show no source diffs.**

| Check | Result |
|-------|--------|
| `git rev-parse` succeeds | Yes — valid repo |
| Current branch | `main` |
| Uncommitted source changes | None |
| Uncommitted other files | `.claude/logs/`, `.claude/state/`, `.claude/archive/` only (harness-internal) |

Review hooks that compare against `git diff HEAD` will see a clean working tree for all source files. Any review of Claim C work will correctly scope to only Claim C changes.

---

## Section 6 — Surface-Tertiary Evidence

**Finding: `--io-surface-tertiary` is NOT defined in `index.css`. It has 4 active call sites that will silently produce no background (CSS `initial`/transparent). There is genuine distinct-tier need in at least two contexts.**

### Reference inventory

| File | Line | Context | Semantic use |
|------|------|---------|--------------|
| `PointManagement.tsx` | 131 | `CRITICALITY_COLORS["informational"].bg` | Muted badge for "informational" criticality level |
| `Import.tsx` | 3856 | Transform params sub-panel background | Nested form section background |
| `Import.tsx` | 3955 | Sample value preview box background | Code/value preview with border |
| `Import.tsx` | 4389 | Toggle button disabled/off-state background | Inactive toggle track |
| `StatusBadge.tsx` | 29 | Comment only — fallback uses `--io-surface-secondary` | "muted/neutral — --io-surface-tertiary is undefined" |

### Is there a distinct-tier need?

The four active uses share a common semantic: a **muted, inert, or disabled background** that is visually below `--io-surface-secondary` (which is the standard panel/card background). Concretely:

- `PointManagement.tsx:131`: The four criticality levels use danger-subtle, success-subtle, warning-subtle, and *informational* — the informational case needs a neutral muted background without the semantic color subtlety. `--io-surface-secondary` (#f9fafb in light) would work but is also the page/panel background, which might not read as visually distinct.
- `Import.tsx:3955`: A monospace value preview box that is supposed to look "sunken" or distinct from the containing panel. `--io-surface-sunken` (#f3f4f6 in light) may actually be the correct existing token here.
- `Import.tsx:4389`: A toggle track in the off/disabled state. `--io-surface-secondary` or `--io-surface-sunken` could fill this role.

**Assessment:** The need is genuine but `--io-surface-sunken` already exists as a step below `--io-surface-secondary` (it is used for inputs and table headers). The question is whether these callers need `--io-surface-sunken` (which they don't use) or a new `--io-surface-tertiary`. The four callers could likely be resolved by replacing `--io-surface-tertiary` with `--io-surface-secondary` or `--io-surface-sunken` without registering a new token. Registering `--io-surface-tertiary` would be redundant if `--io-surface-sunken` already occupies that tier.

---

## One-Line Summary Per Section

1. **Theme status** — Light and HPHMI are live with real distinct values and a working UI switcher in `PreferencesTab.tsx:145–158`. `frontend/src/index.css:235–642`
2. **DesignerCanvas z-index** — 19 hardcoded integers (0 tokens); 10 below 100, 0 in 100–999, 9 at 1000+; three elements at 1000 make the ConfirmDialog stacking concern real. `frontend/src/pages/designer/DesignerCanvas.tsx:332–10271`
3. **Alarm tokens** — All 6 tokens present in all 3 themes; `--io-alarm-inactive` is #808080 in all themes (intentional); `--io-alarm-diagnostic` has the largest spread (near-white → cyan). `frontend/src/index.css:57–74,271–287,476–492`
4. **DesignerCanvas portal context** — DesignerCanvas has NO react-grid-layout ancestor; position:fixed works correctly; the CLAUDE.md invariant applies to WorkspaceGrid panes, not DesignerCanvas. `frontend/src/pages/console/WorkspaceGrid.tsx:9`, `frontend/src/pages/designer/index.tsx:3428`
5. **Git workflow** — Repo on branch `main`, no source-code uncommitted changes; `git diff HEAD` is clean for all source files.
6. **surface-tertiary** — Token undefined in `index.css`; 4 active call sites silently get no background; genuine muted-tier need exists but `--io-surface-sunken` may already cover it; new token registration likely redundant. `frontend/src/pages/settings/{PointManagement.tsx:131,Import.tsx:3856,3955,4389}`, `frontend/src/shared/components/StatusBadge.tsx:29`
