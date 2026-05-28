# Claim B Work Plan — Module Framework Layer Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`, `ui-audit/06-claim-a-plan.md`  
**Scope:** `shared/styles/` constants files (buttons, inputs); four promoted components (FieldLabel, StatusBadge, Dialog, ConfirmDialog). Excludes Claim C canvas layer.  
**Date:** 2026-05-28  
**Status:** Complete 2026-05-28  

---

## Section 1 — Constants Files Plan

### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**

**Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 6, Shared column | "All three use `var(--io-accent)` for primary action button backgrounds; all three use `1px solid var(--io-border)` for secondary/outline borders" |
| Cat 6, List 3 Item 3 | "Settings `settingsStyles.ts` named-variant pattern is the starting point. `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` are named, exported constants with clear semantic intent." |
| Cat 6, List 1 Item 6 | "All three modules ignore the six `--io-btn-*` tokens" — confirms the right approach is named style objects, not migrating to those tokens |
| Cat 6, Deviations, Settings | After Claim A (A5), `--io-text-on-accent` is now a valid alias for `var(--io-accent-foreground)` — `btnPrimary` now resolves correctly |
| 04-recommendations Cat 6 | Explicit variant definitions with corrected token references |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Primary background | `var(--io-accent)` | All three agree (Cat 6 Shared) |
| Secondary/danger border | `1px solid var(--io-border)` / `1px solid var(--io-danger)` | All three agree on secondary border pattern |
| Padding (primary/secondary) | `8px 16px` | Settings canonical |
| Base font size | `13px` | Settings canonical (Console also 13px on some buttons; Designer text-actions 13px) |
| Cursor | `pointer` | Universal |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings | Recommended | Reasoning |
|----------|---------|----------|----------|-------------|-----------|
| Primary text color | `#fff` hardcoded | `#09090b` or `#fff` hardcoded | `var(--io-text-on-accent)` (alias for `var(--io-accent-foreground)`) | `var(--io-accent-foreground)` | The canonical token; `--io-text-on-accent` is a Claim A alias for it. Both names work, canonical is preferred. |
| borderRadius | 3–6 (inconsistent integers) | `var(--io-radius)` on IconBtn, `6` integer on text-actions | `var(--io-radius)` | `var(--io-radius)` | Settings and Designer IconBtn agree; Console inconsistency is the gap to close. `var(--io-radius)` = 6px currently. |
| Secondary fontWeight | Not set (browser default 400) | Not set | Not set | `600` | The audit notes btnSecondary in Settings lacks fontWeight (Cat 6 Deviations). Should match primary for visual consistency at the same type size. Align all variants: 600. |
| Hover state | None on any variant | IconBtn has `transition: background 0.1s, color 0.1s` | None | `transition: opacity 0.1s` or `:focus-visible` outline | Inline styles cannot express CSS pseudo-classes; constants file exports base style objects; hover requires a companion CSS file or Tailwind class. Plan: export `buttonBaseClass = "io-btn"` to pair with a minimal `shared/styles/buttons.css` that sets `:hover { opacity: 0.85 }` and `:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`. Defer full DOM-mutation hover removal to consumer migration. |
| BulkUpdate.tsx BTN_SECONDARY background | `var(--io-surface-sunken)` | — | `transparent` (canonical) | `transparent` | BulkUpdate's secondary uses a surface bg instead of transparent; non-standard. Migrate to shared constants. |

#### Variant specifications for `buttons.ts`

```ts
btnPrimary: {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "var(--io-accent-foreground)",
  border: "none",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSecondary: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnDanger: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-danger)",
  border: "1px solid var(--io-danger)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSmall: {
  padding: "4px 10px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "12px",
  cursor: "pointer",
}
```

Also export a `buttonBaseClass = "io-btn"` string constant pairing with a companion `buttons.css` that adds the `:hover` opacity and `:focus-visible` outline. The CSS is two rules; the constant signals to consumers they should also spread the className.

#### Consumer files to migrate (deferred to execution unless part of initial scope)

| File | What to change |
|------|----------------|
| `pages/settings/BulkUpdate.tsx` | Replace local `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER` constants with shared imports |
| `pages/settings/Import.tsx` | Any inline button styles not using settingsStyles |
| `pages/settings/Sessions.tsx` | Local `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER`/`BTN_DANGER` (slightly non-canonical variants) |
| `pages/console/index.tsx` | Toolbar and modal buttons using inline styles |
| `pages/console/PaneConfigModal.tsx` | Modal action buttons |
| `pages/console/PaneWrapper.tsx` | Pane action buttons |
| `pages/console/AlarmListPane.tsx` | Ack/action buttons |
| `pages/console/PointTablePane.tsx` | Action buttons |
| `pages/designer/DesignerToolbar.tsx` | Text-action buttons (lines 1618–1693) using `borderRadius: 6` integers |
| `pages/designer/DesignerImport.tsx` | Primary button with `#3b82f6` fallback (line 65) |
| `pages/designer/DesignerGraphicsList.tsx` | Action buttons |

**Note:** Designer's `IconBtn` is a module-local primitive (`DesignerToolbar.tsx:904–948`) and is not in scope for migration to buttons.ts. It already has good hover/transition behavior. Leave it as-is.

---

### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**

**Goal:** Single importable input style object replacing per-module duplicates. No React component.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 7, Shared column | "All three: `border: 1px solid var(--io-border)`; `outline: none`" — border converged; outline:none is the pattern to fix |
| Cat 7, List 3 Item 1 | "Settings `settingsStyles.ts` defines a single named `inputStyle` object that propagates automatically to all pages that import it. The `settingsStyles` approach is the pattern most easily extended across other modules." |
| Cat 7, Notes | "`settingsStyles.ts inputStyle` is the closest to a shared pattern; divergence in `Import`/`BulkUpdate`/`Sessions` is a maintenance liability" |
| 04-recommendations Cat 7 | "Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`" |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Border | `1px solid var(--io-border)` | All three agree (Cat 7 Shared) |
| Checkbox accent | `accentColor: "var(--io-accent)"` | Settings consensus; Console uses it in some places |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings canonical | Recommended | Reasoning |
|----------|---------|----------|-------------------|-------------|-----------|
| Background | `--io-surface-secondary` or `--io-surface-elevated` (inconsistent) | `--io-surface` (RightPanel), `--io-input-bg` (ShapePointSelector), `--io-surface-sunken` (PointPickerModal) | `--io-surface-sunken` | `var(--io-surface-sunken)` | Settings canonical is the deepest inset surface, appropriate for inputs embedded in forms. Three-module divergence; `--io-surface-sunken` is the most semantically correct choice and aligns with `--io-input-bg` (registered at index.css:131 — same visual value). |
| borderRadius | `6` or `4` (inconsistent integers) | `var(--io-radius)` or `4` integer (mixed) | `var(--io-radius)` | `var(--io-radius)` | Settings canonical uses the token; all others should match. |
| Padding | `4px 7px` (Designer RightPanel smaller for compact panels) | `4px 7px` or `8px 10px` | `8px 10px` | `8px 10px` | Settings canonical; matches the 13px font size. Designer RightPanel inputs at 4px 7px are intentionally compact for the inspector; those should NOT be migrated — that's a module-local exception (see scope note below). |
| fontSize | `12px` (Designer RightPanel) or `13px` | `13px` | `13px` | `13px` | |
| color | `var(--io-text)` (undefined, now alias via A2) | not always set | `var(--io-text-primary)` | `var(--io-text-primary)` | Canonical token; `--io-text` alias also works but use canonical |
| outline | `none` everywhere | `none` | `none` | Remove `outline: none` from inputStyle; rely on companion CSS | `outline: none` removes accessibility. The constant itself should not suppress the focus ring. Export a companion `inputs.css` with `input.io-input:focus-visible, select.io-input:focus-visible, textarea.io-input:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 0; border-color: var(--io-accent); }` — and export `inputClassName = "io-input"` for consumers to add. This fixes the focus ring in one place. |
| boxSizing | `border-box` in Settings | not always set | `border-box` | `border-box` | Prevents width overflow; all inputs should have it. |

