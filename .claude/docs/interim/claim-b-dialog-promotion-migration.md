---
id: claim-b-dialog-promotion-migration
title: Claim B — Dialog Promotion and Consumer Migration
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
- 2026-05-28_workstream-3c-promote-dialog
implementation:
- frontend/src/shared/components/Dialog.tsx
- frontend/src/pages/console/index.tsx
- frontend/src/pages/console/PaneConfigModal.tsx
- frontend/src/pages/settings/RestorePreviewModal.tsx
- frontend/src/pages/designer/components/TabClosePrompt.tsx
- frontend/src/pages/designer/components/IographicExportDialog.tsx
- ui-audit/08-claim-b-plan.md
related:
- claim-b-statusbadge-promotion
- claim-b-fieldlabel-promotion
- claim-b-constants
topics:
- ui-framework
- module-designer
aliases: []
keywords: []
covers: Claim B — Dialog Promotion and Consumer Migration
---

# Claim B — Dialog Promotion and Consumer Migration

A shared `Dialog` component was promoted to `frontend/src/shared/components/Dialog.tsx` and six consumer files were migrated from hand-rolled inline modal implementations to use it, following the Claim B component promotions plan.

## Purpose

Consolidate the scattered modal overlay pattern (hand-rolled `position: fixed` backdrop divs, hard-coded `rgba` values, inconsistent z-index) into a single shared component backed by Radix Dialog. The goal is uniform ARIA semantics, consistent design tokens, and a single place to evolve modal behavior going forward.

## Behavior

`Dialog` wraps Radix `Dialog.Root` / `Dialog.Content` with a fixed overlay and centered content panel. Props:

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `open` | `boolean` | — | required |
| `onOpenChange` | `(open: boolean) => void` | — | required; Radix fires on Escape and overlay click |
| `title` | `string` | — | rendered as `Dialog.Title` |
| `description` | `ReactNode` | — | optional; rendered as `Dialog.Description`; typed `ReactNode` to allow bold entity names |
| `children` | `ReactNode` | — | body content |
| `width` | `number` | `480` | content panel width in px |
| `footer` | `ReactNode` | — | optional; renders below children, right-aligned |

Overlay uses `var(--io-modal-backdrop)` at `zIndex: 1000`. Content panel uses `var(--io-surface-elevated)`, `var(--io-radius-lg)`, `border: 1px solid var(--io-border)`, `zIndex: 1001`.

`aria-describedby` is applied as a conditional spread — present only when `description` is provided — so Radix auto-wiring works correctly.

## Implementation Notes

**Shared component:** `frontend/src/shared/components/Dialog.tsx` — new file, Radix Dialog wrapper. Source-of-truth for all standard modal overlays.

**Migrated consumers:**
- `console/index.tsx` — three inline modals replaced: `WorkspaceNameModal`, `DeleteConfirmDialog`, `CloseConfirmDialog`. Escape handling removed from individual `onKeyDown` handlers (Radix handles via `onOpenChange`). Title typography normalized to `16px/600/var(--io-text-primary)`.
- `console/PaneConfigModal.tsx` — token fixes only; already on Radix Dialog structurally. Overlay `rgba(0,0,0,0.55)` → `var(--io-modal-backdrop)`, content bg `var(--io-surface)` → `var(--io-surface-elevated)`, `borderRadius: 8` → `var(--io-radius-lg)`.
- `settings/RestorePreviewModal.tsx` — `MODAL_OVERLAY` / `MODAL_BOX` inline style constants removed; header section replaced by Dialog. `maxHeight: calc(85vh - 140px)` applied to children wrapper to preserve viewport cap. Diff table `flex: 1` replaced with `maxHeight: 400` (Dialog content is not a flex column).
- `designer/components/TabClosePrompt.tsx` — replaced inline modal; bold graphic name preserved in `ReactNode` description.
- `designer/components/IographicExportDialog.tsx` — replaced inline modal; header `×` button removed (Cancel button + Escape/overlay dismiss are sufficient).

**Deferred consumers (not migrated):**
- `pages/settings/Certificates.tsx` — already has `role="dialog"`, `aria-modal="true"`, `var(--io-modal-backdrop)`; no structural change needed.
- `pages/designer/components/ValidateBindingsDialog.tsx` — panel widget (`position: absolute`), not a modal overlay; Dialog.tsx inapplicable.
- `pages/designer/components/VersionHistoryDialog.tsx` — already uses a shared component (`VersionRecoveryDialog`); properly structured.
- `pages/designer/components/CanvasPropertiesDialog.tsx` — already has `role="dialog"`, `aria-modal="true"`; ARIA gap addressed.
- `pages/designer/components/RecognitionWizard.tsx` — has `role="dialog"`; complex multi-step, no substitution-level path.
- `pages/designer/components/IographicImportWizard.tsx`, `CategoryShapeWizard.tsx` — complex multi-step wizards; more than substitution-level work.
- `pages/designer/components/SaveAsStencilDialog.tsx`, `ShapeDropDialog.tsx`, `PromoteToShapeWizard.tsx` — rendered inside `DesignerCanvas.tsx`; fall under Claim C scope.

**Build:** `pnpm build` passed with no TypeScript errors after all changes and post-deep-review fixes.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Initial creation. Documents the promotion of `Dialog` to `frontend/src/shared/components/Dialog.tsx` and migration of six consumer files as part of the Claim B component standardization workstream. Includes post-deep-review fixes: `aria-describedby` conditional spread, `maxHeight` restoration on `RestorePreviewModal`, and `description` prop typed as `ReactNode`.
