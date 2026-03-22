use axum::{
    Router,
    routing::{delete, get, post, put},
};
use sha2::{Digest, Sha256};
use std::net::SocketAddr;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

mod audit;
mod config;
mod expression_eval;
mod handlers;
mod oidc_jwks;
mod sms;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "auth-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;

    let cfg = config::Config::from_env()?;

    info!(service = "auth-service", "Connecting to database");
    let db = io_db::create_pool(&cfg.database_url).await?;

    // Seed Phase 1 system report templates (idempotent — skips existing)
    handlers::reports::seed_report_templates(&db).await;

    // Seed EULA documents — insert-only, never overwrites published versions
    seed_installer_eula(&db).await;   // installer (org) EULA — v1.0
    seed_end_user_eula(&db).await;    // end-user EULA — v1.1

    let mut health = io_health::HealthRegistry::new("auth-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(db.clone()));
    health.mark_startup_complete();
    obs.start_watchdog_keepalive();

    let state = AppState::new(db, cfg.clone());

    // Background task: sweep expired EULA pending tokens every 5 minutes
    {
        let eula_tokens = state.eula_pending_tokens.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                let now = chrono::Utc::now();
                eula_tokens.retain(|_, entry| !entry.used && entry.expires_at > now);
                tracing::debug!("eula_pending_tokens sweep complete, {} remaining", eula_tokens.len());
            }
        });
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    // Build the main API router, consume state, produce Router<()>
    let api: Router = Router::new()
        // Auth flow
        // /auth/providers — public endpoint listing enabled IdPs for the login page
        // NOTE: also accessible at /auth/admin/providers (authenticated) for full details
        .route("/auth/providers", get(handlers::auth_providers::list_public_providers))
        .route("/auth/login", post(handlers::auth::login))
        .route("/auth/refresh", post(handlers::auth::refresh))
        .route("/auth/logout", post(handlers::auth::logout))
        // Session lock (idle timer) — requires a valid JWT; never issues new tokens
        .route("/auth/lock", post(handlers::auth::lock_session))
        // Lock-screen unlock — requires a valid JWT; never issues new tokens
        .route("/auth/verify-password", post(handlers::auth::verify_password_unlock))
        // PIN management — set, delete, and verify a 6-digit lock-screen PIN
        .route("/auth/pin", post(handlers::pin::set_pin).delete(handlers::pin::delete_pin))
        .route("/auth/verify-pin", post(handlers::pin::verify_pin))
        // EULA — end-user routes
        // NOTE: /auth/eula/pending must be before /auth/eula/current (avoid path conflict)
        // NOTE: /auth/eula/accept-pending must be before /auth/eula/accept (avoid path conflict)
        .route("/auth/eula/pending", get(handlers::eula::get_pending_eulas))
        .route("/auth/eula/current", get(handlers::eula::get_current_eula))
        .route("/auth/eula/accept-pending", post(handlers::eula::accept_eula_pending))
        .route("/auth/eula/accept", post(handlers::eula::accept_eula))
        .route("/auth/eula/status", get(handlers::eula::eula_status))
        // EULA — admin routes (RBAC enforced by API gateway)
        // NOTE: static /auth/admin/eula/versions must be before parameterised /:id/publish
        .route(
            "/auth/admin/eula/versions",
            get(handlers::eula::list_eula_versions).post(handlers::eula::create_eula_version),
        )
        .route(
            "/auth/admin/eula/versions/:id/publish",
            post(handlers::eula::publish_eula_version),
        )
        .route(
            "/auth/admin/eula/acceptances",
            get(handlers::eula::list_eula_acceptances),
        )
        // Sessions — admin routes
        // NOTE: static /auth/admin/sessions/user/:user_id MUST be before
        //       parameterised /auth/admin/sessions/:id to avoid routing ambiguity.
        .route(
            "/auth/admin/sessions",
            get(handlers::sessions::list_sessions),
        )
        .route(
            "/auth/admin/sessions/user/:user_id",
            delete(handlers::sessions::revoke_user_sessions),
        )
        .route(
            "/auth/admin/sessions/:id",
            delete(handlers::sessions::revoke_session),
        )
        // Sessions — current user's own sessions
        .route("/auth/sessions/mine", get(handlers::sessions::list_my_sessions))
        .route("/auth/sessions/mine/:id", delete(handlers::sessions::revoke_my_session))
        // Current user profile
        .route("/auth/me", get(handlers::users::get_me))
        // User management
        .route("/users", get(handlers::users::list_users))
        .route("/users", post(handlers::users::create_user))
        .route("/users/:id", get(handlers::users::get_user))
        .route("/users/:id", put(handlers::users::update_user))
        .route("/users/:id", delete(handlers::users::delete_user))
        // Role management
        .route("/roles", get(handlers::roles::list_roles))
        .route("/roles", post(handlers::roles::create_role))
        .route("/roles/:id", get(handlers::roles::get_role))
        .route("/roles/:id", put(handlers::roles::update_role))
        .route("/roles/:id", delete(handlers::roles::delete_role))
        // Permissions reference
        .route("/permissions", get(handlers::roles::list_permissions))
        // Settings
        .route("/settings", get(handlers::settings::list_settings))
        .route("/settings/:key", put(handlers::settings::update_setting))
        // WebSocket tickets (called by frontend after JWT auth; validated by Data Broker)
        .route("/auth/ws-ticket", post(handlers::ws_ticket::create_ws_ticket))
        .route(
            "/auth/ws-ticket/:ticket/validate",
            get(handlers::ws_ticket::validate_ws_ticket),
        )
        // Custom expressions
        .route("/expressions", get(handlers::expressions::list_expressions))
        .route("/expressions", post(handlers::expressions::create_expression))
        // NOTE: /expressions/evaluate must be registered before /expressions/:id
        // so that the literal segment "evaluate" is not consumed as an id.
        .route("/expressions/evaluate", post(handlers::expressions::evaluate_expression_inline))
        .route("/expressions/:id", get(handlers::expressions::get_expression))
        .route("/expressions/:id", put(handlers::expressions::update_expression))
        .route("/expressions/:id", delete(handlers::expressions::delete_expression))
        .route("/expressions/:id/evaluate", post(handlers::expressions::evaluate_expression_by_id))
        // Alarm definitions
        .route("/alarm-definitions", get(handlers::alarms::list_alarm_definitions))
        .route("/alarm-definitions", post(handlers::alarms::create_alarm_definition))
        .route("/alarm-definitions/:id", get(handlers::alarms::get_alarm_definition))
        .route("/alarm-definitions/:id", put(handlers::alarms::update_alarm_definition))
        .route("/alarm-definitions/:id", delete(handlers::alarms::delete_alarm_definition))
        // Report templates
        .route("/reports/templates", get(handlers::reports::list_report_templates))
        .route("/reports/templates", post(handlers::reports::create_report_template))
        .route("/reports/templates/:id", get(handlers::reports::get_report_template))
        .route("/reports/templates/:id", put(handlers::reports::update_report_template))
        .route("/reports/templates/:id", delete(handlers::reports::delete_report_template))
        // Export presets (per-template)
        // NOTE: /reports/templates/:id/presets must come before /reports/templates/:id
        // (axum resolves longer literal paths first)
        .route("/reports/templates/:id/presets", get(handlers::reports::list_export_presets))
        // Report schedules
        .route("/reports/schedules", get(handlers::reports::list_report_schedules))
        .route("/reports/schedules", post(handlers::reports::create_report_schedule))
        .route("/reports/schedules/:id", put(handlers::reports::update_report_schedule))
        .route("/reports/schedules/:id", delete(handlers::reports::delete_report_schedule))
        // Export presets standalone (create / delete)
        .route("/reports/presets", post(handlers::reports::create_export_preset))
        .route("/reports/presets/:id", delete(handlers::reports::delete_export_preset))
        // MFA (TOTP enrollment, verification, status, challenge, recovery)
        .route("/auth/mfa/enroll", post(handlers::mfa::enroll_totp))
        .route("/auth/mfa/verify", post(handlers::mfa::verify_totp_enrollment))
        .route("/auth/mfa/status", get(handlers::mfa::get_mfa_status))
        .route("/auth/mfa/challenge", post(handlers::mfa::mfa_challenge))
        .route("/auth/mfa/recover", post(handlers::mfa::use_recovery_code))
        .route("/auth/mfa/totp", delete(handlers::mfa::disable_totp))
        // MFA login-flow verify — completes login after primary auth when MFA is required.
        // Public: caller presents mfa_token (short-lived) + code, receives JWT on success.
        .route("/auth/mfa/login-verify", post(handlers::mfa::mfa_verify_login))
        // Duo Security MFA — Universal Prompt via OIDC Auth API
        // NOTE: static /auth/mfa/duo/callback must be before parameterised /:config_id/login
        // to avoid routing ambiguity.
        .route("/auth/mfa/duo/callback", get(handlers::duo::duo_callback))
        .route("/auth/mfa/duo/:config_id/login", get(handlers::duo::duo_login))
        // API key management
        .route("/api-keys", get(handlers::api_keys::list_api_keys).post(handlers::api_keys::create_api_key))
        .route("/api-keys/:id", delete(handlers::api_keys::delete_api_key))
        // OIDC SSO flow (public — no JWT required; gateway whitelist covers these)
        .route("/auth/oidc/:config_id/login", post(handlers::oidc::oidc_login))
        .route("/auth/oidc/callback", get(handlers::oidc::oidc_callback))
        // LDAP login (public — user submits credentials directly)
        .route("/auth/ldap/:config_id/login", post(handlers::ldap_auth::ldap_login))
        // SAML 2.0 SP flow (public — no JWT required; gateway whitelist covers these)
        // NOTE: static routes (/metadata, /acs) must be before parameterised (/:config_id/login)
        .route("/auth/saml/metadata", get(handlers::saml::saml_metadata))
        .route("/auth/saml/acs", post(handlers::saml::saml_acs))
        .route("/auth/saml/:config_id/login", post(handlers::saml::saml_login))
        // Admin: provider CRUD (authenticated — checked inside handlers via x-io-permissions)
        // NOTE: static route /auth/admin/providers must be before parameterised /:id variants
        .route("/auth/admin/providers",
            get(handlers::auth_providers::list_providers)
                .post(handlers::auth_providers::create_provider))
        .route("/auth/admin/providers/:id",
            get(handlers::auth_providers::get_provider)
                .put(handlers::auth_providers::update_provider)
                .delete(handlers::auth_providers::delete_provider))
        .route("/auth/admin/providers/:id/mappings",
            get(handlers::auth_providers::list_mappings)
                .post(handlers::auth_providers::create_mapping))
        .route("/auth/admin/providers/:id/mappings/:mapping_id",
            delete(handlers::auth_providers::delete_mapping))
        // SCIM token admin (JWT-protected, requires system:configure)
        .route("/auth/admin/scim-tokens",
            get(handlers::scim::list_scim_tokens)
                .post(handlers::scim::create_scim_token))
        .route("/auth/admin/scim-tokens/:id",
            delete(handlers::scim::delete_scim_token))
        // Email MFA (public — part of auth flow, SCIM handles own Bearer auth)
        .route("/auth/mfa/email/send", post(handlers::email_mfa::send_email_code))
        .route("/auth/mfa/email/verify", post(handlers::email_mfa::verify_email_code))
        // SMS MFA (public send + verify — part of auth flow)
        .route("/auth/mfa/sms/send", post(handlers::sms_mfa::send_sms_code))
        .route("/auth/mfa/sms/verify", post(handlers::sms_mfa::verify_sms_code))
        // SMS provider management (requires JWT + system:configure permission)
        .route("/auth/sms-providers",
            get(handlers::sms_mfa::list_sms_providers)
                .post(handlers::sms_mfa::create_sms_provider))
        .route("/auth/sms-providers/:id",
            delete(handlers::sms_mfa::delete_sms_provider))
        // SCIM 2.0 (own Bearer auth inside handlers — bypass JWT middleware at gateway)
        .route("/scim/v2/ServiceProviderConfig", get(handlers::scim::service_provider_config))
        .route("/scim/v2/Schemas", get(handlers::scim::list_schemas))
        .route("/scim/v2/ResourceTypes", get(handlers::scim::list_resource_types))
        .route("/scim/v2/Users",
            get(handlers::scim::list_users)
                .post(handlers::scim::create_user))
        .route("/scim/v2/Users/:id",
            get(handlers::scim::get_user)
                .put(handlers::scim::replace_user)
                .patch(handlers::scim::patch_user)
                .delete(handlers::scim::delete_user))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(cors)
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    info!(service = "auth-service", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Seed helpers — shared INSERT logic
// ---------------------------------------------------------------------------

async fn seed_eula(db: &io_db::DbPool, eula_type: &str, version: &str, title: &str, content: &str) {
    let content_hash = {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    };

    // Never overwrite a published EULA version — prior signatures reference it.
    let result = sqlx::query(
        "INSERT INTO eula_versions
             (eula_type, version, title, content, is_active, content_hash, published_at)
         VALUES ($1, $2, $3, $4, true, $5, NOW())
         ON CONFLICT (eula_type, version) DO NOTHING",
    )
    .bind(eula_type)
    .bind(version)
    .bind(title)
    .bind(content)
    .bind(&content_hash)
    .execute(db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(eula_type, version, "Seeded EULA {} v{}", eula_type, version);
        }
        Ok(_) => {
            tracing::debug!(eula_type, version, "EULA {} v{} already exists, skipping", eula_type, version);
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to seed EULA {} v{}", eula_type, version);
        }
    }
}

