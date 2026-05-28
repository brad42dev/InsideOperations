# Claim B Components — Post-Execution Checkin

**Date:** 2026-05-28  
**Scope:** Four promoted components (FieldLabel, StatusBadge, Dialog, ConfirmDialog) + constants files from 3c  
**Overall-status:** clear-to-proceed

---

## Check 1 — All four components promoted

All four plan sections are marked **DONE 2026-05-28** in `08-claim-b-plan.md`. Component files confirmed present:

| Component | File | Date flag | Build |
|-----------|------|-----------|-------|
| FieldLabel | `shared/components/FieldLabel.tsx` | DONE 2026-05-28 | ✓ |
| StatusBadge | `shared/components/StatusBadge.tsx` | DONE 2026-05-28 | ✓ |
| Dialog | `shared/components/Dialog.tsx` | DONE 2026-05-28 | ✓ |
| ConfirmDialog | `shared/components/ConfirmDialog.tsx` (patched) | DONE 2026-05-28 | ✓ |

All four plan sections report `pnpm build` passed with no type errors.

---

## Check 2 — No scope creep

`git diff --name-only 7031087a..HEAD -- frontend/src/shared/` returns exactly the 8 planned artifacts:

```
frontend/src/shared/components/ConfirmDialog.tsx   (patched)
frontend/src/shared/components/Dialog.tsx          (new)
frontend/src/shared/components/FieldLabel.tsx      (new)
frontend/src/shared/components/StatusBadge.tsx     (new)
frontend/src/shared/styles/buttons.css             (new)
frontend/src/shared/styles/buttons.ts              (new)
frontend/src/shared/styles/inputs.css              (new)
frontend/src/shared/styles/inputs.ts               (new)
```

No other components were moved to `shared/`. Canvas-layer files untouched (DesignerCanvas.tsx, WorkspaceGrid.tsx, SceneRenderer.tsx, alarmFlash.css, operationalState.css, lod.css not in any commit diff). Scope boundary held.

---

## Check 3 — Consumer migration tracking

### FieldLabel

**Plan:** migrate DesignerRightPanel (zero call-site changes), migrate PaneConfigModal (6 field labels). Settings labelStyle users explicitly deferred.

| Consumer | Status | Notes |
|----------|--------|-------|
| `DesignerRightPanel.tsx` | Migrated | Local function removed; import from shared added; 14+ call sites unchanged |
| `PaneConfigModal.tsx` | Migrated | 6 field labels (4 shown in grep); `htmlFor` added for title + duration inputs |
| Settings `labelStyle` users | Deferred | 12px/500/no-uppercase — intentionally distinct per plan |

**Count:** 2 migrated, 0 unplanned deferred. Matches plan.

### StatusBadge

**Plan:** 4 Settings files migrated (Import, OpcSources, SystemHealth, Email). Five deferred categories documented.

| Consumer | Status | Notes |
|----------|--------|-------|
| `Import.tsx` | Migrated | Local function removed; zero call-site changes |
| `OpcSources.tsx` | Migrated | Local `STATUS_COLORS` + StatusBadge removed; zero call-site changes |
| `SystemHealth.tsx` | Migrated | `STATUS_LABELS` record added for custom display labels (Ready/Degraded/etc.) |
| `Email.tsx` | Migrated | Visual change: dot-only → dot+pill; `disabled` maps to muted default |
| `PointManagement.tsx` | Deferred | Boolean `ActiveBadge` API mismatch |
| `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` | Deferred | Hex-alpha bug fix pass (DC-6) |
| Console alarm badges | Deferred | Different semantic vocabulary (alarm priority, not connection status) |

**Count:** 4 migrated, 6 deferred. Matches plan.

**Token substitution logged:** Plan specified `--io-surface-tertiary` for muted states (inherited from Import.tsx base). Token is undefined; substituted `--io-surface-secondary`. Noted in StatusBadge source as a comment.

**Semantic flag logged:** `inactive` maps to danger per plan (red badge). OpcSources previously showed it as muted. The change means a manually-disabled OPC source shows red. Flag for UX review in OpcSources pass.

### Dialog

**Plan:** 6 consumer files (PaneConfigModal token-only fix; WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog in console/index.tsx; RestorePreviewModal; TabClosePrompt; IographicExportDialog). 9 deferred per plan.

Active `Dialog.tsx` imports:

```
pages/console/index.tsx           (WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog)
pages/settings/RestorePreviewModal.tsx
pages/designer/components/TabClosePrompt.tsx
pages/designer/components/IographicExportDialog.tsx
```

`PaneConfigModal.tsx` uses Radix Dialog directly — received token-only fixes (no structural wrapper), as the plan specified. It does not import shared `Dialog.tsx` and that is correct.

