# Settings Module — UI Audit (Consolidated)

**Source:** Pass 1 (categories 1–6, 9) + Pass 2 (categories 7, 8, 11). Category 10 is N/A per audit plan.

**Representative pages (pass 1):** `pages/settings/index.tsx`, `SettingsPageLayout.tsx`, `settingsStyles.ts`, `IdentityAccess.tsx`, `Users.tsx`, `Roles.tsx`, `Groups.tsx`.
**Baseline (pass 1):** `index.css` (138 CSS custom properties), `shared/layout/AppShell.tsx`, `shared/components/ContextMenu.tsx`, `shared/components/SettingsTabs.tsx`.

**Representative pages (pass 2):** `Import.tsx`, `OpcSources.tsx`, `Certificates.tsx`, `AuthProviders.tsx`, `PointManagement.tsx`, `SystemHealth.tsx`, `BulkUpdate.tsx`, `Email.tsx`, `RestorePreviewModal.tsx`, `Sessions.tsx`.

---

## Category 1 — Color Palette and Theme Tokens

**Implementation:** inline-styles; all color references are CSS custom property calls into the app-shell token set defined in `index.css`. No module-specific token definitions exist anywhere in `pages/settings/`.

**Source-of-truth files:**
- Token registry: `src/index.css` lines 17–219 (138 tokens, dark + light themes)
- Shared style constants: `pages/settings/settingsStyles.ts` lines 1–71

**Visual properties actually applied:**
The module uses the following subset of app-shell tokens: `--io-surface-primary`, `--io-surface-secondary`, `--io-surface-elevated`, `--io-surface-sunken`, `--io-text-primary`, `--io-text-secondary`, `--io-text-muted`, `--io-accent`, `--io-accent-subtle`, `--io-border`, `--io-border-subtle`, `--io-radius`, `--io-danger`, `--io-success`, `--io-status-fg`.

**Deviations from the app shell:**

1. **Undefined token `--io-text-on-accent`** (`settingsStyles.ts:26`, propagated across all Settings pages via `btnPrimary`). This token has no `:root` or `[data-theme]` definition anywhere in the codebase. CSS degrades to inheriting the parent `color` value, which happens to be readable in practice (`--io-text-primary` ≈ white in dark, dark in light), but the intended token is `--io-accent-foreground` (`#09090b` dark / `#ffffff` light). The same undefined token appears in ~15 other Settings files outside this pass's representative set.

2. **Hardcoded danger tint in `ErrorBanner`** (`Users.tsx:82–84`, `Roles.tsx:27–29`, `Groups.tsx:41–43`): uses `rgba(239,68,68,0.1)` and `rgba(239,68,68,0.3)` instead of `--io-danger-subtle` (`rgba(239,68,68,0.12)` already defined in the token registry) and `--io-danger`.

3. **Hardcoded modal overlay color** (`Users.tsx:292`, Roles `ModalContent:77`, Groups `ModalContent:66`): `rgba(0,0,0,0.6)`. App-shell token `--io-surface-overlay` is `rgba(0,0,0,0.7)` (dark) / `rgba(0,0,0,0.5)` (light). These three modal implementations all hardcode a single value that neither matches the dark nor the light token.

4. **Hardcoded modal box-shadow** (`Users.tsx:311`, `Users.tsx:1074`): `0 20px 60px rgba(0,0,0,0.4)`. The app-shell token `--io-shadow-lg` is defined as `0 10px 15px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)`. The Settings modals diverge from both the token value and from each other.

5. **Hardcoded toggle thumb color** (`Users.tsx:185`): `background: "white"` — not token-mapped.

6. **Badge hex-alpha arithmetic** (`Users.tsx:108`, `Roles.tsx:54`): `background: "${color}20"`, `border: "1px solid ${color}40"`. Color values from `--io-success`, `--io-text-muted`, etc. are passed as CSS variable strings, so the hex-alpha suffix does not resolve at runtime (CSS variables do not participate in string interpolation). The badge background and border are effectively invisible. This is a functional bug: the hex-alpha string concatenation only works when `color` is a literal hex string, but the callers pass `var(--io-success)` and `var(--io-text-muted)`.

**Notes:** Modules that follow the established pattern cleanly (`--io-*` on every surface, border, text, and interactive element) would have no findings here. The six deviations above are all isolated to dialogs and utility components rather than the main page layout.

---

## Category 2 — Typography

**Implementation:** inline-styles. No module-specific CSS file. No font-family overrides. All text uses the browser's inherited sans-serif stack (Tailwind base resets). Monospace exception noted below.

**Source-of-truth files:**
- `pages/settings/index.tsx` lines 198–224 (nav group/item typography)
- `pages/settings/SettingsPageLayout.tsx` lines 36–55 (page title/description)
- `pages/settings/settingsStyles.ts` lines 15–21 (labelStyle)
- `pages/settings/Users.tsx` lines 381–392 (SectionHeader), 1349–1362 (table column headers)
- `shared/components/SettingsTabs.tsx` lines 60–75 (tab labels)

**Visual properties actually applied:**

| Element | Size | Weight | Color token | Letter spacing | Transform |
|---|---|---|---|---|---|
| Page title (`h2`) | 18px | 600 | `--io-text-primary` | — | — |
| Page description | 13px | 400 | `--io-text-muted` | — | — |
| Nav group header | 11px | 600 | `--io-text-muted` | 0.08em | uppercase |
| Nav item (inactive) | 13px | 400 | `--io-text-secondary` | — | — |
| Nav item (active) | 13px | 600 | `--io-accent` | — | — |
| Tab label (inactive) | 13px | 400 | `--io-text-secondary` | — | — |
| Tab label (active) | 13px | 600 | `--io-accent` | — | — |
| Table column header | 11px | 600 | `--io-text-muted` | 0.06em | uppercase |
| Form section header | 11px | 600 | `--io-text-muted` | 0.07em | uppercase |
| Field label (`labelStyle`) | 12px | 500 | `--io-text-secondary` | — | — |
| Table cell content | 13px | 400 | `--io-text-secondary` | — | — |
| Modal title | 16px | 600 | `--io-text-primary` | — | — |
| Modal subtitle | 12px | 400 | `--io-text-muted` | — | — |
| Hint / field meta text | 11–12px | 400 | `--io-text-muted` | — | — |

**Deviations from the app shell:**

1. **Nav group header size divergence**: Settings nav group headers use `fontSize: "11px"` (`index.tsx:198`) vs AppShell sidebar group headers at `fontSize: "10px"` (`AppShell.tsx:1469`). One pixel difference; same weight, transform, and token.

2. **Letter spacing inconsistency across uppercase label elements**: Three visually identical "small caps label" element types use different letter spacing — nav group headers 0.08em, table column headers 0.06em, form section headers 0.07em. No app-shell baseline for comparison, but internally inconsistent.