**Scope note on Designer RightPanel:** `DesignerRightPanel.tsx` uses a compact `inputStyle` (`padding: "4px 7px"`, `fontSize: 12`) for the inspector panel where vertical space is at a premium. Do NOT migrate these to the shared inputStyle — the different size is intentional. The shared inputs.ts targets form-style inputs in modals, settings pages, and palette search boxes, not inspector panel fields. Flag this in migration tracking.

#### Variant specifications for `inputs.ts`

```ts
inputStyle: {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  boxSizing: "border-box",
  // No outline:none — use inputClassName + inputs.css for focus ring
}

inputClassName = "io-input"  // pair with companion inputs.css
```

#### Consumer files to migrate

| File | What to change |
|------|----------------|
| `pages/settings/Import.tsx` | Own `inputStyle` constant (diverges from settingsStyles) |
| `pages/settings/BulkUpdate.tsx` | `borderRadius: "6px"` string instead of `var(--io-radius)`; local SELECT constant |
| `pages/settings/Sessions.tsx` | Local inline input styles |
| `pages/console/PaneConfigModal.tsx` | Multiple inline `outline: none` inputs (lines 79, 319, 369) |
| `pages/console/PaneWrapper.tsx` | Inline input (line 1054) |
| `pages/console/ConsolePalette.tsx` | Search input (line 419) |
| `pages/console/index.tsx` | Inline inputs (lines 3540, 3569) |
| `pages/designer/PointPickerModal.tsx` | Local inputStyle (different bg token) |

**Not in scope for migration:** `DesignerRightPanel.tsx` local `inputStyle` (compact panel inputs — intentionally different), `ShapePointSelector.tsx` (already uses `--io-input-bg` and `--io-input-border` correctly — leave as-is), `AuthProviders.tsx` `<style>` tag for checkbox accent-color (separate cleanup item).

---

## Section 2 — Component Promotions Plan

### 2.1 FieldLabel — **DONE 2026-05-28**

#### Source-of-truth location

`frontend/src/pages/designer/DesignerRightPanel.tsx:201–217` — function `FieldLabel({ children })`. This is the only reusable label primitive using correct HTML semantics (`<label>` element) in any of the three modules (Cat 9, List 3 Item 6). Settings `labelStyle` uses a different convention (12px/500/no-uppercase) and is distributed as a style constant, not a component. Console has no label component.

Use Designer DesignerRightPanel as the base; make one size adjustment per the Cat 2 convergence table.

#### API surface for the promoted component

```tsx
interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;  // passes through to <label> for="..." association
}
```

No additional props. `display: block`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.05em"`, `color: "var(--io-text-muted)"`, `marginBottom: 3`.

The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2 table recommendation ("Form field label: 11px / 600 / uppercase / 0.05em / `--io-text-muted`"). All other properties preserved exactly.

#### Target location

`frontend/src/shared/components/FieldLabel.tsx`

#### Consumer files to migrate

| File | Current state | Migration action |
|------|---------------|-----------------|
| `pages/designer/DesignerRightPanel.tsx` | Defines and uses FieldLabel locally (14+ usages at lines 240, 513, 542, 1837, 2274, 2301, 2366, 4038, 4614, 4670, 4798, 4840, 4924, and more) | Remove local definition; add import from shared. **This is the primary migration — zero call-site changes, only change the definition location and import path.** |
| `pages/console/PaneConfigModal.tsx` | Inline `<div>` elements with label-like styles | Replace inline divs with `<FieldLabel>`. Light refactoring; no substantive risk. |
| Settings pages using inline label divs | Various; `labelStyle` constant gives a different visual treatment | These pages use 12px/500/no-uppercase labels via `labelStyle`. The promoted FieldLabel is 11px/600/uppercase. Do not force-migrate settings pages — the Settings form-label convention is visually distinct and internally consistent. **Do NOT migrate Settings `labelStyle` usages to FieldLabel in this workstream.** Revisit in a typography-alignment pass (Phase 5 in recommendations). |

**Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/FieldLabel.tsx` created. API: `{ children, htmlFor? }`. `fontSize: 11` (was 10 in source).
- `DesignerRightPanel.tsx`: local `FieldLabel` function removed; import from shared added. Zero call-site changes — all 14+ usages inherited automatically.
- `PaneConfigModal.tsx`: 6 field labels migrated. Labels were already `<label>` elements (plan said `<div>` — minor discrepancy, semantics were already correct). `htmlFor` added for "Title (optional)" → `id="pane-title"` and "Duration (minutes)" → `id="trend-duration"`. "Pane Type", "Points (max 8)", "Points", "Filter" have no single associated input; migrated without `htmlFor`. Visual change: `fontSize 12 → 11`, `letterSpacing 0.04em → 0.05em` (convergence target per Cat 2 table).
- **Consumers migrated:** 2 (`DesignerRightPanel.tsx`, `PaneConfigModal.tsx`)
- **Consumers deferred:** Settings pages using `labelStyle` (12px/500/no-uppercase — intentionally distinct, not to be migrated per plan). No deferred consumers beyond what the plan already documented.
- `pnpm build` passed with no type errors.

---

### 2.2 StatusBadge — **DONE 2026-05-28**

#### Source-of-truth location

**Base: `frontend/src/pages/settings/Import.tsx:72–110`** — function `StatusBadge({ status })` using token-pair lookup (`bg: "var(--io-success-subtle)", color: "var(--io-success)"` etc.). This is the cleanest implementation: no color math, no string interpolation, adapts to themes automatically (Cat 8, List 3 Item 2).

The `OpcSources.tsx:156–185` post-fix version adds a dot indicator and `color-mix()` for dynamic color, which is useful for status contexts where the exact color is runtime-determined. The shared component should adopt the token-pair approach from Import.tsx (for named status values) as the primary pattern; the dot indicator from OpcSources is a valuable addition as the default visual treatment.

The `SystemHealth.tsx` version also uses `color-mix()` but is tightly coupled to `ServiceStatus` type values — not a good base for a general-purpose shared component.

#### API surface for the promoted component

```tsx
interface StatusBadgeProps {
  status: string;
  label?: string;  // display text; defaults to status string
}
```

No `variant` prop. The promoted component always renders a pill (dot + text). The dot size and pill shape are the `OpcSources` pattern; the color resolution is the `Import.tsx` token-pair lookup. This is the combination of the best elements of both implementations.

Status-to-token-pair mapping (extends Import.tsx, adds OpcSources states):

| Status string(s) | bg token | color token |
|------------------|----------|-------------|
| connected, active, ok, completed, healthy | `--io-success-subtle` | `--io-success` |
| running | `--io-accent-subtle` | `--io-accent` |
| warning, partial, pending, connecting | `--io-warning-subtle` | `--io-warning` |
| error, disconnected, inactive, failed, unhealthy | `--io-danger-subtle` | `--io-danger` |
| cancelled, stopped, unknown | `--io-surface-tertiary` | `--io-text-muted` |
| (default / unrecognized) | `--io-surface-tertiary` | `--io-text-muted` |

Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "capitalize"`, dot `6×6px circle` with `background: color`. This matches OpcSources post-fix layout.