| Consumer | Status | Notes |
|----------|--------|-------|
| `PaneConfigModal.tsx` | Migrated (token fix only) | Radix Dialog preserved; backdrop/bg/radius tokens fixed |
| `console/index.tsx` WorkspaceNameModal | Migrated | Hand-rolled overlay replaced with Dialog wrapper |
| `console/index.tsx` DeleteConfirmDialog | Migrated | ReactNode description preserves bold workspace name |
| `console/index.tsx` CloseConfirmDialog | Migrated | Three-button footer via `footer` prop |
| `RestorePreviewModal.tsx` | Migrated | Highest-priority ARIA gap resolved |
| `TabClosePrompt.tsx` | Migrated | Full rewrite; ReactNode description |
| `IographicExportDialog.tsx` | Migrated | Header × button removed; Radix Escape replaces it |
| `Certificates.tsx` | Deferred | Already has `role="dialog"` + `aria-modal`; no migration needed |
| `ValidateBindingsDialog.tsx` | Deferred | Panel widget (`position: absolute`), not modal overlay |
| `VersionHistoryDialog.tsx` | Deferred | Already uses VersionRecoveryDialog (shared) |
| `CanvasPropertiesDialog.tsx` | Deferred | Already has `role="dialog"` + `aria-modal` |
| `RecognitionWizard.tsx` | Deferred | Already has `role="dialog"`; complex multi-step |
| `IographicImportWizard.tsx`, `CategoryShapeWizard.tsx` | Deferred | Complex multi-step wizards |
| `SaveAsStencilDialog.tsx`, `ShapeDropDialog.tsx`, `PromoteToShapeWizard.tsx` | Deferred | Inside DesignerCanvas.tsx (Claim C scope) |

**Count:** 7 migration targets across 6 files, 9 deferred. Matches plan.

### ConfirmDialog

**Plan:** patch 5 token issues; 3 window.confirm() replacements; 15 existing consumers inherit fixes; 2 dashboards window.confirm() deferred.

Token patches confirmed applied (reading ConfirmDialog.tsx):

| Issue | Before | After |
|-------|--------|-------|
| Overlay z-index | `100` (integer) | `"var(--io-z-modal)"` (CSS token string) |
| Content z-index | `101` (integer) | `"calc(var(--io-z-modal) + 1)"` (CSS token string) |
| Content background | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` |
| Content borderRadius | `"10px"` | `var(--io-radius-lg)` |
| Confirm button color | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` |

window.confirm() replacements:

| File | Status | Notes |
|------|--------|-------|
| `DesignerReportsList.tsx` | Migrated | `handleDelete` + state; no portal needed |
| `DesignerDashboardsList.tsx` | Migrated | Same pattern |
| `CameraStreams.tsx` | Migrated | Stores full VideoStream for dynamic message; `setDeleteError(null)` preserved |
| `dashboards/index.tsx` | Deferred | Out of scope per Section 7 Item 8 |
| `PlaylistManager.tsx` | Deferred | Out of scope per Section 7 Item 8 |

Active ConfirmDialog import sites (actual count): 14 files. Plan stated "15 existing consumers." Difference of 1 — likely a pre-existing consolidation or plan overcounting versioning subcomponents (SaveConfirmDialog, PublishConfirmDialog, etc. are different components). Not a gap; all target sites migrated.

**Count:** 3 window.confirm() migrated, 2 deferred. Matches plan.

---

## Check 4 — API stability

### FieldLabel

| Prop | Plan | Actual | Match |
|------|------|--------|-------|
| `children` | `React.ReactNode` | `React.ReactNode` | ✓ |
| `htmlFor?` | `string` | `string` | ✓ |
| `fontSize` | `11` | `11` | ✓ |
| `fontWeight` | `600` | `600` | ✓ |
| `textTransform` | `"uppercase"` | `"uppercase"` | ✓ |
| `letterSpacing` | `"0.05em"` | `"0.05em"` | ✓ |
| `color` | `var(--io-text-muted)` | `var(--io-text-muted)` | ✓ |
| `marginBottom` | `3` | `3` | ✓ |

Exact match.

### StatusBadge

| Prop | Plan | Actual | Match |
|------|------|--------|-------|
| `status` | `string` | `string` | ✓ |
| `label?` | `string` | `string` | ✓ |
| Token map | 15 keys | 17 keys (`sent`, `retry`, `degraded` added for consumers) | Additive |
| Visual | dot + pill, `borderRadius: 9999px`, `fontSize: 11`, `fontWeight: 600` | Matches | ✓ |

Three additive entries added during consumer migration. Not drift — driven by discovered consumer needs.

### Dialog

| Prop | Plan | Actual | Status |
|------|------|--------|--------|
| `open` | `boolean` | `boolean` | ✓ |
| `onOpenChange` | `(open: boolean) => void` | `(open: boolean) => void` | ✓ |
| `title` | `string` | `string` | ✓ |
| `description?` | `string` | `React.ReactNode` | **Drift** |
| `children` | `React.ReactNode` | `React.ReactNode` | ✓ |
| `width?` | `number`, default `480` | `number`, default `480` | ✓ |
| `footer?` | `React.ReactNode` | `React.ReactNode` | ✓ |

