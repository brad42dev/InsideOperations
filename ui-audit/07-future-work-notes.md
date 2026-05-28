# Future Work Notes — Post-Claim-A Implications

**Written:** 2026-05-27 (Claim A close)  
**Feeds into:** Claim C revisit (Workstream 5) and the eight-module rebuild program  
**Source:** `06-claim-a-plan.md` Section 5, `06c-claim-a-drift-checkin.md`, Claim A execution record

---

## implications-for-claim-c-revisit

Claim C reopens only after Claim A and Claim B are both complete and reviewed (per `05-claim-c-deferral.md` Section 5). The following Claim A outcomes have direct downstream effects on Claim C scope and sequencing.

### Tokens that Claim C can now reference without re-entering the token layer

All of the following were undefined at the time Claim C was deferred; they are now defined:

| Token | Defined value | Claim C usage |
|---|---|---|
| `--io-alarm-inactive` | `#808080` (all three themes) | `alarmFlash.css` off-state hex migration (05 Section 3.1) |
| `--io-text-inverse` | Dark=#09090b, light=#ffffff, hphmi=#0f172a | DesignerCanvas resize handle fix (05 Section 3.4) — was already defined; A12 plan claim was wrong |
| `--io-error` | Alias: `var(--io-danger)` | DesignerCanvas context menu destructive color (05 Section 3.5) — already resolves via alias; no code change needed in DesignerCanvas |
| `--io-bg` | Alias: `var(--io-surface-primary)` | WorkspaceGrid container background (05 Section 3.2) — already resolves via alias; no code change needed in WorkspaceGrid |
| `--io-overlay` | Alias: `var(--io-modal-backdrop)` | Any Claim C dialog that needs a backdrop token |
| `--io-accent-rgb` | Per-theme RGB triplet values | Any Claim C component using `rgba(var(--io-accent-rgb), ...)` for tinted overlays |

### Alias-resolved Claim C items (zero code touches required in Claim C files)

Two Claim C items from `05-claim-c-deferral.md` are now automatically resolved by token aliases and require no code change when Claim C executes:

- **05 Section 3.5 — DesignerCanvas context menu destructive color:** `--io-error` now aliases `--io-danger`. The reference in DesignerCanvas already renders the correct color. Claim C should verify the visual (it will be correct) and remove the finding from its task list.
- **05 Section 3.2 — WorkspaceGrid container background:** `--io-bg` now aliases `var(--io-surface-primary)`. The container background now resolves correctly. Same: verify and close.

These are not blocked on Claim B. They are already done.

### Z-index scale is permanent — Claim C must coordinate with it

A13 set the permanent z-index scale (accepted 2026-05-27):

```
--io-z-dropdown:    500
--io-z-modal:      1000
--io-z-command:    1200
--io-z-visual-lock: 1500
--io-z-kiosk-auth: 1800
--io-z-toast:      2000
--io-z-emergency:  3000
```

DesignerCanvas uses internal `zIndex` values in the 300–2000 range for context menus, guide overlays, and floating panels. Before Claim C makes any z-index change inside `DesignerCanvas.tsx`, all internal values must be audited and mapped to this scale. Do not set any `zIndex` inside a Claim C file without first checking whether the value belongs to one of the named scale levels above.

### Sidebar width does not affect the canvas seam

A14 (220px) does not change the canvas boundary. Console's `WorkspaceGrid` and Designer's `DesignerCanvas` span the remaining viewport width after the sidebar; the seam is CSS-flex-driven and agnostic to the sidebar's pixel value. No Claim C scoping decision depends on the A14 outcome.

### selection.css + MarqueeLayer.tsx are already fixed (Cat 10 highest-priority items)

The selection overlay regression (`var(--accent)` prefix bug) was fixed in Claim A per the recommendations. These files should not appear in Claim C's task list. Verify at the start of Claim C that no regression was introduced between now and Claim C's start date.

---

## implications-for-module-rebuild

The eight modules being rebuilt around the converged Console/Designer/Settings foundation inherit all shell conventions locked in by Claim A. The following are non-negotiable constraints for all rebuilt modules, derived from decisions made during Claim A.

### Hard constraints (established by Claim A; cannot be overridden without a cross-module decision)