#### Target location

`frontend/src/shared/components/StatusBadge.tsx`

#### Consumer files to migrate

| File | Current implementation | Migration risk |
|------|----------------------|----------------|
| `pages/settings/Import.tsx:72–110` | Token-pair — cleanest; direct migration to shared component (same API) | Low |
| `pages/settings/OpcSources.tsx:156–185` | `color-mix()` + dot; closely matches proposed component design | Low |
| `pages/settings/SystemHealth.tsx:41` | `color-mix()` tied to `ServiceStatus` type; will need status string mapping adjustment | Medium — the ServiceStatus enum values (healthy/unhealthy/warning) must map to the shared status strings |
| `pages/settings/Email.tsx` | Dot-only 7px, token-based | Low — migrate to shared dot+pill pattern; slight visual change (adds label) |
| `pages/settings/PointManagement.tsx:209` | `ActiveBadge({ active: boolean })` — boolean API not string | **Risk item:** API mismatch; `active ? "active" : "inactive"` is a one-line adapter but the component has a different prop signature. Do not force this migration; migrate separately or leave as-is. |
| `pages/settings/Users.tsx:99–115` | `Badge({ label, color })` using hex-alpha concatenation bug | **Risk item:** dynamic color input, not a named-status pattern. Cannot migrate directly to StatusBadge. Needs separate fix (replace `${color}20` with `color-mix(in srgb, ${color} 12%, transparent)` matching the OpcSources fix pattern). **Not a StatusBadge migration; a separate bug fix.** |
| `pages/settings/Roles.tsx:51–53` | Same hex-alpha bug as Users.tsx | Same as above — separate bug fix, not StatusBadge migration |
| `pages/settings/CameraStreams.tsx:785–787` | Same hex-alpha bug | Same — separate bug fix |
| `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
| Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/StatusBadge.tsx` created. API: `{ status: string; label?: string }`. `label` defaults to `status` display text.
- Token-pair map covers plan vocabulary plus additions required by consumers: `sent` (success), `retry` (warning), `degraded` (warning) for Email.tsx and SystemHealth.tsx.
- Token substitution: `--io-surface-tertiary` is undefined in `index.css`. Plan spec used this token (inherited from Import.tsx base which also used it). Substituted with `--io-surface-secondary` (defined). Adds a subtle visible background for neutral/muted states rather than transparent.
- OpcSources migration: the border (`1px solid color-mix(...)`) from the post-fix version is **dropped** — not part of the plan's visual spec. The shared component uses token-pair bg directly.
- OpcSources `inactive` status: current implementation had `inactive → --io-text-muted` (muted); plan maps `inactive → danger`. Migration follows the plan.
- **Import.tsx:** local `StatusBadge` removed; import from shared added. Zero call-site changes.
- **OpcSources.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes.
- **SystemHealth.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Local `STATUS_LABELS` record added to preserve custom display labels (Ready/Degraded/Not Ready/Unknown). All 3 call sites updated with `label` prop.
- **Email.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes. Visual change: dot-only (no background) → dot + pill with background color. Email.tsx `disabled` status (line 339) maps to default muted.
- **Consumers migrated:** 4 (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`)
- **Consumers deferred:** `PointManagement.tsx` (boolean `ActiveBadge` API mismatch — not a substitution); `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` (hex-alpha bug fix, separate pass per DC-6); Console alarm badges (different semantic vocabulary, out of scope per plan).
- **Design note — `inactive` semantic:** Plan maps `inactive → danger`. OpcSources previously showed `inactive` as muted (neutral). The change means a manually-disabled OPC source now shows a red badge. If operator feedback indicates this causes alarm fatigue, move `inactive` to a new `disabled` tier (muted) and add explicit `disabled` as a muted-tier alias. Intentional as executed; flag for UX review in the OpcSources pass.
- `pnpm build` passed with no type errors.

---

### 2.3 Dialog — **DONE 2026-05-28**

#### Source-of-truth location

No shared Dialog wrapper exists today. The existing `shared/components/ConfirmDialog.tsx` uses Radix Dialog and is the implementation model. The promoted Dialog component is a general-purpose wrapper that ConfirmDialog itself can be refactored to use internally (optional; not required for Claim B completion).

**Build new at:** `frontend/src/shared/components/Dialog.tsx`

Radix Dialog is already a project dependency (used by ConfirmDialog, PointManagement, AuthProviders, Email in Settings). Use it as the primitive.

#### API surface for the promoted component

```tsx
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: number;       // default 480
  footer?: React.ReactNode;  // action buttons area; optional
}
```

Visual spec derived from `04-recommendations.md` Cat 11:
- Overlay: `background: var(--io-modal-backdrop)`, `zIndex: var(--io-z-modal)` (= 1000)
- Content: `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)` (= 9px), `border: 1px solid var(--io-border)`, `padding: 24px`, `zIndex: calc(var(--io-z-modal) + 1)`
- Title: 16px / 600 / `var(--io-text-primary)`
- Description: 13px / `var(--io-text-secondary)` / `lineHeight: 1.5`
- ARIA: Radix Dialog provides `role="dialog"` and `aria-modal` automatically; no manual attributes needed
- Position: `position: fixed`, centered via `top: 50%; left: 50%; transform: translate(-50%, -50%)`

#### Consumer files to migrate

| File | Current state | Migration risk |
|------|---------------|----------------|
| `pages/console/index.tsx:3461–3778` — WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog | Hand-rolled inline JSX, `rgba(0,0,0,0.5)` backdrop, `zIndex: 9999`, no ARIA, `var(--io-surface)` bg | **Medium.** Three separate dialog functions; each needs refactoring to use Dialog wrapper. CloseConfirmDialog has a three-button layout (Save/Discard/Cancel) that doesn't fit a simple footer prop — may need a `footer` slot. No Claim C files touched. |
| `pages/console/PaneConfigModal.tsx` | Already uses Radix Dialog; needs backdrop token + bg/radius token fixes | **Low.** Token fixes only; structural refactor not needed. |
| `pages/settings/RestorePreviewModal.tsx` | Plain-div overlay, no ARIA, destructive-adjacent action | **Low to medium.** High-priority accessibility gap (Cat 11, 04-recommendations). Needs ARIA and token fixes; wrapping in Dialog is the right fix. |
| `pages/settings/Certificates.tsx` | Mix of plain-div and correct ARIA patterns | **Low.** Certificate modals with correct ARIA can stay; incorrect ones can be wrapped. |
| Designer-specific dialogs (`TabClosePrompt.tsx`, `IographicExportDialog.tsx`, etc.) | Individual inline-styled dialogs, `position: fixed` (correct, escape canvas transform) | **Medium.** These are not Claim C files (they are standalone dialog files, not inside DesignerCanvas.tsx). Can be migrated to use Dialog wrapper. The `position: fixed` requirement is already met by the shared Dialog component. |
| Designer dialogs inside `DesignerCanvas.tsx` | Claim C territory | **Out of scope.** Do not touch. |

**Risk item — CloseConfirmDialog:** The Save/Discard/Cancel three-button layout requires either a flexible `footer` prop or a specialized variant. Plan for the `footer?: React.ReactNode` prop to cover this case without over-designing.

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/Dialog.tsx` created. API: `{ open, onOpenChange, title, description?, children, width?=480, footer? }`. Uses Radix Dialog for ARIA. Overlay `var(--io-modal-backdrop)` / `zIndex: 1000`. Content `var(--io-surface-elevated)` / `var(--io-radius-lg)` / `zIndex: 1001`.
- **PaneConfigModal.tsx:** Token fixes only — overlay `rgba(0,0,0,0.55)` → `var(--io-modal-backdrop)`, content bg `var(--io-surface)` → `var(--io-surface-elevated)`, content borderRadius `8` → `var(--io-radius-lg)`. Already on Radix Dialog; no structural change.
- **console/index.tsx WorkspaceNameModal:** Replaced hand-rolled overlay divs with Dialog wrapper. Title converges to 16px/600/text-primary (was 14px/text). Escape handling removed from input keyDown (Radix handles via onOpenChange).
- **console/index.tsx DeleteConfirmDialog:** Replaced with Dialog. Bold workspace name preserved via `description?: React.ReactNode` (changed from `string` in initial cut after deep review).
- **console/index.tsx CloseConfirmDialog:** Replaced with Dialog. Three-button footer works via `footer?: ReactNode` prop. Bold workspace name preserved via ReactNode description.
- **RestorePreviewModal.tsx:** Replaced MODAL_OVERLAY + MODAL_BOX + header section with Dialog wrapper. Title/description rendered by Dialog. Top-right Cancel button removed (Radix Escape/overlay click replaces it). Diff table `flex: 1` changed to `maxHeight: 400px` (Dialog content not flex; explicit cap works for migration pass).
- **TabClosePrompt.tsx:** Full rewrite using Dialog. Bold graphic name preserved via ReactNode description. Three-button footer.
- **IographicExportDialog.tsx:** Replaced hand-rolled overlay with Dialog. Header × button removed. Graphic info block and description textarea in children.
- **Consumers migrated:** 6 (`PaneConfigModal.tsx`, `WorkspaceNameModal` in console/index.tsx, `DeleteConfirmDialog` in console/index.tsx, `CloseConfirmDialog` in console/index.tsx, `RestorePreviewModal.tsx`, `TabClosePrompt.tsx`, `IographicExportDialog.tsx` — counting index.tsx as 3 separate consumers = 8 call sites total across 6 files)
- **Consumers deferred:**
  - `pages/settings/Certificates.tsx` — both dialogs already have `role="dialog"`, `aria-modal="true"`, `var(--io-modal-backdrop)`. ARIA gap already addressed; no migration needed.
  - `pages/designer/components/ValidateBindingsDialog.tsx` — panel widget (`position: absolute`), not a modal overlay. Dialog.tsx not applicable.
  - `pages/designer/components/VersionHistoryDialog.tsx` — already uses `VersionRecoveryDialog` (shared component); properly structured.
  - `pages/designer/components/CanvasPropertiesDialog.tsx` — already has `role="dialog"`, `aria-modal="true"`. Primary ARIA gap addressed.
  - `pages/designer/components/RecognitionWizard.tsx` — already has `role="dialog"`. Complex multi-step; no gain from wrapping.
  - `pages/designer/components/IographicImportWizard.tsx` — complex multi-step wizard; more than substitution-level work.
  - `pages/designer/components/CategoryShapeWizard.tsx` — complex multi-step wizard.
  - `pages/designer/components/SaveAsStencilDialog.tsx` — rendered inside DesignerCanvas.tsx (Claim C scope).
  - `pages/designer/components/ShapeDropDialog.tsx` — rendered inside DesignerCanvas.tsx (Claim C scope).
  - `pages/designer/components/PromoteToShapeWizard.tsx` — rendered inside DesignerCanvas.tsx (Claim C scope).