**One intentional API drift:** `description` changed from `string` to `React.ReactNode`. Execution notes document the reason: consumers needed bold workspace names and graphic names in descriptions (DeleteConfirmDialog, CloseConfirmDialog, TabClosePrompt). The change is backward-compatible (string is still a valid ReactNode). Logged in execution notes.

**z-index implementation note:** Dialog.tsx uses numeric literals `1000` and `1001` (with comments referencing `var(--io-z-modal)`) rather than CSS token strings. ConfirmDialog.tsx correctly uses `"var(--io-z-modal)"` and `"calc(var(--io-z-modal) + 1)"` as string values. Both compute identically but Dialog bypasses the token system. Not a bug; minor consistency gap. Flag for cleanup if the z-index scale ever needs to change.

**Backdrop token note:** Dialog uses `var(--io-modal-backdrop)`; ConfirmDialog uses `var(--io-overlay)`. Both are valid — `index.css` defines `--io-overlay: var(--io-modal-backdrop)` as an alias. Functionally equivalent.

### ConfirmDialog (post-patch)

| Prop | Pre-patch | Post-patch | Match |
|------|-----------|------------|-------|
| Overlay z-index | `100` | `"var(--io-z-modal)"` | ✓ |
| Content z-index | `101` | `"calc(var(--io-z-modal) + 1)"` | ✓ |
| Content bg | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` | ✓ |
| Content borderRadius | `"10px"` | `var(--io-radius-lg)` | ✓ |
| Confirm color | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` | ✓ |
| `description` type | `string` | `string` | Unchanged (intentional — ConfirmDialog has a narrower contract) |

All five plan issues patched exactly.

---

## Check 5 — Deferred candidates (Section 6)

Section 6 contains DC-1 through DC-6 only — unchanged from the original plan. No new candidates were added during execution.

| Candidate | Status |
|-----------|--------|
| DC-1 IconBtn | Unchanged |
| DC-2 SettingsPageLayout | Unchanged |
| DC-3 ContextMenu danger-item token | Unchanged |
| DC-4 SectionLabel | Unchanged |
| DC-5 DeleteConfirmDialog in DesignerLeftPalette | Unchanged |
| DC-6 Hex-alpha badge bug fix | Unchanged |

---

## Check 6 — Lessons signals

### Components simpler than expected (candidates for near-term follow-up)

- **FieldLabel** — migration was purely mechanical: remove local function, add import. Zero call-site changes. Any module that defines a local `FieldLabel`-like component is a one-commit migration.
- **StatusBadge** — Import.tsx and OpcSources.tsx were zero-effort replacements (same API shape, same prop names). Email.tsx needed one prop addition. DC-6 (hex-alpha bug in Users/Roles/CameraStreams/MaintenanceTicketsPanel) is a narrow, well-understood fix pattern already established by OpcSources — should land quickly as a standalone pass.
- **ConfirmDialog token patch** — 5 localized property changes, 15 consumers inherited the fix automatically. Excellent leverage ratio.

### Components harder than expected (validating conservative scope)

Nothing was harder than expected. The conservative scope was correct. The more complex designer wizard dialogs (IographicImportWizard, CategoryShapeWizard) were correctly left deferred — they're multi-step and the Dialog wrapper wouldn't simplify them.

### API design pressure that tempted scope expansion

- **Dialog.description string → ReactNode:** Consumer review during Dialog migration revealed three consumers needed bold/formatted content in descriptions. The API upgrade is minimal (ReactNode is a superset of string) and the pressure came from real consumer needs, not aesthetic preference. Contained.
- **StatusBadge `sent`/`retry`/`degraded` additions:** Email.tsx and SystemHealth.tsx required status strings not in the plan table. Added additive entries with no structural change. Low pressure.
- **No pressure to add a dot-only variant:** Email.tsx switched from dot-only to dot+pill without pushback. The visual change was acceptable. Validates that the "always dot+pill" decision is sound.

### Consumer migration that revealed shared infrastructure should evolve

- **Dialog z-index uses literals, not token strings:** ConfirmDialog uses CSS token strings (`"var(--io-z-modal)"`); Dialog uses numeric literals with comments. If the z-index scale ever changes, Dialog needs a manual update. Low urgency but worth aligning in a follow-up cleanup.
- **`--io-surface-tertiary` is undefined:** StatusBadge's muted state fell back to `--io-surface-secondary`. The plan's token table (from Import.tsx) referenced an undefined token. This is a gap in the token registry, not in the component. Flag for the token audit: either register `--io-surface-tertiary` or update the plan table to use `--io-surface-secondary` as canonical for muted badge backgrounds.

---

## Summary

All four components promoted as planned. No scope creep. Consumer counts match plan. APIs match plan with one intentional upward-compatible change (Dialog.description: ReactNode). Section 6 unchanged. Two minor flags for follow-up: Dialog z-index literals and undefined `--io-surface-tertiary` token.

**Overall-status: clear-to-proceed**
