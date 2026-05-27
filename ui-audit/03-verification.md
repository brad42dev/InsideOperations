# UI Audit Verification — Code-Level Fact-Check

**Source verified against:** live frontend source code only. No design docs or audit files consulted.
**Date:** 2026-05-27

---

## Verification Method

Every claim in the 11 category tables (5 rows each × 11 categories = 55 table rows) and 3 lists (12 + 12 + 7 = 31 items) was checked by reading the cited source files. Source of truth is the code. Comparison file (`02-comparison.md`) is not amended.

---

## Table of Results

### Category 1 — Color Palette and Theme Tokens

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| All | Cat 1 | Implementation | "all colors via CSS custom properties from `index.css`; no module-specific token overrides" | YES | — |
| All | Cat 1 | Source-of-truth files | "`index.css:19–295` (138 tokens)" | YES | The comment in index.css itself states 138 tokens; the range 19–295 reaches through the light-theme pen colors, which is correct for Console. Designer/Settings ranges (19–219 and 17–219) correspond to the dark-theme block end and the block opening comment; minor variation but not wrong. |
| All | Cat 1 | Visual properties | "~20 token references; hardcoded hex for alarm priority/quality badge colors, TrendPane series palette, published dot" | YES | Confirmed: `#10b981` published dot in console/index.tsx:2034; PRIORITY_COLOR hardcoded in AlarmListPane.tsx:34-35; QualityBadge hardcoded in PointTablePane.tsx:30-34. |
| Designer | Cat 1 | Notes | "SCOPE_COLORS/MODE_COLORS are **fully hardcoded** rgba objects with no registry equivalent" | **NO** | `SCOPE_COLORS.console.text = "var(--io-accent)"` (DesignerGraphicsList.tsx:48) and `MODE_COLORS.report.text = "var(--io-text-secondary)"` (line 55). Two of the six entries use registered tokens. Not "fully hardcoded." |
| All | Cat 1 | Deviations | "`var(--io-bg)` and `var(--io-text)` referenced but not defined in `index.css`" | YES | Confirmed: neither `--io-bg` nor bare `--io-text` appears in index.css. Both are genuinely undefined. |

### Category 2 — Typography

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| All | Cat 2 | Implementation | "All three use inline-styles exclusively; no shared typography component exists across modules" | YES | — |
| All | Cat 2 | Visual properties | "Raw px integers 9–18px; `fontFamily: monospace`" | YES | Groups.tsx:197 `fontFamily: "monospace"` confirmed. |
| All | Cat 2 | Deviations | "Zero typography scale tokens used" | YES | No file in any of the three modules references `--io-text-4xl` through `--io-text-code-sm`. |

### Category 3 — Toolbars

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| Console | Cat 3 | Visual properties | "48px height; `background: var(--io-surface)`" | YES | console/index.tsx:1949-1951 confirmed. |
| Designer | Cat 3 | Visual properties | "DesignerToolbar 44px; mode/tab strips with 2px accent underline" | YES | DesignerToolbar.tsx:1162 `height: 44`; DesignerModeTabs.tsx:210 `height: 36`; DesignerTabBar.tsx:370 `height: 36`; DesignerStatusBar.tsx:178 `height: 28`. |
| Designer | Cat 3 | Notes | "Loading skeleton toolbar placeholder uses 40px height vs the actual 44px" | YES | designer/index.tsx:773 `height: 40` for skeleton toolbar row vs actual 44px. |
| Console | Cat 3 | Deviations | "Publish button rendered twice in right controls block (duplicate render)" | YES | console/index.tsx:2294-2325 and 2721-2752 both render the publish toggle button under `{canPublish && (...)`. |