// ---------------------------------------------------------------------------
// Seed: Installer EULA v1.0 — organizational license (insert-only)
// Shown during package installation (CLI) and to the first admin after
// install/upgrade (web UI).  Covers the organization's rights and restrictions.
// ---------------------------------------------------------------------------

async fn seed_installer_eula(db: &io_db::DbPool) {
    seed_eula(db, "installer", "1.0",
        "Inside/Operations — Software License Agreement",
        r#"# Inside/Operations — Software License Agreement

**Version 1.0 | Effective March 2026**

---

> **To the System Administrator**
>
> This Software License Agreement governs your organization's rights to install, operate, and update Inside/Operations. By completing installation you represent that you are authorized to accept these terms on your organization's behalf.
>
> A separate End User License Agreement governs the rights and responsibilities of each individual who logs in to the application.

---

## 1. Grant of License

Inside Operations LLC grants Licensee a non-exclusive, non-transferable, limited license to install and operate Inside/Operations solely for Licensee's internal process monitoring and operational purposes at the facilities identified in the associated Order or Statement of Work.

This license is granted only to Licensee and may not be assigned, sublicensed, or transferred without the prior written consent of Inside Operations LLC.

---

## 2. Permitted Deployment

Subject to the terms of this Agreement, Licensee may:

- Install Inside/Operations on servers owned or controlled by Licensee at the licensed facility or facilities
- Permit authorized employees and contractors to access Inside/Operations through the web interface for job-related purposes
- Create a reasonable number of backup copies solely for disaster recovery purposes

Licensee may not install or operate Inside/Operations at facilities not identified in the associated Order without executing a separate license amendment.

---

## 3. Updates and Upgrades

Inside Operations LLC may, from time to time, make updates, patches, or new versions of Inside/Operations available. This Agreement governs all such updates and upgrades received by Licensee unless a separate agreement is presented at the time of delivery.

Installing an update constitutes Licensee's acceptance of any updated terms presented during the installation process. Inside Operations LLC will not reduce the scope of the license granted herein without Licensee's written consent.

---

## 4. Restrictions

Licensee must not, and must not permit others to:

- Copy, distribute, or sublicense Inside/Operations to any third party
- Modify, adapt, translate, or create derivative works of Inside/Operations
- Reverse engineer, disassemble, decompile, or attempt to derive the source code of Inside/Operations
- Remove or alter any copyright notices, trademarks, or other proprietary markings
- Use Inside/Operations to provide services to third parties (service bureau, outsourcing, or SaaS use)
- Transfer Inside/Operations to any other party without Inside Operations LLC's prior written consent
- Use Inside/Operations in any jurisdiction in violation of applicable laws or regulations

---

## 5. Intellectual Property

Inside/Operations, including all software code, algorithms, user interface designs, graphics, documentation, and related materials, is and remains the exclusive property of Inside Operations LLC and is protected by copyright, trade secret, patent, and other intellectual property laws.

This Agreement does not transfer any ownership interest in Inside/Operations to Licensee. All rights not expressly granted herein are reserved by Inside Operations LLC.

Data generated by Licensee's facility and displayed in Inside/Operations — including process values, alarm records, reports, and logs — belongs to Licensee. Inside Operations LLC makes no claim to Licensee's operational data.

---

## 6. Confidentiality

Licensee acknowledges that Inside/Operations contains proprietary and confidential information of Inside Operations LLC. Licensee must take reasonable steps to prevent unauthorized disclosure or use of the software and its components, no less protective than Licensee's measures for its own confidential information, but in no event less than reasonable care.

---

## 7. Safety and High-Risk Use Disclaimer

**Inside/Operations is a process monitoring and information management application. It is not designed, tested, certified, or intended for use as a Safety Instrumented System (SIS), emergency shutdown system (ESD), process safety management (PSM) tool, or any other safety-critical application.**

Licensee must not deploy Inside/Operations as a primary or backup safety control system. All safety-critical monitoring, control, and intervention must be performed by certified safety systems in accordance with applicable standards including IEC 61511 and IEC 61508. Licensee is solely responsible for maintaining appropriate safety systems, procedures, and controls at its facilities.

Inside Operations LLC expressly disclaims any liability for incidents, injuries, environmental damage, or other consequences arising from reliance on Inside/Operations for safety-critical functions.

---

## 8. Warranty Disclaimer

INSIDE OPERATIONS LLC PROVIDES INSIDE/OPERATIONS "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, INSIDE OPERATIONS LLC EXPRESSLY DISCLAIMS ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT.

Inside Operations LLC does not warrant that Inside/Operations will be uninterrupted, error-free, or free from security vulnerabilities, or that defects will be corrected.

---

## 9. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL INSIDE OPERATIONS LLC BE LIABLE TO LICENSEE OR ANY THIRD PARTY FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, REVENUE, DATA, BUSINESS, OR GOODWILL, ARISING OUT OF OR RELATED TO THIS AGREEMENT OR THE USE OR INABILITY TO USE INSIDE/OPERATIONS, EVEN IF INSIDE OPERATIONS LLC HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

Inside Operations LLC's total cumulative liability to Licensee arising out of or related to this Agreement shall not exceed the fees paid by Licensee for Inside/Operations in the twelve (12) months immediately preceding the event giving rise to the claim.

---

## 10. Term and Termination

This Agreement is effective from the date of installation and continues until terminated. Inside Operations LLC may terminate this Agreement immediately upon written notice if Licensee materially breaches any provision hereof and fails to cure such breach within thirty (30) days of written notice.

Upon termination, Licensee must cease all use of Inside/Operations, destroy all copies in its possession or control, and certify such destruction in writing upon request.

---

## 11. Governing Law and Jurisdiction

This Agreement is governed by the laws of the **State of Texas**, without regard to its conflict of laws provisions. Any dispute arising out of or relating to this Agreement shall be subject to the exclusive jurisdiction of the state and federal courts located in Harris County, Texas.

---

## 12. Entire Agreement

This Agreement, together with any associated Order or Statement of Work, constitutes the entire agreement between the parties with respect to Inside/Operations and supersedes all prior negotiations, representations, warranties, and understandings. This Agreement may only be amended by a written document signed by authorized representatives of both parties.

---

## Acceptance

By accepting below, you represent and warrant that:

1. You are an authorized representative of the licensed organization with authority to bind it to these terms
2. Your organization agrees to comply with all terms of this Software License Agreement
3. You will ensure that all individuals who access Inside/Operations agree to the End User License Agreement presented at login

---

*Inside/Operations is a product of Inside Operations LLC. All rights reserved.*
*For licensing inquiries: legal@in-ops.com*"#,
    ).await;
}