- `pnpm build` passed with no type errors.

---

### 2.4 ConfirmDialog — **DONE 2026-05-28**

#### Current location

`frontend/src/shared/components/ConfirmDialog.tsx` — **already exists and already used widely** (15 import sites across Settings, Designer, and profile pages). This is not a new component; the promotion is: fix the existing implementation's token deviations, then migrate remaining `window.confirm()` call sites.

#### Issues to fix in the existing file

| Issue | Current value | Correct value | Source |
|-------|--------------|---------------|--------|
| Overlay z-index | `zIndex: 100` | `var(--io-z-modal)` (1000) | A13; ConfirmDialog at 100 would be rendered below any element with z-index > 100 — a layering regression |
| Content z-index | `zIndex: 101` | `calc(var(--io-z-modal) + 1)` | Same; content must be above overlay |
| Content background | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` | Cat 11 recommendations; modal content bg should be elevated, not secondary |
| Content borderRadius | `"10px"` hardcoded | `var(--io-radius-lg)` (= 9px) | Cat 11 standardization; `--io-radius-lg` is registered |
| Confirm button text | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` | Canonical token; `--io-text-on-accent` is an alias so functionally equivalent after A5, but canonical form preferred |

These are all localized changes within `ConfirmDialog.tsx` — no call-site changes required.

#### window.confirm() replacements

The audit (Cat 11) cited 8 `window.confirm()` calls in Settings. Current codebase grep (2026-05-28) finds 5 calls in different locations:

| File | Line | Call | Notes |
|------|------|------|-------|
| `pages/dashboards/index.tsx` | 674 | Delete dashboard | **Out of scope — dashboards module (see Section 7 Item 8)** |
| `pages/designer/DesignerReportsList.tsx` | 328 | Delete report template | Designer file; safe to migrate |
| `pages/designer/DesignerDashboardsList.tsx` | 334 | Delete dashboard | Designer file; safe to migrate |
| `pages/settings/CameraStreams.tsx` | 1004 | Destructive action | Settings file |
| `pages/dashboards/PlaylistManager.tsx` | 567 | Delete playlist | **Out of scope — dashboards module (see Section 7 Item 8)** |

The 3 OpcSources, 3 Import, and 1 SupplementalConnectorsTab calls cited in the audit doc are not present in current code — likely already addressed before this planning session. **Do not re-audit these files for this plan entry; verify at execution time with a grep before writing.**

**`createPortal` check:** Each `window.confirm()` replacement must verify the calling component is not inside a `react-grid-layout` transform ancestor. If it is, the ConfirmDialog must be rendered via `createPortal(el, document.body)` per the CLAUDE.md invariant. `dashboards/index.tsx` and `PlaylistManager.tsx` are excluded from this workstream (Section 7 Item 8) — do not migrate them here. Document for a future dashboards-module pass.

#### No consolidation needed

There is no second `ConfirmDialog` implementation to merge. `DesignerLeftPalette.tsx:217` defines a local `DeleteConfirmDialog` function but it is module-specific (not a re-implementation of the shared ConfirmDialog); it is a candidate for future migration (see Section 6).