| Convention | Value | Basis |
|---|---|---|
| Side panel background | `var(--io-surface-secondary)` | B1 corrected Designer to match Console/Settings; now universal |
| Active nav item indicator | `borderLeft: 2px solid var(--io-accent)` + `padding: 7px 10px 7px 8px` (transparent border on inactive) | B2 implementation; uniform-padding approach is the correct mechanism |
| Sidebar width token | `var(--io-sidebar-width)` = 220px | A14 decision; no hardcoded integer permitted |
| Nav group header typography | 11px / 600 / uppercase / 0.06em / `var(--io-text-muted)` | Consensus across Console, Designer, Settings (B4 aligned Settings) |
| Toolbar surface | `var(--io-surface)` + `borderBottom: 1px solid var(--io-border)` | Console+Designer consensus; NOT `var(--io-surface-primary)` |
| Token hygiene | No reference to any token not defined in `index.css` | Zero undefined token references is the post-Claim-A baseline |

### Token registry as of Claim A close (2026-05-27)

The following tokens were added or corrected during Claim A and are now authoritative. Rebuilt modules must use these tokens where applicable:

- `--io-bg` → `var(--io-surface-primary)` (page/container backgrounds)
- `--io-text` → `var(--io-text-primary)` (default text color)
- `--io-surface-hover` → `var(--io-surface-elevated)` (hover state surfaces)
- `--io-font-sans` → full Inter/system sans-serif stack (sans-serif font family)
- `--io-text-on-accent` → `var(--io-accent-foreground)` (text on accent-bg buttons)
- `--io-error` → `var(--io-danger)` (error/destructive color)
- `--io-surface-raised` → `var(--io-surface-elevated)` (raised surface alias)
- `--io-overlay` → `var(--io-modal-backdrop)` (modal/dialog backdrop)
- `--io-accent-rgb` → per-theme RGB triplet (for rgba() composition)
- `--io-alarm-inactive` → `#808080` (alarm off-state color for `alarmFlash.css` migration)
- `--io-z-modal` → 1000 (full scale established; see scale table above)
- `--io-sidebar-width` → 220px

No rebuilt module may reference `--io-accent-muted` (intentionally not defined; one-consumer pattern — fix at consumer with `var(--io-accent-subtle)`).

### Pre-panel-layout gate

Before any of the eight rebuilt modules begins panel-layout work, confirm `--io-sidebar-width` still equals 220px in `index.css`. If it has changed (e.g., revised between Claim A and module rebuild), a single token update propagates to all modules automatically — but only if no module uses a hardcoded integer. Verify the token is used, not overridden.

### One Claim A lesson the rebuild should inherit

**Single-consumer tokens belong at the consumer.** If a rebuilt module needs a visual value used in only one place, use an existing registered token rather than proposing a new one. Claim A (A8) established this pattern explicitly. New tokens in `index.css` require cross-module review and a usage count justification. Rebuilt modules are not exempt from this discipline.

---

## Claim B additions — 2026-05-28

### New shared conventions for module rebuild (from Claim B)

All rebuilt modules must use these artifacts. They are the canonical implementation; no module may duplicate them independently.

#### Constants files

| File | Exports | Usage rule |
|------|---------|------------|
| `shared/styles/buttons.ts` | `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`, `buttonBaseClass` | All module buttons use these objects. Spread `style={btnPrimary}` + `className={buttonBaseClass}` together to get hover/focus from companion CSS. Do not hardcode button colors. |
| `shared/styles/buttons.css` | `.io-btn:hover`, `.io-btn:focus-visible` | Import alongside buttons.ts consumers. |
| `shared/styles/inputs.ts` | `inputStyle`, `inputClassName` | All form inputs (except intentionally compact inspector inputs) use `inputStyle`. Spread `style={inputStyle}` + `className={inputClassName}` for focus ring. No `outline:none` in input styles. |
| `shared/styles/inputs.css` | `.io-input:focus-visible` | Import alongside inputs.ts consumers. |

**Inspector-panel exception:** Compact panel inputs (like `DesignerRightPanel` inspector fields — `padding: 4px 7px`, `fontSize: 12`) are intentionally excluded from `inputStyle`. This is a documented exception: inspector panels at high element density require compact inputs. A rebuilt module with an inspector panel should use a local `compactInputStyle` constant with explicit different padding/size, not override `inputStyle`.

