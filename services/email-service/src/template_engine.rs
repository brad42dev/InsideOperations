//! MiniJinja-based email template rendering.
//!
//! Provides a single `render` function that compiles a Jinja2 template string,
//! adds the shared `_base.html` base layout, and renders it against a
//! `serde_json::Value` context with HTML auto-escaping enabled.

use minijinja::{AutoEscape, Environment, Value};

/// Embedded base layout shared by all built-in system templates.
const BASE_HTML: &str = include_str!("../templates/_base.html");

/// Error type for template rendering failures.
#[derive(Debug)]
pub struct TemplateError(pub minijinja::Error);

impl std::fmt::Display for TemplateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "template render error: {}", self.0)
    }
}

impl From<minijinja::Error> for TemplateError {
    fn from(e: minijinja::Error) -> Self {
        TemplateError(e)
    }
}

/// Render a Jinja2 template string against a JSON context.
///
/// HTML auto-escaping is always enabled. The `_base.html` base layout is
/// available for `{% extends "_base.html" %}` in any template.
///
/// # Errors
/// Returns [`TemplateError`] if the template is invalid or rendering fails.
pub fn render(template_str: &str, vars: &serde_json::Value) -> Result<String, TemplateError> {
    let mut env = Environment::new();

    // Enable HTML auto-escaping for every template in this environment.
    env.set_auto_escape_callback(|_name| AutoEscape::Html);

    // Register the shared base layout so templates can use:
    //   {% extends "_base.html" %}
    env.add_template_owned("_base.html".to_string(), BASE_HTML.to_string())
        .map_err(TemplateError)?;

    // Compile the caller-supplied template string.
    let tmpl = env.template_from_str(template_str)?;

    // Serialize the JSON context into a MiniJinja Value.
    let ctx = Value::from_serialize(vars);

    Ok(tmpl.render(ctx)?)
}
