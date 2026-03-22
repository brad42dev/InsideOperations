---
id: DD-31-003
title: Change template variable definitions from string[] to structured {name, label, default_value, required} objects
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each template variable must carry metadata: a display label, an optional default value, and a required flag. The UI must render the label as the field label, pre-fill the input with the default value, and mark required fields (e.g., asterisk). When no default is provided and the field is marked required, the Send button must be disabled until the field is filled.

## Spec Excerpt (verbatim)

> `variables` JSONB — Array of variable definitions: `{name, label, default_value, required}`
>
> Variables definition (name, label, default value, required flag)
> — `31_ALERTS_MODULE.md`, §Template Fields and §Template editor

## Where to Look in the Codebase

Primary files:
- `frontend/src/api/notifications.ts` line 20 — `variables: string[]` in `NotificationTemplate` interface (must change to `TemplateVariable[]`)
- `frontend/src/pages/alerts/index.tsx` lines 244–256 — `handleTemplateSelect` initialises variable state
- `frontend/src/pages/alerts/index.tsx` lines 367–389 — variable input rendering loop
- `frontend/src/pages/alerts/AlertComposer.tsx` lines 81–89 — `handleTemplateChange`

## Verification Checklist

- [ ] `NotificationTemplate.variables` is typed as `TemplateVariable[]` where `TemplateVariable = { name: string; label: string; default_value?: string; required: boolean }`
- [ ] Variable input fields use `v.label` as the `<label>` text, not the raw variable name
- [ ] Variable inputs are pre-filled with `v.default_value` when it is set
- [ ] Required variables show a visual indicator (asterisk or "required" label)
- [ ] Send button is disabled when a required variable has no value
- [ ] Template create form in `TemplatesPanel` allows defining structured variable objects (not just free-text names)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `notifications.ts:20` has `variables: string[]` — just an array of name strings. `index.tsx:367-389` renders inputs with the variable name as both key and label. No default_value pre-fill, no required flag enforcement. `AlertComposer.tsx:88` copies `body_template` verbatim into the body field (replaces template body with raw template string instead of variable-substituted preview).

## Fix Instructions

1. In `frontend/src/api/notifications.ts`, add and use:
   ```ts
   export interface TemplateVariable {
     name: string
     label: string
     default_value?: string
     required: boolean
   }
   ```
   Change `NotificationTemplate.variables` from `string[]` to `TemplateVariable[]`.
   Change `CreateTemplatePayload.variables` and `UpdateTemplatePayload.variables` similarly.

2. In `index.tsx handleTemplateSelect` (around line 250), initialise variable state from `v.default_value`:
   ```ts
   tpl.variables.forEach((v) => { initVars[v.name] = v.default_value ?? '' })
   ```

3. In `index.tsx` variable rendering loop (lines 367–389), change the loop variable from raw string to `TemplateVariable` and render `v.label` as the label, add `*` when `v.required`.

4. In `doSend` validation, block send if any required variable is empty.

5. In `AlertComposer.tsx handleTemplateChange`, stop overwriting title/body fields with the raw template string — those are template strings with `{{placeholder}}` syntax. Keep the template selected and let the preview show the substituted result.

Do NOT:
- Keep the flat `string[]` type — the DB stores `JSONB` with structured objects
- Show the raw `{{variable_name}}` as a label — use `v.label`
