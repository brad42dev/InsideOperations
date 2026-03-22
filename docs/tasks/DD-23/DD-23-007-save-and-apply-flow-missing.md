---
id: DD-23-007
title: Implement full save-and-apply OK flow with API save, performance test, and confirmation
unit: DD-23
status: pending
priority: high
depends-on: [DD-23-001, DD-23-005]
---

## What This Feature Should Do

Clicking OK triggers a multi-step flow: (1) validate name if Save is checked, (2) check name uniqueness, (3) show confirmation dialog, (4) run performance test, (5) save to API if Save is checked, (6) call onApply. If the expression is slow, the user is warned. Errors prevent apply. The current implementation skips all of this and calls onApply directly.

## Spec Excerpt (verbatim)

> **If "Save for Future Use" is checked:**
> 1. Validate that Name is not blank. ... 3. Prompt: "Test this expression, save it, and apply it?" ... 4. Run performance test (same as Test button). 5. **If test succeeds**: Save to database, apply to the context, close the modal.
> — design-docs/23_EXPRESSION_BUILDER.md, §10.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1146–1157` — handleApply; currently calls onApply directly
- `frontend/src/api/expressions.ts:39–54` — expressionsApi.create / expressionsApi.update
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:959–1002` — validateExpression; already checks name

## Verification Checklist

- [ ] When saveForFuture is true and name is blank, handleApply shows an error and does not proceed
- [ ] When saveForFuture is true, a confirmation dialog "Test this expression, save it, and apply it?" is shown before proceeding
- [ ] Performance test (via Worker per DD-23-005) runs as part of the OK flow
- [ ] If test passes, `expressionsApi.create` (or `update` for edit mode) is called before `onApply`
- [ ] If test fails (error), shows "This expression produces an error. Please check your formula." with Cancel / Save for Later
- [ ] If test is slow (>1ms avg), shows warning with Cancel / Save for Later / Accept & Apply
- [ ] When saveForFuture is false, confirmation is "Test this expression and apply it?" with Apply / Cancel

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `handleApply` at lines 1146–1157 builds the AST and calls `onApply(ast)` immediately with no confirmation, no API save, and no performance test.

## Fix Instructions (if needed)

1. Replace `handleApply` with an async function `handleOkClick` that:
   a. Returns early if `!validation.valid`
   b. If `state.saveForFuture && !state.name.trim()`: show inline error, return
   c. Open a confirmation dialog (use Radix Dialog) with the appropriate prompt text
   d. On confirm: launch the Worker benchmark (see DD-23-005)
   e. Based on benchmark result: if error → show error dialog; if slow → show slow warning dialog
   f. If proceeding: if `state.saveForFuture`, call `expressionsApi.create(...)` and await result
   g. Call `onApply(ast)` only after successful save (or immediately if not saving)
2. Manage dialog state with `useState` (e.g., `showConfirmDialog`, `showSlowWarning`, `showErrorDialog`).
3. For name uniqueness (check 2 in spec §10.1): call `expressionsApi.list()` filtered by name before proceeding, or rely on the API returning a 409 conflict.

Do NOT:
- Make the OK button itself async without disabling it during the operation — show a loading spinner
- Call onApply before the API save completes
