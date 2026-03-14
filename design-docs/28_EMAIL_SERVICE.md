# 28. Email Service

## Overview

The Email Service is a system-wide email delivery service that provides programmatic email sending to all I/O modules and services. It supports multiple email providers simultaneously, with one set as default and others selectable per use case. Any module that needs to send email — alert notifications, scheduled report delivery, export completion notices, overdue round reminders, password resets — routes through this service.

The Email Service is a standalone Rust/Axum service (port 3008) with its own PostgreSQL tables for provider configuration, template management, queue processing, and delivery logging.

---

## Architecture

### Provider Adapter Pattern

```
┌────────────────────────────────────────────────────────────────┐
│                     Email Service (Port 3008)                  │
│                                                                │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐ │
│  │   Template    │  │    Queue      │  │  Provider Registry  │ │
│  │   Engine      │  │  (PostgreSQL  │  │                     │ │
│  │  (MiniJinja)  │  │   SKIP LOCKED │  │  ┌───────────────┐ │ │
│  │              │  │   workers)    │  │  │ SMTP Relay    │ │ │
│  └──────────────┘  └───────────────┘  │  ├───────────────┤ │ │
│                                        │  │ SMTP+XOAUTH2 │ │ │
│  ┌──────────────┐  ┌───────────────┐  │  ├───────────────┤ │ │
│  │   Delivery   │  │   Bounce      │  │  │ MS Graph API  │ │ │
│  │   Log        │  │   Handler     │  │  ├───────────────┤ │ │
│  │              │  │              │  │  │ Gmail API     │ │ │
│  └──────────────┘  └───────────────┘  │  ├───────────────┤ │ │
│                                        │  │ Amazon SES    │ │ │
│                                        │  ├───────────────┤ │ │
│                                        │  │ Webhook       │ │ │
│                                        │  └───────────────┘ │ │
│                                        └─────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Inter-Service Communication

Any I/O service can send email by either:
1. **HTTP POST** to `POST /api/email/send` — synchronous queue insertion, returns queue ID
2. **PostgreSQL NOTIFY** on `email_send` channel — for services that prefer async fire-and-forget

The Email Service processes the queue with configurable concurrency (default: 4 workers) using `SELECT ... FOR UPDATE SKIP LOCKED`.

### Data Flow

```
Calling Service (Reports, Alerts, Rounds, etc.)
    │
    │  POST /api/email/send  { provider_id?, template_id, to, variables }
    │  OR  NOTIFY email_send '{ ... }'
    ▼
Email Service
    │
    ├── 1. Resolve template (MiniJinja render with variables)
    ├── 2. Select provider (explicit provider_id, or default)
    ├── 3. Insert into email_queue (status: 'pending')
    ├── 4. Return queue_id to caller
    │
    ▼
Queue Worker (Tokio task, polling interval: 1s)
    │
    ├── 5. Dequeue batch (SKIP LOCKED)
    ├── 6. Send via selected provider adapter
    ├── 7. Update status (sent/failed)
    ├── 8. Write to email_log
    └── 9. On failure: schedule retry with exponential backoff
```

---

## Email Providers

### Provider Trait

All providers implement a common async trait:

```rust
#[async_trait]
pub trait EmailProvider: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    fn provider_type(&self) -> ProviderType;
    async fn send(&self, email: &RenderedEmail) -> Result<ProviderResponse, EmailError>;
    async fn health_check(&self) -> Result<(), EmailError>;
}

pub struct RenderedEmail {
    pub from: EmailAddress,
    pub to: Vec<EmailAddress>,
    pub cc: Vec<EmailAddress>,
    pub bcc: Vec<EmailAddress>,
    pub reply_to: Option<EmailAddress>,
    pub subject: String,
    pub body_html: String,
    pub body_text: Option<String>,
    pub attachments: Vec<Attachment>,
    pub headers: HashMap<String, String>,
    pub priority: EmailPriority,   // Low, Normal, High
}

