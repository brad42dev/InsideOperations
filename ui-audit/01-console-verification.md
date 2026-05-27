# Console Audit Verification

Verified: 2026-05-27. All findings derived from direct code inspection. No markdown documentation consulted.

---

## Section 1: Scope Check

The audit plan flags three handling concerns. Each is evaluated below.

### 1a. Categories 1 and 2 — inheritance from app shell
**Handled correctly: YES**

Category 1 opens with "shared-component — all colors consumed via CSS custom properties defined in `frontend/src/index.css`. No Console-specific token overrides." Category 2 opens with "inline-styles — no Console-specific CSS classes or shared typography component. Font-family not overridden anywhere in Console; inherits system sans-serif from app shell." Both categories proceed to enumerate what Console actually does (specific deviations, hardcoded hex values) rather than treating missing tokens as gaps. This is the correct behavior.

### 1b. TrendPane chart UI and PaneConfigModal forms — delegation to shared components
**Handled correctly: YES**

Category 10 records TrendPane's implementation as "delegated to shared/components/charts/TimeSeriesChart and shared/components/charts/ChartRenderer" and only audits the `SERIES_COLORS` constant (lines 46–55 of `TrendPane.tsx`). No internals of `TimeSeriesChart`, `ChartRenderer`, or `ChartToolbar` appear in the audit. The source-of-truth files listed for category 10 do not include any files under `shared/components/charts/`. Category 7 correctly scopes PaneConfigModal form inputs without entering the `ChartConfigPanel` lazy-loaded from shared.

### 1c. Versioning dialogs — noted but not audited as Console scope
**Handled correctly: YES**

Category 11 lists `VersionRecoveryDialog` and `SaveConfirmDialog` with the explicit note "delegated to `shared/components/versioning/`; no Console-specific styles applied." Line references (`index.tsx:3407-3430` and `index.tsx:3418-3429`) are source-of-truth citations for where the dialogs are wired in, not audits of the shared components themselves. Confirmed against actual code: `VersionRecoveryDialog` at lines 3407–3415 and `SaveConfirmDialog` at lines 3418–3429 are indeed pure pass-throughs to shared components.

---

## Section 2: Completeness Check

All eleven categories are present in `01-console.md`.

| # | Category | Present |
|---|----------|---------|
| 1 | Color palette and theme tokens | YES |
| 2 | Typography | YES |
| 3 | Toolbars | YES |
| 4 | Menus | YES |
| 5 | Side panels | YES |
| 6 | Buttons | YES |
| 7 | Form inputs | YES |
| 8 | Status indicators | YES |
| 9 | Labels and headers | YES |
| 10 | Canvas / main work area | YES |
| 11 | Modals and dialogs | YES |

All categories that apply have substantive content. No category is improperly marked N/A.

Spot-check of "not existing" determinations: none of the eleven categories were marked as not existing in Console. Correct — Console does have concrete content in every category.

---

## Section 3: Claim Verification

### Category 5: Side panels

**Claims that hold up:**
- `PANEL_W = 220` hardcoded constant at `ConsolePalette.tsx:52` — confirmed.
- `var(--io-text)` undefined token used in section search input — confirmed (`index.css` has no `--io-text` top-level token, only `--io-text-primary`, `--io-text-secondary`, etc.).
- View mode selector hover and resize handle hover use `onMouseEnter`/`onMouseLeave` DOM mutation — confirmed at `ConsolePalette.tsx:233–248`.
- `borderRadius: 3` on view mode selector vs `var(--io-radius)` (6px) on list items — confirmed.
- `--io-sidebar-width: 240px` defined in `index.css:106`; palette uses 220px — confirmed.
- `PointsBrowserPanel` embedded in palette's Points section, noted as app-shell-owned — confirmed from imports and usage in `ConsolePalette.tsx`.

