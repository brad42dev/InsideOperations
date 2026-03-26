---
id: DD-23-008
title: Add unsaved-changes confirmation prompt to Cancel button
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user clicks Cancel and there are unsaved changes (any tile added, removed, moved, or values changed), a dialog "You have unsaved changes. Discard changes?" with "Discard" and "Keep Editing" buttons must appear. If no changes were made, Cancel closes immediately.

## Spec Excerpt (verbatim)

> If there are any unsaved changes (tiles added/removed/moved, values changed, options changed):
> - Prompt: "You have unsaved changes. Discard changes?" with "Discard" and "Keep Editing"
> If no changes: close immediately.
> — design-docs/23_EXPRESSION_BUILDER.md, §10.2

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1518` — Cancel button calls `onCancel` directly
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1056–1069` — initial state; `past` stack can serve as dirty indicator

## Verification Checklist

- [ ] If `state.past.length === 0` (no changes made), Cancel calls `onCancel()` directly
- [ ] If `state.past.length > 0` (changes made), a confirmation dialog is shown
- [ ] Dialog has "Discard" (calls onCancel) and "Keep Editing" (closes dialog, resumes editing) buttons
- [ ] Changing name, description, outputType, or checkboxes also counts as a change (not just tiles)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Line 1518: `<button style={btnSecondary} onClick={onCancel}>Cancel</button>` — calls onCancel with no check.

## Fix Instructions (if needed)

1. Add `showCancelConfirm` state: `const [showCancelConfirm, setShowCancelConfirm] = useState(false)`.
2. Track "dirty" state: the `state.past.length > 0` check is sufficient for tile changes. For header field changes (name, desc, outputType, etc.) compare against initial values.
3. Replace the Cancel onClick with:
   ```typescript
   onClick={() => {
     if (isDirty) { setShowCancelConfirm(true) } else { onCancel() }
   }}
   ```
4. Render a Radix Dialog when `showCancelConfirm` is true:
   - Title: "You have unsaved changes."
   - Body: "Discard changes and close the expression builder?"
   - Buttons: "Keep Editing" (closes dialog) and "Discard" (calls onCancel)

Do NOT:
- Use `window.confirm()` — use Radix Dialog for consistent styling