### Category 4 — Menus

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| All | Cat 4 | Visual properties | "ContextMenu: `var(--io-alarm-urgent)` for danger items rather than `var(--io-danger)`" | YES | shared/components/ContextMenu.tsx:247 `? "var(--io-alarm-urgent)"` confirmed. |
| Designer | Cat 4 | Notes | "File menu has no Escape key handler" | YES | No `Escape`/`keydown`/`onKeyDown` handler found in DesignerModeTabs.tsx File menu code. |
| Designer | Cat 4 | Deviations | "zoom dropdown hover uses `var(--io-surface-hover)` (undefined token)" | YES | DesignerToolbar.tsx:1459 `e.currentTarget.style.background = "var(--io-surface-hover)"` confirmed. `--io-surface-hover` not in index.css. |
| Designer | Cat 4 | Deviations | "zoom font uses `var(--io-font-sans)` (undefined)" | YES | DesignerToolbar.tsx:1456 `fontFamily: "var(--io-font-sans)"` confirmed. Not in index.css. |

### Category 5 — Side Panels

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| Console | Cat 5 | Visual properties | "220px; `background: var(--io-surface-secondary)`" | YES | ConsolePalette.tsx uses `width: "220px"` style. |
| Settings | Cat 5 | Visual properties | "220px; `background: var(--io-surface-secondary)`" | YES | settings/index.tsx:182 `width: "220px"` confirmed. |
| All | Cat 5 | Deviations | "220px vs `--io-sidebar-width: 240px`" | YES | `--io-sidebar-width: 240px` at index.css:106; all three modules use hardcoded 220px. |
| Settings | Cat 5 | Deviations | "active left-border accent missing" | YES | No `borderLeft`, `--io-sidebar-active-border`, or `2px solid var(--io-accent)` found in settings/index.tsx nav items. |

### Category 6 — Buttons

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| All | Cat 6 | Shared | "none use the 6 `--io-btn-*` tokens" | YES | `--io-btn-bg`, `--io-btn-hover`, etc. appear nowhere in console, designer, or settings page files. |
| Settings | Cat 6 | Visual properties | "`btnPrimary`: `var(--io-accent)`, `var(--io-text-on-accent)` (undefined)" | YES | settingsStyles.ts:22-31 confirmed. `--io-text-on-accent` not in index.css. |
| Settings | Cat 6 | Notes | "`BulkUpdate.tsx` defines its own full button set (`BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER`) independently from `settingsStyles`" | YES | BulkUpdate.tsx:33-63 confirmed. Uses `borderRadius: "6px"` string instead of `var(--io-radius)`. |

### Category 7 — Form Inputs

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| All | Cat 7 | Shared | "All suppress the native browser focus ring (`outline: none`) without a CSS replacement" | YES | ConsolePalette, PaneConfigModal, DesignerRightPanel, settingsStyles.ts all have `outline: "none"`. |
| All | Cat 7 | Shared | "none use the 5 `--io-input-*` tokens" | **NO** | ShapePointSelector.tsx:366-367 uses `var(--io-input-bg)` and `var(--io-input-border)` — but see next row for correction on "unregistered" claim. |
| Settings | Cat 7 | Visual properties | "`labelStyle`: 12px/500/`--io-text-secondary`/uppercase/0.05em" | **NO** | settingsStyles.ts:15-21: `labelStyle` has `fontSize: "12px"`, `fontWeight: 500`, `color: "var(--io-text-secondary)"`, `marginBottom: "5px"`. **No `textTransform: "uppercase"` and no `letterSpacing`**. Cat 9 for Settings correctly says "(no uppercase)"; Cat 7 is wrong. |
| Designer | Cat 7 | Deviations | "`--io-input-bg` and `--io-input-border` in `ShapePointSelector` appear to be unregistered" | **NO** | Both tokens ARE registered: `--io-input-bg: var(--io-surface-sunken)` at index.css:131 and `--io-input-border: var(--io-border)` at index.css:132. ShapePointSelector.tsx:366-367 uses them both. Not unregistered. |
| Settings | Cat 7 | Deviations | "`--io-space-*` tokens in `BulkUpdate`/`RestorePreviewModal` appear unregistered" | **NO** | `--io-space-0` through `--io-space-48` are defined in index.css:148-164 (17 tokens). Not unregistered. |
| All | Cat 7 | Shared | "none use the 5 `--io-input-*` tokens" | **NO** | Specifically `--io-input-bg` and `--io-input-border` ARE used in ShapePointSelector.tsx. Claim should read "Console and most of Settings use none; Designer's ShapePointSelector uses `--io-input-bg` and `--io-input-border`." |

