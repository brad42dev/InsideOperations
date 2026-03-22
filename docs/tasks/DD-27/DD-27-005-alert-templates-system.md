---
id: DD-27-005
title: Implement alert templates with MiniJinja rendering and built-in seed templates
unit: DD-27
status: pending
priority: medium
depends-on: [DD-27-001]
---

## What This Feature Should Do

Alert templates allow operators and automated systems to trigger alerts by template ID plus variable substitution, rather than providing raw title/message text each time. The system should ship with 14 built-in templates (gas_leak, fire_alarm, unit_trip, etc.), support CRUD for custom templates, and render `title_template` and `message_template` via MiniJinja when an alert is triggered with `template_id` + `template_variables`.

## Spec Excerpt (verbatim)

> ```json
> {
>   "id": "uuid",
>   "name": "Gas Leak Emergency",
>   "severity": "emergency",
>   "title_template": "Gas Leak Detected — {{unit}}",
>   "message_template": "{{gas_type}} detected at {{instrument}}. {{action_required}}. Await all-clear from Control Room.",
>   "channels": ["websocket", "email", "sms", "radio", "pa", "browser_push"],
>   "default_roster_id": "uuid",
>   "escalation_policy": [ ... ],
>   "requires_acknowledgment": true,
>   "auto_resolve_minutes": null,
>   "category": "emergency",
>   "variables": ["unit", "gas_type", "instrument", "action_required"]
> }
> ```
>
> These are starting points. Site administrators customize or create new templates to match their specific emergency response procedures.
> — design-docs/27_ALERT_SYSTEM.md, §Alert Templates

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/main.rs:43-77` — no `/alerts/templates` routes registered
- `services/alert-service/src/handlers/` — no `templates.rs` file exists
- `services/alert-service/Cargo.toml` — check if `minijinja` is listed as a dependency

## Verification Checklist

- [ ] `Cargo.toml` for alert-service includes `minijinja = "..."` (MIT license)
- [ ] `handlers/templates.rs` exists with CRUD: `list_templates`, `get_template`, `create_template`, `update_template`, `delete_template`
- [ ] `main.rs` registers routes for `GET/POST /alerts/templates` and `GET/PUT/DELETE /alerts/templates/:id`
- [ ] `trigger_alert` handler resolves `template_id` when provided: loads template, renders `title_template` and `message_template` with MiniJinja using `template_variables` map
- [ ] Built-in templates (gas_leak, fire_alarm, unit_trip, etc.) are seeded in a migration or on startup; deletion of built-in templates returns 409 Conflict
- [ ] `variables` field is validated: trigger request providing `template_variables` that omit a required variable returns 400 with which variable is missing

## Assessment

- **Status**: ❌ Missing — no template routes, no handlers, no MiniJinja dependency

## Fix Instructions (if needed)

1. Add `minijinja = "2"` to `services/alert-service/Cargo.toml`.

2. Create `services/alert-service/src/handlers/templates.rs` with:
   - `AlertTemplate` struct matching spec columns (all fields including `variables: Vec<String>`)
   - `list_templates`, `get_template`, `create_template`, `update_template`, `delete_template` handlers
   - `delete_template`: query `built_in BOOLEAN` column; if `true`, return 409

3. In `trigger_alert` handler (`alerts.rs:82`), add template resolution branch:
   ```rust
   if let Some(template_id) = body.template_id {
       let template = // fetch from alert_templates WHERE id = template_id
       let vars = body.template_variables.unwrap_or_default();
       let env = minijinja::Environment::new();
       let title = env.render_str(&template.title_template, &vars)?;
       let message = env.render_str(&template.message_template, &vars)?;
       // use rendered title/message for the alert
   }
   ```

4. Write a database migration adding `alert_templates` table with all spec columns plus a `built_in BOOLEAN NOT NULL DEFAULT false` flag.

5. Write a separate seed migration inserting the 14 built-in templates from the spec (gas_leak, fire_alarm, shelter_in_place, evacuation, all_clear, unit_trip, equipment_failure, safety_system_override, high_alarm, opc_connection_lost, round_overdue, report_ready, maintenance_reminder, custom) with `built_in = true`.

6. Register routes in `main.rs`:
   ```rust
   .route("/alerts/templates", get(handlers::templates::list_templates).post(handlers::templates::create_template))
   .route("/alerts/templates/:id", get(handlers::templates::get_template).put(handlers::templates::update_template).delete(handlers::templates::delete_template))
   ```

Do NOT:
- Use `tera` or `handlebars` — the spec and email-service both use `minijinja`
- Allow deletion of built-in templates (those with `built_in = true`)