**Claims that do not hold up:**
- **WRONG — panel width not applied.** The audit states: "the `panelWidth` prop passed from `index.tsx` is not applied to the panel body. The panel width therefore does not resize when the user drags the resize handle."

  This is false. The `ConsolePalette` default export at line 2165 renders:
  ```jsx
  <div style={{ ...panel, width: panelWidth, minWidth: panelWidth, position: "relative", ... }}>
  ```
  The component spreads the module-level `panel` constant (which carries `PANEL_W = 220`) and then **overrides** `width` and `minWidth` with the `panelWidth` prop. The prop is received (line 2028), passed in from `index.tsx` (line 2872), and applied. The resize handle works. The module-level `PANEL_W` constant is only the fallback value in the style object — it is overridden in the actual JSX render. This is the most significant false claim in the audit.

**Missed:**
- The `panel` style constant at lines 54–64 (module scope) is distinct from the rendered component. The audit conflated the constant definition with the rendered output.

---

### Category 10: Canvas / main work area

**Claims that hold up:**
- Grid container: `flex: 1, overflow: hidden, position: relative, height: 100%, userSelect: none` — confirmed at `WorkspaceGrid.tsx:755–761`.
- `margin: [0,0], containerPadding: [0,0]` — confirmed at `WorkspaceGrid.tsx:776–779`.
- Pane visual padding via `.io-workspace-grid > .react-grid-item { padding: 2px }` — confirmed in `WorkspaceGrid.css:4–7`.
- N/NW/NE resize handle CSS overrides (`transform: none`, full-width N handle) — confirmed in `WorkspaceGrid.css:34–66`.
- Fullscreen portal: `position: absolute, inset: 0, zIndex: 500` — confirmed at `WorkspaceGrid.tsx:895`.
- Fullscreen enter/exit animation (200ms ease, scale 0.98) — confirmed in `WorkspaceGrid.css:9–29`.
- Portal uses `createPortal` into `containerRef.current` (grid container), not `document.body` — confirmed at `WorkspaceGrid.tsx:892`.
- `gridCompactor = { ...noCompactor, allowOverlap: true }` — confirmed at `WorkspaceGrid.tsx:45`.
- Pane card shell: `background: var(--io-surface), borderRadius: 4, contain: layout style paint` — confirmed at `PaneWrapper.tsx:352–368`.
- All six border states in priority order — confirmed at `PaneWrapper.tsx:354–366`.
- Thin drag strip: `height: 4, cursor: grab` — confirmed at `PaneWrapper.tsx:381`.
- Box selection marquee: `border: 1px solid var(--io-accent), background: var(--io-accent-subtle), pointerEvents: none, zIndex: 50` — confirmed at `WorkspaceGrid.tsx:1024–1027`.
- Ghost outline: `border: 2px dashed var(--io-accent), background: var(--io-accent-subtle), borderRadius: var(--io-radius), opacity: 0.75`, transition `left/top/width/height 60ms ease` — confirmed at `WorkspaceGrid.tsx:1001–1007`.
- `rowHeight: containerHeight / GRID_ROWS` (denominator 288) — confirmed at `WorkspaceGrid.tsx:238`.

**Claims that do not hold up:**
- **WRONG — column count.** The audit states: "RGL: cols: 144 (12 × GRID_SCALE=12)".

  Actual values from `layout-utils.ts`:
  ```ts
  export const GRID_SCALE = 24;       // not 12
  export const GRID_COLS = 12 * GRID_SCALE;  // = 288, not 144
  export const GRID_ROWS = 12 * GRID_SCALE;  // = 288
  ```
  The correct entry is: `cols: 288 (12 × GRID_SCALE=24)`. GRID_SCALE is 24, not 12. The 288 denominator used in the `rowHeight` formula is correctly stated; the 144 cols figure and the GRID_SCALE=12 factor are both wrong.