### Category 8 — Status Indicators

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| Console | Cat 8 | Visual properties | "Connection dot: 6×6px circle, `var(--io-success)`/`var(--io-warning)`/`var(--io-danger)`" | YES | console/index.tsx:76-84 confirmed. |
| Designer | Cat 8 | Visual properties | "WS dot: `●` glyph 8px, `#22c55e`/`#ef4444` hardcoded" | YES | DesignerStatusBar.tsx:208-213 `color: wsConnected ? "#22c55e" : "#ef4444"` at fontSize 8 with `●`. |
| Designer | Cat 8 | Visual properties | "dirty indicator: 7×7px div, `#f97316` hardcoded" | YES | DesignerToolbar.tsx:1585-1596 `width: 7, height: 7, background: "#f97316"`. |
| Designer | Cat 8 | Visual properties | "READ-ONLY badge: `#eab308`/`rgba(234,179,8,*)` hardcoded" | YES | DesignerToolbar.tsx:1600-1614 `background: "rgba(234,179,8,0.15)"`, `color: "#eab308"`. |
| Designer | Cat 8 | Visual properties | "modified tab dot: `var(--io-warning, #f59e0b)` — only token-using indicator" | YES | DesignerTabBar.tsx:185 `color: "var(--io-warning, #f59e0b)"` confirmed. |
| Designer | Cat 8 | Notes | "TEST MODE injects a new `<style>` element on every render cycle" | YES (partial) | DesignerStatusBar.tsx:316 injects `<style>` as JSX when `testMode` is true. React reconciliation re-uses the same DOM element on re-renders (not truly "new on every render"), but the `<style>` tag does exist inline in JSX and is created fresh on mount. Performance concern is valid; "every render" overstates it. |
| Settings | Cat 8 | Deviations | "`--io-info` undefined in `AuthProviders TypeBadge` (always fallback blue `#3b82f6`)" | **NO** | `--io-info` IS defined in index.css:72 as `#3b82f6`. AuthProviders.tsx:528 uses `"var(--io-info, #3b82f6)"` with a fallback that equals the token value. Token resolves correctly — not an undefined token. |
| All | Cat 8 | Deviations | "hardcoded `#22c55e` for connection dot glow shadows" | YES | Confirmed in OpcSources and SystemHealth. |
| Settings | Cat 8 | Visual properties | "`OpcSources StatusBadge`: hex-alpha concat bug (broken background)" | YES | OpcSources.tsx:157-168: `STATUS_COLORS` maps statuses to CSS variables (e.g., `"var(--io-success)"`). `background: \`${color}20\`` produces `"var(--io-success)20"` — invalid CSS. Bug confirmed. |

### Category 9 — Labels and Headers

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| Designer | Cat 9 | Notes | "`FieldLabel` is consistently applied throughout `DesignerRightPanel`; semantically correct (`<label>` element)" | YES | DesignerRightPanel.tsx:201-203: `function FieldLabel` returns `<label>` element. Used at lines 240, 513, 542, 1837, 2274, 2301, 2366. |
| Settings | Cat 9 | Visual properties | "field label: 12px/500/`--io-text-secondary` (no uppercase)" | YES | Correct and consistent with actual settingsStyles.ts:15-21. This row in Cat 9 is accurate where Cat 7 is wrong. |

