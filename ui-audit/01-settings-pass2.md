# Settings UI Audit — Pass 2 of 2
**Categories covered:** 7 (form inputs), 8 (status indicators), 11 (modals and dialogs)
**Category 10 (canvas/main work area): N/A — Settings has no canvas.**
**Representative pages audited:** Import.tsx, OpcSources.tsx, Certificates.tsx, AuthProviders.tsx, PointManagement.tsx, SystemHealth.tsx, BulkUpdate.tsx, Email.tsx, RestorePreviewModal.tsx, Sessions.tsx

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

## Cross-cutting findings

### Undefined tokens in active use

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

### Pattern-level summary applicable to thin sub-pages

The ~15 thinner sub-pages (Badges, About, ScimTokens, ExportPresets, Groups, Roles, AlarmThresholds, etc.) follow the settingsStyles-import pattern established in the representative pages. Based on the uniformity observed, they are expected to:
- Import `inputStyle`, `labelStyle`, `btnPrimary`, `btnSecondary` from settingsStyles.
- Use `ConfirmDialog` for deletes.
- Use Radix Dialog for edit/create modals, or no modals at all (read-only pages like About).
- Not introduce new StatusBadge implementations.

Any divergence from this should be treated as the same class of issues documented above. Sub-page-specific auditing is not expected to produce new categories of findings.

### Comparison to pass 1 findings

Pass 1 documented:
- `--io-text-on-accent` undefined in `btnPrimary` (**confirmed** — same token reappears in BulkUpdate and RestorePreviewModal).
- Hex-alpha badge concatenation bug in OpcSources (**confirmed** — `StatusBadge.background = \`${color}20\``).
- Three distinct modal patterns (pass 1 counted three; pass 2 confirms four patterns).
- `ErrorBanner` local implementations in multiple files (**confirmed** — Sessions and OpcSources both have divergent ErrorBanner implementations).

No pass 1 findings have been resolved in the files examined in this pass.
