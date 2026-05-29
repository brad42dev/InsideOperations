---
id: 2026-05-28-workstream-3c-promote-confirmdialog
title: 'Claim B: ConfirmDialog Token Fixes and window.confirm() Migration'
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
- 2026-05-28_workstream-3c-promote-confirmdialog_045013
implementation:
- frontend/src/shared/components/ConfirmDialog.tsx
- frontend/src/pages/designer/DesignerReportsList.tsx
- frontend/src/pages/designer/DesignerDashboardsList.tsx
- frontend/src/pages/settings/CameraStreams.tsx
- ui-audit/08-claim-b-plan.md
related:
- 2026-05-28-workstream-3c-promote-dialog
- 2026-05-28-workstream-3c-promote-statusbadge
topics:
- ui-framework
- module-designer
aliases: []
keywords: []
covers: 'Claim B: ConfirmDialog Token Fixes and window.confirm() Migration'
---

# Claim B: ConfirmDialog Token Fixes and window.confirm() Migration

`ConfirmDialog` was already in its canonical shared location at `frontend/src/shared/components/ConfirmDialog.tsx`. This work unit corrected five hardcoded style values to use design tokens, then migrated three `window.confirm()` call sites to use the proper React dialog component.

## Purpose

`ConfirmDialog` is a shared destructive-action confirmation dialog used across modules. It wraps Radix `Dialog.Root` with `role="alertdialog"` semantics and provides a standard two-button (Cancel / Confirm) layout with a `variant="danger"` option that renders the confirm button as an outlined red button rather than a filled accent button.

## Behavior

- Controlled via `open` / `onOpenChange` props (Radix-managed)
- `onConfirm` fires then `onOpenChange(false)` is called immediately — the dialog closes on confirm without waiting for any async result
- `variant="danger"`: confirm button is transparent background with `var(--io-danger)` border and text; `variant="default"`: filled `var(--io-accent)` background
- Cancel button always renders as secondary outline style (`var(--io-border)` border, `var(--io-text-secondary)` text)
- Overlay: `var(--io-overlay, rgba(0,0,0,0.5))` fallback; z-index `var(--io-z-modal)`
- Content: fixed-centered, `420px` wide (capped at `calc(100vw - 32px)`), `var(--io-surface-elevated)` background, `var(--io-radius-lg)` border-radius, z-index `calc(var(--io-z-modal) + 1)`
- `description` prop is a plain `string` (not `ReactNode`) — no dynamic markup in descriptions
- The 15 pre-existing import sites that already consumed the component inherited the token fixes automatically with no call-site changes required

## Implementation Notes

**Component location:** `frontend/src/shared/components/ConfirmDialog.tsx`

**API:**
```tsx
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;   // default: "Confirm"
  cancelLabel?: string;    // default: "Cancel"
  onConfirm: () => void;
  variant?: "danger" | "default";  // default: "default"
}
```

**Token fixes applied (pre-existing hardcoded values corrected):**

| Property | Before | After |
|----------|--------|-------|
| Overlay `zIndex` | `100` | `"var(--io-z-modal)"` |
| Content `zIndex` | `101` | `"calc(var(--io-z-modal) + 1)"` |
| Content `background` | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` |
| Content `borderRadius` | `"10px"` | `var(--io-radius-lg)` |
| Confirm button `color` (default variant) | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` |

**Consumer migrations — `window.confirm()` replaced:**

| File | Pattern | Notes |
|------|---------|-------|
| `pages/designer/DesignerReportsList.tsx` | `confirmDeleteId: string \| null` state; `handleDelete` sets state instead of calling `window.confirm` | Message: "Delete this report template? This cannot be undone." |
| `pages/designer/DesignerDashboardsList.tsx` | Same `confirmDeleteId` pattern | Message: "Delete this dashboard? This cannot be undone." |
| `pages/settings/CameraStreams.tsx` | `confirmDelete: VideoStream \| null` state — stores full object to access `.name` for dynamic message | `setDeleteError(null)` preserved in `onConfirm`. Message: `Delete "${stream.name}"? This cannot be undone.` |

**No `createPortal` needed** — none of the three consumer components render inside a `react-grid-layout` transform.

**Deferred consumers (`window.confirm()` not migrated):**
- `pages/designer/dashboards/index.tsx` — out of scope per plan Section 7 Item 8 (dashboards module pass)
- `pages/console/PlaylistManager.tsx` — out of scope per plan Section 7 Item 8

**Deferred consumers (existing ConfirmDialog users needing non-trivial migration):**
- `pages/designer/DesignerLeftPalette.tsx` — local `DeleteConfirmDialog` (DC-5 in plan Section 6); not a substitution-level migration

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Deep review and wrapup pass. Review found no blocking concerns: diff matches intent, all three window.confirm() replacements are correctly wired (state initialized, mutation called in onConfirm, dialog dismissed via onOpenChange), and the CameraStreams dynamic description pattern is sound. Build passed. Plan section 2.4 marked DONE with full execution notes. No code changes in this pass.

### 2026-05-28
Initial creation. Documents the ConfirmDialog token fix pass and window.confirm() migration for DesignerReportsList, DesignerDashboardsList, and CameraStreams. Component was already at shared location; no file move occurred.
