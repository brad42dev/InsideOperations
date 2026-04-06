import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { SettingsTabs } from "../../shared/components/SettingsTabs";
import SettingsPageLayout from "./SettingsPageLayout";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnDanger,
  cellStyle,
} from "./settingsStyles";
import {
  emailApi,
  EmailProvider,
  EmailTemplate,
  EmailQueueItem,
  CreateProviderRequest,
  CreateTemplateRequest,
} from "../../api/email";

// ---------------------------------------------------------------------------
// Test email dialog
// ---------------------------------------------------------------------------

function TestEmailDialog({
  providerId,
  providerName,
  onClose,
}: {
  providerId: string;
  providerName: string;
  onClose: () => void;
}) {
  const [toAddress, setToAddress] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const testMutation = useMutation({
    mutationFn: (addr: string) => emailApi.testProvider(providerId, addr),
    onSuccess: (res) => {
      if (res.success && res.data.ok) {
        setResult({ ok: true, message: "Test email sent successfully." });
      } else {
        setResult({
          ok: false,
          message: res.success ? "Provider reported a failure." : res.error.message,
        });
      }
    },
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-modal-backdrop)",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            padding: "24px",
            width: "400px",
            zIndex: 201,
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 6px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Send Test Email
          </Dialog.Title>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Sends a test message through{" "}
            <strong style={{ color: "var(--io-text-primary)" }}>
              {providerName}
            </strong>{" "}
            to verify connectivity and credentials.
          </p>

          <div>
            <label style={labelStyle}>Recipient address</label>
            <input
              style={inputStyle}
              type="email"
              value={toAddress}
              onChange={(e) => {
                setToAddress(e.target.value);
                setResult(null);
              }}
              placeholder="you@example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter" && toAddress.trim())
                  testMutation.mutate(toAddress.trim());
              }}
              autoFocus
            />
          </div>

          {result && (
            <div
              style={{
                marginTop: "14px",
                padding: "10px 12px",
                borderRadius: "var(--io-radius)",
                background: result.ok
                  ? "color-mix(in srgb, var(--io-success) 12%, transparent)"
                  : "color-mix(in srgb, var(--io-danger) 12%, transparent)",
                border: `1px solid ${result.ok ? "var(--io-success)" : "var(--io-danger)"}`,
                color: result.ok ? "var(--io-success)" : "var(--io-danger)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {result.ok ? "✓ " : "✗ "}
              {result.message}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <button style={btnSecondary} onClick={onClose}>
              Close
            </button>
            <button
              style={btnPrimary}
              onClick={() => testMutation.mutate(toAddress.trim())}
              disabled={testMutation.isPending || !toAddress.trim()}
            >
              {testMutation.isPending ? "Sending…" : "Send Test Email"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--io-warning)",
  retry: "var(--io-warning)",
  sent: "var(--io-success)",
  failed: "var(--io-danger)",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12px",
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Providers tab
// ---------------------------------------------------------------------------

function ProvidersTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editProvider, setEditProvider] = useState<EmailProvider | null>(null);
  const [testTarget, setTestTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["email-providers"],
    queryFn: async () => {
      const res = await emailApi.listProviders();
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailApi.deleteProvider(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-providers"] }),
  });

  const providers = data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Email Providers
        </h3>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>
          Add Provider
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading…
        </p>
      ) : providers.length === 0 ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          No providers configured.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
              {[
                "Name",
                "Type",
                "From",
                "Default",
                "Status",
                "Last Test",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cellStyle,
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr
                key={p.id}
                style={{ borderBottom: "1px solid var(--io-border)" }}
              >
                <td
                  style={{
                    ...cellStyle,
                    fontWeight: 500,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {p.name}
                </td>
                <td style={cellStyle}>{p.provider_type}</td>
                <td style={cellStyle}>
                  {p.from_name
                    ? `${p.from_name} <${p.from_address}>`
                    : p.from_address}
                </td>
                <td style={cellStyle}>{p.is_default ? "✓" : "—"}</td>
                <td style={cellStyle}>
                  <StatusBadge status={p.enabled ? "active" : "disabled"} />
                </td>
                <td style={cellStyle}>
                  {p.last_tested_at ? (
                    p.last_test_ok ? (
                      <span style={{ color: "var(--io-success)" }}>OK</span>
                    ) : (
                      <span style={{ color: "var(--io-danger)" }}>Failed</span>
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ ...cellStyle, display: "flex", gap: "8px" }}>
                  <button
                    style={btnSecondary}
                    onClick={() => setTestTarget({ id: p.id, name: p.name })}
                  >
                    Test
                  </button>
                  <button
                    style={btnSecondary}
                    onClick={() => setEditProvider(p)}
                  >
                    Edit
                  </button>
                  <button
                    style={btnDanger}
                    onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(showAdd || editProvider) && (
        <ProviderDialog
          provider={editProvider}
          onClose={() => {
            setShowAdd(false);
            setEditProvider(null);
          }}
        />
      )}

      {testTarget && (
        <TestEmailDialog
          providerId={testTarget.id}
          providerName={testTarget.name}
          onClose={() => {
            setTestTarget(null);
            qc.invalidateQueries({ queryKey: ["email-providers"] });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        title="Delete Provider"
        description={
          deleteConfirm ? `Delete provider "${deleteConfirm.name}"?` : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider config field definitions
// ---------------------------------------------------------------------------

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "select" | "textarea" | "checkbox";
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
  optional?: boolean;
  hint?: string;
  showWhen?: (f: Record<string, string>) => boolean;
  /** Column span out of 12. Defaults to 12 (full row). */
  gridSpan?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
}

interface SetupGuide {
  title: string;
  steps: string[];
}

const SECRET_KEYS = new Set([
  "password",
  "client_secret",
  "secret_access_key",
  "service_account_key",
  "auth_value",
]);

const PROVIDER_FIELDS: Record<string, ConfigField[]> = {
  smtp: [
    { key: "host", label: "SMTP Host", type: "text", placeholder: "smtp.example.com", gridSpan: 9 },
    { key: "port", label: "Port", type: "number", defaultValue: "587", placeholder: "587", gridSpan: 3 },
    {
      key: "tls_mode",
      label: "TLS Mode",
      type: "select",
      defaultValue: "starttls",
      gridSpan: 6,
      options: [
        { value: "starttls", label: "STARTTLS (port 587)" },
        { value: "implicit_tls", label: "Implicit TLS / SSL (port 465)" },
        { value: "none", label: "None — plaintext (not recommended)" },
      ],
    },
    {
      key: "auth_method",
      label: "Auth Method",
      type: "select",
      defaultValue: "plain",
      gridSpan: 6,
      options: [
        { value: "plain", label: "PLAIN" },
        { value: "login", label: "LOGIN" },
        { value: "none", label: "None (unauthenticated relay)" },
      ],
    },
    {
      key: "username",
      label: "Username",
      type: "text",
      placeholder: "user@example.com",
      gridSpan: 7,
      showWhen: (f) => f.auth_method !== "none",
    },
    {
      key: "password",
      label: "Password",
      type: "password",
      gridSpan: 5,
      showWhen: (f) => f.auth_method !== "none",
    },
    {
      key: "connection_pool_size",
      label: "Connection Pool Size",
      type: "number",
      placeholder: "5",
      optional: true,
      gridSpan: 4,
      hint: "Leave blank to use the default.",
    },
  ],
  smtp_xoauth2: [
    {
      key: "host",
      label: "SMTP Host",
      type: "text",
      defaultValue: "smtp.office365.com",
      placeholder: "smtp.office365.com",
      gridSpan: 9,
    },
    { key: "port", label: "Port", type: "number", defaultValue: "587", placeholder: "587", gridSpan: 3 },
    {
      key: "tls_mode",
      label: "TLS Mode",
      type: "select",
      defaultValue: "starttls",
      gridSpan: 4,
      options: [
        { value: "starttls", label: "STARTTLS" },
        { value: "implicit_tls", label: "Implicit TLS" },
      ],
    },
    { key: "username", label: "Username (sender email)", type: "text", placeholder: "sender@yourdomain.com", gridSpan: 8 },
    {
      key: "token_endpoint",
      label: "Token Endpoint",
      type: "text",
      placeholder: "https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token",
    },
    { key: "client_id", label: "Client ID (Application ID)", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", gridSpan: 7 },
    { key: "client_secret", label: "Client Secret", type: "password", gridSpan: 5 },
    {
      key: "scope",
      label: "Scope",
      type: "text",
      defaultValue: "https://outlook.office365.com/.default",
      placeholder: "https://outlook.office365.com/.default",
    },
  ],
  ms_graph: [
    { key: "tenant_id", label: "Tenant ID (Directory ID)", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", gridSpan: 6 },
    { key: "client_id", label: "Client ID (Application ID)", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", gridSpan: 6 },
    { key: "client_secret", label: "Client Secret", type: "password", gridSpan: 5 },
    { key: "send_as_user", label: "Send-As User (UPN)", type: "text", placeholder: "noreply@yourdomain.com", gridSpan: 7 },
    { key: "save_to_sent", label: "Save to Sent Items", type: "checkbox", defaultValue: "true", gridSpan: 4 },
  ],
  gmail: [
    {
      key: "service_account_key",
      label: "Service Account Key (JSON)",
      type: "textarea",
      placeholder: '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
      hint: "Paste the entire contents of the downloaded JSON key file.",
    },
    { key: "send_as_user", label: "Send-As User", type: "text", placeholder: "noreply@yourdomain.com", gridSpan: 7 },
    { key: "domain", label: "Google Workspace Domain", type: "text", placeholder: "yourdomain.com", gridSpan: 5 },
  ],
  ses: [
    { key: "access_key_id", label: "Access Key ID", type: "text", placeholder: "AKIAIOSFODNN7EXAMPLE", gridSpan: 7 },
    { key: "secret_access_key", label: "Secret Access Key", type: "password", gridSpan: 5 },
    { key: "region", label: "AWS Region", type: "text", placeholder: "us-east-1", gridSpan: 4 },
    {
      key: "configuration_set",
      label: "Configuration Set",
      type: "text",
      placeholder: "my-config-set",
      optional: true,
      gridSpan: 8,
      hint: "Optional. Use to track sending events (bounces, opens).",
    },
  ],
  webhook: [
    { key: "url", label: "Webhook URL", type: "text", placeholder: "https://hooks.example.com/..." },
    {
      key: "method",
      label: "HTTP Method",
      type: "select",
      defaultValue: "POST",
      gridSpan: 4,
      options: [
        { value: "POST", label: "POST" },
        { value: "GET", label: "GET" },
        { value: "PUT", label: "PUT" },
      ],
    },
    {
      key: "auth_type",
      label: "Authentication",
      type: "select",
      defaultValue: "none",
      gridSpan: 8,
      options: [
        { value: "none", label: "None" },
        { value: "bearer", label: "Bearer Token" },
        { value: "basic", label: "Basic Auth (user:password)" },
        { value: "api_key_header", label: "API Key Header" },
      ],
    },
    {
      key: "header_name",
      label: "Header Name",
      type: "text",
      placeholder: "X-API-Key",
      gridSpan: 5,
      showWhen: (f) => f.auth_type === "api_key_header",
    },
    {
      key: "auth_value",
      label: "Auth Value",
      type: "password",
      gridSpan: 7,
      showWhen: (f) => f.auth_type !== "none",
      hint: "Bearer: token value. Basic: user:password. API Key: key value.",
    },
    {
      key: "payload_template",
      label: "Payload Template (MiniJinja)",
      type: "textarea",
      optional: true,
      placeholder: '{"text": "{{ subject }}"}',
      hint: "Optional. Override the default payload. Variables: subject, body_text, context_type, context_id.",
    },
  ],
};

type SmtpHelpKey = "microsoft365" | "gmail_app_password" | "sendgrid" | "mailgun" | "postmark" | "other";
type WebhookHelpKey = "slack" | "teams" | "pagerduty" | "other";

const SMTP_GUIDES: Record<SmtpHelpKey, SetupGuide> = {
  microsoft365: {
    title: "Microsoft 365 — SMTP AUTH",
    steps: [
      "Sign in to `admin.microsoft.com` (Microsoft 365 Admin Center).",
      "Go to Settings → Org settings → Services → Modern authentication. Confirm that SMTP AUTH is not globally disabled — if it is, enable it there.",
      "Enable SMTP AUTH for the sending mailbox: open Exchange Admin Center at `admin.exchange.microsoft.com` → Recipients → Mailboxes → select the mailbox → Manage email apps → toggle on Authenticated SMTP. Save.",
      "In I/O set: Host `smtp.office365.com` · Port `587` · TLS Mode `STARTTLS`.",
      "Username: the full mailbox address (e.g. `noreply@contoso.com`). Password: the account password.",
      "If MFA is enabled on the account: go to `myaccount.microsoft.com` → Security info → App passwords → Add sign-in method → App password. Generate one and use it as the password here instead.",
    ],
  },
  gmail_app_password: {
    title: "Gmail — App Password",
    steps: [
      "Enable 2-Step Verification on the sending account: go to `myaccount.google.com` → Security → How you sign in to Google → 2-Step Verification → Get started.",
      "Create an App Password: `myaccount.google.com` → Security → How you sign in to Google → App passwords (visible only after 2-Step Verification is on).",
      "In the App passwords dialog, choose app: Mail and device: Other (custom name). Click Generate. Copy the 16-character password — it won't be shown again.",
      "In I/O set: Host `smtp.gmail.com` · Port `587` · TLS Mode `STARTTLS`.",
      "Username: the full Gmail address (e.g. `sender@gmail.com`). Password: the 16-character app password (enter without spaces).",
      "Note: the legacy 'Less secure apps' setting is deprecated and no longer works. Only App Passwords or XOAUTH2 are supported.",
    ],
  },
  sendgrid: {
    title: "SendGrid — SMTP Relay",
    steps: [
      "Log in to `app.sendgrid.com` and navigate to Settings → API Keys → Create API Key.",
      "Choose Restricted Access. Under Mail Send, set Full Access. Click Create & View and copy the key immediately — it is only shown once.",
      "Authenticate your sender domain: go to Settings → Sender Authentication → Authenticate Your Domain. Follow the instructions to add CNAME records in your DNS provider. Delivery rates improve significantly after verification.",
      "In I/O set: Host `smtp.sendgrid.net` · Port `587` · TLS Mode `STARTTLS`.",
      "Username: `apikey` (the literal string, not your SendGrid username). Password: the API key value you copied.",
    ],
  },
  mailgun: {
    title: "Mailgun — SMTP",
    steps: [
      "Log in to `app.mailgun.com` and go to Sending → Domains → select or add your sending domain.",
      "On the domain page, click SMTP credentials to view or create credentials for this domain.",
      "Verify your domain DNS: Mailgun lists required TXT, MX, and CNAME records. Add them via your domain registrar. Verification can take a few hours.",
      "In I/O set: Host `smtp.mailgun.org` · Port `587` · TLS `STARTTLS`. For EU region use host `smtp.eu.mailgun.org`.",
      "Username: your SMTP login from Mailgun (e.g. `postmaster@mg.yourdomain.com`). Password: the password shown in Mailgun's SMTP credentials panel.",
    ],
  },
  postmark: {
    title: "Postmark — SMTP",
    steps: [
      "Log in to `account.postmarkapp.com`. Go to Servers → select or create a server → open the API Tokens tab.",
      "Copy the Server API Token shown on that page.",
      "Verify a sender signature or domain: go to Sender Signatures → Add Domain or Signature, enter your from-address domain, and follow the DNS verification steps.",
      "In I/O set: Host `smtp.postmarkapp.com` · Port `587` · TLS `STARTTLS`.",
      "Both Username and Password fields are set to your Server API Token — the exact same value in both fields.",
    ],
  },
  other: {
    title: "Generic SMTP",
    steps: [
      "Obtain your SMTP hostname, port, and credentials from your email provider's documentation or hosting control panel.",
      "Port `587` with STARTTLS is the most common setup for authenticated submission. Port `465` uses Implicit TLS (SSL) — choose based on your provider's instructions.",
      "For internal relay servers (e.g. a local SMTP relay that trusts your server's IP) you can set Auth Method to None. Only do this on trusted internal networks.",
      "If your provider requires OAuth2 authentication (common with Microsoft 365 and Google Workspace enterprise accounts), use the SMTP + XOAUTH2 provider type instead of plain SMTP.",
    ],
  },
};

const WEBHOOK_GUIDES: Record<WebhookHelpKey, SetupGuide> = {
  slack: {
    title: "Slack — Incoming Webhook",
    steps: [
      "Go to `api.slack.com/apps` and click Create New App → From scratch. Give it a name and select your workspace.",
      "In the app's left sidebar, click Incoming Webhooks. Toggle Activate Incoming Webhooks to On.",
      "Click Add New Webhook to Workspace, choose the channel to post alerts to, and click Allow. Copy the webhook URL shown.",
      "In I/O, paste the webhook URL in the Webhook URL field. Set Auth Type to `None` — Slack embeds auth in the URL itself.",
      "Optional — customize the payload: Slack expects a JSON body with a `text` field, e.g. `{\"text\": \"{{ subject }}\\n{{ body_text }}\"}`. Enter this in the Payload Template field.",
    ],
  },
  teams: {
    title: "Microsoft Teams — Incoming Webhook",
    steps: [
      "In Microsoft Teams, navigate to the channel you want to receive alerts in.",
      "Click the ⋯ (More options) button next to the channel name → Connectors (or Workflows, depending on your Teams version).",
      "Find Incoming Webhook in the connectors list and click Configure. Give it a name, optionally upload an image, and click Create.",
      "Copy the webhook URL shown. Click Done to close the dialog.",
      "In I/O, paste the URL in the Webhook URL field. Set Auth Type to `None` — Teams uses URL-embedded authentication.",
      "Note: Microsoft is deprecating classic Office 365 Connectors. If Connectors are unavailable, use the Teams Workflows app to create an incoming webhook instead.",
    ],
  },
  pagerduty: {
    title: "PagerDuty — Events API v2",
    steps: [
      "Log in to PagerDuty and go to Services → Service Directory. Select the service that should receive these alerts (or create a new one).",
      "Open the Integrations tab for that service and click Add integration. Search for Events API V2 and add it.",
      "Copy the Integration Key from the integration's detail page.",
      "In I/O set Webhook URL to `https://events.pagerduty.com/v2/enqueue` and HTTP Method to `POST`.",
      "Set Auth Type to `Bearer` and paste the Integration Key as the token value.",
      "Use the Payload Template to format a valid PagerDuty v2 event, including the `routing_key`, `event_action` (e.g. `trigger`), and `payload` object fields.",
    ],
  },
  other: {
    title: "Generic Webhook",
    steps: [
      "Enter the full HTTPS URL of your webhook endpoint in the Webhook URL field.",
      "Choose the HTTP method — `POST` is standard for virtually all webhook receivers.",
      "Select the authentication method your endpoint requires: None, Bearer Token, Basic Auth (`user:password`), or API Key Header.",
      "If using API Key Header: set the Header Name to what your endpoint expects (e.g. `X-API-Key`) and enter the key value in Auth Value.",
      "Use the Payload Template field (MiniJinja syntax) to shape the request body for your endpoint. Available variables: `subject`, `body_text`, `context_type`, `context_id`.",
    ],
  },
};

const STATIC_GUIDES: Record<string, SetupGuide> = {
  smtp_xoauth2: {
    title: "Microsoft 365 — SMTP + OAuth2 (XOAUTH2)",
    steps: [
      "Go to `portal.azure.com` → Microsoft Entra ID (or Azure Active Directory) → App registrations → New registration.",
      "Give the app a name (e.g. `IO-SMTP-OAuth`). Set Supported account types to Accounts in this organizational directory only. Click Register.",
      "In the app, go to API permissions → Add a permission → APIs my organization uses → search `Office 365 Exchange Online` → Delegated permissions → enable `SMTP.Send`. Click Add permissions.",
      "Click Grant admin consent for [your tenant] and confirm. The status column should show a green checkmark.",
      "Go to Certificates & secrets → Client secrets → New client secret. Enter a description, set an expiry, and click Add. Copy the Value column immediately — it is hidden after you navigate away.",
      "From the app's Overview page, copy the Application (client) ID and Directory (tenant) ID into I/O.",
      "Token endpoint: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token` (replace `{tenant-id}` with your Directory ID).",
      "Scope: `https://outlook.office365.com/.default`",
    ],
  },
  ms_graph: {
    title: "Microsoft Graph API — Azure AD App Registration",
    steps: [
      "Go to `portal.azure.com` → Microsoft Entra ID → App registrations → New registration.",
      "Name the app (e.g. `IO-Mail-Send`). Set Supported account types to Accounts in this organizational directory only. Click Register.",
      "In the app, go to API permissions → Add a permission → Microsoft Graph → Application permissions (not Delegated).",
      "Search for and enable `Mail.Send`. Click Add permissions, then Grant admin consent for [your tenant] and confirm.",
      "Go to Certificates & secrets → Client secrets → New client secret. Set a description and expiry, click Add. Copy the Value immediately — it is only shown once.",
      "From the app Overview, copy the Application (client) ID and the Directory (tenant) ID into I/O.",
      "Set Send-As User to the UPN (email address) of the mailbox to send from, e.g. `noreply@yourdomain.com`. This mailbox must have an Exchange Online license assigned in Microsoft 365.",
    ],
  },
  gmail: {
    title: "Gmail API — Google Workspace Service Account",
    steps: [
      "Open the Google Cloud Console at `console.cloud.google.com`. Select or create a project for this integration.",
      "Enable the Gmail API: navigate to APIs & Services → Library → search Gmail API → click Enable.",
      "Create a service account: go to IAM & Admin → Service Accounts → Create service account. Give it a name and click Done.",
      "Enable domain-wide delegation: click the service account → Details tab → Advanced settings → Enable G Suite Domain-wide Delegation. Save.",
      "Create a JSON key: on the service account, go to Keys → Add Key → Create new key → JSON. The file downloads automatically. Keep it secure.",
      "In the Google Workspace Admin Console at `admin.google.com`: Security → Access and data control → API controls → Domain-wide Delegation → Add new.",
      "Enter the service account's numeric Client ID (found in the service account details) and add scope `https://mail.google.com/`. Click Authorize.",
      "Paste the entire contents of the downloaded JSON key file into the Service Account Key field in I/O. Set Send-As User to a Workspace address in your domain.",
    ],
  },
  ses: {
    title: "Amazon SES",
    steps: [
      "Sign in to `console.aws.amazon.com` and navigate to Simple Email Service (SES). Use the region selector in the top-right to choose the region closest to your servers.",
      "Verify your sending identity: go to Verified identities → Create identity. For production use, verify a domain (requires DNS TXT/MX/DKIM records) rather than a single email address.",
      "If your account is in the SES sandbox (new accounts can only send to verified addresses): go to Account dashboard → Request production access and fill in the form. AWS typically responds within one business day.",
      "Create a dedicated IAM user for sending: go to IAM → Users → Create user. On the Permissions step, attach the policy `AmazonSESFullAccess`, or create a custom policy granting `ses:SendEmail` on `arn:aws:ses:*:*:identity/*`.",
      "Generate access keys: select the IAM user → Security credentials tab → Create access key → Application running outside AWS. Copy both the Access Key ID and Secret Access Key.",
      "Enter the same AWS region in I/O (e.g. `us-east-1`, `eu-west-1`). This must match the region where your SES identity is verified.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Inline code renderer for setup guide steps
// ---------------------------------------------------------------------------

function renderStep(text: string) {
  const parts = text.split(/`([^`]+)`/);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : (
          <code
            key={i}
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              background: "color-mix(in srgb, var(--io-accent) 12%, transparent)",
              color: "var(--io-accent)",
              padding: "1px 5px",
              borderRadius: "3px",
              whiteSpace: "nowrap",
            }}
          >
            {part}
          </code>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Provider Dialog
// ---------------------------------------------------------------------------

function ProviderDialog({
  provider,
  onClose,
}: {
  provider: EmailProvider | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!provider;

  const [name, setName] = useState(provider?.name ?? "");
  const [providerType, setProviderType] = useState(
    provider?.provider_type ?? "smtp",
  );
  const [fromAddress, setFromAddress] = useState(provider?.from_address ?? "");
  const [fromName, setFromName] = useState(provider?.from_name ?? "");
  const [isDefault, setIsDefault] = useState(provider?.is_default ?? false);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);

  function buildInitialFields(
    type: string,
    config: Record<string, unknown>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const f of PROVIDER_FIELDS[type] ?? []) {
      if (SECRET_KEYS.has(f.key)) {
        result[f.key] = "";
      } else if (config[f.key] !== undefined && config[f.key] !== null) {
        result[f.key] = String(config[f.key]);
      } else {
        result[f.key] = f.defaultValue ?? "";
      }
    }
    return result;
  }

  const [configFields, setConfigFields] = useState<Record<string, string>>(
    () =>
      buildInitialFields(
        provider?.provider_type ?? "smtp",
        (provider?.config as Record<string, unknown>) ?? {},
      ),
  );

  const [helpKey, setHelpKey] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [rawJson, setRawJson] = useState(
    provider?.config ? JSON.stringify(provider.config, null, 2) : "{}",
  );
  const [error, setError] = useState("");

  function handleTypeChange(t: string) {
    setProviderType(t);
    setConfigFields(buildInitialFields(t, {}));
    setHelpKey("");
    setShowGuide(false);
    setRawJson("{}");
  }

  function setField(key: string, value: string) {
    setConfigFields((prev) => ({ ...prev, [key]: value }));
  }

  function buildConfig(): Record<string, unknown> {
    if (showRaw) {
      return JSON.parse(rawJson);
    }
    const config: Record<string, unknown> = {};
    for (const f of PROVIDER_FIELDS[providerType] ?? []) {
      const val = configFields[f.key] ?? "";
      if (SECRET_KEYS.has(f.key) && val === "") continue;
      if (f.optional && val === "") continue;
      if (f.showWhen && !f.showWhen(configFields)) continue;
      if (f.type === "number") {
        if (val !== "") config[f.key] = Number(val);
      } else if (f.type === "checkbox") {
        config[f.key] = val === "true";
      } else {
        config[f.key] = val;
      }
    }
    return config;
  }

  function getGuide(): SetupGuide | null {
    if (providerType === "smtp") {
      const k = (helpKey || "other") as SmtpHelpKey;
      return SMTP_GUIDES[k] ?? SMTP_GUIDES.other;
    }
    if (providerType === "webhook") {
      const k = (helpKey || "other") as WebhookHelpKey;
      return WEBHOOK_GUIDES[k] ?? WEBHOOK_GUIDES.other;
    }
    return STATIC_GUIDES[providerType] ?? null;
  }

  const guide = getGuide();

  const createMutation = useMutation({
    mutationFn: (data: CreateProviderRequest) => emailApi.createProvider(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-providers"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateProviderRequest) =>
      emailApi.updateProvider(provider!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-providers"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSave() {
    setError("");
    let config: Record<string, unknown>;
    try {
      config = buildConfig();
    } catch {
      setError("Raw JSON config is invalid");
      return;
    }
    const payload: CreateProviderRequest = {
      name,
      provider_type: providerType,
      config,
      from_address: fromAddress,
      from_name: fromName || undefined,
      is_default: isDefault,
      enabled,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const visibleFields = (PROVIDER_FIELDS[providerType] ?? []).filter(
    (f) => !f.showWhen || f.showWhen(configFields),
  );

  const sectionLabel =
    providerType === "smtp" ? "SMTP Settings" :
    providerType === "smtp_xoauth2" ? "OAuth2 / XOAUTH2 Settings" :
    providerType === "ms_graph" ? "Azure AD App Settings" :
    providerType === "gmail" ? "Service Account Settings" :
    providerType === "ses" ? "AWS Credentials" :
    "Webhook Settings";

  return (
    <>
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-modal-backdrop)",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            padding: "24px",
            width: "min(1400px, 94vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            zIndex: 101,
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 20px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {isEdit ? "Edit Provider" : "Add Provider"}
          </Dialog.Title>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: showGuide && guide ? "1fr 360px" : "1fr",
              gap: "28px",
              alignItems: "start",
            }}
          >
            {/* LEFT COLUMN: configuration form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Name</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Provider type */}
            <div>
              <label style={labelStyle}>Provider Type</label>
              <select
                style={inputStyle}
                value={providerType}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="smtp">SMTP</option>
                <option value="smtp_xoauth2">SMTP + XOAUTH2 (Microsoft OAuth)</option>
                <option value="ms_graph">Microsoft Graph API</option>
                <option value="gmail">Gmail (Service Account)</option>
                <option value="ses">Amazon SES</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>

            {/* From address / name */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label style={labelStyle}>From Address</label>
                <input
                  style={inputStyle}
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  From Name{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "var(--io-text-muted)",
                      fontSize: "11px",
                    }}
                  >
                    optional
                  </span>
                </label>
                <input
                  style={inputStyle}
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Inside/Operations"
                />
              </div>
            </div>

            {/* Section divider */}
            <div
              style={{ borderTop: "1px solid var(--io-border)", margin: "2px 0" }}
            />

            {/* Config section label + guide toggle */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {sectionLabel}
              </div>
              {guide && (
                <button
                  type="button"
                  style={{
                    background: showGuide
                      ? "var(--io-accent)"
                      : "color-mix(in srgb, var(--io-accent) 15%, transparent)",
                    border: "1px solid var(--io-accent)",
                    borderRadius: "var(--io-radius)",
                    padding: "5px 14px",
                    cursor: "pointer",
                    color: showGuide ? "white" : "var(--io-accent)",
                    fontSize: "13px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => setShowGuide((v) => !v)}
                >
                  <span style={{ fontSize: "15px", lineHeight: 1, fontWeight: 800 }}>?</span>
                  {showGuide ? "Hide Guide" : "Setup Guide"}
                </button>
              )}
            </div>

            {/* Sub-provider selector (smtp / webhook only — determines which guide is shown) */}
            {(providerType === "smtp" || providerType === "webhook") && (
              <div>
                <label style={labelStyle}>
                  {providerType === "smtp"
                    ? "Which email service are you using?"
                    : "Which platform are you connecting to?"}
                </label>
                <select
                  style={{ ...inputStyle, maxWidth: "300px" }}
                  value={helpKey}
                  onChange={(e) => {
                    setHelpKey(e.target.value);
                    if (e.target.value) setShowGuide(true);
                  }}
                >
                  {providerType === "smtp" ? (
                    <>
                      <option value="">Select a provider…</option>
                      <option value="microsoft365">Microsoft 365</option>
                      <option value="gmail_app_password">Gmail (App Password)</option>
                      <option value="sendgrid">SendGrid</option>
                      <option value="mailgun">Mailgun</option>
                      <option value="postmark">Postmark</option>
                      <option value="other">Other / Generic SMTP</option>
                    </>
                  ) : (
                    <>
                      <option value="">Select a platform…</option>
                      <option value="slack">Slack</option>
                      <option value="teams">Microsoft Teams</option>
                      <option value="pagerduty">PagerDuty</option>
                      <option value="other">Other</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {/* Per-type config fields — 12-col grid, fields declare their own span */}
            {!showRaw && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: "14px 12px",
                  alignItems: "start",
                }}
              >
              {visibleFields.map((f) => (
                <div key={f.key} style={{ gridColumn: `span ${f.gridSpan ?? 12}` }}>
                  {f.type !== "checkbox" && (
                    <label style={labelStyle}>
                      {f.label}
                      {f.optional && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontWeight: 400,
                            color: "var(--io-text-muted)",
                            fontSize: "11px",
                          }}
                        >
                          optional
                        </span>
                      )}
                    </label>
                  )}
                  {f.type === "select" ? (
                    <select
                      style={inputStyle}
                      value={configFields[f.key] ?? f.defaultValue ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                    >
                      {f.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      style={{
                        ...inputStyle,
                        height: f.key === "service_account_key" ? "120px" : "80px",
                        resize: "vertical",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}
                      value={configFields[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  ) : f.type === "checkbox" ? (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={configFields[f.key] === "true"}
                        onChange={(e) =>
                          setField(f.key, e.target.checked ? "true" : "false")
                        }
                      />
                      {f.label}
                    </label>
                  ) : (
                    <input
                      style={inputStyle}
                      type={
                        f.type === "password"
                          ? "password"
                          : f.type === "number"
                            ? "number"
                            : "text"
                      }
                      value={configFields[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={
                        isEdit && SECRET_KEYS.has(f.key)
                          ? "Leave blank to keep current value"
                          : (f.placeholder ?? "")
                      }
                    />
                  )}
                  {f.hint && (
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "11px",
                        color: "var(--io-text-muted)",
                      }}
                    >
                      {f.hint}
                    </p>
                  )}
                </div>
              ))}
              </div>
            )}

            {/* Divider */}
            <div
              style={{ borderTop: "1px solid var(--io-border)", margin: "2px 0" }}
            />

            {/* Default / Enabled */}
            <div style={{ display: "flex", gap: "24px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Default provider
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled
              </label>
            </div>

            {/* Advanced: raw JSON */}
            <div>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--io-text-muted)",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
                onClick={() => {
                  if (showRaw) {
                    // Closing raw mode: sync edits back into form fields
                    try {
                      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
                      const updated: Record<string, string> = { ...configFields };
                      for (const f of PROVIDER_FIELDS[providerType] ?? []) {
                        if (parsed[f.key] !== undefined) {
                          updated[f.key] = String(parsed[f.key]);
                        }
                      }
                      setConfigFields(updated);
                    } catch {
                      /* leave configFields as-is if JSON is invalid */
                    }
                  } else {
                    try {
                      setRawJson(JSON.stringify(buildConfig(), null, 2));
                    } catch {
                      /* ignore */
                    }
                  }
                  setShowRaw((v) => !v);
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: showRaw ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                    fontSize: "9px",
                  }}
                >
                  ▶
                </span>
                {showRaw ? "Hide" : "Edit"} raw JSON config
              </button>
              {showRaw && (
                <textarea
                  style={{
                    ...inputStyle,
                    marginTop: "8px",
                    height: "120px",
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                />
              )}
            </div>
            </div>

            {/* RIGHT COLUMN: setup guide panel */}
            {showGuide && guide && (
              <div
                style={{
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  borderLeft: "3px solid var(--io-accent)",
                  borderRadius: "var(--io-radius)",
                  padding: "18px 16px",
                  overflowY: "auto",
                  maxHeight: "calc(90vh - 200px)",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "var(--io-accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "8px",
                  }}
                >
                  Setup Guide
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                    marginBottom: "18px",
                    lineHeight: 1.4,
                    paddingBottom: "12px",
                    borderBottom: "1px solid var(--io-border)",
                  }}
                >
                  {guide.title}
                </div>
                <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {guide.steps.map((step, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginBottom: "14px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: "var(--io-accent)",
                          color: "white",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: "1px",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--io-text-secondary)",
                          lineHeight: 1.65,
                        }}
                      >
                        {renderStep(step)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {error && (
            <p
              style={{
                color: "var(--io-danger)",
                fontSize: "13px",
                marginTop: "12px",
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "20px",
            }}
          >
            <div>
              {isEdit && (
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={() => setShowTestDialog(true)}
                >
                  Send Test Email
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button
                style={btnPrimary}
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    {isEdit && showTestDialog && (
      <TestEmailDialog
        providerId={provider!.id}
        providerName={provider!.name}
        onClose={() => {
          setShowTestDialog(false);
          qc.invalidateQueries({ queryKey: ["email-providers"] });
        }}
      />
    )}
  </>
  );
}

// ---------------------------------------------------------------------------
// Templates tab
// ---------------------------------------------------------------------------

function TemplatesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [previewVars, setPreviewVars] = useState("{}");
  const [preview, setPreview] = useState<{
    subject: string;
    body_html: string;
    body_text?: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await emailApi.listTemplates();
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });

  const renderMutation = useMutation({
    mutationFn: async ({ id, vars }: { id: string; vars: string }) => {
      let variables: Record<string, unknown> = {};
      try {
        variables = JSON.parse(vars);
      } catch {
        /* ignore */
      }
      const res = await emailApi.renderTemplate(id, variables);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => setPreview(data),
  });

  const templates = data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Email Templates
        </h3>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>
          Add Template
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading…
        </p>
      ) : templates.length === 0 ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          No templates defined.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
              {["Name", "Category", "Subject", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cellStyle,
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr
                key={t.id}
                style={{ borderBottom: "1px solid var(--io-border)" }}
              >
                <td
                  style={{
                    ...cellStyle,
                    fontWeight: 500,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {t.name}
                </td>
                <td style={cellStyle}>{t.category}</td>
                <td
                  style={{
                    ...cellStyle,
                    maxWidth: "300px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.subject_template}
                </td>
                <td style={{ ...cellStyle, display: "flex", gap: "8px" }}>
                  <button
                    style={btnSecondary}
                    onClick={() => {
                      setPreviewTemplate(t);
                      setPreview(null);
                      setPreviewVars("{}");
                    }}
                  >
                    Preview
                  </button>
                  <button
                    style={btnSecondary}
                    onClick={() => setEditTemplate(t)}
                  >
                    Edit
                  </button>
                  <button
                    style={btnDanger}
                    onClick={() => setDeleteConfirm({ id: t.id, name: t.name })}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(showAdd || editTemplate) && (
        <TemplateDialog
          template={editTemplate}
          onClose={() => {
            setShowAdd(false);
            setEditTemplate(null);
          }}
        />
      )}

      {previewTemplate && (
        <Dialog.Root
          open
          onOpenChange={(open) => !open && setPreviewTemplate(null)}
        >
          <Dialog.Portal>
            <Dialog.Overlay
              style={{
                position: "fixed",
                inset: 0,
                background: "var(--io-modal-backdrop)",
                zIndex: 100,
              }}
            />
            <Dialog.Content
              aria-describedby={undefined}
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                background: "var(--io-surface)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                padding: "24px",
                width: "600px",
                maxHeight: "80vh",
                overflowY: "auto",
                zIndex: 101,
              }}
            >
              <Dialog.Title
                style={{
                  margin: "0 0 16px",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                }}
              >
                Preview: {previewTemplate.name}
              </Dialog.Title>
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Variables (JSON)</label>
                <textarea
                  style={{
                    ...inputStyle,
                    height: "80px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    resize: "vertical",
                  }}
                  value={previewVars}
                  onChange={(e) => setPreviewVars(e.target.value)}
                />
              </div>
              <button
                style={btnPrimary}
                onClick={() =>
                  renderMutation.mutate({
                    id: previewTemplate.id,
                    vars: previewVars,
                  })
                }
                disabled={renderMutation.isPending}
              >
                {renderMutation.isPending ? "Rendering…" : "Render"}
              </button>
              {preview && (
                <div
                  style={{
                    marginTop: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--io-text-muted)",
                        marginBottom: "4px",
                      }}
                    >
                      SUBJECT
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "var(--io-surface-sunken)",
                        borderRadius: "var(--io-radius)",
                        fontSize: "13px",
                      }}
                    >
                      {preview.subject}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--io-text-muted)",
                        marginBottom: "4px",
                      }}
                    >
                      HTML BODY
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        background: "#fff",
                        border: "1px solid var(--io-border)",
                        borderRadius: "var(--io-radius)",
                        color: "#000",
                        fontSize: "13px",
                        maxHeight: "200px",
                        overflow: "auto",
                      }}
                      dangerouslySetInnerHTML={{ __html: preview.body_html }}
                    />
                  </div>
                  {preview.body_text && (
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--io-text-muted)",
                          marginBottom: "4px",
                        }}
                      >
                        TEXT BODY
                      </div>
                      <pre
                        style={{
                          padding: "8px 10px",
                          background: "var(--io-surface-sunken)",
                          borderRadius: "var(--io-radius)",
                          fontSize: "12px",
                          whiteSpace: "pre-wrap",
                          margin: 0,
                        }}
                      >
                        {preview.body_text}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "16px",
                }}
              >
                <button
                  style={btnSecondary}
                  onClick={() => setPreviewTemplate(null)}
                >
                  Close
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        title="Delete Template"
        description={
          deleteConfirm ? `Delete template "${deleteConfirm.name}"?` : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
      />
    </div>
  );
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "custom");
  const [subjectTemplate, setSubjectTemplate] = useState(
    template?.subject_template ?? "",
  );
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? "");
  const [bodyText, setBodyText] = useState(template?.body_text ?? "");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) => emailApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) =>
      emailApi.updateTemplate(template!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSave() {
    setError("");
    const payload: CreateTemplateRequest = {
      name,
      category: category || "custom",
      subject_template: subjectTemplate,
      body_html: bodyHtml,
      body_text: bodyText || undefined,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-modal-backdrop)",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            padding: "24px",
            width: "680px",
            maxHeight: "85vh",
            overflowY: "auto",
            zIndex: 101,
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 20px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {isEdit ? "Edit Template" : "Add Template"}
          </Dialog.Title>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  style={inputStyle}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="custom">Custom</option>
                  <option value="system">System</option>
                  <option value="alert">Alert</option>
                  <option value="report">Report</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                Subject (use {"{{variable}}"} placeholders)
              </label>
              <input
                style={inputStyle}
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>HTML Body</label>
              <textarea
                style={{
                  ...inputStyle,
                  height: "160px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  resize: "vertical",
                }}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Plain Text Body (optional)</label>
              <textarea
                style={{
                  ...inputStyle,
                  height: "80px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  resize: "vertical",
                }}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p
              style={{
                color: "var(--io-danger)",
                fontSize: "13px",
                marginTop: "12px",
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <button style={btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button
              style={btnPrimary}
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Queue tab
// ---------------------------------------------------------------------------

const QUEUE_STATUSES = ["", "pending", "retry", "sent", "failed"];

function QueueTab() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["email-queue", statusFilter],
    queryFn: async () => {
      const res = await emailApi.listQueue(
        statusFilter ? { status: statusFilter } : {},
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    refetchInterval: 15000,
  });

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["email-delivery-log", selectedQueueId],
    queryFn: async () => {
      const res = await emailApi.listDeliveryLog(
        selectedQueueId ? { queue_id: selectedQueueId } : {},
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const items = queueData ?? [];
  const logItems = logData ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Email Queue
        </h3>
        <select
          style={{ ...inputStyle, width: "auto" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {QUEUE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {queueLoading ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          No queue items.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "24px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
              {["To", "Subject", "Status", "Attempts", "Created", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      ...cellStyle,
                      fontWeight: 600,
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: "left",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item: EmailQueueItem) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background:
                    selectedQueueId === item.id
                      ? "var(--io-accent-subtle)"
                      : "transparent",
                }}
              >
                <td style={cellStyle}>{item.to_addresses.join(", ")}</td>
                <td
                  style={{
                    ...cellStyle,
                    maxWidth: "200px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.subject}
                </td>
                <td style={cellStyle}>
                  <StatusBadge status={item.status} />
                </td>
                <td style={cellStyle}>
                  {item.attempts}/{item.max_attempts}
                </td>
                <td style={cellStyle}>
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td style={cellStyle}>
                  <button
                    style={btnSecondary}
                    onClick={() =>
                      setSelectedQueueId(
                        selectedQueueId === item.id ? null : item.id,
                      )
                    }
                  >
                    {selectedQueueId === item.id ? "Hide Log" : "View Log"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedQueueId && (
        <div>
          <h4
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--io-text-secondary)",
              marginBottom: "10px",
            }}
          >
            Delivery Log for selected item
          </h4>
          {logLoading ? (
            <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
              Loading…
            </p>
          ) : logItems.length === 0 ? (
            <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
              No delivery attempts yet.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
                  {["Attempt", "Status", "Message ID", "Error", "Sent At"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          ...cellStyle,
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "var(--io-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          textAlign: "left",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {logItems.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid var(--io-border)" }}
                  >
                    <td style={cellStyle}>{entry.attempt_number}</td>
                    <td style={cellStyle}>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td style={cellStyle}>
                      {entry.provider_message_id ?? "—"}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        color: "var(--io-danger)",
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.error_details ?? "—"}
                    </td>
                    <td style={cellStyle}>
                      {new Date(entry.sent_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

const TABS = [
  { id: "Providers", label: "Providers" },
  { id: "Templates", label: "Templates" },
  { id: "Queue", label: "Queue" },
];

export default function EmailSettingsPage() {
  const [activeTab, setActiveTab] = useState("Providers");

  return (
    <SettingsPageLayout
      title="Email"
      description="Configure email providers, templates, and delivery queue."
      variant="list"
    >
      <SettingsTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div>
          {activeTab === "Providers" && <ProvidersTab />}
          {activeTab === "Templates" && <TemplatesTab />}
          {activeTab === "Queue" && <QueueTab />}
        </div>
      </SettingsTabs>
    </SettingsPageLayout>
  );
}
