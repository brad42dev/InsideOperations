---
id: 2026-05-28-workstream-3c-promote-dialog

read-ui-a
title: "Claim B: Promote shared Dialog component and migrate consumers"
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
  - 2026-05-28_workstream-3c-promote-dialog

read-ui-au_041950
implementation:
  - frontend/src/shared/components/Dialog.tsx
  - frontend/src/pages/console/index.tsx
  - frontend/src/pages/console/PaneConfigModal.tsx
  - frontend/src/pages/settings/RestorePreviewModal.tsx
  - frontend/src/pages/designer/components/TabClosePrompt.tsx
  - frontend/src/pages/designer/components/IographicExportDialog.tsx
related:
  - claim-b-shared-style-constants
  - 2026-05-28-workstream-3c-promote-fieldlabel

read-
  - 2026-05-28-workstream-3c-promote-statusbadge

read-
---

# Claim B: Promote shared Dialog component and migrate consumers

Promotes a unified `Dialog` component to `src/shared/components/Dialog.tsx` using Radix Dialog for ARIA and portal safety, then migrates six files (eight call sites) from hand-rolled overlay divs to the new shared component.

## Purpose

Eliminates duplicated modal overlay/box markup spread across console, settings, and designer modules. Each file previously maintained its own `position: fixed` overlay, z-index stack, and surface tokens — with slight divergences between them. The shared component standardises the visual contract (backdrop token, surface token, radius token, z-index) and delegates focus trap and keyboard dismissal to Radix.

## Behavior

- **API surface:** `{ open, onOpenChange, title, description?: ReactNode, children, width?: number (default 480), footer?: ReactNode }`
- Overlay uses `var(--io-modal-backdrop)` at `z-index: 1000`; content panel uses `var(--io-surface-elevated)` / `var(--io-radius-lg)` at `z-index: 1001`
- Escape key and backdrop click both call `onOpenChange(false)` — handled by Radix
- `description` is typed `ReactNode` to allow bold entity names in destructive confirmation copy
- `footer` slot accepts arbitrary buttons, enabling the three-button Save/Discard/Cancel layout in `TabClosePrompt` and `CloseConfirmDialog` without over-designing the API
- `children` renders between description and footer; pass `{null}` for description-only dialogs

## Implementation Notes

**Shared component:** `src/shared/components/Dialog.tsx` — wraps `@radix-ui/react-dialog`. Renders `Dialog.Overlay` (backdrop) and `Dialog.Content` (panel) via `createPortal`-equivalent Radix portal. No close button in the header; relies on Escape and backdrop for dismissal.

**Migrated consumers:**
- `console/index.tsx` — `WorkspaceNameModal`, `DeleteConfirmDialog`, `CloseConfirmDialog` (three call sites; hand-rolled 9999 z-index overlays replaced)
- `console/PaneConfigModal.tsx` — token fixes only; was already on Radix Dialog structurally
- `settings/RestorePreviewModal.tsx` — `MODAL_OVERLAY` / `MODAL_BOX` constants removed; top-right Cancel button removed (Radix handles); `maxHeight: calc(85vh - 140px)` on children wrapper preserves viewport cap; diff table `flex: 1` changed to `maxHeight: 400px`
- `designer/components/TabClosePrompt.tsx` — full replacement; bold graphic name in description preserved via `ReactNode`
- `designer/components/IographicExportDialog.tsx` — inline overlay replaced; × button removed (Cancel + Escape sufficient)

**Deferred consumers (not substitution-level):**
- `settings/Certificates.tsx` — already has `role="dialog"` + `aria-modal`; primary ARIA gap addressed
- `designer/components/ValidateBindingsDialog.tsx` — `position: absolute` panel widget, not a modal overlay
- `designer/components/VersionHistoryDialog.tsx` — already uses shared `VersionRecoveryDialog`
- `designer/components/CanvasPropertiesDialog.tsx` — already has `role="dialog"` / `aria-modal`
- `designer/components/RecognitionWizard.tsx`, `IographicImportWizard.tsx`, `CategoryShapeWizard.tsx` — complex multi-step wizards
- `designer/components/SaveAsStencilDialog.tsx`, `ShapeDropDialog.tsx`, `PromoteToShapeWizard.tsx` — render inside `DesignerCanvas.tsx` (Claim C canvas-layer scope)

**Post-review fixes applied in same session:**
- `aria-describedby` dead ternary in `Dialog.tsx` corrected (always resolved to `undefined` when description present)
- `description` prop widened from `string` to `ReactNode`
- `RestorePreviewModal` `maxHeight` restored after MODAL_BOX removal

Build verified clean (`pnpm build`) after all changes and post-review fixes.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Initial creation. Documents the Dialog promotion and consumer migration performed in workstream-3c. Six files modified (eight call sites migrated). Post-review pass fixed `aria-describedby` ternary, widened `description` to `ReactNode`, and restored viewport height cap on `RestorePreviewModal`.