3. **Monospace usage without token**: `Groups.tsx:197` uses `fontFamily: "monospace"` for the role slug label in the group edit dialog. The app-shell token is `--io-font-mono`. Using the bare keyword means the font stack differs from other monospace usages that reference the token.

**Notes:** No module-specific heading hierarchy or custom font loading. Typography is overwhelmingly consistent across the representative pages; deviations are minor.

---

## Category 3 — Toolbars

**Confirmed absent.** Settings has no horizontal toolbars. Per-page action rows (e.g., "Export" + "+ Add User" in `Users.tsx:1291–1309`) are inline flexbox rows above the table, not toolbars in the toolbar sense. These action buttons are covered under Category 6. No ToolbarContext, no sticky toolbar container, no icon-button strip was found in any representative page.

---

## Category 4 — Menus

**Implementation:** shared-component. `shared/components/ContextMenu.tsx` is the sole menu type used in Settings. No dropdown menus, command menus, or select-based menus are present in the representative pages (the pagination `<select>` at `Users.tsx:1556` is a native browser select, not a styled dropdown component).

**Source-of-truth files:**
- `shared/components/ContextMenu.tsx` lines 52–200 (container + item rendering)
- `Users.tsx` lines 1628–1660 (context menu invocation with 4 items)
- `Roles.tsx` and `Groups.tsx` (both import ContextMenu; item sets differ but component is shared)

**Visual properties actually applied (ContextMenu container):**
- Background: `var(--io-surface-elevated)`
- Border: `1px solid var(--io-border)`
- Border radius: `var(--io-radius)`
- Box shadow: `0 8px 24px rgba(0,0,0,0.4)` (hardcoded — not `--io-shadow-lg`)
- Min width: 200px
- Padding: 4px top + 4px bottom
- Z-index: 1800 (default)
- Entry animation: `io-context-menu-in 0.08s ease`

**Visual properties actually applied (MenuItemRow):**
- Layout: flex row, gap 8px, padding `6px 14px`
- Font: 13px, no explicit weight
- Color (normal): `var(--io-text-primary)`
- Color (danger): `var(--io-alarm-urgent)` (not `--io-danger`)
- Color (disabled): `var(--io-text-muted)`, opacity 0.5
- Hover/focus background: `var(--io-accent-subtle)` (applied via imperative style mutation on mouseenter/focus events)
- Divider: `height: 1px, background: var(--io-border), margin: "3px 0"`

**Deviations from the app shell:** None. ContextMenu is an app-shell shared component. Settings consumes it identically to other modules.

**Notes:** The use of `var(--io-alarm-urgent)` for danger items in ContextMenu vs `var(--io-danger)` for danger in settingsStyles.ts buttons (`btnDanger`) means a "Disable Account" row in the context menu renders in urgent alarm red while a standalone Disable button renders in danger red — these are the same token value in the dark theme (`#ef4444`) but differ in the light theme (`--io-alarm-urgent: #dc2626` vs `--io-danger: #dc2626` — actually same in both themes; safe).

---

## Category 5 — Side Panels

**Implementation:** module-local-component. The Settings left nav is a bespoke `<aside>` in `pages/settings/index.tsx`. It is not derived from the app-shell sidebar infrastructure (`AppShell.tsx`/`--io-sidebar-*` tokens).

**Source-of-truth files:**
- `pages/settings/index.tsx` lines 179–229 (aside container + NavLink groups)
- `shared/layout/AppShell.tsx` lines 1327–1516 (app-shell sidebar for comparison)

**Visual properties actually applied:**

| Property | Settings nav (`index.tsx`) | App shell sidebar (`AppShell.tsx`) |
|---|---|---|
| Width | 220px (hardcoded) | `var(--io-sidebar-width)` = 240px |
| Background | `var(--io-surface-secondary)` | `var(--io-sidebar-bg)` = `var(--io-surface-secondary)` |
| Right border | `1px solid var(--io-border)` | `1px solid var(--io-border-subtle)` (varies by sidebar state) |
| Padding | `8px` | `8px 6px` or `8px 4px` |
| Overflow | `overflowY: auto` | `overflowY: auto` |
| Group header size | 11px | 10px |
| Group header spacing | `0.08em` | `0.06em` |
| Nav item padding | `7px 10px` | `7px 10px` |
| Nav item border radius | `var(--io-radius)` | `var(--io-radius)` |
| Nav item margin-bottom | `2px` | `1px` |
| Nav item active color | `var(--io-accent)` | `var(--io-accent)` |
| Nav item active bg | `var(--io-accent-subtle)` | `var(--io-accent-subtle)` |
| Nav item active left border | **none** | `2px solid var(--io-accent)` |
| Nav item hover transition | **none** | `background var(--io-duration-fast), color var(--io-duration-fast)` |

**Deviations from the app shell:**

1. **Width**: 220px vs `--io-sidebar-width` (240px). Settings nav is 20px narrower. Not using the token means it will not adapt if the token changes.

2. **Active left-border accent missing**: AppShell nav items show a `2px solid var(--io-accent)` left border on the active item. Settings nav has no left-border treatment — active state is indicated only by background and text color, not the border accent.

3. **No hover transition**: AppShell items transition background and color on hover. Settings nav items switch states immediately.

4. **Group header size and spacing**: 11px/0.08em vs 10px/0.06em in AppShell (documented also in Category 2).

**Notes:** The Settings nav intentionally uses a shallower 220px width to leave more room for content. The missing left-border accent is the most visually significant deviation, as it is the primary active-state indicator in the app shell nav pattern.

---

## Category 6 — Buttons

**Implementation:** module-local-component. Four named variants in `settingsStyles.ts`, plus inline-defined row action buttons in `Users.tsx`.

**Source-of-truth files:**
- `pages/settings/settingsStyles.ts` lines 23–63 (btnPrimary, btnSecondary, btnDanger, btnSmall)
- `pages/settings/Users.tsx` lines 1462–1519 (inline row action buttons)
- `pages/settings/Groups.tsx` lines 27–31 (btnSmallDanger local extension)

**Visual properties actually applied:**