#### Existing consumers — no changes needed

The 15 existing import sites already use the component correctly. After the token fixes, they inherit the corrected values automatically. No call-site migration required for existing consumers.

**Execution notes (2026-05-28):**
- Pre-execution read of `ConfirmDialog.tsx` confirmed all 5 current values matched the issue table exactly: overlay `zIndex: 100`, content `zIndex: 101`, content `background: var(--io-surface-secondary)`, content `borderRadius: "10px"`, confirm button `color: var(--io-text-on-accent)`.
- Token fixes applied to `shared/components/ConfirmDialog.tsx`: overlay `zIndex: 100` → `"var(--io-z-modal)"`, content `zIndex: 101` → `"calc(var(--io-z-modal) + 1)"`, content bg `var(--io-surface-secondary)` → `var(--io-surface-elevated)`, content borderRadius `"10px"` → `var(--io-radius-lg)`, confirm text color `var(--io-text-on-accent)` → `var(--io-accent-foreground)`. All 15 existing consumers inherit changes automatically; no call-site changes needed.
- `window.confirm()` pre-execution grep: 5 calls found (matches plan). 2 in dashboards module (out of scope per Section 7 Item 8); 3 in scope.
- **`DesignerReportsList.tsx`:** `handleDelete` changed to set state; ConfirmDialog added to JSX. Message preserved verbatim: "Delete this report template? This cannot be undone." `variant="danger"`.
- **`DesignerDashboardsList.tsx`:** Same pattern. Message: "Delete this dashboard? This cannot be undone." `variant="danger"`.
- **`CameraStreams.tsx`:** Inline onClick replaced with `setConfirmDelete(s)`. ConfirmDialog renders dynamic message `Delete "${confirmDelete.name}"? This cannot be undone.` Stores full `VideoStream` object in state to access `.name` for the description. `setDeleteError(null)` preserved in `onConfirm` (was in the original onClick). `variant="danger"`.
- **createPortal check:** None of the 3 consumer components are inside a `react-grid-layout` transform. No portal needed.
- **Consumers migrated (window.confirm()):** 3 (`DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx`)
- **Consumers deferred (window.confirm()):** 2 — `dashboards/index.tsx` and `PlaylistManager.tsx` (out of scope per Section 7 Item 8; documented for dashboards-module pass).
- **Consumers deferred (existing ConfirmDialog users needing review):** `DesignerLeftPalette.tsx` local `DeleteConfirmDialog` (DC-5 in Section 6; not a substitution-level migration).
- `pnpm build` passed with no type errors.

---

## Section 3 — Sequencing

### Phase 1 — Constants files (pure additions, no consumer changes)

These are new files with no imports to update. They unblock consumer migration but do not require it in the same PR.

1. `shared/styles/buttons.ts` + companion `buttons.css`
2. `shared/styles/inputs.ts` + companion `inputs.css`

**Why first:** Zero risk. Creates the foundation that consumers will later import. Does not modify any existing file.

### Phase 2 — FieldLabel (simplest component; no dependencies on Phase 1)

3. Create `shared/components/FieldLabel.tsx` (promoted from DesignerRightPanel)
4. Migrate `DesignerRightPanel.tsx` — remove local definition, add shared import (mechanical; no call-site changes)

**Why second:** FieldLabel has no dependency on constants files. The migration of DesignerRightPanel is zero-risk (no behavioral change, only import path). Console and Settings consumer migration is deferred to the follow-up pass.

### Phase 3 — StatusBadge (no dependencies; token pairs already in index.css)

5. Create `shared/components/StatusBadge.tsx`
6. Migrate Settings `Import.tsx` and `OpcSources.tsx` StatusBadge (direct replacement; same API shape)
7. Migrate `SystemHealth.tsx` StatusBadge (requires status string mapping adjustment)

**Why third:** StatusBadge has no dependencies on Phase 1 or Phase 2. Token pairs (`--io-success-subtle`, `--io-danger-subtle`, etc.) were already defined before Claim B. Import.tsx and OpcSources.tsx are low-risk. SystemHealth migration is deferred within Phase 3 if it requires more investigation.

### Phase 4 — Dialog (new component; model is ConfirmDialog)

8. Create `shared/components/Dialog.tsx`
9. Migrate `RestorePreviewModal.tsx` (highest-priority ARIA gap; destructive-adjacent path)
10. Migrate Console inline modals (`WorkspaceNameModal`, `CloseConfirmDialog`, `DeleteConfirmDialog` in `index.tsx`)

**Why fourth:** Dialog wrapper needs ConfirmDialog as the implementation model (which exists). The z-index tokens and backdrop token are already defined (Claim A). RestorePreviewModal is the highest-priority accessibility gap from the audit.

### Phase 5 — ConfirmDialog fixes + window.confirm() migration

11. Fix z-index, bg token, radius token in `shared/components/ConfirmDialog.tsx`
12. Replace `window.confirm()` calls in `DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx` with ConfirmDialog (portal check first for dashboards files)

**Why last:** ConfirmDialog token fixes are mechanical but affect all 15 existing consumers (they inherit the changes). Do this after Dialog is stable so the two components are consistent.

### Consumer migration (deferred unless part of initial scope)

All remaining consumers of buttons.ts and inputs.ts (Console toolbar buttons, Settings BulkUpdate, Designer text-actions, etc.) are a follow-up pass after the initial five deliverables are confirmed stable.

---

## Section 4 — Multi-Module Implications and Eight-Module Rebuild Considerations

### buttons.ts

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| `var(--io-accent-foreground)` as primary text | All eight rebuilt modules will use this for any primary/accent button text color. Ensures future modules don't re-introduce `#fff` hardcoding. | No — canonical token, clear choice |
| `fontWeight: 600` on secondary | Eight modules will get 600-weight secondary buttons by default. If any rebuilt module wants a lighter secondary, it will be a deliberate override rather than an accident. | No |
| Hover via companion CSS class | Requires consumer code to spread both `style={btnPrimary}` and `className={buttonBaseClass}`. Eight rebuilt modules need to follow this two-part pattern. | **Yes** — the pattern of "constants file + companion CSS" is new; confirm the approach fits the project's styling conventions before locking it in for eight modules |
| Excluding `--io-btn-*` tokens | The six registered `--io-btn-*` tokens in `index.css` remain unused. This workstream does not adopt them. If a future workstream adopts them, all buttons.ts consumers would need re-migration. | No — the audit explicitly confirms all three modules ignore these tokens; the constants approach is correct |

### inputs.ts

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| `--io-surface-sunken` as standard input background | Eight rebuilt modules use this for all form inputs by default. Differs from some current Designer inline inputs (`--io-surface`) — confirm this is the intended convention for all new modules. | **Yes** — background token choice sets visual depth convention for all future inputs. Visually `--io-surface-sunken` is slightly deeper/darker than `--io-surface`. Confirm this is correct for the app's form language. |
| No `outline: none` in inputStyle | All eight rebuilt modules' inputs will show the browser focus ring by default. The `inputs.css` companion adds a styled `:focus-visible` ring. This is the right accessibility behavior but a visible change from current practice. | No — accessibility improvement; correct direction |
| DesignerRightPanel compact inputs exempted | Eight rebuilt modules may have similar compact inspector panels. The exemption pattern (local inputStyle for inspector vs. shared for form inputs) should be documented as a convention for future modules. | No — document in a comment in inputs.ts |

