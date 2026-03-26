# UAT Scenarios — DD-31

**Session focus:** DD-31-023 (template variable label and required indicator)
**Seed data status:** UNAVAILABLE

## Alerts Page Foundation

Scenario 1: [DD-31-023] Alerts page renders without error — navigate to /alerts → page loads, no error boundary ("Something went wrong") visible, tab navigation present

## Alert Compose — Data Flow

Scenario 2: [DD-31-023] — data flow: GET /api/notifications/templates — navigate to /alerts, open compose/new-alert form → template selector/dropdown is present and not empty, at least one template option visible (DOM evidence: option elements inside template select, or template list items rendered)

## Template Variable Rendering (DD-31-023 core)

Scenario 3: [DD-31-023] Template variable label uses human-readable text — in compose form, select "Fire Alarm" template (or any template with variables) → variable input field label shows human-readable text (e.g., "Location" or "Fire Location") NOT raw snake_case like "location"

Scenario 4: [DD-31-023] Required variable shows asterisk indicator — select a template with a required variable → asterisk (*) or "required" text is visible next to the variable field label

Scenario 5: [DD-31-023] Send button disabled when required variable is empty — select template with required variable, clear/leave variable field blank → Send button is disabled (grayed out, aria-disabled, or visually inactive)

Scenario 6: [DD-31-023] Variable input pre-fill with default_value — select a template with a variable that has a default_value → the input is pre-populated with that value (if no template has a default value in test env, record as ⚠️ skipped/not testable)

## Alert Compose Form Structure

Scenario 7: [DD-31-023] Compose form opens and shows template selector — navigate to /alerts, click "New Alert" or compose button → compose form or dialog opens, template selector field is visible

Scenario 8: [DD-31-023] No crash after template selection — select any available template → no error boundary appears, variable section renders below template picker