pub struct ProviderResponse {
    pub provider_message_id: Option<String>,
    pub accepted: bool,
}
```

### Shipped Providers

#### 1. SMTP Relay (Authenticated)

**Priority**: P0 — ships first, universal fallback.

| Setting | Description |
|---------|-------------|
| `host` | SMTP server hostname |
| `port` | 587 (STARTTLS) or 465 (implicit TLS) |
| `tls_mode` | `starttls` / `implicit_tls` / `none` (not recommended) |
| `auth_method` | `plain` / `login` / `xoauth2` / `none` |
| `username` | SMTP username (for plain/login auth) |
| `password` | SMTP password (encrypted at rest) |
| `from_address` | Default sender address |
| `from_name` | Default sender display name |

**Crate**: `lettre` (MIT) — async via `AsyncSmtpTransport` on Tokio. Supports STARTTLS, implicit TLS, AUTH PLAIN, AUTH LOGIN, AUTH XOAUTH2, connection pooling, MIME multipart, attachments, embedded images.

**XOAUTH2 sub-mode**: When `auth_method` is `xoauth2`, additional fields:

| Setting | Description |
|---------|-------------|
| `token_endpoint` | OAuth2 token URL (e.g., `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`) |
| `client_id` | OAuth2 application client ID |
| `client_secret` | OAuth2 client secret (encrypted at rest) |
| `scope` | OAuth2 scope (e.g., `https://outlook.office365.com/.default`) |
| `username` | Mailbox UPN to send as |

The service acquires tokens via the `oauth2` crate (MIT/Apache-2.0), caches them in memory, and refreshes 5 minutes before expiry. The XOAUTH2 credential string is constructed per RFC and passed to `lettre`'s AUTH mechanism.

**When to use**: On-premises Exchange servers, ISP relays, any environment where IT provides SMTP credentials. XOAUTH2 mode for Microsoft 365 SMTP when Graph API isn't preferred.

#### 2. Microsoft Graph API

**Priority**: P1 — recommended for Microsoft 365 / Exchange Online environments.

| Setting | Description |
|---------|-------------|
| `tenant_id` | Azure AD / Entra ID tenant ID |
| `client_id` | Registered application client ID |
| `client_secret` | Application client secret (encrypted at rest) |
| `send_as_user` | UPN or user-id of the mailbox to send from |
| `save_to_sent` | Whether to save sent emails to the mailbox's Sent Items (default: true) |

**Authentication**: OAuth2 client credentials flow. The application registers in Azure AD with `Mail.Send` application permission (admin-consented). Token acquired via `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`.

**Sending**: `POST https://graph.microsoft.com/v1.0/users/{send_as_user}/sendMail` with JSON body containing message, recipients, attachments.

**Rate limits**:
- 10,000 recipients per day per mailbox (24-hour rolling window)
- 30 messages per minute per mailbox
- 4 concurrent requests per app per mailbox

**Implementation**: ~200 lines of `reqwest` + `serde` + `oauth2`. No heavy SDK dependency (`graph-rs-sdk` exists but pulls in the entire Graph surface — unnecessary).

**Attachments**: Up to 4MB inline (base64 in JSON body). For larger attachments, use the upload session API (up to 150MB). The service should handle this transparently — inline for small, upload session for large.

**When to use**: Enterprise environments running Microsoft 365. Many IT departments prefer this over SMTP because it uses OAuth2 (no stored passwords), provides Azure AD audit trail, and works even when SMTP AUTH is disabled tenant-wide (which Microsoft is actively pushing).

#### 3. Gmail API (Google Workspace)

**Priority**: P2 — for organizations using Google Workspace.

| Setting | Description |
|---------|-------------|
| `service_account_key` | Google Cloud service account JSON key (encrypted at rest) |
| `send_as_user` | Email address to send as (must be in the Workspace domain) |
| `domain` | Google Workspace domain |

**Authentication**: Service account with domain-wide delegation. The service account impersonates `send_as_user` using a JWT exchanged for an access token. Requires `https://www.googleapis.com/auth/gmail.send` scope granted in Google Workspace Admin Console.

