---
id: DD-23-021
unit: DD-23
title: "Save for Future Use" checkbox not checked by default
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

When the expression builder modal opens, the "Save for Future Use" checkbox should be checked by default. Currently it is unchecked when the modal opens, requiring users to manually opt in to saving. The spec requires this to default to checked so users don't accidentally lose their work.

UAT Scenario 8 [DD-23-014]: modal opens → "Save for Future Use" checked by default → observed unchecked.

## Acceptance Criteria

- [ ] When the expression builder modal opens fresh (new expression), "Save for Future Use" is checked by default
- [ ] When editing an existing saved expression, "Save for Future Use" remains checked
- [ ] The checked state persists through the modal session (doesn't reset on workspace changes)

## Verification Checklist

- [ ] Navigate to /settings/expressions, click Edit on a saved expression
- [ ] Confirm "Save for Future Use" checkbox is checked on modal open (before any interaction)
- [ ] Confirm the checkbox state is preserved when adding tiles to the workspace

## Do NOT

- Do not make this dependent on user preferences — it should always default to checked
- Do not stub the fix; the actual `useState` initial value must be `true`

## Dev Notes

UAT failure from 2026-03-24: screenshot (fail-s8-save-for-future-unchecked.png) clearly shows both "Save for Future Use" and "Shared" checkboxes unchecked on modal open. The initial state in ExpressionBuilderModal or ExpressionBuilder component defaults saveForFuture to false.
Spec reference: DD-23-014 (saveForFuture default)
