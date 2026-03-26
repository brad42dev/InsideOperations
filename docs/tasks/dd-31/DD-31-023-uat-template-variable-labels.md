---
id: DD-31-023
unit: DD-31
title: "Template variable inputs show raw name instead of structured label; no required indicator"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

When selecting a template with variables in the alert compose form, the variable input fields
show the raw snake_case variable name ("location") as the field label instead of the human-readable
label from the structured `TemplateVariable.label` field. Additionally, required variables show
no visual indicator (no asterisk, no "required" text).

UAT test: selected "Fire Alarm" template. Expected a labelled input like "Fire Location *" or
"Location *" (with asterisk for required). Actual: input labelled "location" with no required marker.

DD-31-003 changed the TypeScript type from `string[]` to `TemplateVariable[]` but the UI rendering
still appears to use the raw `name` field as the label text, and required flag enforcement is absent.

## Acceptance Criteria

- [ ] Template variable input fields display `v.label` as the field label (human-readable text), not `v.name`
- [ ] Required variables (`v.required === true`) show a visual indicator (asterisk `*` or "required" label)
- [ ] Send button is disabled when a required variable field is empty
- [ ] Variable inputs are pre-filled with `v.default_value` when set

## Verification Checklist

- [ ] Navigate to /alerts, select "Fire Alarm" template
- [ ] Variable section shows a labelled input with human-readable label (e.g., "Location" not "location")
- [ ] If the variable is required, an asterisk or "required" text is visible next to the label
- [ ] Leaving a required field empty disables the Send button
- [ ] `cd frontend && npx tsc --noEmit` passes

## Do NOT

- Do not display `v.name` (snake_case) as the label — always use `v.label`
- Do not skip the required indicator — it must be visually present on required fields
- Do not ignore `v.default_value` — pre-fill the input when a default exists

## Dev Notes

UAT failure 2026-03-26: Selected "Fire Alarm" template. Variable section shows:
- Label: "location" (raw name field, lowercase snake_case)
- No asterisk or required indicator visible
- No pre-fill behavior tested (no default_value in seed data)
Expected: "Location" or "Fire Location" label with asterisk if required.
Spec reference: DD-31-003 (type changed but UI behavior incomplete)
File to fix: `frontend/src/pages/alerts/index.tsx` variable rendering loop (around lines 367-389)