**Sending**: `POST https://gmail.googleapis.com/gmail/v1/users/{send_as_user}/messages/send` with base64url-encoded RFC 2822 message body.

**Rate limits**: 2,000 emails/day per user, 10,000 recipients/day, ~2.5 messages/second.

**Implementation**: `reqwest` + `serde` + `jsonwebtoken` (MIT) for JWT-based auth. The `mail-builder` crate (MIT/Apache-2.0) or `lettre`'s `Message` builder can construct the RFC 2822 message.

**When to use**: Organizations on Google Workspace instead of Microsoft.

#### 4. Webhook (Generic HTTP)

**Priority**: P2 — covers Power Automate, Zapier, n8n, custom integrations.

| Setting | Description |
|---------|-------------|
| `url` | Webhook endpoint URL (HTTPS) |
| `method` | HTTP method (default: POST) |
| `auth_type` | `none` / `bearer` / `basic` / `api_key_header` |
| `auth_value` | Token, credentials, or API key (encrypted at rest) |
| `header_name` | Custom auth header name (for `api_key_header`) |
| `payload_template` | Optional MiniJinja template for custom JSON payload. Default sends standardized payload. |

**Default payload**:
```json
{
  "to": ["recipient@example.com"],
  "cc": [],
  "subject": "Alert: High pressure on V-101",
  "body_html": "<p>...</p>",
  "body_text": "...",
  "priority": "high",
  "source": "inside_operations",
  "context_type": "alert",
  "context_id": "uuid"
}
```

**When to use**: Organizations that want to route email through their own automation platform. Covers Power Automate (HTTP trigger → Send Email action), Zapier webhooks, n8n webhooks, or any custom middleware. Also useful for organizations with email compliance gateways that require all outbound email to pass through a specific system.

#### 5. Amazon SES

**Priority**: P3 — for AWS-centric environments. Also reachable via SMTP provider using SES SMTP credentials.

| Setting | Description |
|---------|-------------|
| `access_key_id` | AWS IAM access key |
| `secret_access_key` | AWS IAM secret key (encrypted at rest) |
| `region` | AWS region (e.g., `us-east-1`) |
| `from_address` | Verified sender address or domain |
| `configuration_set` | Optional SES configuration set for tracking |

**Implementation**: `aws-sdk-sesv2` (Apache-2.0) for the REST API path, or simply configure an SMTP provider pointed at `email-smtp.{region}.amazonaws.com` with SES SMTP credentials — the SMTP provider already handles this without any SES-specific code.

**Pricing**: $0.10 per 1,000 emails. Extremely cheap at scale.

**When to use**: Organizations already on AWS. The SMTP path via `lettre` is simpler and doesn't require the `aws-sdk-sesv2` dependency, so the dedicated SES provider is only needed if the customer wants SES-specific features (configuration sets, event publishing, suppression lists).

#### 6. SMTP Direct (No Auth)

**Priority**: P3 — advanced/legacy option.

Same settings as SMTP Relay but with `auth_method: none` and typically `tls_mode: none` or `starttls`. The service connects to the plant's internal mail server on port 25 without authentication.

**Warning displayed in UI**: "Direct SMTP without authentication relies on the mail server accepting relay from this server's IP address. Messages sent this way may be rejected by external recipients. Recommended only for internal-only email delivery."

**When to use**: Internal-only email on plant LANs where the Exchange server is configured to accept unauthenticated relay from trusted IPs. Some air-gapped plant networks have no other option.

### Provider Configuration Model

Multiple providers can be configured simultaneously. Each has:
- **Unique ID** — user-assigned name (e.g., "plant-exchange", "office365-graph", "ses-backup")
- **Provider type** — one of: `smtp`, `msgraph`, `gmail`, `webhook`, `ses`
- **Enabled/disabled** — providers can be disabled without deleting their configuration
- **Default flag** — exactly one provider is marked as default
- **Fallback flag** — optional secondary provider if default fails
- **Last tested** — timestamp and result of the last health check or test email