#### Shared components (API surfaces)

| Component | Location | API | Notes |
|-----------|----------|-----|-------|
| `FieldLabel` | `shared/components/FieldLabel.tsx` | `{ children: ReactNode; htmlFor?: string }` | 11px/600/uppercase/0.05em/`--io-text-muted`. For form field labels. Not for palette section headers (use `SectionLabel` when promoted, or inline until DC-4 is done). |
| `StatusBadge` | `shared/components/StatusBadge.tsx` | `{ status: string; label?: string }` | Token-pair map covers: connected/active/ok/completed/healthy (success), running (accent), warning/pending/connecting (warning), error/disconnected/failed/inactive (danger), cancelled/stopped/unknown (muted). Add new status strings additively; do not duplicate locally. |
| `Dialog` | `shared/components/Dialog.tsx` | `{ open, onOpenChange, title, description?: ReactNode, children, width?=480, footer?: ReactNode }` | Uses Radix; ARIA automatic; `--io-modal-backdrop` backdrop; `--io-z-modal` z-index; `--io-surface-elevated` bg; `--io-radius-lg` radius. All new general-purpose dialogs use this wrapper. |
| `ConfirmDialog` | `shared/components/ConfirmDialog.tsx` | Existing API unchanged | Patched 2026-05-28: z-index, bg, radius, token fixes applied. All destructive confirmations use this component. |

#### Token gaps discovered during Claim B

| Gap | Status | Action |
|-----|--------|--------|
| `--io-surface-tertiary` undefined | StatusBadge muted state uses `--io-surface-secondary` as substitute | Either register `--io-surface-tertiary` as a distinct token or formally adopt `--io-surface-secondary` as canonical for muted badge backgrounds. Decide before any rebuilt module needs a muted badge. |

### Implications for Claim C revisit (Claim B additions)

The following Claim B outcomes affect Claim C scope and sequencing:

- **`shared/components/Dialog.tsx` is now the canonical dialog wrapper.** Claim C dialogs inside `DesignerCanvas.tsx` scope (`SaveAsStencilDialog`, `ShapeDropDialog`, `PromoteToShapeWizard`) were explicitly excluded from Claim B. When Claim C executes, these dialogs must be evaluated: (a) are they rendered inside a canvas transform ancestor that requires `createPortal`? (b) can they use Dialog wrapper or do they need custom positioning? The `position: fixed` requirement is already met by Dialog; the portal question needs per-dialog review.

- **`shared/components/ConfirmDialog.tsx` z-index is now `var(--io-z-modal)` (1000).** Any Claim C code that currently renders content at z-index 100–999 may now appear behind ConfirmDialog in stacking contexts that previously had no conflict. Claim C should audit for this at the start of its execution pass.

- **`Dialog.tsx` uses numeric z-index literals, not CSS token strings.** If Claim C needs to change the `--io-z-modal` scale, Dialog.tsx will need a manual update alongside the token change. Minor — flag as a cleanup dependency.

- **DesignerCanvas wizard dialogs (out of scope for Claim B) need their own Dialog migration pass.** `IographicImportWizard`, `CategoryShapeWizard`, `RecognitionWizard`, and `PromoteToShapeWizard` have inconsistent step indicator patterns and mixed ARIA coverage. This is now the remaining highest-complexity dialog gap. Claim C should plan a dedicated wizard-dialog pass rather than treating these as incidental.

---

## follow-up-promotions

Deferred promotion candidates from 08-claim-b-plan.md Section 6, ordered by readiness. Each should be resolved before or during the eight-module rebuild begins.

### FP-1 — DC-6: Hex-alpha badge bug fix (Users, Roles, CameraStreams, MaintenanceTicketsPanel)

**Readiness: Ready now.** Not a promotion — a bug fix. Pattern established (OpcSources fix, Claim A). Four files, same three-line `color-mix()` substitution each. Should land as a standalone PR.

- `Users.tsx:108/110` — `${color}20` / `${color}40` → `color-mix(in srgb, ${color} 12%, transparent)` / `color-mix(in srgb, ${color} 25%, transparent)`
- `Roles.tsx:51/53` — same
- `CameraStreams.tsx:785/787` — same
- `MaintenanceTicketsPanel.tsx:52` — same