// ---------------------------------------------------------------------------
// Seed: End User EULA v1.1 — individual user agreement (insert-only)
// Shown to every user on first login and whenever a new version is published.
// Covers personal use rights, safety disclaimer, and prohibited conduct.
// ---------------------------------------------------------------------------

async fn seed_end_user_eula(db: &io_db::DbPool) {
    seed_eula(db, "end_user", "1.1",
        "Inside/Operations — End User License Agreement",
        r#"# Inside/Operations — End User License Agreement

**Version 1.1 | Effective March 2026**

---

> **Plain-English Summary** *(for convenience only — not legally binding)*
>
> - Your employer has licensed Inside/Operations. These terms govern your personal use of the application.
> - Use it only for your assigned job duties within your granted permissions.
> - This is a monitoring and information tool — **it is not a safety system**. Never use it as your primary source for safety-critical decisions.
> - Your usage is logged and may be monitored by your organization.
> - Keep your login credentials confidential and notify your administrator if they are compromised.
> - The software is proprietary. Do not copy, reverse engineer, or redistribute it.

---

## 1. Who This Applies To

This End User License Agreement applies to you as an individual employee, contractor, or authorized representative accessing Inside/Operations on behalf of an organization that has licensed it from Inside Operations LLC.

Your employer or organization has agreed to a separate Software License Agreement that covers the organization's rights to install and operate the software. This agreement covers your personal rights and responsibilities while using it.

By logging in to Inside/Operations, you confirm that you have read, understood, and agree to be bound by these terms. If you do not agree, do not use the application.

---

## 2. Authorized Use Only

You are authorized to use Inside/Operations solely for the performance of your assigned job duties at your facility. Authorized use means:

- Accessing only the data, views, and functions for which you have been granted permission by your system administrator
- Using the application in connection with legitimate operational, monitoring, engineering, or administrative tasks within the scope of your role
- Complying with your organization's internal policies governing use of process control and monitoring systems

Use of Inside/Operations for any other purpose is not authorized.

---

## 3. This Is Not a Safety System

**Inside/Operations is a monitoring and information tool only.**

The application displays data sourced from your facility's connected systems. It is designed to support operational awareness, process monitoring, and data analysis. It is **not** a safety system, safety interlock, emergency shutdown system (ESD), or process safety management (PSM) tool.

**You must not:**
- Use Inside/Operations as a primary or backup safety system
- Rely on data displayed in this application to make safety-critical decisions in place of your facility's approved safety instrumented systems (SIS), DCS interlocks, or other safety controls
- Use this application as a substitute for direct instrument readings or certified safety system outputs during emergency or safety-critical situations

All safety-critical decisions must be made using your facility's approved safety systems and procedures. In any emergency or safety-critical situation, follow your facility's established emergency response procedures.

---

## 4. Data Accuracy Disclaimer

Data displayed in Inside/Operations is sourced from your facility's OPC UA servers, historians, and other connected systems configured and maintained by your organization. **Inside Operations LLC does not control, verify, or guarantee the accuracy, completeness, timeliness, or reliability of that data.**

Displayed values reflect what the connected source systems are reporting at the time of transmission. Data may be delayed, incomplete, or incorrect due to network conditions, source system issues, configuration errors, or other factors outside Inside Operations LLC's control.

Do not treat displayed data as authoritative for any purpose where independent verification is required.

---

## 5. Prohibited Uses

You must not use Inside/Operations to:

- Conduct personal, non-work-related activities
- Access, view, or modify data, configurations, or records that you have not been authorized to access
- Attempt to bypass, circumvent, or test security controls, authentication mechanisms, or permission boundaries
- Introduce malware, scripts, or unauthorized code into the application or its connected systems
- Share your login credentials with any other person
- Access the application using another person's credentials
- Harvest, extract, copy, or export data or system information for purposes outside your authorized job duties
- Interfere with the operation of Inside/Operations or any connected system

---

## 6. Monitoring and Audit Logging

Your organization may log, monitor, and audit your use of Inside/Operations for operational, safety, security, and compliance purposes. This may include records of login events, pages accessed, data queried, actions performed, reports generated, and changes made.

By using this application, you acknowledge and consent to such monitoring and logging in accordance with your organization's policies and applicable law. Audit logs are retained as configured by your organization's system administrator.

---

## 7. Credentials and Account Security

Your login credentials are personal to you. You are responsible for maintaining the confidentiality of your username, password, and any multi-factor authentication methods associated with your account.

You must:
- Keep your credentials confidential and not share them with anyone
- Lock or log out of the application when leaving your workstation unattended
- Promptly notify your system administrator if you suspect your credentials have been compromised or that unauthorized access has occurred

Inside Operations LLC is not responsible for any loss, damage, or unauthorized access resulting from your failure to protect your credentials.

---

## 8. Intellectual Property

Inside/Operations is the proprietary intellectual property of Inside Operations LLC. You must not:

- Copy, reproduce, or redistribute any part of the application
- Attempt to decompile, disassemble, or reverse engineer any part of the application
- Remove or alter any proprietary notices, copyright markings, or labels

These terms do not grant you any ownership interest in the software. Your organization's rights are defined in its separate Software License Agreement with Inside Operations LLC.

---

## 9. No Warranty

Inside/Operations is provided to you through your organization. **Inside Operations LLC makes no warranty of any kind, express or implied, directly to you as an end user.** For application support, contact your system administrator. You may also reach support at support@in-ops.com.

---

## 10. Limitation of Liability

To the fullest extent permitted by applicable law, Inside Operations LLC shall not be liable to you for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of Inside/Operations, including damages resulting from data inaccuracies, system unavailability, unauthorized access, or reliance on displayed information for safety-critical decisions.

---

## 11. Governing Law

These terms are governed by the laws of the **State of Texas**, without regard to its conflict of law provisions.

---

## 12. Changes to These Terms

Inside Operations LLC may update these terms from time to time. You will be presented with any updated version at your next login and must accept it before continuing.

---

## 13. Contact

**Legal inquiries:** legal@in-ops.com
**Support:** support@in-ops.com
**System access:** Contact your organization's system administrator

---

## Acceptance

By checking the boxes and clicking **"I Accept"** below, you confirm that you have read and agree to these terms, and separately, that you understand this application is not a safety system.

---

*Inside/Operations is a product of Inside Operations LLC. All rights reserved.*"#,
    ).await;
}