Any feature that sends email can optionally specify a `provider_id`. If omitted, the default provider is used. This allows routing — e.g., alert emails through Graph API (for reliability) while report exports go through SMTP (for attachment size limits).

---

## Email Templates

### Template Engine

**MiniJinja** (Apache-2.0) — Jinja2-compatible template syntax. Chosen for:
- Created by Armin Ronacher (author of the original Jinja2/Flask)
- Minimal dependency footprint (~100KB compiled vs ~500KB for Tera)
- Full Jinja2 syntax: variables, conditionals, loops, filters, template inheritance
- Built-in HTML auto-escaping
- Excellent error messages for template debugging

### Template Structure

Each template consists of:
- **Name** — unique identifier (e.g., `alert_notification`, `report_delivery`, `round_overdue`)
- **Subject template** — MiniJinja template for the subject line
- **HTML body template** — MiniJinja template for the HTML body
- **Text body template** — Optional plain-text fallback (auto-generated from HTML if omitted)
- **Category** — `system` (built-in, not deletable) or `custom` (user-created)
- **Variables schema** — JSON schema describing expected template variables (for UI validation)

### Built-In Templates

The following templates ship with I/O and are used by their respective modules:

| Template | Used By | Variables |
|----------|---------|-----------|
| `alert_notification` | Alert Service | `severity`, `title`, `message`, `triggered_at`, `acknowledge_url` |
| `alert_escalation` | Alert Service | `severity`, `title`, `message`, `escalation_level`, `original_triggered_at` |
| `report_ready` | Reports Module | `report_name`, `report_type`, `generated_at`, `download_url`, `attachment?` |
| `export_complete` | Export System | `export_name`, `format`, `size`, `download_url` |
| `round_assigned` | Rounds Module | `round_name`, `area`, `due_date`, `assignee_name` |
| `round_overdue` | Rounds Module | `round_name`, `area`, `due_date`, `overdue_by`, `assignee_name` |
| `password_reset` | Auth Service | `user_name`, `reset_url`, `expires_in` |
| `user_welcome` | Auth Service | `user_name`, `login_url`, `temporary_password?` |
| `test_email` | Settings UI | `provider_name`, `sent_at` |

All built-in templates use a shared base layout template (`_base.html`) that includes the I/O logo, consistent header/footer, and responsive styling. Custom templates can extend this base or define their own layout.

### Template Preview

The Settings UI provides a template preview feature: enter sample variable values, click Preview, and see the rendered HTML in a side panel. This uses the same MiniJinja engine server-side with a `POST /api/email/templates/:id/preview` endpoint.

---

## Queue and Delivery

### Queue Processing

The email queue uses PostgreSQL as the backing store — no additional message broker dependency.

**Queue worker loop** (Tokio task, runs within the Email Service):

1. Poll `email_queue` every 1 second for pending messages
2. Dequeue a batch of up to 10 messages using `SELECT ... FOR UPDATE SKIP LOCKED`
3. For each message: resolve provider, send via adapter, update status
4. On success: set `status = 'sent'`, record `sent_at` and `provider_message_id`
5. On failure: increment `attempts`, set `next_attempt` with exponential backoff, record error

**Retry schedule** (exponential backoff):
- Attempt 1: immediate
- Attempt 2: +1 minute
- Attempt 3: +5 minutes
- Attempt 4: +30 minutes
- After max attempts (default: 4): mark as `dead`, log error

**Concurrency**: Configurable worker count (default: 4). Each worker independently dequeues and processes. `SKIP LOCKED` prevents contention.

**Priority**: The queue supports priority levels (`critical`, `high`, `normal`, `low`). Alert-related emails are queued as `critical` and dequeued before normal-priority messages. Queue workers process highest-priority items first:

