# Review (shallow)

**Generated**: 2026-05-28T04:42:42+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-dialog

read-ui-au_041950.md`
**Session**: 
**Depth**: shallow

---

## Summary

The diff matches the prompt's intent well. A shared `Dialog.tsx` was created, PaneConfigModal received token-only fixes, and five consumer files were migrated via substitution. The post-review pass addressed real regressions (aria-describedby dead ternary, missing maxHeight cap, bold entity names in destructive confirmations). Scope is contained — no unrelated files touched, canvas-layer files untouched, deferred consumers documented.

## Concerns

1. **`{null}` children pattern is awkward.** `DeleteConfirmDialog`, `CloseConfirmDialog`, and `TabClosePrompt` pass `{null}` as children because their content is entirely in `description` and `footer`. If `Dialog.tsx` renders a children wrapper unconditionally, this produces an empty `<div>` in the DOM. Worth checking whether Dialog renders the children slot conditionally.

2. **`DeleteConfirmDialog` and `CloseConfirmDialog` bold entity name claim is contradicted.** The summary says "Description is plain string (workspace name bold formatting dropped)," but the actual diff shows the `description` prop receives a `<>...<strong>...</strong>...</>` ReactNode with bold workspace names intact. The plan note is inaccurate, but the code is correct. Low-stakes documentation error.

3. **`RestorePreviewModal` diff table regression.** The original `flex: 1` on the diff table container was changed to `maxHeight: 400px`. The original used flexbox to fill remaining space dynamically; the fixed 400px cap is less adaptive. The outer wrapper already has `maxHeight: calc(85vh - 140px)` with `overflowY: auto`, so at large viewports the diff table caps at 400px even when more space is available. The plan notes this as acceptable for a migration pass — but reviewers should be aware it's a visual behavior change, not a neutral substitution.

4. **`onOpenChange` vs `open` prop mismatch risk.** Several consumers pass `open={true}` unconditionally and rely on `onOpenChange` to unmount (via parent state). This means the dialog is never truly "controlled closed" from Dialog's perspective — it's always-open and the parent removes it from the tree. This is a common but slightly fragile pattern; if a parent fails to unmount cleanly, the dialog stays open. Not a regression from the prior code (all were conditional renders), but worth noting as a property of the new shared abstraction.