**Missed:**
- The Replace Graphic dialog in `PaneWrapper.tsx:962–987` uses `position: fixed` with `zIndex: 4000`. This dialog is rendered inside a PaneWrapper component which is a child of a `react-grid-layout` item — CSS transforms on RGL items break `position: fixed` (documented in `CLAUDE.md` and frontend invariants). The audit records the visual properties correctly but does not flag this as a functional deviation. This is not a visual property gap but is a pre-existing bug the audit should have noted.

---

### Category 11: Modals and dialogs

**Claims that hold up:**
- `borderRadius: 8` on all Console-owned modals vs `--io-modal-radius: var(--io-radius-lg)` = 9px — confirmed. `index.css:169` defines `--io-radius-lg: 9px` and `index.css:140` defines `--io-modal-radius: var(--io-radius-lg)`. All Console modal content boxes use `borderRadius: 8`.
- `background: var(--io-surface)` vs `--io-modal-bg: var(--io-surface-elevated)` — confirmed. `index.css:138` defines `--io-modal-bg: var(--io-surface-elevated)`. WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog, and PaneConfigModal all use `background: var(--io-surface)`. Replace Graphic dialog correctly uses `var(--io-surface-elevated)`.
- None of the 3 modal tokens referenced — confirmed.
- Z-index inconsistency: inline modals `9999`, PaneConfigModal `1001`, Replace Graphic `4000` vs `--io-z-modal: 300` — confirmed at `index.css:203` and in the modal code.
- Modal button `borderRadius: 4` — confirmed (`PaneWrapper.tsx`, `index.tsx` modal sections).
- `var(--io-text)` in dialog titles — confirmed. `index.tsx:3487` (WorkspaceNameModal): `color: "var(--io-text)"`. No `--io-text` top-level token in `index.css`.
- No ARIA semantics (no `aria-modal`, no `role="dialog"`) on inline modals — confirmed for WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog. PaneConfigModal uses Radix Dialog which provides ARIA.
- VersionRecoveryDialog and SaveConfirmDialog as shared: confirmed at `index.tsx:3407–3429`.

**Claims that hold up (line numbers):**
- WorkspaceNameModal at `index.tsx:3438` — confirmed (function definition starts at 3438).
- PaneConfigModal Radix overlay at `PaneConfigModal.tsx:210–219` — confirmed (`Dialog.Root` at 211, overlay at 213–219).
- Replace Graphic backdrop at `PaneWrapper.tsx:961–987` — confirmed.

**Nothing in category 11 was missed.** The audit correctly identified all five dialog types, their implementation patterns (inline JSX vs Radix), and the relevant deviations.

---

## Risk Flags

### Risk 1: Incursion into shared chart or versioning components
**Not observed.** The audit stays within Console-owned code throughout:
- Category 10 lists `TrendPane.tsx` only for its `SERIES_COLORS` constant, which is Console-owned. No `shared/components/charts/` file appears in any source-of-truth list.
- Category 11 delegates VersionRecoveryDialog and SaveConfirmDialog explicitly without auditing their internals.
- The only potential concern: ConsolePalette imports `MicroIcon` from `shared/components/charts/ChartTypePicker` (line 28), but this is an icon import, not a chart UI audit.

### Risk 2: Categories 1 and 2 treated as gaps vs inheritance
**Not observed.** Both categories open with explicit inheritance statements and proceed to enumerate deviations (hardcoded hex values, undefined tokens, raw pixel sizes) as items of record — not as missing implementations. No category 1 or 2 deviation is framed as "Console should add tokens" vs the correct "Console uses X instead of the token that exists."

---

## Final Counts

- **Scope issues:** 0
- **Missing categories:** 0
- **Claim discrepancies:** 2
  1. Category 5: Panel width is incorrectly claimed to ignore the `panelWidth` prop — the prop IS applied and overrides the constant.
  2. Category 10: GRID_COLS stated as 144 (GRID_SCALE=12) — actual value is 288 (GRID_SCALE=24).