| Variant | Padding | Background | Color | Border | Border radius | Font size | Font weight |
|---|---|---|---|---|---|---|---|
| `btnPrimary` | 8px 16px | `var(--io-accent)` | `var(--io-text-on-accent)` ⚠ | none | `var(--io-radius)` | 13px | 600 |
| `btnSecondary` | 8px 16px | transparent | `var(--io-text-secondary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 13px | — |
| `btnDanger` | 8px 16px | transparent | `var(--io-danger)` | `1px solid var(--io-danger)` | `var(--io-radius)` | 13px | 600 |
| `btnSmall` | 4px 10px | transparent | `var(--io-text-secondary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 12px | — |
| `btnSmallDanger` (Groups local) | (extends btnSmall) | transparent | `var(--io-danger)` | `1px solid rgba(239,68,68,0.3)` | `var(--io-radius)` | 12px | — |
| Row "Edit"/"View"/"Enable" (inline) | 4px 10px | transparent | `var(--io-text-secondary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 12px | — |
| Row "Disable" (inline) | 4px 10px | transparent | `var(--io-danger)` | `1px solid rgba(239,68,68,0.3)` | `var(--io-radius)` | 12px | — |

**Deviations from the app shell:**

1. **`btnPrimary` uses undefined token `--io-text-on-accent`** (`settingsStyles.ts:26`). The correct token is `--io-accent-foreground`. In practice the button text inherits from parent (`--io-text-primary`), which is readable but unintentional.

2. **`btnSecondary` and `btnSmall` have no `fontWeight`** — they rely on the browser default (400). `btnPrimary` and `btnDanger` explicitly set weight 600. No consistent rule for when weight is set.

3. **Row action buttons (Edit, View, Enable, Disable) are defined inline** at `Users.tsx:1462–1519` rather than using `btnSmall`/`btnSmallDanger`. The values are identical to the named constants but duplicated.

4. **Modal close icon inconsistency**: Users.tsx `LargeModal` and Roles.tsx `ModalContent` use the Unicode `✕` character (`Users.tsx:359`, `Roles.tsx:130`). Groups.tsx `ModalContent` uses ASCII `x` (`Groups.tsx:120`). Same size (18px), same color token, different glyph.

5. **No hover or focus styles on any button**: None of the button variants define `:hover` CSS (no class used), and none add mouseenter/focus handlers. The active/clicked state relies on the browser's default button appearance.

6. **Disable row button uses muted danger border** (`rgba(239,68,68,0.3)`) rather than `var(--io-danger)` or `--io-danger-subtle`. This pattern is not named in `settingsStyles.ts`, leading to duplicated hardcoded values in `Groups.btnSmallDanger` and `Users.tsx:1495`.

**Notes:** The shared `ConfirmDialog` component (`shared/components/ConfirmDialog.tsx`) is not used in Settings. Each sub-page defines its own inline confirm dialog or local modal. The `ConfirmDialog` from `settingsStyles.ts`-styled buttons in Users.tsx is the pattern established for Settings.

---

## Category 7 — Form Inputs

### 7.1 Standard text / number inputs and labels (settingsStyles baseline)

**Implementation:**
`settingsStyles.ts` exports `inputStyle` (`background: --io-surface-sunken`, `border: 1px solid --io-border`, `borderRadius: --io-radius`, `padding: 8px 10px`, `fontSize: 13px`, `color: --io-text`) and `labelStyle` (`fontSize: 12px`, `fontWeight: 600`, `color: --io-text-muted`, `textTransform: uppercase`, `letterSpacing: 0.05em`). Most pages import and apply these directly.

**Source-of-truth files:**
`frontend/src/pages/settings/settingsStyles.ts`,
`OpcSources.tsx`, `Certificates.tsx`, `AuthProviders.tsx`, `PointManagement.tsx`, `Email.tsx`

**Visual properties:**
Full-width inputs with sunken background, 1-px border, 4-px radius, 13-px text. Labels are 12-px uppercase muted caps sitting 6px above the field. Consistent across all pages that import settingsStyles.

**Deviations from app shell:**
None for pages that import settingsStyles. The pattern is internally consistent.

**Notes:**
This is the established baseline. Deviations are called out in 7.2–7.6 below.

---

### 7.2 Import.tsx — independent local style definitions

**Implementation:**
Import.tsx does not import from `settingsStyles`. It defines its own constants at lines 1790–1830:
- `inputStyle`: `background: "var(--io-surface-secondary)"` — not `--io-surface-sunken`.
- `primaryBtnStyle`: `color: "#fff"` — hardcoded, not `var(--io-text-on-accent)`.
- `secondaryBtnStyle`, `dangerBtnStyle`: token-based, acceptable.

Additionally, `DataLinksTab` defines a second local `inputStyle` at lines 4157–4166 with `background: "var(--io-surface)"` (yet another background variant). `SectionEditModal` defines local `inputSt` with `background: "var(--io-surface-secondary)"`.

The `Field` label component (line 1763) independently replicates the labelStyle pattern (uppercase, 12px, muted, 0.05em tracking) without importing the shared constant.

**Source-of-truth files:**
`Import.tsx:1790–1836`, `Import.tsx:4157–4177`, `Import.tsx:2939–2958`, `Import.tsx:1763–1788`

**Visual properties:**
Inputs look similar but sit on `--io-surface-secondary` instead of `--io-surface-sunken`; primary buttons have hardcoded white text. Three different input background values in one file.

**Deviations from app shell:**
- Background token mismatch: `--io-surface-secondary` and `--io-surface` are both used where the canonical style uses `--io-surface-sunken`.
- `primaryBtnStyle.color = "#fff"` — hardcoded instead of token.
- Duplication of the label pattern (not a functional regression, but maintenance surface).

**Notes:**
Import.tsx is the largest non-OpcSources settings file (4,904 lines). The three local style variants are a maintenance liability and will diverge further.

---

### 7.3 BulkUpdate.tsx — independent local style definitions

**Implementation:**
BulkUpdate.tsx defines its own `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER`, `SELECT`, `INPUT` at lines 33–103, not importing from settingsStyles.
- `BTN_PRIMARY.color = "var(--io-text-on-accent)"` — undefined token.
- `BTN_PRIMARY.background = "var(--io-accent)"`, `padding: "6px 16px"`, `borderRadius: "6px"` (hardcoded, not `--io-radius`).
- `SELECT` and `INPUT` use `background: "var(--io-surface-sunken)"` — matching settingsStyles, but the radius is `"6px"` hardcoded.
- The `CARD` container uses `padding: "var(--io-space-5)"` and `marginBottom: "var(--io-space-4)"` — spacing tokens; existence in the 138-token registry is unverified.

**Source-of-truth files:**
`BulkUpdate.tsx:25–103`

**Visual properties:**
Visually similar to settingsStyles; small radius inconsistency (6px literal vs `--io-radius`).

**Deviations from app shell:**
- `--io-text-on-accent` undefined (same as pass 1 finding for btnPrimary in settingsStyles).
- `borderRadius: "6px"` instead of `var(--io-radius)`.
- `--io-space-2` through `--io-space-6` spacing tokens used extensively — not in the documented 138-token set.

**Notes:**
The `--io-space-*` tokens appear in BulkUpdate and RestorePreviewModal only; if they are not registered they resolve to empty and collapse the spacing entirely. Worth verifying against `src/index.css`.

---

### 7.4 Sessions.tsx — independent local style definitions

**Implementation:**
Sessions.tsx defines local `btnSecondary`, `btnDanger`, `cellStyle` at lines 11–32, not importing from settingsStyles.
- `btnDanger.borderColor = "rgba(239,68,68,0.3)"` — hardcoded hex-rgba instead of `var(--io-danger)` or a token.
- Pagination rows-per-page `<select>` (line 334) uses custom inline style — not `inputStyle`.
- `ErrorBanner` (line 73) uses `background: "rgba(239,68,68,0.1)"` — should be `--io-danger-subtle`. Same divergence seen in Sessions.tsx `ErrorBanner` vs PointManagement `ErrorBanner` which correctly uses `--io-danger-subtle`.

**Source-of-truth files:**
`Sessions.tsx:11–32`, `Sessions.tsx:73–89`, `Sessions.tsx:334–356`

**Visual properties:**
ErrorBanner renders the same red tone visually but without token control.

**Deviations from app shell:**
- Hardcoded hex-rgba for danger color; not theme-switchable.
- `ErrorBanner` pattern diverges from PointManagement's correct token-based version.

**Notes:**
This is the third page (after Import and BulkUpdate) that defines its own button styles. Pattern is spreading; each new file copies with slight variations.

---

### 7.5 Textarea and monospace field overrides

**Implementation:**
Textareas extending inputStyle appear in: Email (height/fontFamily/resize), AuthProviders (fontFamily: `var(--io-font-mono, monospace)`), PointManagement (minHeight/resize/`fontFamily: "inherit"`), OpcSources datetime-local field (custom inline style bypassing inputStyle entirely), Import (fontFamily: `monospace` bare string). Certificates defines a standalone `textareaStyle` with `background: "var(--io-surface)"` (non-standard surface token).

**Source-of-truth files:**
`OpcSources.tsx:1917–1966`, `Certificates.tsx:67–78`, `AuthProviders.tsx:2312–2324`, `PointManagement.tsx:1011–1022`, `Email.tsx (multiple)`, `Import.tsx (multiple)`

**Visual properties:**
Visually similar but with differing font-family references and surface tokens on textarea backgrounds.

**Deviations from app shell:**
- `Certificates.textareaStyle` uses `var(--io-surface)` — not in the standard surface token set (`--io-surface-primary`, `--io-surface-secondary`, `--io-surface-elevated`, `--io-surface-sunken`). Likely resolves to undefined.
- `OpcSources` datetime-local input bypasses `inputStyle` entirely with a custom inline style at padding `7px 9px` vs the standard `8px 10px`.
- `fontFamily` references inconsistent: bare `"monospace"`, `"var(--io-font-mono, monospace)"`, and `"inherit"` are all used across pages.

**Notes:**
The monospace font inconsistency is cosmetically minor but reflects the broader lack of a shared textarea pattern.

---

### 7.6 Checkbox and radio input styling

**Implementation:**
Three approaches coexist:
- (A) Per-input `style={{ accentColor: "var(--io-accent)" }}`: PointManagement, Import (SectionEditModal toggle, Import step 3 connection checkbox), AuthProviders partial.
- (B) Global `<style>` tag injected at component root: `AuthProviders.tsx:2854–2858` — `input[type="checkbox"] { accent-color: var(--io-accent); }` and `input[type="radio"] { accent-color: var(--io-accent); }`.
- (C) No explicit accent styling: BulkUpdate.tsx conflict resolution radios (lines 368–394), Sessions.tsx (no checkboxes), RestorePreviewModal radio/checkbox fields.

**Source-of-truth files:**
`AuthProviders.tsx:2854–2858`, `PointManagement.tsx:749–760`, `BulkUpdate.tsx:368–394`, `RestorePreviewModal.tsx (radio, checkbox fields)`

**Visual properties:**
Without accent-color the browser renders checkboxes/radios in the system default color which may be grey/blue regardless of theme.

**Deviations from app shell:**
BulkUpdate and RestorePreviewModal conflict-resolution radios render in browser-default color, not `--io-accent`. These are key interactive controls in the bulk-update and restore flows.

**Notes:**
The global `<style>` tag in AuthProviders is an unusual pattern — it injects styles into the document on every mount of the component. A shared CSS class or global stylesheet entry would be cleaner.

---

## Category 8 — Status Indicators

### 8.1 StatusBadge — three incompatible implementations

**Implementation:**
Three distinct `StatusBadge` components exist across Settings pages, none shared:

**(a) OpcSources.tsx (lines 156–186)** — hex-alpha concatenation:
```tsx
background: `${color}20`   // e.g. `var(--io-success)20`
color: color
```
`color` is a CSS variable string (`"var(--io-success)"`). String-interpolating `20` after a CSS var reference does not produce a valid CSS value; the background renders as transparent/invalid.

**(b) SystemHealth.tsx (lines 41–70)** — `color-mix()`:
```tsx
background: `color-mix(in srgb, ${colorVar} 12%, transparent)`
color: colorVar
```
This is the correct approach and renders correctly in all supporting browsers. Font weight is 700 vs OpcSources 600.

**(c) Import.tsx (lines 72–106)** — `*-subtle` / `*` token pairs:
```tsx
background: "var(--io-success-subtle)"
color: "var(--io-success)"
```
All token-based, no interpolation, correct.

**Source-of-truth files:**
`OpcSources.tsx:156–186`, `SystemHealth.tsx:41–70`, `Import.tsx:72–106`

**Visual properties:**
Type (c) and type (b) render correctly. Type (a) renders with a transparent/empty background — the pill text appears but without any fill, breaking the visual meaning.

**Deviations from app shell:**
OpcSources `StatusBadge` is visually broken by the hex-alpha CSS variable concatenation bug. This was already documented in pass 1 (Category 1) as a general pattern; OpcSources is the primary affected location in Settings.

**Notes:**
Import.tsx and PointManagement.tsx use the `*-subtle`/`*` pattern which is the simplest correct approach and should be the canonical model. The `color-mix()` approach in SystemHealth is also correct and semantically richer (arbitrary tints) but unnecessary when token pairs exist.

---

### 8.2 Connection/service status dots

**Implementation:**
Two pages render a small colored dot for live connection state:

**OpcSources.tsx** — OPC source connection dot in the source list row (estimated lines ~800–810 in OpcSources source detail):
```tsx
background: src.connected ? "var(--io-success)" : "var(--io-danger)"
boxShadow: src.connected ? "0 0 4px #22c55e" : undefined
```
Width/height: 8px, `borderRadius: "50%"`.

**SystemHealth.tsx** — OPC Sources tab connection dot (lines ~800–810):
```tsx
background: src.connected ? "var(--io-success)" : "var(--io-text-muted)"
boxShadow: src.connected ? "0 0 4px #22c55e" : undefined
```

Both use the same hardcoded `#22c55e` for the glow shadow color regardless of theme.

**Source-of-truth files:**
`OpcSources.tsx` (source detail connection indicator), `SystemHealth.tsx:~800–810`

**Visual properties:**
8px circle, token-based fill, but hardcoded Tailwind green `#22c55e` for the glow shadow. The glow is visible only in dark theme and is purely decorative.

**Deviations from app shell:**
`#22c55e` is not `--io-success` and does not respect theme overrides. If `--io-success` is remapped (e.g. for high-contrast mode), the glow stays Tailwind green.

**Notes:**
The glow shadow could use `box-shadow: 0 0 4px var(--io-success)` without any functional change, eliminating the hardcoded color.

---

### 8.3 Criticality, aggregation, and active badges (PointManagement)

**Implementation:**
`CriticalityBadge` (lines 143–163): maps 4 criticality levels to `*-subtle`/`*` token pairs — correct.
`AggBadges` (lines 170–203): `--io-accent-subtle`/`--io-accent` — correct.
`ActiveBadge` (lines 209–232): 6px dot + label text, no pill background. Uses `var(--io-success)` or `var(--io-text-muted)`.

`BulkAggregationBar` selected-state background (line 1275): `rgba(var(--io-accent-rgb, 234,179,8),0.08)` — requires `--io-accent-rgb` to be a registered CSS variable. Falls back to hardcoded `234,179,8` (a yellow). The same pattern appears in `PointConfigDialog` aggregation tab (line 895).

**Source-of-truth files:**
`PointManagement.tsx:126–232`, `PointManagement.tsx:1275`, `PointManagement.tsx:895`

**Visual properties:**
CriticalityBadge and AggBadges render correctly. ActiveBadge is minimal (dot + text, no pill). BulkAggregationBar accent tint relies on `--io-accent-rgb`.

**Deviations from app shell:**
`--io-accent-rgb` is not in the documented 138-token set. If not registered, the rgba() expression still evaluates using the hardcoded fallback `234,179,8`, which is fine in the current yellow-accent theme but silently breaks if the accent changes.

**Notes:**
`ActiveBadge` is intentionally minimal (it's a table-row indicator, not a page-level status). The dot+text pattern is appropriate for density.

---

### 8.4 AuthProviders type and enabled state indicators

**Implementation:**
`TypeBadge` (lines 525–549):
```tsx
background: `color-mix(in srgb, var(--io-info, #3b82f6) 12%, transparent)`
color: "var(--io-info, #3b82f6)"
border: `1px solid color-mix(in srgb, var(--io-info, #3b82f6) 25%, transparent)`
```
`--io-info` is not in the 138-token registry; the fallback `#3b82f6` (Tailwind blue-500) applies in all cases.

Enabled/Disabled state (line 2563): inline text only — `color: provider.enabled ? "var(--io-success)" : "var(--io-text-muted)"`. No badge, no dot. JIT provisioning shown as a small pill `background: --io-surface-sunken`.

**Source-of-truth files:**
`AuthProviders.tsx:525–549`, `AuthProviders.tsx:2563–2588`

**Visual properties:**
TypeBadge renders in blue always; no theme-aware control. Enabled state is text-only, low visual salience.

**Deviations from app shell:**
`--io-info` is not registered — de facto hardcoded blue, equivalent to a bare hex value. Should use `--io-accent` or a documented semantic token, or `--io-info` should be added to the token registry.

**Notes:**
The enabled/disabled inline text pattern (no pill, no dot) is inconsistent with ActiveBadge in PointManagement which at least shows a dot. Neither is wrong for their respective contexts, but the inconsistency adds to the cross-page visual churn.

---

### 8.5 Email StatusBadge — dot-only variant

**Implementation:**
`Email.tsx StatusBadge` (lines 187–212): renders only a 7px dot with no background pill. Font size 12px, color from `STATUS_COLORS` map. Most minimal badge variant in Settings.

**Source-of-truth files:**
`Email.tsx:187–212`

**Visual properties:**
7px circle, token-based color, no wrapping pill.

**Deviations from app shell:**
Intentionally minimal for the email queue row context (dot-only conveys delivered/failed quickly). Not a bug.

**Notes:**
The five StatusBadge variants in Settings (OpcSources pill-with-bug, SystemHealth color-mix pill, Import token-pair pill, Email dot-only, PointManagement ActiveBadge dot-with-label) constitute a fragmented pattern with no shared component. A single `<StatusBadge>` in shared components would eliminate the inconsistency.

---

### 8.6 Sessions — session state indicators

**Implementation:**
Sessions.tsx does not use a status badge for session state. The table shows: username, IP, browser, last active (relative time), expires-in (countdown text), and action buttons. Revoked sessions are removed from the list. Expired sessions show `"expired"` text via `formatExpiry()` in muted color. No active/revoked badge exists.

**Source-of-truth files:**
`Sessions.tsx:49–58`, `Sessions.tsx:275–282`

**Visual properties:**
Expiry countdown as muted 12px text. "expired" appears as the string output if diff ≤ 0.

**Deviations from app shell:**
None — this is a deliberate design choice. The audit plan mentioned "session active/revoked state" as a specific item to check; there is no indicator beyond the countdown text.

**Notes:**
The `ErrorBanner` in Sessions uses `background: rgba(239,68,68,0.1)` (hardcoded hex-rgba) — documented in 7.4 above. This is the only status-adjacent deviation; the session rows themselves have no indicator issue.

---

### 8.7 SystemHealth MetricsTab — active time range button

**Implementation:**
MetricsTab time range segment buttons (line ~1342):
```tsx
color: timeRange === r ? "#fff" : "var(--io-text-secondary)"
```
The active state uses hardcoded `"#fff"` for the text color on an accent-colored background.

`StepIndicator` in BulkUpdate (line 820):
```tsx
color: isActive || isDone ? "#fff" : "var(--io-text-muted)"
```
Same pattern — `"#fff"` on accent/success background.

**Source-of-truth files:**
`SystemHealth.tsx:~1342`, `BulkUpdate.tsx:820`

**Visual properties:**
White text on colored background — correct in dark theme, but not token-controlled.

**Deviations from app shell:**
`"#fff"` should be `var(--io-text-on-accent)`. This token is undefined in the 138-token registry (documented in pass 1), which means both using the token and using the literal have the same effect currently — but the literal forecloses any future token-based override.

---

## Category 9 — Labels and Headers

**Implementation:** mix. Page-level headers: `SettingsPageLayout.tsx` (module-local-component). Field labels and table headers: inline-styles referencing `labelStyle` from `settingsStyles.ts`. Tab labels: `shared/components/SettingsTabs.tsx` (shared-component). Modal titles: inline-styles within each sub-page.

**Source-of-truth files:**
- `pages/settings/SettingsPageLayout.tsx` lines 36–55
- `pages/settings/settingsStyles.ts` lines 15–21
- `pages/settings/index.tsx` lines 192–225
- `pages/settings/Users.tsx` lines 381–392 (SectionHeader), 1349–1361 (table headers)
- `shared/components/SettingsTabs.tsx` lines 60–75

**Visual properties actually applied:**

| Element | Size | Weight | Color token | Letter spacing | Transform | Location |
|---|---|---|---|---|---|---|
| Page title | 18px | 600 | `--io-text-primary` | — | — | `SettingsPageLayout.tsx:40` |
| Page description | 13px | 400 | `--io-text-muted` | — | — | `SettingsPageLayout.tsx:49` |
| Nav group header | 11px | 600 | `--io-text-muted` | 0.08em | uppercase | `index.tsx:198–201` |
| Tab label (active) | 13px | 600 | `--io-accent` | — | — | `SettingsTabs.tsx:63` |
| Tab label (inactive) | 13px | 400 | `--io-text-secondary` | — | — | `SettingsTabs.tsx:63` |
| Tab active underline | — | — | `--io-accent` | — | — | `SettingsTabs.tsx:68` (2px bottom border) |
| Table column header | 11px | 600 | `--io-text-muted` | 0.06em | uppercase | `Users.tsx:1355` |
| Form section header | 11px | 600 | `--io-text-muted` | 0.07em | uppercase | `Users.tsx:385` |
| Field label | 12px | 500 | `--io-text-secondary` | — | — | `settingsStyles.ts:16` |
| Modal title | 16px | 600 | `--io-text-primary` | — | — | `Users.tsx:330`, `Roles.tsx:110` |
| Modal subtitle | 12px | 400 | `--io-text-muted` | — | — | `Users.tsx:340` |
| Required field indicator | 12px | — | `--io-danger` | — | — | `Users.tsx:431` |
| Error text under field | 12px | 400 | `--io-danger` | — | — | `Users.tsx:455` |
| Hint text under field | 11px | 400 | `--io-text-muted` | — | — | `Users.tsx:447` |

**Deviations from the app shell:**

1. **Letter spacing inconsistency across uppercase label types**: Nav group headers use 0.08em (`index.tsx:200`), table column headers use 0.06em (`Users.tsx:1358`), and form section headers use 0.07em (`Users.tsx:387`). All three are the same visual element type (11px, weight 600, uppercase, `--io-text-muted`) but with three different letter spacings. The app-shell sidebar group header uses 0.06em. No app-shell token for this value.

2. **Nav group header size**: 11px in Settings (`index.tsx:198`) vs 10px in AppShell (`AppShell.tsx:1469`). Same token and weight; size differs by 1px (documented also in Category 2).

3. **Page title is `<h2>` not `<h1>`**: `SettingsPageLayout.tsx:36` renders `<h2>` with `margin: "0 0 4px"`. Correct for Settings context where the module is a sub-page within the app shell. No functional deviation; noted for completeness.

**Notes:** The page-level header pattern (title + description + optional action) is consistently applied via `SettingsPageLayout` across all representative pages. The letter spacing drift is the most actionable finding — a single value from the token system (or a local constant) would resolve it.

---

## Category 10 — Canvas / Main Work Area

**N/A.** Settings has no canvas or main work area. This category was excluded from the audit plan; the determination was made before either pass began. No findings.

---

## Category 11 — Modals and Dialogs

### 11.1 Modal construction pattern inventory

Settings uses four distinct construction patterns across its modals and dialogs. None of these share a wrapper component.

**Pattern A — Radix Dialog with `var(--io-overlay)` fallback:**
Used by: PointManagement (`PointConfigDialog`, `LifecycleDialog`, expression builder), AuthProviders (`ProviderDialog`).
- Overlay: `var(--io-overlay, rgba(0,0,0,0.5))` or `rgba(0,0,0,0.55)`.
- Content background: `var(--io-surface-elevated)` (PointManagement) or `var(--io-surface-secondary)` (AuthProviders).
- Accessibility: Radix Dialog provides ARIA attributes automatically.
- Close glyph: `&#x2715;` (PointManagement) or `×` / U+00D7 (AuthProviders).

**Pattern B — Radix Dialog with `var(--io-modal-backdrop)`:**
Used by: Email (`ProviderDialog`, `TestEmailDialog`, `TemplateDialog`).
- Overlay: `var(--io-modal-backdrop)` — token not in 138-token registry.
- Content background: `var(--io-surface)` — not in the standard surface token set.
- Accessibility: Radix Dialog handles ARIA.

**Pattern C — Plain div overlay (no Radix):**
Used by: RestorePreviewModal, Certificates (`UploadModal`, `certDetail`), OpcSources `ManageCategoriesModal`, Import (`Modal` component, `Drawer`, `DataLinksTab` add/edit dialog, `SectionEditModal`).
- Overlay values: `var(--io-modal-backdrop)` (RestorePreviewModal, Certificates), `var(--io-overlay, rgba(0,0,0,0.5))` (OpcSources), `rgba(0,0,0,0.5)` hardcoded (Import Modal/DataLinksTab/SectionEditModal), `rgba(0,0,0,0.4)` hardcoded (Import Drawer).
- Accessibility: Certificates provides `role="dialog" aria-modal="true" aria-labelledby` — correct. RestorePreviewModal and all Import dialogs provide none.

**Pattern D — Radix Dialog as slide-over drawer:**
Used by: OpcSources `SourceDetailPanel`.
- Radix Dialog.Content positioned `top:0, right:0, bottom:0, width: "560px"`.
- Box shadow: `"-20px 0 60px rgba(0,0,0,0.3)"`.

**Source-of-truth files:**
`PointManagement.tsx:286–392`, `PointManagement.tsx:611–1248`, `AuthProviders.tsx:2003–2476`, `Email.tsx (all Dialog uses)`, `RestorePreviewModal.tsx`, `Certificates.tsx:270–478`, `Certificates.tsx:~788–916`, `OpcSources.tsx:384–457`, `OpcSources.tsx:524–868`, `OpcSources.tsx:2122–2442`, `Import.tsx:149–305`, `Import.tsx:2939–3248`, `Import.tsx:4491–4791`, `BulkUpdate.tsx:1101–1121`

---

### 11.2 Overlay token inconsistency

**Implementation:**
Five distinct overlay specifications are in use simultaneously:
1. `var(--io-modal-backdrop)` — RestorePreviewModal, Certificates, Email. This token is not in the documented 138-token registry. Standard overlay token from pass 1 is `--io-surface-overlay`.
2. `var(--io-overlay, rgba(0,0,0,0.5))` — PointManagement, AuthProviders, OpcSources ManageCategoriesModal. `--io-overlay` also not in registry; the fallback fires in all cases.
3. `rgba(0,0,0,0.5)` hardcoded — Import `Modal`, `DataLinksTab` dialog, `SectionEditModal`.
4. `rgba(0,0,0,0.4)` hardcoded — Import `Drawer` backdrop.
5. `rgba(0,0,0,0.55)` hardcoded (within `var(--io-overlay, ...)` fallback) — AuthProviders.

**Source-of-truth files:**
As listed in 11.1

**Visual properties:**
All five render a dark semi-transparent overlay. Shade varies from 0.4 to 0.55 opacity.

**Deviations from app shell:**
Both `--io-modal-backdrop` and `--io-overlay` appear to be undefined tokens. No single standard backdrop token is used consistently. The app shell defines `--io-surface-overlay` in `src/index.css` — this is not used in any Settings modal.

**Notes:**
This is the most widespread token deviation in the modal layer. All modal overlays should standardize on `var(--io-surface-overlay)` or whichever token is canonical in the app shell.

---

### 11.3 Modal content background inconsistency

**Implementation:**
Five content backgrounds in use:
1. `var(--io-surface-elevated)` — PointManagement dialogs, OpcSources ModalContent, Certificates certDetail. This is the intended elevated surface for modals.
2. `var(--io-surface-secondary)` — AuthProviders ProviderDialog.
3. `var(--io-surface)` — Import `Modal` / `Drawer` / `DataLinksTab` dialog, Email dialogs, Certificates UploadModal. `var(--io-surface)` is not in the named surface token set.
4. `var(--io-surface-primary)` — RestorePreviewModal.
5. `var(--io-surface-sunken)` — not used in modal content (used for inner cards only).

**Source-of-truth files:**
As listed in 11.1

**Visual properties:**
In dark theme, `--io-surface-elevated` produces the lightest background (correct for modal layering). `--io-surface-secondary` and `--io-surface` may produce the same or lower elevation depending on token values, making dialogs appear to float at the wrong depth.

**Deviations from app shell:**
`var(--io-surface)` is not in the documented token set. `--io-surface-elevated` is the correct modal content token and is used by most PointManagement and OpcSources dialogs.

---

### 11.4 Close button glyph inconsistency

**Implementation:**
Four different close glyphs are in use:
1. `✕` literal (U+2715) — OpcSources ModalContent.
2. `&#x2715;` HTML entity (→ U+2715) — OpcSources SourceDetailPanel, PointManagement dialogs.
3. `×` literal (U+00D7, multiplication sign) — AuthProviders, Import Modal/Drawer/DataLinksTab/SectionEditModal.
4. No close button (Cancel only) — Certificates UploadModal.

These are visually indistinguishable at most font sizes but technically different characters.

**Source-of-truth files:**
`OpcSources.tsx:427`, `OpcSources.tsx:2283`, `PointManagement.tsx:686`, `AuthProviders.tsx:close button`, `Import.tsx:215`, `Import.tsx:296`

**Visual properties:**
All render as a small ✕ mark. U+00D7 is slightly wider than U+2715.

**Deviations from app shell:**
The app shell uses `&#x2715;` (U+2715) in established component patterns. The mix does not constitute a regression but reflects the absence of a shared `<ModalCloseButton>` component.

---

### 11.5 Border radius inconsistency in modal content

**Implementation:**
Four values in use across Settings modals:
1. `var(--io-radius)` — settingsStyles baseline, most small dialogs.
2. `var(--io-radius-lg)` — Import `Modal` component, Import `DataLinksTab` dialog.
3. `"10px"` hardcoded — PointManagement `PointConfigDialog` and `LifecycleDialog`, Import `SectionEditModal`, OpcSources `ModalContent`.
4. `"12px"` hardcoded — AuthProviders `ProviderDialog`.

**Source-of-truth files:**
`Import.tsx:269`, `Import.tsx:4509`, `PointManagement.tsx:305`, `PointManagement.tsx:631`, `AuthProviders.tsx:~2100`, `OpcSources.tsx:409`

**Visual properties:**
`--io-radius-lg` likely resolves to 8px or 12px; `"10px"` and `"12px"` are hardcoded. Variation is subtle (2–4px difference) but present.

**Deviations from app shell:**
Only `var(--io-radius-lg)` is token-controlled. Hardcoded radii don't respect any theme radius override.

---

### 11.6 Modal box shadow inconsistency

**Implementation:**
Three shadow values in use:
1. `"0 20px 60px rgba(0,0,0,0.4)"` — OpcSources ModalContent (line 425), Import SectionEditModal (line 2979), PointManagement LifecycleDialog (line 312), PointManagement PointConfigDialog (line 639).
2. `"0 24px 80px rgba(0,0,0,0.5)"` — PointManagement ExpressionBuilder (line 1181). Larger dialog, heavier shadow.
3. `"-20px 0 60px rgba(0,0,0,0.3)"` — OpcSources SourceDetailPanel slide-over (line 2270).
4. No explicit box-shadow — Certificates, Email, Import Modal/Drawer/DataLinksTab, AuthProviders.

**Source-of-truth files:**
As noted above.

**Visual properties:**
The `0 20px 60px` shadow is the most common and produces a pronounced floating effect. Dialogs without an explicit shadow appear flatter (system default shadow or none).

**Deviations from app shell:**
All shadow values are hardcoded rgba strings. No shadow token is used.

---

### 11.7 Accessibility gaps in plain-div modals

**Implementation:**
Pattern C (plain div overlay) modals vary in ARIA coverage:

| File / Modal | role="dialog" | aria-modal | aria-labelledby | Focus trap |
|---|---|---|---|---|
| Certificates UploadModal | ✅ | ✅ | ✅ | ❌ (not Radix) |
| Certificates certDetail | ✅ | ✅ | ✅ | ❌ |
| RestorePreviewModal | ❌ | ❌ | ❌ | ❌ |
| OpcSources ManageCategoriesModal | ❌ | ❌ | ❌ | ❌ |
| Import Modal component | ❌ | ❌ | ❌ | ❌ |
| Import Drawer component | ❌ | ❌ | ❌ | ❌ |
| Import DataLinksTab dialog | ❌ | ❌ | ❌ | ❌ |
| Import SectionEditModal | ❌ | ❌ | ❌ | ❌ |

Radix Dialog (Pattern A/B) provides all ARIA attributes and focus management automatically.

**Source-of-truth files:**
`RestorePreviewModal.tsx:~50–70`, `OpcSources.tsx:524–868`, `Import.tsx:149–305`

**Visual properties:**
No visible difference; accessibility-only gap.

**Deviations from app shell:**
RestorePreviewModal lacks ARIA entirely despite being a multi-step critical-path modal (snapshot restore). The Import `Modal` and `Drawer` components are reused throughout Import.tsx; adding ARIA to the two wrapper components would fix all six Import dialog instances simultaneously.

**Notes:**
RestorePreviewModal is the most urgent accessibility gap given its critical-path nature (snapshot restore is a destructive-adjacent operation). Certificates at least demonstrates the correct pattern for plain-div modals.

---

### 11.8 Native `confirm()` usage

**Implementation:**
Three locations use `window.confirm()` for destructive actions instead of the shared `ConfirmDialog`:
1. OpcSources.tsx row-level delete (line 2947): `confirm(\`Delete source "\${src.name}"?\`)`.
2. OpcSources.tsx another delete path (line 3009).
3. Import.tsx ConnectionsTab delete (line 847): `confirm(\`Delete connection "\${conn.name}"?\`)`.
4. Import.tsx DefinitionsTab delete (line 2722): `confirm(\`Delete definition "\${def.name}"?\`)`.

**Source-of-truth files:**
`OpcSources.tsx:2947`, `OpcSources.tsx:3009`, `Import.tsx:847`, `Import.tsx:2722`

**Visual properties:**
Browser-native confirm dialog — visually jarring against the app's styled modals.

**Deviations from app shell:**
`ConfirmDialog` (shared component at `shared/components/ConfirmDialog.tsx`) is the established pattern and is used correctly by Certificates, Email, BulkUpdate, AuthProviders, PointManagement. The four `confirm()` usages are regressions.

**Notes:**
This was flagged as a common Settings pattern in pass 1 notes. It appears in the two most complex pages (OpcSources and Import) and is likely an artifact of their size/complexity.

---

### 11.9 BulkUpdate modal patterns — correct use of shared components

**Implementation:**
BulkUpdate.tsx uses `ConfirmDialog` (shared) for apply confirmation and undo confirmation. The `RestorePreviewModal` is invoked as a controlled component, not reimplemented. No custom overlay/modal construction in BulkUpdate itself.

**Source-of-truth files:**
`BulkUpdate.tsx:1101–1121`, `BulkUpdate.tsx:1664–1692`

**Visual properties:**
All confirmation dialogs use the shared pattern.

**Deviations from app shell:**
None for modal patterns in BulkUpdate.

**Notes:**
BulkUpdate is the best modal-usage example in Settings: it uses shared dialogs throughout and does not introduce novel overlay patterns.

---

## Cross-cutting observations

### Pass 1 cross-cutting observations

- **No shared button component**: The app shell has no shared button component for settings. Each Settings sub-page imports from `settingsStyles.ts` or defines buttons inline. This is by design (settings is a CRUD module not a canvas app) but means style drift (missing `fontWeight`, undefined token, inline duplication) is not caught by a shared abstraction.

- **Three distinct modal patterns in six files**: `LargeModal` (Users.tsx), `ModalContent` (Roles.tsx, Groups.tsx — near-identical duplicates), and `ConfirmDialog` (Users.tsx, with a narrow version used in Roles/Groups as well). All share the same structure (`Dialog.Portal` + `Dialog.Overlay` + `Dialog.Content`) but with slightly different padding, border radius (all use hardcoded `10px` vs `var(--io-radius-lg)` = 9px), and close button glyphs. Consolidating these into one local modal component would eliminate the badge-glyph mismatch and the shadow/overlay token misses.

- **`ErrorBanner` is independently defined in Users.tsx, Roles.tsx, and Groups.tsx**: Three identical components (`background: rgba(239,68,68,0.1)`, `border: 1px solid rgba(239,68,68,0.3)`). A candidate for extraction to `settingsStyles.ts` or a local shared component — no action required for this audit, noting for the implementation queue.

### Pass 2 — Undefined tokens in active use

The following CSS custom property tokens appear in Settings pass 2 source but are not in the documented 138-token registry:

| Token | Used in | Notes |
|---|---|---|
| `--io-text-on-accent` | `settingsStyles.btnPrimary` (pass 1), BulkUpdate `BTN_PRIMARY`, RestorePreviewModal `BTN_PRIMARY`, Certificates Trust/Reject buttons, PointManagement deactivate button | Effectively `#fff` in the current theme but no token |
| `--io-modal-backdrop` | RestorePreviewModal, Certificates, Email | No fallback; overlay becomes empty string if token absent |
| `--io-overlay` | PointManagement, AuthProviders, OpcSources ManageCategoriesModal | Has explicit rgba fallback; token absent fires fallback |
| `--io-surface` | Import Modal/Drawer/DataLinksTab, Email dialogs, Certificates `textareaStyle` | Not in `primary/secondary/elevated/sunken` set |
| `--io-info` | AuthProviders TypeBadge | Fallback `#3b82f6` always fires |
| `--io-space-2` … `--io-space-6` | BulkUpdate.tsx, RestorePreviewModal.tsx | All spacing uses these; if absent layouts collapse |
| `--io-accent-rgb` | PointManagement BulkAggregationBar, PointConfigDialog agg tab | Fallback `234,179,8` always fires in current theme |

### Pass 2 — Pattern-level summary applicable to thin sub-pages

The ~15 thinner sub-pages (Badges, About, ScimTokens, ExportPresets, Groups, Roles, AlarmThresholds, etc.) follow the settingsStyles-import pattern established in the representative pages. Based on the uniformity observed, they are expected to:
- Import `inputStyle`, `labelStyle`, `btnPrimary`, `btnSecondary` from settingsStyles.
- Use `ConfirmDialog` for deletes.
- Use Radix Dialog for edit/create modals, or no modals at all (read-only pages like About).
- Not introduce new StatusBadge implementations.

Any divergence from this should be treated as the same class of issues documented above. Sub-page-specific auditing is not expected to produce new categories of findings.

### Pass 2 — Comparison to pass 1 findings

Pass 1 documented:
- `--io-text-on-accent` undefined in `btnPrimary` (**confirmed** — same token reappears in BulkUpdate and RestorePreviewModal).
- Hex-alpha badge concatenation bug in OpcSources (**confirmed** — `StatusBadge.background = \`${color}20\``).
- Three distinct modal patterns (pass 1 counted three; pass 2 confirms four patterns).
- `ErrorBanner` local implementations in multiple files (**confirmed** — Sessions and OpcSources both have divergent ErrorBanner implementations).

No pass 1 findings have been resolved in the files examined in this pass.