### FieldLabel

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| 11px / uppercase / 0.05em convention | Eight rebuilt modules will use this exact treatment for all form field labels. This differs from Settings' current labelStyle (12px / 500 / no uppercase). | **Yes** — this locks in the form label visual language for all future modules. If the preference is Settings-style (no uppercase), the component should be built differently. The Cat 2 table endorses 11px/uppercase/0.05em as the convergence target, but confirm before building the promoted component. |

### StatusBadge

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| Status-to-token-pair mapping | Eight rebuilt modules will use this vocabulary for all connection and operational status indicators. Adding new status values requires updating the shared component. | No — the vocabulary covers standard operational states; additions are additive |
| Dot + text always (no dot-only variant) | Some current uses are dot-only (Email). The shared component always renders dot + label text. Dot-only becomes `<StatusBadge status="connected" label="" />` (empty label) or requires a variant. | No — minor; empty label is workable |

### Dialog

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| Radix Dialog as the primitive | All eight rebuilt modules' general-purpose dialogs will use Radix. This is already the direction established by ConfirmDialog and Settings pages. | No — consistent with existing practice |
| `--io-z-modal: 1000` as dialog z-index | All future dialogs will stack at 1000. Established by A13 (Claim A). | No — already decided |
| `--io-surface-elevated` as modal content bg | Eight modules will use this surface tier for modal backgrounds. | No — consistent with recommendations |

### ConfirmDialog

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| z-index fix to `var(--io-z-modal)` | **Breaking change for existing consumers:** any component currently rendered with `z-index > 100` that appears above ConfirmDialog in the current (broken) state will behave differently after the fix. Existing consumers may rely on the incorrect stacking. Test all 15 existing consumers visually after the fix. | **Yes — verify existing consumers.** The z-index fix is correct but touches 15 active call sites indirectly. |

---

## Section 5 — Definition of Done for Initial Claim B Scope

All five criteria must be verifiable before Claim B is marked complete.

1. **`shared/styles/buttons.ts` exists** with `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` exported. Companion `buttons.css` exists with `.io-btn:focus-visible` and `.io-btn:hover` rules. All token references (`var(--io-accent)`, `var(--io-accent-foreground)`, `var(--io-text-secondary)`, `var(--io-border)`, `var(--io-danger)`, `var(--io-radius)`) are confirmed defined by running `grep -E "(--io-accent|--io-accent-foreground|--io-text-secondary|--io-border|--io-danger|--io-radius):" frontend/src/index.css` before the file is written. `grep -r "--io-btn-" frontend/src/shared/styles/buttons.ts` returns no results (not using the unused `--io-btn-*` tokens).

2. **`shared/styles/inputs.ts` exists** with `inputStyle`, `inputClassName` exported. Companion `inputs.css` exists with `.io-input:focus-visible` rule. Background token is `var(--io-surface-sunken)`. No `outline: none` in the exported style object.

3. **`shared/components/FieldLabel.tsx` exists** at that path. Props are `{ children: React.ReactNode; htmlFor?: string }`. `fontSize` is `11` (not 10). `DesignerRightPanel.tsx` no longer defines a local `FieldLabel` function; it imports from `shared/components/FieldLabel`. `pnpm build` passes with no type errors.

4. **`shared/components/StatusBadge.tsx` exists**. Token-pair mapping covers at minimum: connected/active/ok/completed/healthy (success), running (accent), warning/pending/connecting (warning), error/disconnected/failed (danger), cancelled/stopped/unknown (muted). Settings `Import.tsx` and `OpcSources.tsx` import from the shared component instead of defining local functions. `pnpm build` passes.

5. **`shared/components/Dialog.tsx` exists**. Uses Radix Dialog. Overlay uses `var(--io-modal-backdrop)` and `var(--io-z-modal)`. Content uses `var(--io-surface-elevated)` and `var(--io-radius-lg)`. ARIA is Radix-provided (no manual `role="dialog"` needed). At minimum `RestorePreviewModal.tsx` uses Dialog (highest-priority ARIA gap resolved).

6. **`shared/components/ConfirmDialog.tsx` is patched**: **Pre-execution step required — read `ConfirmDialog.tsx` before writing and confirm the current values match what the issue table states** (overlay `zIndex: 100`, content `zIndex: 101`, `background: var(--io-surface-secondary)`, `borderRadius: "10px"`). After patching: overlay `zIndex` is `var(--io-z-modal)`, content `zIndex` is `calc(var(--io-z-modal) + 1)`, content `background` is `var(--io-surface-elevated)`, `borderRadius` is `var(--io-radius-lg)`. All 15 existing consumers verified visually (no regression from z-index change). All `window.confirm()` call sites in `DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, and `CameraStreams.tsx` replaced with `ConfirmDialog`.

7. **Consumer migration plan exists**: for each constants file and each promoted component, a list of remaining unconverted consumers is documented (either in this file's consumer tables, updated to mark migrated vs. deferred, or in a follow-up task).

8. **`02-comparison.md` and `04-recommendations.md` updated**: Claim B deliverables noted in the relevant rows with `Fixed [date]: Claim B`.

---

## Section 5b — Lessons from Claim A Applied

From `06-claim-a-plan.md` Section 6. Each lesson is assessed for applicability to this workstream.

| Lesson | Applicable? | How addressed |
|--------|-------------|---------------|
| **L1 — Deferred gates are hard gates.** Items marked deferred in a plan must not be executed until the gate is explicitly cleared. | Yes | Section 7 enumerates 10 hard out-of-scope items. Section 6 deferred candidates are not active scope. No Section 6 item may be executed within this workstream without an explicit re-prioritization decision. |
| **L2 — Verify "undefined" claims before writing fixes.** Grep before assuming a token is absent. | Yes | DoD criterion 1 now specifies the exact grep command to run against `index.css` before writing `buttons.ts`. The same verification applies to `inputs.ts` token references and to the `--io-input-bg` vs. `--io-surface-sunken` value claim (run `grep ": --io-input-bg\|: --io-surface-sunken" frontend/src/index.css` to confirm visual equivalence before publishing inputs.ts). |
| **L3 — Alias over code-replacement for Claim C files.** When a consumer is inside a Claim C file, prefer a token alias over in-file edits. | Not applicable | No token registry additions are planned for Claim B. All Claim A token aliases are already defined. Claim C files are fully excluded from this workstream (Section 7, Item 4). |
| **L4 — Single-consumer tokens: fix the consumer, not the registry.** Do not define a new token with only one consumer if an existing token serves the same purpose. | Not applicable | Claim B adds no new tokens to `index.css`. |
| **L5 — Describe mechanism, not visual effect.** Plan entries for CSS fixes should specify exact property-value changes. | Yes | Variant specification blocks in Sections 1.1 and 1.2 provide exact TypeScript objects with property names and values. FieldLabel spec in 2.1 specifies all properties. Dialog visual spec in 2.3 specifies tokens and computed values. Sequencing descriptions remain effect-oriented (e.g., "unblocks consumer migration") but no CSS fix entries rely on visual-effect-only descriptions. |
| **L6 — DoD grep scopes must be explicit.** "Confirmed by grep" is insufficient; name the exact scope. | Yes | DoD criterion 1 now contains an explicit grep command with file path. DoD criterion 6 now requires reading `ConfirmDialog.tsx` before writing to verify current-state values match the issue table. Any additional DoD criterion involving a verification check must name the file or path explicitly — not "confirmed by grep" without a target. |
| **L7 — Pre-execution token validation is a required first step.** Treat token validation as mandatory before any token-touching task, even for "obviously present" tokens. | Yes | DoD criterion 1 requires the grep before writing `buttons.ts`. DoD criterion 6 requires reading `ConfirmDialog.tsx` before writing. For `inputs.ts`, run `grep "io-surface-sunken" frontend/src/index.css` to confirm the token exists and check its value against `--io-input-bg` before writing. These are not optional steps. |

---

## Section 6 — Deferred Promotion Candidates

Components and patterns that surfaced during planning as future promotion candidates. Not in scope for this workstream.

### DC-1 — `IconBtn` (Designer)

**What:** Reusable icon button primitive at `DesignerToolbar.tsx:904–948`. 32×32, `var(--io-radius)`, `transition: background 0.1s, color 0.1s`, hover `var(--io-surface-elevated)`.

**Where:** `frontend/src/pages/designer/DesignerToolbar.tsx:904–948`

**Why it could be promoted:** Only icon button component with correct hover/transition behavior in any module. Console and Settings have zero hover states on icon-like buttons. A shared `IconBtn` would fix hover for all modules at once.

**Evidence needed to justify:** At least one other module needs the same icon-button pattern before promotion. After Settings and Console migrate their buttons.ts constants, assess whether they would benefit from an IconBtn component or if the simpler className-based hover approach (buttons.css) is sufficient.

---

### DC-2 — `SettingsPageLayout` (Settings)

**What:** Shared component at `frontend/src/shared/components/SettingsTabs.tsx` context; `SettingsPageLayout.tsx` renders page title (`<h2>` 18px/600), description (13px/muted), and optional action area. Used consistently across all Settings sub-pages.

**Where:** `frontend/src/pages/settings/SettingsPageLayout.tsx` (inferred; not independently verified during planning)

**Why it could be promoted:** Console and Designer have no equivalent page-title component. Console uses raw inline text for the module name; Designer has no consistent page-level heading. A shared `PageLayout` or `PageHeader` component would give all rebuilt modules a consistent heading hierarchy from day one.

**Evidence needed to justify:** Requires confirming `SettingsPageLayout` is at a stable, module-agnostic location. Its current path under `pages/settings/` would need to move to `shared/components/` for cross-module use. Do this after at least one rebuilt module has a clear need for it.

---

### DC-3 — `ContextMenu` danger-item token fix

**What:** `shared/components/ContextMenu.tsx` currently uses `var(--io-alarm-urgent)` for danger menu items instead of `var(--io-danger)`. Both resolve to `#ef4444` in dark theme but diverge in light/HPHMI themes.