```sql
SELECT * FROM email_queue
WHERE status IN ('pending', 'retry')
  AND next_attempt <= NOW()
  AND attempts < max_attempts
ORDER BY priority ASC, next_attempt ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

### Delivery Tracking

Every send attempt is logged in `email_delivery_log`:
- Provider used
- HTTP status / SMTP response code
- Provider message ID (for cross-referencing with provider dashboards)
- Timestamp
- Error details on failure

### Bounce Handling

**Hard bounce detection**: When email delivery permanently fails (5xx SMTP response, Microsoft Graph permanent error, SES permanent bounce), the recipient address is automatically added to a suppression list.

**Suppression table**:
```sql
CREATE TABLE email_suppressions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_address       VARCHAR(254) NOT NULL UNIQUE,
    reason              TEXT NOT NULL,
    suppressed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_delivery_id UUID REFERENCES email_delivery_log(id)
);

CREATE INDEX idx_email_suppressions_address ON email_suppressions (email_address);
```

**Behavior**: Before sending any email, the queue worker checks the suppression list. If the recipient address is suppressed, delivery is skipped and logged as `suppressed` in the delivery log. Suppressed deliveries do not count against retry attempts.

**Soft bounces**: Handled by the existing retry logic with exponential backoff. After max retries are exhausted on a soft bounce (4xx SMTP response, temporary Graph API error), the message is marked `dead` but the address is NOT added to the suppression list — transient failures should not permanently block delivery.

**Admin UI**: Settings > Email > Suppression List tab:
- Paginated table of suppressed addresses with reason and suppression date
- "Remove" action to re-enable delivery to an address (e.g., after the recipient fixes their mailbox)
- Suppression reason shows the original error (e.g., "550 5.1.1 User unknown", "MailboxNotFound")

### Queue Cleanup

Completed queue entries are retained for 30 days (configurable), then archived or purged by a scheduled cleanup task. The `email_delivery_log` is retained per the system's data retention policy.

---

## Database Schema

### Tables

```sql
-- Email provider configurations
CREATE TABLE email_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    provider_type   VARCHAR(20) NOT NULL,  -- 'smtp', 'msgraph', 'gmail', 'webhook', 'ses'
    config          JSONB NOT NULL,         -- provider-specific config (secrets encrypted at application layer)
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_fallback     BOOLEAN NOT NULL DEFAULT false,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    from_address    VARCHAR(254) NOT NULL,
    from_name       VARCHAR(200),
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

-- Ensure exactly one default
CREATE UNIQUE INDEX idx_email_providers_default ON email_providers (is_default) WHERE is_default = true;

-- Email templates
CREATE TABLE email_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100) NOT NULL UNIQUE,
    category          VARCHAR(20) NOT NULL DEFAULT 'custom',  -- 'system', 'custom'
    subject_template  TEXT NOT NULL,
    body_html         TEXT NOT NULL,
    body_text         TEXT,
    variables_schema  JSONB,          -- expected variables and types for UI validation
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES users(id),
    updated_by        UUID REFERENCES users(id)
);

-- Email queue (outbound)
CREATE TABLE email_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID REFERENCES email_providers(id),  -- NULL = use default
    template_id     UUID REFERENCES email_templates(id),  -- NULL = raw send (pre-rendered)
    to_addresses    TEXT[] NOT NULL,
    cc_addresses    TEXT[] DEFAULT '{}',
    bcc_addresses   TEXT[] DEFAULT '{}',
    reply_to        VARCHAR(254),
    subject         TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    body_text       TEXT,
    attachments     JSONB,            -- [{name, content_type, data_base64, size_bytes}]
    priority        SMALLINT NOT NULL DEFAULT 2,  -- 0=critical, 1=high, 2=normal, 3=low
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, sending, sent, retry, failed, dead
    attempts        SMALLINT NOT NULL DEFAULT 0,
    max_attempts    SMALLINT NOT NULL DEFAULT 4,
    next_attempt    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT,
    context_type    VARCHAR(50),      -- 'alert', 'report', 'export', 'round', 'auth', 'test'
    context_id      UUID,             -- FK to originating record
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id)
);

