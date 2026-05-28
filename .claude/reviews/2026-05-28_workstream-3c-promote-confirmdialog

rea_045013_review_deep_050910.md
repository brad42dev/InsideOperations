# Review (deep)

**Generated**: 2026-05-28T05:10:17+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-confirmdialog

rea_045013.md`
**Session**: 5eda53d1-1415-440c-a95c-991141fefe2b
**Depth**: deep

---

## Summary

The diff matches intent well. The ConfirmDialog promotion consists of two distinct actions: (1) five token fixes applied directly to the existing shared component at `shared/components/ConfirmDialog.tsx`, and (2) migration of three `window.confirm()` call sites to the shared component. All five token fixes are applied correctly. All three in-scope consumers (`DesignerReportsList`, `DesignerDashboardsList`, `CameraStreams`) are migrated using the correct pattern: state to hold the pending-delete item, dialog rendered once outside the list, and `onConfirm` firing the mutation. One minor message deviation and one structural observation are worth noting.

## Concerns

1. **Dashboard delete message expanded beyond original**
   - `DesignerDashboardsList.tsx:521` — `description="Delete this dashboard? This cannot be undone."`
   - The original `window.confirm` message was `"Delete this dashboard?"` — no "This cannot be undone." suffix. The execution notes describe it as "Message: 'Delete this dashboard? This cannot be undone.'" but the original diff shows the window.confirm had the shorter string. This is a small scope addition (consistent with the Reports message) but technically deviates from the "preserve verbatim" instruction.

2. **`ModalContent` in CameraStreams still uses hardcoded `zIndex: 100/101`**
   - `CameraStreams.tsx` lines ~141–144 — `ModalContent` overlay and content retain `zIndex: 100` and `zIndex: 101`, while the newly-added `ConfirmDialog` uses `var(--io-z-modal)`. These are not the same layer. If `--io-z-modal` resolves to 1000 (as the plan documents), the ConfirmDialog will correctly layer above `ModalContent` dialogs, but the un-migrated `ModalContent` z-index values are now visibly inconsistent in the same file. This is out of scope per the plan but is a real layering divergence introduced by the migration — the ConfirmDialog and the existing camera-stream edit dialog are now on different z-index systems.

## Verification Notes

- The `zIndex: "var(--io-z-modal)"` and `zIndex: "calc(var(--io-z-modal) + 1)"` values in inline `style` objects are valid — CSS custom properties resolve correctly in inline styles per the CSS Custom Properties spec.
- State cleanup is correct in all three consumers: `onOpenChange` receiving `false` triggers the consumer's handler which nulls the state; no leak path.
- `setDeleteError(null)` from the original CameraStreams onClick is preserved in `onConfirm` — behavioral parity maintained.
- Two deferred window.confirm() sites (`dashboards/index.tsx`, `PlaylistManager.tsx`) and the `DesignerLeftPalette` local `DeleteConfirmDialog` are correctly identified and recorded in the plan.
- `pnpm build` was verified clean per the log. No type errors from the new state shape or the CSS-custom-property z-index values (TypeScript accepts strings for `zIndex`).