**Where:** `frontend/src/shared/components/ContextMenu.tsx` — danger item color

**Why it could be promoted:** Single-line token fix with no API change. Would bring ContextMenu into compliance without introducing a new component.

**Evidence needed to justify:** Not a promotion candidate — this is a bug fix. Should be executed as a standalone fix, not as a component promotion. Excluded from Claim B scope because it doesn't fit the "promotion" pattern, but it is low-risk and can land at any time.

---

### DC-4 — `SectionLabel` (palette/panel group headers)

**What:** The 11px / 600 / uppercase / 0.06em / `--io-text-muted` group header label pattern used in Console palette (`ConsolePalette.tsx` section headers), Designer left palette (`SectionHeader`), and Settings nav groups (post-B4 fix). This is distinct from `FieldLabel` (which is for form fields, 0.05em) and could be a separate promoted component.

**Where:** Console `ConsolePalette.tsx` (section headers); Designer `DesignerLeftPalette.tsx` (SectionHeader); Settings `index.tsx` (nav group headers)

**Why it could be promoted:** Three modules have converged on this exact typography for group/section labels. A `SectionLabel` component would lock in the convention and prevent future drift.

**Evidence needed to justify:** The three implementations are currently inline styles / local components, not causing active bugs. Promote after the four initial components are stable and at least one rebuilt module needs to create a side-panel section header — at that point, sharing the component pays off immediately.

---

### DC-5 — `DeleteConfirmDialog` in DesignerLeftPalette

**What:** Local `DeleteConfirmDialog` function at `DesignerLeftPalette.tsx:217` — rolls its own Radix Dialog for confirming stencil/graphic deletion, instead of using the shared `ConfirmDialog`.

**Where:** `frontend/src/pages/designer/DesignerLeftPalette.tsx:217`

**Why it could be promoted:** After ConfirmDialog is patched, this local version should be migrated to use the shared component. This is a consumer migration, not a new promotion.

**Evidence needed to justify:** No new evidence needed. Execute as part of the ConfirmDialog consumer migration pass after Claim B core deliverables land.

---

### DC-6 — Hex-alpha badge bug fix (Users, Roles, CameraStreams, MaintenanceTicketsPanel)

**What:** Four files have a `Badge({ label, color })` function using the `${color}20` / `${color}40` hex-alpha concatenation bug. When `color` is a CSS custom property string (`var(--io-...)`), the concatenation produces an invalid color value.

**Where:** `Users.tsx:108/110`, `Roles.tsx:51/53`, `CameraStreams.tsx:785/787`, `MaintenanceTicketsPanel.tsx:52`

**Why it could be promoted:** This is not a StatusBadge migration candidate (dynamic color input, not named-status pattern). Fix is to replace `${color}20` with `color-mix(in srgb, ${color} 12%, transparent)` — the same fix applied to OpcSources.tsx in Claim A/regression pass.

**Evidence needed to justify:** These are bugs, not promotion candidates. Execute as a standalone bug-fix pass after Claim B core deliverables. The fix pattern is already established (OpcSources fix).

---

## Section 7 — Scope Discipline for Execution

The following are explicitly **out of scope** for this workstream:

1. **Promoting components beyond the initial four.** No new shared components beyond FieldLabel, StatusBadge, Dialog, and the ConfirmDialog fix. Promotion candidates from Section 6 do not become active scope unless explicitly re-prioritized.

2. **Building a component library framework.** No Storybook, no design-token export system, no Radix Themes integration, no CSS-in-JS system. The deliverables are a constants file and four components, not a component architecture. **This is a permanent architectural exclusion for this project, not a deferred workstream item — no planned future workstream will introduce a component framework.**

3. **Migrating all consumers.** Full migration of every inline button and input in Console, Designer, and Settings is a follow-up pass. The initial scope proves out the shared artifacts; bulk migration is a separate workstream.

4. **Touching canvas-layer files.** Per `05-claim-c-deferral.md` Section 4: `DesignerCanvas.tsx`, `WorkspaceGrid.tsx`, `SceneRenderer.tsx`, `alarmFlash.css`, `operationalState.css`, `lod.css` are off-limits. Any dialog inside DesignerCanvas.tsx is also off-limits for Dialog migration.

5. **Typography scale token migration.** The `--io-text-*` scale tokens in `index.css` are defined but unused across all three modules. Migrating raw pixel sizes to these tokens is explicitly deferred per `04-recommendations.md` Section 2, Cat 2.