CREATE INDEX idx_email_queue_pending ON email_queue (priority, next_attempt)
    WHERE status IN ('pending', 'retry');

CREATE INDEX idx_email_queue_context ON email_queue (context_type, context_id);

-- Email delivery log
CREATE TABLE email_delivery_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id            UUID NOT NULL REFERENCES email_queue(id),
    provider_id         UUID NOT NULL REFERENCES email_providers(id),
    attempt_number      SMALLINT NOT NULL,
    status              VARCHAR(20) NOT NULL,  -- 'accepted', 'rejected', 'error', 'timeout'
    provider_message_id VARCHAR(200),
    provider_response   TEXT,
    error_details       TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_delivery_log_queue ON email_delivery_log (queue_id);
```

### JSONB Config Schemas by Provider Type

**SMTP**:
```json
{
  "host": "mail.plant.com",
  "port": 587,
  "tls_mode": "starttls",
  "auth_method": "plain",
  "username": "io-alerts@plant.com",
  "password": "<encrypted>",
  "connection_pool_size": 4
}
```

**SMTP + XOAUTH2**:
```json
{
  "host": "smtp.office365.com",
  "port": 587,
  "tls_mode": "starttls",
  "auth_method": "xoauth2",
  "token_endpoint": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
  "client_id": "app-guid",
  "client_secret": "<encrypted>",
  "scope": "https://outlook.office365.com/.default",
  "username": "io-alerts@company.com"
}
```

**Microsoft Graph API**:
```json
{
  "tenant_id": "tenant-guid",
  "client_id": "app-guid",
  "client_secret": "<encrypted>",
  "send_as_user": "io-alerts@company.com",
  "save_to_sent": true
}
```

**Gmail API**:
```json
{
  "service_account_key": "<encrypted-json>",
  "send_as_user": "io-alerts@company.com",
  "domain": "company.com"
}
```

**Webhook**:
```json
{
  "url": "https://prod-01.westus.logic.azure.com/workflows/...",
  "method": "POST",
  "auth_type": "bearer",
  "auth_value": "<encrypted>",
  "payload_template": null
}
```

**Amazon SES**:
```json
{
  "access_key_id": "AKIA...",
  "secret_access_key": "<encrypted>",
  "region": "us-east-1",
  "configuration_set": "io-tracking"
}
```

---

## Security

### Credential Storage

All provider secrets (passwords, client secrets, API keys, service account keys) are encrypted at rest using AES-256-GCM. The encryption key is derived from the system's master key (delivered via systemd `LoadCredentialEncrypted`, see doc 03). Secrets are decrypted in memory only when needed for provider initialization.

The `config` JSONB column in `email_providers` stores encrypted values for sensitive fields. The application layer handles encryption/decryption — the database never sees plaintext secrets.

### OAuth2 Token Management

For providers using OAuth2 (SMTP XOAUTH2, Microsoft Graph, Gmail):
- Tokens are cached in memory with TTL tracking
- Automatic refresh 5 minutes before expiry
- Refresh failures trigger alert (via Alert Service) and retry
- Token cache is per-provider-instance (multiple providers can use different tenants/credentials)
- Token acquisition uses the `oauth2` crate (MIT/Apache-2.0) for standards-compliant flows

### TLS

- **SMTP**: STARTTLS or implicit TLS required by default. Plaintext SMTP can be enabled per-provider with a UI warning ("Insecure: email will be transmitted unencrypted"). Custom CA certificates supported for environments with internal PKI or TLS-inspecting firewalls.
- **REST APIs**: HTTPS only, no override. Standard system CA bundle, with optional custom CA certificate path for corporate proxies.

### Audit Logging

All configuration changes are logged to the system audit trail:
- Provider created/updated/deleted/enabled/disabled
- Default provider changed
- Template created/updated/deleted
- Test email sent (who, to where, result)
- Credential rotation

Email send operations are tracked in `email_delivery_log`, not the audit trail (too high volume).

---

## Settings UI

### Email Providers Section

Located in **Settings > Email**.

**Provider list view**:
- Table of configured providers: name, type, from address, default badge, enabled toggle, last test result, actions
- "Add Provider" button opens a wizard

**Provider wizard / edit form**:
1. Select provider type (SMTP, Microsoft Graph, Gmail, Webhook, Amazon SES)
2. Form fields adapt to selected type (see config schemas above)
3. "Test Connection" button sends a test email to the current user's address
4. Test result displayed inline (success with delivery time, or error message)
5. Save / Cancel

**Default provider management**:
- Radio button or "Set as Default" action on any enabled provider
- Exactly one default at all times — setting a new default clears the old one
- Optional: set a fallback provider (used if default fails)

### Email Templates Section

Located in **Settings > Email > Templates**.

**Template list view**:
- Table: name, category (system/custom), last updated, actions
- System templates show "View/Edit" (can customize content but not delete)
- Custom templates show "Edit" and "Delete"
- "New Template" button

**Template editor**:
- Name, subject template, HTML body editor (code editor with syntax highlighting)
- Optional plain-text body
- Variable reference panel: shows expected variables with descriptions
- "Preview" button: enter sample values, renders preview in side panel
- "Send Test" button: renders and sends a real email to the current user

### Email Logs Section

Located in **Settings > Email > Logs**.

- Paginated, filterable table of sent emails
- Columns: timestamp, to, subject, provider, status, context type
- Filters: date range, status (sent/failed/dead), provider, context type
- Click to expand: full delivery log with attempt history, error details
- Queue status summary: pending count, retry count, dead count

---

## API Endpoints

All endpoints are prefixed with `/api/email` and routed through the API Gateway.

### Provider Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/email/providers` | `email:configure` | List all configured providers |
| `GET` | `/api/email/providers/:id` | `email:configure` | Get provider details (secrets masked) |
| `POST` | `/api/email/providers` | `email:configure` | Create a new provider |
| `PUT` | `/api/email/providers/:id` | `email:configure` | Update provider configuration |
| `DELETE` | `/api/email/providers/:id` | `email:configure` | Delete provider (cannot delete default) |
| `PUT` | `/api/email/providers/:id/default` | `email:configure` | Set as default provider |
| `PUT` | `/api/email/providers/:id/fallback` | `email:configure` | Set as fallback provider |
| `POST` | `/api/email/providers/:id/test` | `email:send_test` | Send test email via this provider |
| `PUT` | `/api/email/providers/:id/enabled` | `email:configure` | Enable/disable provider |

