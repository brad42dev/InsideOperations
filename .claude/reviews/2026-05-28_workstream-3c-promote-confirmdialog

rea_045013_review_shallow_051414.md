# Review (shallow)

**Generated**: 2026-05-28T05:14:30+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-confirmdialog

rea_045013.md`
**Session**: 5eda53d1-1415-440c-a95c-991141fefe2b
**Depth**: shallow

---

## Summary

The diff matches the prompt's intent closely. The work correctly applies five design token fixes to the existing shared `ConfirmDialog.tsx` and migrates three in-scope `window.confirm()` call sites (`DesignerReportsList`, `DesignerDashboardsList`, `CameraStreams`) to use the shared component via state-driven pattern. Deferred consumers are correctly documented rather than force-migrated. Scope constraints (no canvas files, no other components) are respected.

## Concerns

1. **`zIndex` type mismatch in `ConfirmDialog.tsx`.** The overlay style sets `zIndex: "var(--io-z-modal)"` (a string) and content sets `zIndex: "calc(var(--io-z-modal) + 1)"` (also a string). React's inline style type for `zIndex` expects `number | string`; CSS custom property references as strings are only valid in inline styles when the browser supports them, and `var()` in a `zIndex` inline style does not resolve — browsers treat it as invalid and fall back to `auto`. The hardcoded `100`/`101` integers were actually functional; the replacement with CSS variable strings will silently break stacking. This was a misstep: the correct fix for a tokenized z-index is either a JS constant (`const IO_Z_MODAL = 1000`) or keeping numeric literals, not a CSS variable string in an inline style.

2. **`DesignerDashboardsList` description text mismatch.** The original `window.confirm` text was `"Delete this dashboard?"`. The replacement sets `description="Delete this dashboard? This cannot be undone."` — the addition of "This cannot be undone." is not from the source; it is new copy added without basis in the prompt or the original behavior. Minor, but introduces unspecified copy changes.

3. **`ConfirmDialog` not auto-closing after confirm in consumers.** The `ConfirmDialog.tsx` `onConfirm` handler calls `onConfirm()` then `onOpenChange(false)` — this will close the dialog regardless of mutation success or failure. In `CameraStreams.tsx`, the original code only called `removeMut.mutate()` after the user confirmed; errors were displayed via `setDeleteError`. With the new pattern, the dialog closes immediately on confirm and then the mutation runs asynchronously. If the mutation fails, `setDeleteError` still fires, but the dialog is already gone — this matches the original behavior, so it is acceptable. No regression.