### Category 10 — Canvas / Main Work Area

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| Designer | Cat 10 | Source-of-truth | "`DesignerCanvas.tsx:7452–12067`" | YES | DesignerCanvas.tsx is 12,067 lines; line 7452 is the return statement of the main component. |
| Designer | Cat 10 | Visual properties | "Container: `background: var(--io-surface-sunken)` (outside canvas bounds)" | YES | DesignerCanvas.tsx:7473 confirmed. |
| Designer | Cat 10 | Visual properties | "canvas background `<rect>`: live from `doc.canvas.backgroundColor` or `var(--io-surface-primary)` fallback" | YES | DesignerCanvas.tsx:7287 `const bgColor = doc?.canvas.backgroundColor ?? "var(--io-surface-primary)"` confirmed. |
| Designer | Cat 10 | Deviations | "selection resize handles `fill: 'white'` not token-adaptive" | YES | DesignerCanvas.tsx:1599, 1955, 2012, 2345 all show `fill="white"`. |
| Designer | Cat 10 | Deviations | "`--io-error` (context menu destructive item) is undefined — correct token is `--io-danger`" | YES | `--io-error` not in index.css. DesignerCanvas.tsx:8075, 10322 use `"var(--io-error, #ef4444)"` with fallback. |
| Designer | Cat 10 | Notes | "`io-multiselect-active` class is added to SVG but has no observable CSS rule" | **NO** | index.css:904-909 defines `svg.io-multiselect-active [data-node-id].io-selected { filter: drop-shadow(...) }`. The class DOES have a CSS rule. |
| Console | Cat 10 | Visual properties | "grid container background inherits `var(--io-bg)` (undefined token)" | YES | console/index.tsx:1878, 1938 use `background: "var(--io-bg)"`. Not in index.css. |

### Category 11 — Modals and Dialogs

| Module | Category | Field | Claim as stated | Verified | Correction |
|---|---|---|---|---|---|
| Console | Cat 11 | Visual properties | "Inline modal backdrop: `rgba(0,0,0,0.5)`; z-index 9999; `PaneConfigModal` z-index 1001; Replace Graphic z-index 4000, `rgba(0,0,0,0.6)`" | YES | console/index.tsx:3465-3469 `rgba(0,0,0,0.5)` + zIndex 9999; PaneConfigModal.tsx:228 zIndex 1001; PaneWrapper.tsx:966-967 zIndex 4000 + `rgba(0,0,0,0.6)`. |
| Console | Cat 11 | Deviations | "3 inline modals lack `role='dialog'`/`aria-modal`" | YES | No `role="dialog"` or `aria-modal` in console/index.tsx inline modals. |
| Designer | Cat 11 | Deviations | "only `RecognitionWizard` has `role='dialog'`/`aria-modal`" | YES | RecognitionWizard.tsx:110-111 confirmed; no ARIA found in other designer dialog files checked. |
| Settings | Cat 11 | Visual properties | "Five distinct overlay specs: `var(--io-modal-backdrop)` (undefined), `var(--io-overlay, rgba(0,0,0,0.5))`…" | **NO** | `--io-modal-backdrop` IS defined in index.css:139 as `var(--io-surface-overlay)`. Calling it "undefined" is incorrect. Email.tsx, RestorePreviewModal.tsx, and others correctly use a defined token. `--io-overlay` IS undefined (not in index.css) and has its fallback applied. |
| Settings | Cat 11 | Deviations | "4 native `window.confirm()` calls" | **NO** | Actual count: **8 calls** — OpcSources.tsx (3 calls: lines 585, 2947, 3009), Import.tsx (3 calls: lines 846, 907, 2722), CameraStreams.tsx (1 call: line 1004), SupplementalConnectorsTab.tsx (1 call: line 584). |
| Settings | Cat 11 | Notes | "`RestorePreviewModal` is the most urgent accessibility gap (destructive path, no ARIA)" | YES | RestorePreviewModal.tsx has no `role="dialog"` or `aria-modal`. Confirmed. |

### List 1 — Elements already consistent across all three modules