### Template Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/email/templates` | `email:manage_templates` | List all templates |
| `GET` | `/api/email/templates/:id` | `email:manage_templates` | Get template details |
| `POST` | `/api/email/templates` | `email:manage_templates` | Create custom template |
| `PUT` | `/api/email/templates/:id` | `email:manage_templates` | Update template |
| `DELETE` | `/api/email/templates/:id` | `email:manage_templates` | Delete custom template (system templates cannot be deleted) |
| `POST` | `/api/email/templates/:id/preview` | `email:manage_templates` | Preview rendered template with sample variables |

### Email Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/email/send` | Service-internal or `email:send_test` | Queue an email for delivery |
| `GET` | `/api/email/queue` | `email:view_logs` | View queue status (pending/retry/dead counts and items) |
| `POST` | `/api/email/queue/:id/retry` | `email:configure` | Retry a dead message |
| `DELETE` | `/api/email/queue/:id` | `email:configure` | Cancel a pending/retry message |

### Email Logs

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/email/logs` | `email:view_logs` | Paginated delivery log (filterable) |
| `GET` | `/api/email/logs/:id` | `email:view_logs` | Delivery details for a specific email |
| `GET` | `/api/email/stats` | `email:view_logs` | Delivery statistics (sent/failed/dead counts by provider, date range) |

### Send Request Schema

```json
{
  "provider_id": "uuid (optional — uses default if omitted)",
  "template_id": "uuid (optional — if omitted, subject/body_html required)",
  "template_variables": { "key": "value" },
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "reply_to": "noreply@plant.com",
  "subject": "Override subject (used if no template_id)",
  "body_html": "Override HTML body (used if no template_id)",
  "body_text": "Optional plain text",
  "attachments": [
    { "name": "report.pdf", "content_type": "application/pdf", "data_base64": "..." }
  ],
  "priority": "normal",
  "context_type": "report",
  "context_id": "uuid"
}
```

---

## RBAC Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `email:configure` | Configure email providers, set default, enable/disable | Admin |
| `email:manage_templates` | Create, edit, delete email templates | Admin |
| `email:send_test` | Send test emails to verify provider configuration | Admin |
| `email:view_logs` | View email delivery logs and queue status | Admin, Supervisor |

Total: **4 new permissions**.

---

## Technology Stack

### New Crates

| Crate | License | Purpose |
|-------|---------|---------|
| `lettre` | MIT | SMTP transport (relay, STARTTLS, XOAUTH2, connection pool) |
| `oauth2` | MIT/Apache-2.0 | OAuth2 client credentials flow, token management |
| `minijinja` | Apache-2.0 | Email template rendering (Jinja2-compatible) |
| `jsonwebtoken` | MIT | JWT for Google service account authentication |

### Existing Crates (already in I/O stack)

| Crate | Purpose |
|-------|---------|
| `reqwest` | HTTP client for REST API providers (Graph, Gmail, SES, Webhook) |
| `serde` / `serde_json` | JSON serialization for API payloads and config |
| `sqlx` | PostgreSQL async queries |
| `tokio` | Async runtime, queue worker tasks, token refresh timers |
| `tracing` | Structured logging |

### Optional Crate

| Crate | License | Purpose |
|-------|---------|---------|
| `aws-sdk-sesv2` | Apache-2.0 | Amazon SES REST API (only if SES provider is compiled in; SES also works via SMTP without this) |

---

## Deployment

### Service Configuration

```env
# Email Service
EMAIL_SERVICE_PORT=3008
EMAIL_QUEUE_WORKERS=4
EMAIL_QUEUE_POLL_INTERVAL_MS=1000
EMAIL_QUEUE_RETRY_MAX=4
EMAIL_QUEUE_RETENTION_DAYS=30
# Master key delivered via systemd LoadCredentialEncrypted (see doc 03)
```

### Health Check

`GET /api/email/health` returns:
```json
{
  "status": "healthy",
  "queue": { "pending": 0, "retry": 1, "dead": 0 },
  "providers": [
    { "id": "plant-exchange", "type": "smtp", "enabled": true, "default": true, "last_test_ok": true },
    { "id": "graph-backup", "type": "msgraph", "enabled": true, "default": false, "last_test_ok": true }
  ]
}
```

### systemd Service

```ini
[Unit]
Description=Inside/Operations Email Service
After=postgresql.service io-api-gateway.service
Wants=postgresql.service

[Service]
Type=simple
ExecStart=/opt/io/bin/email-service
EnvironmentFile=/opt/io/.env
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

---

## Change Log

- **v0.3** — Replaced stale `EMAIL_MASTER_KEY_ENV=IO_MASTER_KEY` env var with systemd `LoadCredentialEncrypted` reference per doc 03 v2.1. Updated credential storage description. Fixed non-canonical role name "Power User" → "Supervisor" in `email:view_logs` permission.
- **v0.2** — Promoted bounce handling from future to concrete design. Added hard bounce detection with `email_suppressions` table, suppression check before send, admin UI for suppression list management. Soft bounces remain handled by existing retry logic without suppression.
- **v0.1** — Initial document. System-wide email service with 6 provider adapters (SMTP, SMTP+XOAUTH2, Microsoft Graph, Gmail, Webhook, Amazon SES), MiniJinja templates, PostgreSQL queue, multi-provider support with default/fallback, RBAC, full API specification, Settings UI.
