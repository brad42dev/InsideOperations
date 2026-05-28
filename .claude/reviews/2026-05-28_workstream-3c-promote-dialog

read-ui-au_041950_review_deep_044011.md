# Review (deep)

**Generated**: 2026-05-28T04:41:55+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-dialog

read-ui-au_041950.md`
**Session**: b9d4a784-0bb8-4396-867c-50cc8713bde8
**Depth**: deep

---

## Summary

The diff matches the stated intent: Dialog.tsx is created, token fixes are applied to PaneConfigModal, and all planned consumers are migrated. The post-review fixes (ReactNode description, bold entity names in destructive dialogs, viewport height cap) are present. Build passes clean. Three issues are worth flagging — one is a measurable regression, one is a UX regression under real-world usage, and one is a cosmetic inconsistency.

## Concerns

1. **IographicExportDialog z-index drop from 1100 → 1001**
   - File: `frontend/src/shared/components/Dialog.tsx` — hardcoded `zIndex: 1001` on `Radix.Content`
   - The original `IographicExportDialog.tsx` used `zIndex: 1100`. The Designer has toolbar and panel elements; if any sit between 1001 and 1100 in the stacking order, the export dialog will render behind them. Dialog.tsx provides no `zIndex` override prop. The promotion silently lowered a deliberate z-index choice with no mechanism for callers to restore it.

2. **RestorePreviewModal action buttons are now inside the scrollable content area**
   - File: `frontend/src/pages/settings/RestorePreviewModal.tsx`, step-2 and step-3 footer divs inside the `maxHeight: "calc(85vh - 140px)"` / `overflowY: "auto"` wrapper
   - In the original, `MODAL_BOX` was `display: flex; flexDirection: column` and the action buttons (Cancel/Continue/Back/Restore) were children of MODAL_BOX *outside* the scrollable diff table section. Now both the diff table and the action buttons are inside the same scrollable div. With a large diff table, the action buttons scroll off screen and become unreachable without scrolling. The top-right Cancel button was the escape valve for this; it was removed.

3. **Excess whitespace between description and footer when `children={null}`**
   - Files: `console/index.tsx` DeleteConfirmDialog and CloseConfirmDialog, `designer/components/TabClosePrompt.tsx`
   - Dialog.tsx renders `{children}` unconditionally then adds `marginTop: "24px"` on the footer wrapper. When `children={null}`, Radix.Description has `margin: "0 0 16px"` and the footer div adds 24px on top — 40px total gap between description text and action buttons. The original dialogs had ~12px (flex `gap`) between body text and buttons. Not a functional bug, but visually loose.

## Verification Notes

- The `describedByProp` ternary in Dialog.tsx is correct as written: when `description === undefined` it spreads `{ "aria-describedby": undefined }` (suppressing Radix's missing-description DevTools warning), and when description is present it spreads `{}` (letting Radix auto-wire via its internal context). The review concern about this was already fixed before the final state.
- `description?: React.ReactNode` on Dialog.tsx exceeds the plan's `description?: string` spec. This was intentional (preserving bold entity names in destructive confirmations) and doesn't break ARIA — `Radix.Description` accepts ReactNode — but callers can now embed arbitrary JSX in the description slot, which screen readers will read as a description.
- PaneConfigModal was intentionally left on its own Radix Dialog instance (token fixes only), matching the plan's "no structural change" call. The `Dialog` import added to PaneConfigModal.tsx is unused — the file imports `{ Dialog } from "../../shared/components/Dialog"` but continues using `import * as Dialog from "@radix-ui/react-dialog"` directly. The import is dead code.