| # | Claim | Verified | Correction |
|---|---|---|---|
| 1 | "All three modules draw colors exclusively from the `index.css` CSS custom property registry." | YES | — |
| 2 | "All three use raw pixel integer literals in inline styles. None reference the 16 typography scale tokens." | YES | — |
| 3 | "All three use `shared/components/ContextMenu` as the sole or primary right-click context menu." | YES | — |
| 4 | "All three use `var(--io-accent)` as the background of primary action buttons." | YES | — |
| 5 | "All three use `1px solid var(--io-border)` as the border for secondary/outline button variants." | YES | — |
| 6 | "All three modules ignore the six `--io-btn-*` tokens." | YES | — |
| 7 | "All three modules ignore the five `--io-input-*` tokens." | **NO** | ShapePointSelector.tsx (Designer) uses `--io-input-bg` and `--io-input-border`. Should read "Console and Settings ignore all `--io-input-*` tokens; Designer's ShapePointSelector uses two of them." |
| 8 | "All three suppress the native browser focus ring (`outline: none`) without a CSS replacement." | YES | — |
| 9 | "All three use `onMouseEnter`/`onMouseLeave` direct DOM style mutation for at least some hover states." | YES | — |
| 10 | "All three represent connection state with 6–8px circular dots using `var(--io-success)` for connected and `var(--io-danger)` for error." | YES | — |
| 11 | "All three ignore `--io-modal-bg`, `--io-modal-backdrop`, and `--io-modal-radius`." | **NO** | `--io-modal-backdrop` is used in Email.tsx, RestorePreviewModal.tsx, Recognition.tsx, ReportScheduling.tsx, SmsProviders.tsx, and EulaAdmin.tsx. `--io-modal-backdrop` IS defined (index.css:139) and IS used. The claim is wrong on both counts: it's neither ignored nor undefined. |
| 12 | "All three hardcode the text color on accent-background buttons." | YES | — |

### List 2 — Elements that are inconsistent across modules

| # | Claim | Verified | Correction |
|---|---|---|---|
| 1 | Side panel background: Console/Settings `var(--io-surface-secondary)`; Designer left palette `var(--io-surface)`. | YES | — |
| 2 | Modal backdrop inconsistency across modules. | YES | — |
| 3 | Form input background: three different surface tiers across modules. | YES | — |
| 4 | Section/field label typography: three different size/weight/transform combinations. | YES | — |
| 5 | StatusBadge: five incompatible implementations in Settings. | YES | — |
| 6 | Modal ARIA gaps differ per module. | YES | — |
| 7 | "All three reference undefined tokens but entirely different ones… Settings references `--io-text-on-accent`, `--io-modal-backdrop`, `--io-overlay`, `--io-info`, `--io-space-*`, `--io-accent-rgb`, `--io-surface`" | **NO** | Four of the seven tokens listed for Settings ARE defined: `--io-modal-backdrop` (index.css:139), `--io-info` (index.css:72), `--io-space-*` (index.css:148-164), and `--io-surface` (index.css:29). Only three are genuinely undefined: `--io-text-on-accent`, `--io-overlay`, and `--io-accent-rgb`. |
| 8 | Button hover state differences across modules. | YES | — |
| 9 | Toolbar structure differences. | YES | — |
| 10 | Menu pattern consistency: Settings uses only shared ContextMenu; others add custom panels. | YES | — |
| 11 | Modal z-index values all uncoordinated. | YES | — |
| 12 | Semantic heading elements used inconsistently. | YES | — |

### List 3 — Best version for convergence

| # | Claim | Verified | Correction |
|---|---|---|---|
| 1 | Form input centralization — `settingsStyles.ts`. | YES | — |
| 2 | StatusBadge — `Import.tsx` token-pair pattern. | YES | — |
| 3 | Button system naming — `settingsStyles.ts`. | YES | — |
| 4 | Page-level label structure — `SettingsPageLayout.tsx`. | YES | — |
| 5 | Menu implementation discipline — Settings uses only shared ContextMenu. | YES | — |
| 6 | Form label primitives — Designer `FieldLabel` component. | YES | — |
| 7 | Destructive confirmation pattern — Settings `ConfirmDialog` usage. | YES | — |

---

## Discrepancy Summary

11 discrepancies found in the comparison file. Each is a claim that the code contradicts:

1. **Cat 1 Notes (Designer)** — SCOPE_COLORS/MODE_COLORS: claimed "fully hardcoded" but two entries reference `var(--io-accent)` and `var(--io-text-secondary)`. (`DesignerGraphicsList.tsx:48,55`)

