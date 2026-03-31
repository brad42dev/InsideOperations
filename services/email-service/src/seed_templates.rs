//! Seed the nine built-in system email templates into `email_templates` if they
//! are not already present.  Called once at service startup.

use sqlx::PgPool;

/// One built-in template definition.
struct BuiltinTemplate {
    name: &'static str,
    category: &'static str,
    subject: &'static str,
    body_html: &'static str,
}

/// All nine built-in system templates.
static BUILTIN_TEMPLATES: &[BuiltinTemplate] = &[
    BuiltinTemplate {
        name: "alert_notification",
        category: "system",
        subject: "Alert: {{ alert_name }}",
        body_html: include_str!("../templates/alert_notification.html"),
    },
    BuiltinTemplate {
        name: "alert_escalation",
        category: "system",
        subject: "Alert Escalated: {{ alert_name }}",
        body_html: include_str!("../templates/alert_escalation.html"),
    },
    BuiltinTemplate {
        name: "report_ready",
        category: "system",
        subject: "Report Ready: {{ report_name }}",
        body_html: include_str!("../templates/report_ready.html"),
    },
    BuiltinTemplate {
        name: "export_complete",
        category: "system",
        subject: "Export Complete: {{ export_name }}",
        body_html: include_str!("../templates/export_complete.html"),
    },
    BuiltinTemplate {
        name: "round_assigned",
        category: "system",
        subject: "Round Assigned: {{ round_name }}",
        body_html: include_str!("../templates/round_assigned.html"),
    },
    BuiltinTemplate {
        name: "round_overdue",
        category: "system",
        subject: "Round Overdue: {{ round_name }}",
        body_html: include_str!("../templates/round_overdue.html"),
    },
    BuiltinTemplate {
        name: "password_reset",
        category: "system",
        subject: "Password Reset Request — Inside/Operations",
        body_html: include_str!("../templates/password_reset.html"),
    },
    BuiltinTemplate {
        name: "user_welcome",
        category: "system",
        subject: "Welcome to Inside/Operations",
        body_html: include_str!("../templates/user_welcome.html"),
    },
    BuiltinTemplate {
        name: "test_email",
        category: "system",
        subject: "Test Email — Inside/Operations",
        body_html: include_str!("../templates/test_email.html"),
    },
];

/// Insert all built-in templates using INSERT … ON CONFLICT DO NOTHING so that
/// existing records (including user-customised copies) are never overwritten.
pub async fn seed_builtin_templates(db: &PgPool) -> anyhow::Result<()> {
    for tmpl in BUILTIN_TEMPLATES {
        sqlx::query(
            r#"INSERT INTO email_templates (id, name, category, subject_template, body_html)
               VALUES (gen_random_uuid(), $1, $2, $3, $4)
               ON CONFLICT (name) DO NOTHING"#,
        )
        .bind(tmpl.name)
        .bind(tmpl.category)
        .bind(tmpl.subject)
        .bind(tmpl.body_html)
        .execute(db)
        .await?;
    }

    tracing::info!(
        count = BUILTIN_TEMPLATES.len(),
        "Built-in email templates seeded"
    );
    Ok(())
}