**Gate:** Must complete before module rebuild (active rendering bug when CSS variable strings are passed as color).

### FP-2 — DC-3: ContextMenu danger-item token fix

**Readiness: Ready now.** One-line token replacement in `shared/components/ContextMenu.tsx`: `var(--io-alarm-urgent)` → `var(--io-danger)`. No API change. Can land any time.

**Gate:** Low urgency (both resolve to `#ef4444` in dark theme), but required before light/HPHMI theme work.

### FP-3 — DC-5: DeleteConfirmDialog in DesignerLeftPalette → ConfirmDialog migration

**Readiness: Ready in next consumer migration pass.** `DesignerLeftPalette.tsx:217` defines a local `DeleteConfirmDialog` using Radix Dialog directly. Now that `ConfirmDialog.tsx` is patched, this is a straightforward consumer migration. No design decisions required.

**Gate:** Should complete before the Designer module rebuild begins.

### FP-4 — DC-4: SectionLabel component (palette/panel group headers)

**Readiness: Promote at module-rebuild planning time.** Three modules converge on 11px/600/uppercase/0.06em for group/section labels. Enough evidence exists. Promote when the first rebuilt module needs a side-panel section header.

Source locations:
- Console: `ConsolePalette.tsx` section headers (11px/700/uppercase/0.06em — weight slight divergence)
- Designer: `DesignerLeftPalette.tsx` `SectionHeader` (11px/600/uppercase/0.06em — canonical)
- Settings: `index.tsx` nav group headers (11px/600/uppercase/0.06em post-B4 fix)

Recommended canonical: 11px/600/uppercase/0.06em (Designer + Settings post-B4 agree; Console uses 700 — converge to 600).

**Gate:** Not blocking; promote opportunistically at the start of the first rebuilt module that needs section headers.

### FP-5 — DC-1: IconBtn shared component

**Readiness: Evaluate after buttons.ts consumer migration completes.** Do not promote prematurely. After Console and Settings migrate their buttons to `buttons.ts`, assess whether the companion `buttons.css` hover approach is sufficient or whether a shared `IconBtn` component adds value for the icon-button pattern.

**Gate:** No gate; evaluate after consumer migration pass.

### FP-6 — DC-2: SettingsPageLayout promotion to shared

**Readiness: Promote at module-rebuild start.** Move `SettingsPageLayout` from `pages/settings/` to `shared/components/` when the first rebuilt module needs a consistent page-level heading. Path change only; no behavioral change.

**Gate:** No gate; promote opportunistically.

---

## deferred-consumer-migrations

Consumers that were explicitly deferred during Claim B (workstream 3c/3d) with reasons. All should be resolved before the eight-module rebuild begins to avoid the rebuild inheriting inconsistent patterns.

### Buttons (buttons.ts consumers not yet migrated)

| File | What to migrate | Notes |
|------|----------------|-------|
| `pages/settings/BulkUpdate.tsx` | Local `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER` → import from `shared/styles/buttons.ts` | Second button system within Settings; must resolve before Settings rebuild |
| `pages/settings/Import.tsx` | Any inline button styles not using settingsStyles | |
| `pages/settings/Sessions.tsx` | Local `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER` variants | Slightly non-canonical |
| `pages/console/index.tsx` | Toolbar and modal buttons using inline styles | |
| `pages/console/PaneConfigModal.tsx` | Modal action buttons | |
| `pages/console/PaneWrapper.tsx` | Pane action buttons | |
| `pages/console/AlarmListPane.tsx` | Ack/action buttons | |
| `pages/console/PointTablePane.tsx` | Action buttons | |
| `pages/designer/DesignerToolbar.tsx` | Text-action buttons (lines 1618–1693) using `borderRadius: 6` integers | Designer `IconBtn` (line 904–948) intentionally excluded |
| `pages/designer/DesignerImport.tsx` | Primary button with `#3b82f6` fallback (line 65) | Wrong hue fallback must go |
| `pages/designer/DesignerGraphicsList.tsx` | Action buttons | |

### Inputs (inputs.ts consumers not yet migrated)

