/// Integration tests for the email-service.
///
/// The email-service handles transactional email via lettre (SMTP), template
/// rendering with minijinja, queue management, and bounce handling.
///
/// Tests that require a live SMTP relay or email-service process are marked
/// `#[ignore]`.  Stub tests use wiremock to intercept HTTP callbacks.
///
///   cargo test -p email-service --test email_send -- --ignored

// ---------------------------------------------------------------------------
// Template rendering — pure logic using minijinja directly
// ---------------------------------------------------------------------------

/// A minijinja template must render with the expected variable substitution.
#[test]
fn test_email_template_renders_with_variables() {
    let mut env = minijinja::Environment::new();
    env.add_template("welcome", "Hello, {{ name }}! Your account is ready.")
        .expect("template must be added");

    let tmpl = env.get_template("welcome").expect("template must be found");
    let rendered = tmpl
        .render(minijinja::context! { name => "Alice" })
        .expect("template must render");

    assert_eq!(rendered, "Hello, Alice! Your account is ready.");
}

/// Missing variable in a strict template must produce an error.
#[test]
fn test_email_template_with_missing_variable_returns_error() {
    let mut env = minijinja::Environment::new();
    env.set_undefined_behavior(minijinja::UndefinedBehavior::Strict);
    env.add_template("strict", "Hello, {{ name }}!")
        .expect("template must be added");

    let tmpl = env.get_template("strict").expect("template must be found");
    // Render with an empty context — `name` is undefined.
    let result = tmpl.render(minijinja::context! {});
    assert!(
        result.is_err(),
        "strict template with missing variable must return an error"
    );
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

fn email_url() -> String {
    std::env::var("TEST_EMAIL_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3008".to_string())
}

#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", email_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// Send email via wiremock SMTP stub — requires wiremock (#[ignore])
// ---------------------------------------------------------------------------

/// Sending an email must result in exactly one HTTP callback to the mock SMTP.
///
/// This test is left as a stub; full implementation requires wiring the
/// email-service to accept a configurable SMTP URL for test overrides.
#[tokio::test]
#[ignore]
async fn test_send_email_reaches_smtp_relay() {
    // TODO: start a wiremock SMTP server, point email-service at it via
    //       TEST_SMTP_URL, POST /emails/send, assert the mock was called once.
    todo!("wire wiremock SMTP stub");
}