2. **Cat 7 Visual Properties (Settings)** — `labelStyle`: claimed "uppercase/0.05em" but actual code has neither `textTransform: "uppercase"` nor `letterSpacing`. (`settingsStyles.ts:15-21`)

3. **Cat 7 Deviations (Designer)** — `--io-input-bg` and `--io-input-border` in ShapePointSelector: claimed "appear to be unregistered." Both ARE registered in index.css (lines 131-132). (`ShapePointSelector.tsx:366-367`)

4. **Cat 7 Deviations (Settings)** — `--io-space-*`: claimed "appear unregistered." Seventeen `--io-space-*` tokens ARE defined in index.css:148-164.

5. **Cat 8 Deviations (Settings)** — `--io-info` in AuthProviders TypeBadge: claimed "undefined." `--io-info: #3b82f6` IS defined in index.css:72. Fallback value equals token value; no regression exists. (`AuthProviders.tsx:528`)

6. **Cat 10 Notes (Designer)** — `io-multiselect-active`: claimed "no observable CSS rule." Rule exists at index.css:904-909 (`svg.io-multiselect-active [data-node-id].io-selected { filter: drop-shadow(…) }`).

7. **Cat 11 Deviations (Settings)** — native confirm() count: claimed "4 calls." Actual count is **8 calls** across 4 files: OpcSources(3), Import(3), CameraStreams(1), SupplementalConnectorsTab(1).

8. **Cat 11 Visual Properties (Settings)** / **List 2 Item 7** — `--io-modal-backdrop`: claimed "undefined." `--io-modal-backdrop: var(--io-surface-overlay)` IS defined in index.css:139 and used in ≥6 Settings files.

9. **List 2 Item 7 (Settings)** — `--io-info`: claimed undefined. IS defined (see #5 above).

10. **List 2 Item 7 (Settings)** — `--io-space-*`: claimed undefined. IS defined (see #4 above).

11. **List 2 Item 7 (Settings)** — `--io-surface`: claimed undefined. `--io-surface: var(--io-surface-elevated)` IS defined in index.css:29.

---

## Missing-from-Comparison Entries

4 elements exist in code but have no entry in the comparison:

1. **`shared/clipboard/selection/selection.css` + `MarqueeLayer.tsx`** — Both reference `var(--accent)` (without the `--io-` prefix), a token not defined anywhere in the codebase. `selection.css` lines 2 and 9 use it for selection box outline (`2px solid var(--accent)`) and glow (`box-shadow: … var(--accent)`). `MarqueeLayer.tsx:101` uses `border: "1px dashed var(--accent)"`. With no definition, all three resolve to the CSS initial value, meaning selection highlight and marquee border have no visible color. Should be `var(--io-accent)`.

2. **`shared/graphics/alarmFlash.css`** — CSS keyframe animations for alarm flash states (`io-alarm-flash-urgent`, `io-alarm-flash-high`, etc.) use hardcoded hex colors: `#ef4444`, `#f97316`, `#eab308`, `#f4f4f5`, `#60a5fa` rather than `--io-alarm-*` tokens. These animations apply to display elements in the graphics canvas but do not adapt to light or HPHMI themes. The comparison covers alarm badge colors in Cat 1 and 8 but does not mention this file.

3. **`shared/graphics/operationalState.css`** — ISA-101 equipment operational state CSS classes (`io-running`, `io-stopped`, `io-fault`, `io-transitioning`, `io-oos`) apply hardcoded hex fills and strokes (`#047857`, `#808080`, `#dc2626`, `#d97706`) to SVG elements via `!important` overrides. No token system used. Not mentioned in the comparison under any category.

4. **`shared/graphics/lod.css`** — Level-of-detail visibility rules for graphics elements. Structural CSS only (opacity transitions, `display: none` for non-adjacent LOD levels). No color tokens used. Not mentioned in the comparison; relevant to Canvas / Main Work Area (Cat 10) as a separate style layer governing display element visibility.

---

## Totals

- **Rows checked:** 86 (55 table rows + 31 list items)
- **Discrepancies found:** 11
- **Missing-from-comparison entries:** 4