| File | What to migrate | Notes |
|------|----------------|-------|
| `pages/settings/Import.tsx` | Own `inputStyle` constant (diverges from settingsStyles) | |
| `pages/settings/BulkUpdate.tsx` | `borderRadius: "6px"` string instead of `var(--io-radius)`; local SELECT constant | |
| `pages/settings/Sessions.tsx` | Local inline input styles | |
| `pages/console/PaneConfigModal.tsx` | Multiple inline `outline: none` inputs (lines 79, 319, 369) | |
| `pages/console/PaneWrapper.tsx` | Inline input (line 1054) | |
| `pages/console/ConsolePalette.tsx` | Search input (line 419) | |
| `pages/console/index.tsx` | Inline inputs (lines 3540, 3569) | |
| `pages/designer/PointPickerModal.tsx` | Local inputStyle (different bg token) | |
| **Not in scope:** `DesignerRightPanel.tsx` | Compact inspector inputs intentionally different | Do not migrate |
| **Not in scope:** `ShapePointSelector.tsx` | Already uses `--io-input-bg` / `--io-input-border` correctly | Leave as-is |

### StatusBadge consumers not yet migrated

| File | Reason deferred | Action |
|------|----------------|--------|
| `pages/settings/PointManagement.tsx` | `ActiveBadge({ active: boolean })` — boolean API mismatch; not a StatusBadge substitution | Migrate with an adapter (`active ? "active" : "inactive"`) or keep as-is if the visual distinction is intentional |
| `pages/settings/Users.tsx` | `Badge({ label, color })` with hex-alpha bug — dynamic color, not named-status | Fix via DC-6 (FP-1 above), not StatusBadge migration |
| `pages/settings/Roles.tsx` | Same as Users.tsx | DC-6 |
| `pages/settings/CameraStreams.tsx` | Same hex-alpha bug | DC-6 |
| `pages/settings/MaintenanceTicketsPanel.tsx` | Same hex-alpha bug | DC-6 |
| Console alarm badges (PriorityBadge, StateBadge, QualityBadge) | Different semantic vocabulary (alarm priority); hardcoded alarm-specific colors | Alarm token work (Claim C / alarm pass), not StatusBadge migration |

### Dialog consumers not yet migrated

| File | Reason deferred | Action |
|------|----------------|--------|
| `pages/settings/Import.tsx` `Modal`/`Drawer` | Not in Claim B scope (Import ARIA deferred per Section 7) | Accessibility pass; add ARIA or wrap in Dialog |
| `pages/settings/OpcSources.tsx` `ManageCategoriesModal` | Not in Claim B scope | Accessibility pass |
| `pages/settings/Certificates.tsx` | Already has `role="dialog"` + `aria-modal` on both dialogs | No action needed; ARIA already correct |
| `pages/designer/components/ValidateBindingsDialog.tsx` | Panel widget (`position: absolute`), not a modal overlay; Dialog.tsx not applicable | No action needed |
| `pages/designer/components/RecognitionWizard.tsx` | Complex multi-step; already has `role="dialog"`; wizard-dialog pass | Wizard-dialog pass (separate from Dialog migration) |
| `pages/designer/components/IographicImportWizard.tsx` | Complex multi-step wizard | Wizard-dialog pass |
| `pages/designer/components/CategoryShapeWizard.tsx` | Complex multi-step wizard | Wizard-dialog pass |
| `pages/designer/components/SaveAsStencilDialog.tsx` | Rendered inside DesignerCanvas.tsx (Claim C scope) | Claim C |
| `pages/designer/components/ShapeDropDialog.tsx` | Rendered inside DesignerCanvas.tsx (Claim C scope) | Claim C |
| `pages/designer/components/PromoteToShapeWizard.tsx` | Rendered inside DesignerCanvas.tsx (Claim C scope) | Claim C |

### window.confirm() deferred

| File | Reason deferred | Action |
|------|----------------|--------|
| `pages/dashboards/index.tsx` (line 674) | Dashboards module — out of scope per 08-claim-b-plan.md Section 7 Item 8 | Dashboards-module pass; confirm portal context before migrating (`react-grid-layout` ancestor likely) |
| `pages/dashboards/PlaylistManager.tsx` (line 567) | Dashboards module — same | Same; portal check required |