// ---------------------------------------------------------------------------
// Seed: End User EULA v1.1 — stub kept for historical name compatibility
// ---------------------------------------------------------------------------
#[allow(dead_code)]
async fn seed_eula_v1(db: &io_db::DbPool) {
    const EULA_VERSION: &str = "1.1";
    const EULA_TITLE: &str = "Inside/Operations — Terms of Use";
    const EULA_CONTENT: &str = r#"# Inside/Operations — End User Terms of Use

**Version 1.1 | Effective March 2026**

---

> **Plain-English Summary** *(for convenience only — not legally binding)*
>
> - You are using Inside/Operations because your employer has licensed it from Inside Operations LLC. These terms govern your personal use of the application.
> - Use it only for your assigned job duties. Do not attempt to access areas outside your assigned permissions.
> - This application is a monitoring and information tool — it is **not** a safety system. Never rely on it as your primary source for safety-critical decisions.
> - Your usage activity may be logged and monitored by your organization.
> - Keep your login credentials confidential and report anything suspicious to your system administrator.
> - The software is proprietary. Do not copy, reverse engineer, or attempt to extract its code or content.

---

## 1. Who This Agreement Is With

Inside/Operations is a proprietary industrial process monitoring application developed and owned by **Inside Operations LLC**. Your employer or organization has licensed Inside/Operations from Inside Operations LLC under a separate Software License Agreement. These End User Terms of Use govern your individual access to and use of the application. By using Inside/Operations, you agree to be bound by these terms.

If you do not agree to these terms, do not use the application. Contact your system administrator.

---

## 2. Authorized Use Only

You are authorized to use Inside/Operations solely for the performance of your assigned job duties at your facility. Authorized use means:

- Accessing only the data, views, and functions for which you have been granted permission by your system administrator
- Using the application in connection with legitimate operational, monitoring, engineering, or administrative tasks within the scope of your role
- Complying with your organization's internal policies governing use of process control and monitoring systems

Use of Inside/Operations for any other purpose is not authorized.

---

## 3. This Is Not a Safety System

**Inside/Operations is a monitoring and information tool only.**

The application displays data sourced from your facility's connected systems. It is designed to support operational awareness, process monitoring, and data analysis. It is **not** a safety system, safety interlock, emergency shutdown system (ESD), or process safety management (PSM) tool.

**You must not:**
- Use Inside/Operations as a primary or backup safety system
- Rely on data displayed in this application to make safety-critical decisions in place of your facility's approved safety instrumented systems (SIS), DCS interlocks, or other safety controls
- Use this application as a substitute for direct instrument readings or certified safety system outputs during emergency or safety-critical situations

All safety-critical decisions must be made using your facility's approved safety systems and procedures. In any emergency or safety-critical situation, follow your facility's established emergency response procedures.

---

## 4. Data Accuracy Disclaimer

Data displayed in Inside/Operations is sourced from your facility's OPC UA servers, historians, and other connected systems configured and maintained by your organization. **Inside Operations LLC does not control, verify, or guarantee the accuracy, completeness, timeliness, or reliability of that data.**

Displayed values reflect what the connected source systems are reporting at the time of transmission. Data may be delayed, incomplete, or incorrect due to network conditions, source system issues, configuration errors, or other factors outside Inside Operations LLC's control.

Do not treat displayed data as authoritative for any purpose where independent verification is required.

---

## 5. Prohibited Uses

You must not use Inside/Operations to:

- Conduct personal, non-work-related activities
- Access, view, or modify data, configurations, or records that you have not been authorized to access
- Attempt to bypass, circumvent, or test security controls, authentication mechanisms, or permission boundaries
- Introduce malware, scripts, or unauthorized code into the application or its connected systems
- Share your login credentials with any other person
- Access the application using another person's credentials
- Harvest, extract, copy, or export data or system information for purposes outside your authorized job duties
- Interfere with the operation of Inside/Operations or any connected system

---

## 6. Monitoring and Audit Logging

Your organization may log, monitor, and audit your use of Inside/Operations for operational, safety, security, and compliance purposes. This may include records of login events, pages accessed, data queried, actions performed, reports generated, and changes made.

By using this application, you acknowledge and consent to such monitoring and logging in accordance with your organization's policies and applicable law. Audit logs are retained as configured by your organization's system administrator.

---

## 7. Credentials and Account Security

Your login credentials are personal to you. You are responsible for maintaining the confidentiality of your username, password, and any multi-factor authentication methods associated with your account.

You must:
- Keep your credentials confidential and not share them with anyone
- Lock or log out of the application when leaving your workstation unattended
- Promptly notify your system administrator if you suspect your credentials have been compromised or that unauthorized access has occurred

Inside Operations LLC is not responsible for any loss, damage, or unauthorized access resulting from your failure to protect your credentials.

---

## 8. Intellectual Property

Inside/Operations, including all software code, user interface designs, graphics, documentation, algorithms, and components, is the proprietary intellectual property of Inside Operations LLC and is protected by copyright, trade secret, and other applicable laws.

You must not:
- Copy, reproduce, or redistribute any part of the application
- Attempt to decompile, disassemble, reverse engineer, or derive source code from any part of the application
- Remove or alter any proprietary notices, copyright markings, or labels
- Attempt to extract, replicate, or use any proprietary logic, algorithms, templates, or formats from the application outside of your authorized use

Your organization's rights to use Inside/Operations are defined in its Software License Agreement with Inside Operations LLC. These End User Terms of Use do not grant you any ownership interest in the software.

---

## 9. No Warranty to End Users

Inside/Operations is provided to you through your organization under the terms of its Software License Agreement with Inside Operations LLC. **Inside Operations LLC makes no warranty of any kind, express or implied, directly to you as an end user.** This includes, without limitation, any implied warranty of merchantability, fitness for a particular purpose, or non-infringement.

For questions about application functionality, access, or issues, contact your system administrator. Support is provided to your organization in accordance with its agreement with Inside Operations LLC. You may also reach Inside Operations LLC support at support@in-ops.com, though your primary point of contact for day-to-day issues should be your organization's system administrator.

---

## 10. Limitation of Liability

To the fullest extent permitted by applicable law, Inside Operations LLC shall not be liable to you for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of Inside/Operations, including but not limited to damages resulting from data inaccuracies, system unavailability, unauthorized access, or reliance on displayed information for safety-critical decisions.

---

## 11. Governing Law

These End User Terms of Use are governed by the laws of the **State of Texas**, without regard to its conflict of law provisions. Any disputes arising under these terms that are not resolved through your organization's internal processes shall be subject to the exclusive jurisdiction of the state and federal courts located in Texas.

---

## 12. Changes to These Terms

Inside Operations LLC may update these End User Terms of Use from time to time. Your continued use of Inside/Operations after updated terms are presented at login constitutes your acceptance of the revised terms.

---

## 13. Contact

**Legal inquiries:** legal@in-ops.com
**Support:** support@in-ops.com
**System access and permissions:** Contact your organization's system administrator

The full Software License Agreement governing your organization's rights to Inside/Operations is a separate document available from Inside Operations LLC upon request.

---

## Acceptance

By clicking **"I Accept"** below, you confirm that:

1. You have read and understood these End User Terms of Use
2. You agree to be bound by these terms
3. You are an authorized employee or contractor of an organization that has licensed Inside/Operations from Inside Operations LLC
4. You will use Inside/Operations only for authorized purposes in accordance with your assigned job duties and your organization's policies

---

*Inside/Operations is a product of Inside Operations LLC. All rights reserved.*"#;

    let content_hash = {
        let mut hasher = Sha256::new();
        hasher.update(EULA_CONTENT.as_bytes());
        format!("{:x}", hasher.finalize())
    };

    // Never overwrite a published EULA version — users may have signed it.
    // If this version already exists, skip silently.
    let result = sqlx::query(
        "INSERT INTO eula_versions (version, title, content, is_active, content_hash, published_at)
         VALUES ($1, $2, $3, true, $4, NOW())
         ON CONFLICT (version) DO NOTHING",
    )
    .bind(EULA_VERSION)
    .bind(EULA_TITLE)
    .bind(EULA_CONTENT)
    .bind(&content_hash)
    .execute(db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(version = EULA_VERSION, "Seeded EULA version {}", EULA_VERSION);
        }
        Ok(_) => {
            tracing::debug!(version = EULA_VERSION, "EULA version {} already exists, skipping", EULA_VERSION);
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to seed EULA version {}", EULA_VERSION);
        }
    }
}

async fn shutdown_signal() {
    use tokio::signal;
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received, draining in-flight requests…");
}