6. **Hover/focus DOM-mutation replacement.** Replacing `onMouseEnter`/`onMouseLeave` style mutations with CSS `:hover` across all interactive elements is Phase 5 work per the recommendations. The companion CSS files (buttons.css, inputs.css) address the specific elements covered by the new constants; everything else is deferred.

7. **ARIA gap completion.** The Dialog component and ConfirmDialog fix address the highest-priority ARIA gaps (RestorePreviewModal, console inline modals). The full ARIA pass across all dialogs (Designer wizard dialogs, Import/OpcSources Settings modals) is follow-up scope.

8. **`window.confirm()` in dashboards module.** `dashboards/index.tsx` and `PlaylistManager.tsx` are not Console, Designer, or Settings. They are out of scope for this workstream; their window.confirm() calls are listed in Section 2.4 for documentation only — deferred to a future dashboards-module pass.

9. **ContextMenu token fix.** The `var(--io-alarm-urgent)` → `var(--io-danger)` fix in ContextMenu.tsx is a bug fix, not a component promotion. It can land any time as a standalone PR but is not gated on or gating this workstream.

10. **settingsStyles.ts removal.** The existing `settingsStyles.ts` is not deleted as part of this workstream. Consumer migration happens file-by-file; settingsStyles.ts remains as a compatibility shim until all its consumers are migrated in a follow-up pass.

---

## Section 8 — Lessons from Claim B

**Workstream declared complete 2026-05-28.**

### L1 — Was the conservative initial scope the right call?

Yes. The initial scope (2 constants files + 4 components) was exactly right.

The four component promotions were all cleaner to execute than a larger scope would have been. Nothing required heroics. FieldLabel and StatusBadge were mechanical replacements — zero call-site changes for the primary consumers. Dialog and ConfirmDialog were more complex (consumer-by-consumer rewrites), but each migration was self-contained and build-verified. There was no accumulated complexity from tackling more than four components at once.

The Section 6 candidates (DC-1 through DC-6) remained correctly deferred. Nothing in the execution surfaced a reason to pull them in. The wizard dialogs (IographicImportWizard, CategoryShapeWizard) validated the exclusion: they are multi-step flows where the Dialog wrapper would add structure without simplifying the complexity. Leaving them deferred was correct.

One soft lesson: the consumer migration pass is inherently slower than the promotion pass. Two constants files were created in one phase; consuming them fully across 10+ files is a separate workstream. Future plans should be explicit that "create the shared artifact" and "migrate all consumers" are different work items with different timelines.

### L2 — Which Section 6 candidates now have strong enough evidence to promote in a near-term follow-up pass?

Ordered by readiness:

**DC-6 (Hex-alpha badge bug fix) — Ready now.** Not a promotion; a bug fix. Pattern fully established (OpcSources fix in Claim A). Four files, same three-line fix each. Should land as a standalone PR before the module rebuild begins. No planning needed.

**DC-3 (ContextMenu danger-item token fix) — Ready now.** One-line token replacement. `var(--io-alarm-urgent)` → `var(--io-danger)` in `shared/components/ContextMenu.tsx`. No planning needed.

**DC-5 (DeleteConfirmDialog in DesignerLeftPalette) — Ready in next consumer migration pass.** The shared ConfirmDialog is now correctly patched. Migrating the local `DeleteConfirmDialog` at `DesignerLeftPalette.tsx:217` is a single-file consumer migration with no design decisions required.

**DC-4 (SectionLabel component) — Promote in module-rebuild planning pass.** Three modules have converged on 11px/600/uppercase/0.06em for group headers. Enough evidence exists. Promote when the first rebuilt module needs a side-panel section header — at that point the component pays back immediately and locks in the convention.

**DC-1 (IconBtn) — Evaluate after buttons.ts consumer migration.** The hover/transition behavior of IconBtn is the best in the codebase, but Console and Settings don't yet have icon-button patterns to compare it against. After buttons.ts consumer migration, assess whether the className-based approach in buttons.css is sufficient or whether a shared component adds value. Do not promote prematurely.

**DC-2 (SettingsPageLayout) — Evaluate at module-rebuild start.** Moving `SettingsPageLayout` from `pages/settings/` to `shared/components/` is a path change with no behavioral change. Do it at the point when the first rebuilt module needs a consistent page-level heading — not before. Low risk, low urgency.

### L3 — Did any API choice show signs of becoming a wrong abstraction?

**Dialog.description: ReactNode (intentional drift, well-contained).** The plan specified `string`; execution upgraded to `React.ReactNode` because three consumers needed bold/formatted content (workspace names, graphic names). The change is backward-compatible and the pressure came from real consumer needs, not aesthetics. Not a wrong abstraction — a correct response to discovered requirements. Keep it.

**Dialog.tsx z-index literals (minor inconsistency, not a wrong abstraction).** Dialog uses numeric `1000`/`1001` with comments; ConfirmDialog uses `"var(--io-z-modal)"` CSS token strings. Both work. The inconsistency only matters if the z-index scale changes. Fix in a cleanup pass, not a workstream. Low urgency.

**`--io-surface-tertiary` undefined (token gap, not a component API issue).** StatusBadge's muted-state plan referenced `--io-surface-tertiary` (inherited from Import.tsx base), which is not registered in index.css. Substituted `--io-surface-secondary`. The component API is fine; the token registry has an implicit gap. Flag for a token audit: either register `--io-surface-tertiary` as distinct from `--io-surface-secondary`, or formally adopt `--io-surface-secondary` as canonical for muted badge backgrounds.

**StatusBadge `inactive` → danger semantic (UX flag, not an API issue).** The plan maps `inactive` to danger (red). OpcSources previously showed it as muted. A manually-disabled OPC source now shows a red badge, which may cause alarm fatigue. The component API is correct (the mapping is a deliberate choice, not an accident). Flag for UX review when OpcSources gets its dedicated pass.

No API choice needs to be reversed before the module rebuild.

### L4 — What should change about how the next promotion pass is planned?

**Separate "create artifact" from "migrate consumers" explicitly in the plan.** This workstream completed both for some items and only the first for others. The checkin revealed that all Section 5 DoD criteria were met, but the consumer migration tables had a long tail. Future plans should have two distinct completion criteria: (a) artifact created and primary consumer migrated, and (b) full consumer migration complete. Mark (a) as "Claim B done" and (b) as "follow-up pass."

**Run DC-6 and DC-3 as background fixes, not workstream items.** These are one-file bug fixes with no design decisions. They don't need a plan section — they need a PR. Block the module rebuild on them, not on a future workstream declaration.

**Inventory consumers before planning sequencing.** This workstream planned sequencing (Phases 1–5) from the audit findings. At execution time, the window.confirm() grep found different files than the plan listed (OpcSources and Import had already been addressed; DesignerReportsList and DesignerDashboardsList were new). A pre-execution grep of every consumer type (button styles, input styles, StatusBadge usages, Dialog patterns) should be a mandatory first step in future promotion plans, not something discovered mid-execution.

**Plan for the deferred wizard dialogs separately.** The multi-step wizard dialogs (IographicImportWizard, CategoryShapeWizard, PromoteToShapeWizard, RecognitionWizard) need their own pass with a different approach: not wrapping in Dialog but auditing their step indicator patterns, reviewing ARIA, and standardizing the visual vocabulary. Lumping them with simpler Dialog migrations in a future plan would mix unrelated work.
