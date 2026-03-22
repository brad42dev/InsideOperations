---
id: DD-28-002
title: Replace hand-rolled template substitution with MiniJinja engine
unit: DD-28
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

All email template rendering — for preview, for queue insertion, and for delivery — must use MiniJinja (the `minijinja` crate already in the workspace). Templates support full Jinja2 syntax: variables, conditionals, loops, filters, template inheritance, and HTML auto-escaping. The current hand-rolled `{{var}}` string replacement does none of this and will silently produce wrong output for any template using conditionals, loops, or filters.

## Spec Excerpt (verbatim)

> **MiniJinja** (Apache-2.0) — Jinja2-compatible template syntax. Chosen for:
> - Full Jinja2 syntax: variables, conditionals, loops, filters, template inheritance
> - Built-in HTML auto-escaping
> - Excellent error messages for template debugging
> — 28_EMAIL_SERVICE.md, §Email Templates / Template Engine

> All built-in templates use a shared base layout template (`_base.html`) that includes the I/O logo, consistent header/footer, and responsive styling. Custom templates can extend this base or define their own layout.
> — 28_EMAIL_SERVICE.md, §Email Templates / Built-In Templates

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/handlers/email.rs` — `render_template` function at lines 46-56 (the false-DONE implementation); called at lines 560-562, 614-616 in `render_template_preview` and `enqueue_email`
- `services/email-service/src/queue_worker.rs` — `attempt_delivery` at line 159; template variables are not passed through to the worker at all
- `services/email-service/Cargo.toml` — `minijinja` is listed as a dependency but unused

## Verification Checklist

- [ ] `render_template` function uses `minijinja::Environment` to render, not string replacement
- [ ] HTML auto-escaping is enabled on the MiniJinja environment
- [ ] A `_base.html` base layout template is seeded into the DB or loaded from embedded files
- [ ] The nine built-in system templates (`alert_notification`, `alert_escalation`, `report_ready`, `export_complete`, `round_assigned`, `round_overdue`, `password_reset`, `user_welcome`, `test_email`) are seeded with valid MiniJinja syntax
- [ ] Template render errors return a structured error response, not a panic

## Assessment

- **Status**: ❌ Missing — `minijinja` crate imported in Cargo.toml but never instantiated; `render_template` at `handlers/email.rs:46-56` uses only `String::replace`

## Fix Instructions

1. Create a helper module or function (e.g., in a new `services/email-service/src/template_engine.rs`) that:
   ```rust
   use minijinja::{Environment, Value};

   pub fn render(template_str: &str, vars: &serde_json::Value) -> Result<String, minijinja::Error> {
       let mut env = Environment::new();
       env.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
       // Add _base.html to environment if needed
       let tmpl = env.template_from_str(template_str)?;
       let ctx = Value::from_serialize(vars);
       tmpl.render(ctx)
   }
   ```

2. Replace `render_template` in `handlers/email.rs` with calls to this helper. Propagate the `minijinja::Error` as a 400/500 response.

3. Update `enqueue_email` in `handlers/email.rs` to also pass `template_variables` (rename `variables` field in `EnqueueBody` to match the spec's `template_variables`) to the render function.

4. Seed the nine built-in templates into the `email_templates` table (via migration or `seed_tier1`). The templates must use proper Jinja2 syntax (`{{ variable_name }}`, `{% if %}`, etc.).

5. For the `_base.html` base layout: either embed it as a compile-time string (`include_str!`) or seed it as a special template in the DB. Templates that extend it should use `{% extends "_base.html" %}`.

Do NOT:
- Keep the hand-rolled `render_template` function; delete it entirely
- Use `format!` or `String::replace` for any template rendering path
- Panic on template errors; return `Err` and convert to a structured HTTP error response
