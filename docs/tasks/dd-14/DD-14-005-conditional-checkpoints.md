---
id: DD-14-005
title: Implement conditional checkpoints in TemplateDesigner and RoundPlayer
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Round template checkpoints can be configured to show or hide based on a previous checkpoint's answer. For example: "If Pump Running = No, show 'Reason for shutdown' checkpoint." The TemplateDesigner must allow configuring this condition per checkpoint. The RoundPlayer must evaluate conditions at runtime and skip hidden checkpoints (they receive no response and do not appear in the progress count).

## Spec Excerpt (verbatim)

> **Conditional checkpoints (show based on previous answer)**
> — 14_ROUNDS_MODULE.md, §Template Designer (Desktop)

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/TemplateDesigner.tsx` — EditableCheckpoint type (lines 14–41) and CheckpointEditor component (lines 198–608); no condition fields exist
- `frontend/src/api/rounds.ts` — Checkpoint type (lines 34–51); no `condition` field defined
- `frontend/src/pages/rounds/RoundPlayer.tsx` — main render loop at lines 621–635; iterates checkpoints array without filtering

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `Checkpoint` type in api/rounds.ts has an optional `condition` field (e.g. `{ checkpoint_index: number; operator: 'eq' | 'ne' | 'gt' | 'lt'; value: string }`)
- [ ] `EditableCheckpoint` in TemplateDesigner.tsx has condition fields
- [ ] CheckpointEditor renders a "Show only if" section when enabled, with previous-checkpoint selector, operator, and value
- [ ] RoundPlayer evaluates conditions against current response values and skips non-matching checkpoints
- [ ] Skipped checkpoints are excluded from the progress bar denominator
- [ ] Skipped checkpoints do not appear in navigation (Next button jumps over them)

## Assessment

- **Status**: ❌ Missing — no condition field in Checkpoint type; no condition UI in TemplateDesigner; RoundPlayer iterates all checkpoints without filtering

## Fix Instructions (if needed)

1. **Add type** in `frontend/src/api/rounds.ts` after `CheckpointGpsGate`:
   ```ts
   export interface CheckpointCondition {
     /** Index of the checkpoint whose answer controls this checkpoint's visibility */
     depends_on_index: number
     /** Comparison operator */
     operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
     /** Value to compare against (always string; RoundPlayer coerces to match data type) */
     value: string
   }
   ```
   Add `condition?: CheckpointCondition` to the `Checkpoint` interface.

2. **Update TemplateDesigner** — add to `EditableCheckpoint` (line 14):
   ```ts
   condition_enabled: boolean
   condition_depends_on: string  // index as string
   condition_operator: string
   condition_value: string
   ```
   In `CheckpointEditor`, after the GPS gate section (~line 603), add a "Conditional" section with:
   - Checkbox to enable condition
   - When enabled: "Show only if Checkpoint [select] [operator select] [value input]"
   - Previous checkpoint options pulled from `total` and sibling checkpoint titles

3. **Update RoundPlayer** — before `const clampedIdx = ...` (line 633), build a `visibleCheckpoints` array that filters out checkpoints whose condition is not met given current `values` state. Use `visibleCheckpoints` for progress calculation and navigation. The raw `checkpoints` array index is still used as the key in `values` so stored responses are not lost if conditions change.

4. In `handleNext` (line 576), advance to the next *visible* checkpoint index, not `checkpointIdx + 1`.

Do NOT:
- Apply conditions to the first checkpoint (it has no previous checkpoint to depend on)
- Remove a stored response when a checkpoint becomes hidden — the response should persist in case the condition changes
- Evaluate conditions server-side — the spec does not mention server evaluation; client-side evaluation is appropriate
