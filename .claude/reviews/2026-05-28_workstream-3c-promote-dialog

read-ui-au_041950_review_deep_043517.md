# Review (deep)

**Generated**: 2026-05-28T04:37:14+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-dialog

read-ui-au_041950.md`
**Session**: 
**Depth**: deep

---

## Summary

The diff matches the stated intent: a new `shared/components/Dialog.tsx` wrapper built on Radix Dialog, token fixes on `PaneConfigModal.tsx`, and substitution-level migrations across six files. The plan is executed faithfully — each consumer imports the new component and removes hand-rolled overlay code. Build passed. The concerns below are functional and accessibility issues, not scope drift.

## Concerns

1. **Dead ternary in `Dialog.tsx` suppresses ARIA description linkage.**
   `Dialog.tsx:28`: `aria-describedby={description !== undefined ? undefined : undefined}` — both branches evaluate to `undefined`. The intent was likely to pass `undefined` when no description is provided (to suppress the Radix console warning) but let Radix auto-wire `aria-describedby` when description IS present. As written, `aria-describedby` is always explicitly `undefined` on `Radix.Content`, which overrides Radix's internal context-based wiring. When a `description` prop is passed, the rendered `<Radix.Description>` element exists in the DOM but is not referenced by `aria-describedby` on the dialog — the ARIA association is broken. The fix is to not pass `aria-describedby` at all when description is provided, and pass `undefined` only when it is absent.

2. **`RestorePreviewModal` lost its viewport height cap (`maxHeight: 85vh`).**
   `Dialog.tsx` content element has no `maxHeight` or `overflowY`. The original `MODAL_BOX` had `maxHeight: "85vh"` and `display: flex; flexDirection: column`, which allowed the diff table's `flex: 1; overflowY: auto` to create a scrollable area within the viewport. The migrated version sets `maxHeight: 400` only on the diff table. The wrapping `<div>` and Dialog content have no height constraint. For a snapshot with many rows, step 2 content (summary bar + mode selector + diff table at up to 400px + safety checkbox + footer) could exceed viewport height with no mechanism to scroll the dialog itself. `RestorePreviewModal.tsx:376`.

3. **Destructive confirmations lost bold emphasis on the entity name.**
   `DeleteConfirmDialog` and `CloseConfirmDialog` (both in `console/index.tsx`) originally rendered the workspace name as `<strong style={{ color: "var(--io-text)" }}>{workspaceName}</strong>` inside the confirmation body — a deliberate UX decision to surface what will be deleted/closed before the user clicks. The `description` prop accepts only a string, so the migration passes `description={\`${workspaceName} will be permanently deleted...\`}` with the name unformatted. Same issue in `TabClosePrompt.tsx:23` where `<strong>&ldquo;{graphicName}&rdquo;</strong>` became a plain string. For destructive-path dialogs this is a regression in clarity; a user who skims the dialog body may not notice which workspace is affected.

4. **`IographicExportDialog` removed the header close button with no replacement in the content area.**
   The original had an `×` button in the header (`IographicExportDialog.tsx`, original lines ~80–92). The Dialog component has no built-in `×` affordance, and the migration relies entirely on the "Cancel" footer button and Radix's Escape/overlay-click behavior. This is fine functionally, but `Cancel` is only visible after scrolling if the dialog content is tall. The original close button was in the fixed-position header and always visible.

## Verification Notes

- `PaneConfigModal.tsx` correctly remains on its existing direct Radix Dialog usage — the plan correctly identified this as a token-fix-only migration and did not restructure it.
- Radix Dialog keyboard handling (`Escape` → `onOpenChange(false)` → `onCancel()`) correctly replaces the removed `onKeyDown` Escape handlers in `WorkspaceNameModal` and the description textarea.
- `{null}` as children for `DeleteConfirmDialog`, `CloseConfirmDialog`, and `TabClosePrompt` is valid React and avoids the Radix "children must be provided" requirement cleanly.
- The `width={860}` for `RestorePreviewModal` converts to `width: "860px"` via React's inline style handling, paired with `maxWidth: calc(100vw - 32px)` in Dialog.tsx — responsive behavior is preserved.
- The `08-claim-b-plan.md` deferred-consumer list is accurate and complete based on the code state visible in the diff.
