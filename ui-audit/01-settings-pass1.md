# Settings Module — UI Audit Pass 1

Categories: 1 (color palette/tokens), 2 (typography), 3 (toolbars), 4 (menus), 5 (side panels), 6 (buttons), 9 (labels and headers).

Representative pages read: `pages/settings/index.tsx`, `SettingsPageLayout.tsx`, `settingsStyles.ts`, `IdentityAccess.tsx`, `Users.tsx`, `Roles.tsx`, `Groups.tsx`.

Baseline: `index.css` (138 CSS custom properties), `shared/layout/AppShell.tsx`, `shared/components/ContextMenu.tsx`, `shared/components/SettingsTabs.tsx`.

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

## Cross-cutting observations (pass 1)

- **No shared button component**: The app shell has no shared button component for settings. Each Settings sub-page imports from `settingsStyles.ts` or defines buttons inline. This is by design (settings is a CRUD module not a canvas app) but means style drift (missing `fontWeight`, undefined token, inline duplication) is not caught by a shared abstraction.

- **Three distinct modal patterns in six files**: `LargeModal` (Users.tsx), `ModalContent` (Roles.tsx, Groups.tsx — near-identical duplicates), and `ConfirmDialog` (Users.tsx, with a narrow version used in Roles/Groups as well). All share the same structure (`Dialog.Portal` + `Dialog.Overlay` + `Dialog.Content`) but with slightly different padding, border radius (all use hardcoded `10px` vs `var(--io-radius-lg)` = 9px), and close button glyphs. Consolidating these into one local modal component would eliminate the badge-glyph mismatch and the shadow/overlay token misses.

- **`ErrorBanner` is independently defined in Users.tsx, Roles.tsx, and Groups.tsx**: Three identical components (`background: rgba(239,68,68,0.1)`, `border: 1px solid rgba(239,68,68,0.3)`). A candidate for extraction to `settingsStyles.ts` or a local shared component — no action required for this audit, noting for the implementation queue.
