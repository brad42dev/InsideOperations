import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  smsProvidersApi,
  SmsProvider,
  CreateSmsProviderRequest,
  UpdateSmsProviderRequest,
} from "../../api/smsProviders";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import SettingsPageLayout from "./SettingsPageLayout";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  optional?: boolean;
  hint?: string;
  /** Column span out of 12. Defaults to 12 (full row). */
  gridSpan?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
}

interface SetupGuide {
  title: string;
  steps: string[];
}

type ProviderType = "twilio" | "webhook";
type WebhookGuideKey = "vonage" | "sinch" | "plivo" | "aws_sns" | "custom";

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

const TWILIO_FIELDS: ConfigField[] = [
  {
    key: "account_sid",
    label: "Account SID",
    type: "text",
    placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    hint: "Starts with AC — found on your Twilio Console dashboard under Account Info",
    gridSpan: 7,
  },
  {
    key: "from_number",
    label: "From Number",
    type: "text",
    placeholder: "+15005550006",
    hint: "E.164 format — must be a Twilio-purchased or verified number",
    gridSpan: 5,
  },
  {
    key: "auth_token",
    label: "Auth Token",
    type: "password",
    placeholder: "Your Twilio Auth Token",
    hint: "Found on the Twilio Console dashboard — treat as a secret",
    gridSpan: 12,
  },
];

const WEBHOOK_FIELDS: ConfigField[] = [
  {
    key: "url",
    label: "Webhook URL",
    type: "text",
    placeholder: "https://api.example.com/sms/send",
    hint: 'I/O will POST { "to": "+15551234567", "message": "..." } to this URL',
    gridSpan: 12,
  },
  {
    key: "headers",
    label: "Custom Headers (JSON)",
    type: "textarea",
    placeholder: '{"Authorization": "Bearer your-secret"}',
    optional: true,
    hint: "JSON object of HTTP headers sent with every request — use for API key auth",
    gridSpan: 12,
  },
];

// ---------------------------------------------------------------------------
// Setup guides
// ---------------------------------------------------------------------------

const TWILIO_GUIDE: SetupGuide = {
  title: "Twilio — SMS Setup",
  steps: [
    "Sign in to `console.twilio.com`. No account? Start a free trial at twilio.com — trial accounts can send to verified numbers without charge.",
    "From the Console dashboard, copy your `Account SID` (starts with `AC`) and `Auth Token` from the `Account Info` panel in the lower-left.",
    "Purchase a phone number: go to `Phone Numbers → Manage → Buy a number`. Filter by `SMS` capability, select a local or toll-free number, and click Buy.",
    "In I/O enter: Account SID, Auth Token, and From Number in E.164 format (e.g. `+15005550006`). The From Number must match the Twilio number you purchased.",
    "Trial accounts only: before sending, verify each destination phone number at `console.twilio.com → Verified Caller IDs → Add a new Caller ID`. Production accounts can send to any number.",
    "Click `Test` to send a live SMS and confirm end-to-end delivery. The result and timestamp are recorded against this provider.",
  ],
};

const WEBHOOK_GUIDES: Record<WebhookGuideKey, SetupGuide> = {
  vonage: {
    title: "Vonage (Nexmo) — Webhook Bridge",
    steps: [
      "Sign in to `dashboard.nexmo.com`. From the top-right menu go to `Account → Settings` and copy your `API key` and `API secret`.",
      "Purchase a virtual number: go to `Numbers → Buy numbers`, filter by country and `SMS` capability, and click the cart icon to purchase.",
      'Create a small bridge endpoint (Node.js, Python, etc.) that receives I/O\'s payload `{ "to", "message" }` and calls the Vonage SMS REST API: `POST https://rest.nexmo.com/sms/json` with params `api_key`, `api_secret`, `from` (your Vonage number), `to`, and `text`.',
      'Deploy your bridge and enter its URL here. Add an authentication header in Custom Headers (e.g. `{"X-Bridge-Secret": "your-secret"}`) and validate it in your bridge for security.',
      "Click `Test` to verify end-to-end delivery. Confirm the outbound message in `Vonage → Logs → SMS` in the dashboard.",
    ],
  },
  sinch: {
    title: "Sinch — Webhook Bridge",
    steps: [
      "Sign in to `dashboard.sinch.com`. Go to `SMS → REST APIs` and note your `Service Plan ID` and `API Token` from the API settings page.",
      "Get a Sinch sending number: go to `Numbers → Your numbers` or purchase a new one. Note the number in E.164 format.",
      'Create a bridge endpoint that receives I/O\'s payload `{ "to", "message" }` and forwards it to Sinch: `POST https://us.sms.api.sinch.com/xms/v1/{servicePlanId}/batches` with body `{ "from": "YOUR_NUMBER", "to": ["to"], "body": "message" }` and header `Authorization: Bearer {apiToken}`.',
      "Set the Webhook URL to your bridge endpoint URL here. Add any authentication headers your bridge requires.",
      "Click `Test` to verify. Confirm delivery in `Sinch → SMS → Message Logs`.",
    ],
  },
  plivo: {
    title: "Plivo — Webhook Bridge",
    steps: [
      "Sign in to `console.plivo.com`. Copy your `Auth ID` and `Auth Token` from the dashboard Overview under `API Credentials`.",
      "Purchase a Plivo number: go to `Phone Numbers → Buy Numbers`, filter by `SMS`, choose a number, and complete the purchase.",
      'Create a bridge endpoint receiving I/O\'s `{ "to", "message" }` payload. It should call Plivo: `POST https://api.plivo.com/v1/Account/{AUTH_ID}/Message/` with Basic Auth (`AUTH_ID:AUTH_TOKEN`) and body `{ "src": "PLIVO_NUMBER", "dst": to, "text": message }`.',
      "Set the Webhook URL to your bridge URL. Add authentication headers as needed.",
      "Click `Test` to verify. Check `Plivo → Logs → Message Logs` to confirm delivery.",
    ],
  },
  aws_sns: {
    title: "AWS SNS + Lambda — Webhook Bridge",
    steps: [
      "In the AWS Console go to `IAM → Users`, create a dedicated user, and attach a policy granting `sns:Publish` (or use `AmazonSNSFullAccess`). Generate `Access Key ID` and `Secret Access Key`.",
      "Ensure SNS SMS is enabled in your AWS region: go to `SNS → Text messaging (SMS)` and verify the monthly spend limit is set to a non-zero value.",
      "Create an AWS Lambda function (Node.js/Python). Add an `API Gateway HTTP` trigger to expose it as a public URL. The Lambda should read `event.body` for `{ to, message }` and call the AWS SDK: `sns.publish({ PhoneNumber: to, Message: message })`.",
      "Set the Lambda function's execution role to include `sns:Publish`. In I/O, set the Webhook URL to your Lambda API Gateway endpoint URL.",
      'Secure the endpoint by checking a custom header in your Lambda (e.g. `X-Api-Key`). Add the matching header in Custom Headers here: `{"X-Api-Key": "your-secret"}`.',
      "Click `Test` to verify end-to-end delivery. Check `CloudWatch → Log groups → /aws/lambda/{your-function}` for delivery logs.",
    ],
  },
  custom: {
    title: "Custom Webhook",
    steps: [
      'I/O sends a `POST` request with `Content-Type: application/json` and body: `{ "to": "+15551234567", "message": "Your code is 123456" }`. The `to` field is always E.164 format.',
      "Your endpoint must return a `2xx` HTTP status code to indicate success. Any non-2xx response is treated as a delivery failure and the attempt is logged.",
      'To secure the endpoint, add a secret in the `Custom Headers` field — for example `{"Authorization": "Bearer your-secret"}` — and validate it server-side before forwarding the SMS.',
      "If your SMS provider uses a different request format, create a thin bridge script that maps I/O's `{ to, message }` payload into your provider's required format before forwarding.",
      "Click `Test` to verify I/O can reach your endpoint and that it returns a 2xx response for a live delivery.",
    ],
  },
};

// ---------------------------------------------------------------------------
// renderStep — render backtick-delimited values as inline code
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
              background:
                "color-mix(in srgb, var(--io-accent) 12%, transparent)",
              color: "var(--io-accent)",
              padding: "1px 5px",
              borderRadius: "3px",
              whiteSpace: "nowrap",
            }}
          >
            {part}
          </code>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TestSmsDialog
// ---------------------------------------------------------------------------

function TestSmsDialog({
  providerId,
  providerName,
  onClose,
}: {
  providerId: string;
  providerName: string;
  onClose: () => void;
}) {
  const [toNumber, setToNumber] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const testMutation = useMutation({
    mutationFn: (num: string) => smsProvidersApi.test(providerId, num),
    onSuccess: (res) => {
      if (res.success && res.data.ok) {
        setResult({ ok: true, message: "Test SMS sent successfully." });
      } else {
        setResult({
          ok: false,
          message: res.success
            ? (res.data.error ?? "Provider reported a failure.")
            : res.error.message,
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
            width: "420px",
            maxWidth: "95vw",
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
            Send Test SMS
          </Dialog.Title>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Send a test message via <strong>{providerName}</strong> to verify
            delivery.
          </p>
          <label style={labelStyle}>Destination Phone Number</label>
          <input
            style={{ ...inputStyle, marginBottom: "4px" }}
            value={toNumber}
            onChange={(e) => setToNumber(e.target.value)}
            placeholder="+15005550006"
          />
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "11px",
              color: "var(--io-text-muted)",
            }}
          >
            E.164 format — must be a number authorised to receive SMS from this
            provider.
          </p>
          {result && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                borderRadius: "var(--io-radius)",
                background: result.ok
                  ? "color-mix(in srgb, var(--io-success) 12%, transparent)"
                  : "color-mix(in srgb, var(--io-danger) 12%, transparent)",
                border: `1px solid ${result.ok ? "var(--io-success)" : "var(--io-danger)"}`,
                fontSize: "13px",
                color: result.ok ? "var(--io-success)" : "var(--io-danger)",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontWeight: 700, flexShrink: 0 }}>
                {result.ok ? "✓" : "✗"}
              </span>
              {result.message}
            </div>
          )}
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
          >
            <Dialog.Close asChild>
              <button style={btnSecondary}>Close</button>
            </Dialog.Close>
            <button
              style={btnPrimary}
              onClick={() => {
                setResult(null);
                testMutation.mutate(toNumber);
              }}
              disabled={!toNumber.trim() || testMutation.isPending}
            >
              {testMutation.isPending ? "Sending…" : "Send Test SMS"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// ProviderDialog — add or edit an SMS provider
// ---------------------------------------------------------------------------

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProvider: SmsProvider | null;
  onSaved: () => void;
}

function initFormData(
  provider: SmsProvider,
  type: ProviderType,
): Record<string, string> {
  if (provider.provider_type !== type) return {};
  const c = provider.config;
  if (type === "twilio") {
    return {
      account_sid: c.account_sid ?? "",
      auth_token: c.auth_token ?? "",
      from_number: c.from_number ?? "",
    };
  }
  return {
    url: c.url ?? "",
    headers: c.headers ? JSON.stringify(c.headers, null, 2) : "",
  };
}

function ProviderDialog({
  open,
  onOpenChange,
  editingProvider,
  onSaved,
}: ProviderDialogProps) {
  const isEdit = editingProvider !== null;
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("twilio");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [webhookGuideKey, setWebhookGuideKey] =
    useState<WebhookGuideKey>("custom");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingProvider) {
      setName(editingProvider.name);
      const pt = editingProvider.provider_type as ProviderType;
      setProviderType(pt);
      setFormData(initFormData(editingProvider, pt));
      setEnabled(editingProvider.enabled);
      setIsDefault(editingProvider.is_default);
    } else {
      setName("");
      setProviderType("twilio");
      setFormData({});
      setEnabled(true);
      setIsDefault(false);
    }
    setShowGuide(false);
    setError("");
  }, [open, editingProvider]);

  const createMutation = useMutation({
    mutationFn: (body: CreateSmsProviderRequest) =>
      smsProvidersApi.create(body),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["sms-providers"] });
        onSaved();
      } else {
        setError(res.error.message ?? "Failed to create provider");
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateSmsProviderRequest) =>
      smsProvidersApi.update(editingProvider!.id, body),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["sms-providers"] });
        onSaved();
      } else {
        setError(res.error.message ?? "Failed to update provider");
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    setError("");
    if (!name.trim()) {
      setError("Provider name is required");
      return;
    }

    let config: Record<string, unknown>;
    if (providerType === "twilio") {
      if (!formData.account_sid?.trim()) {
        setError("Account SID is required");
        return;
      }
      if (!formData.from_number?.trim()) {
        setError("From Number is required");
        return;
      }
      if (!isEdit && !formData.auth_token?.trim()) {
        setError("Auth Token is required");
        return;
      }
      config = {
        account_sid: formData.account_sid.trim(),
        auth_token: formData.auth_token?.trim() ?? "***",
        from_number: formData.from_number.trim(),
      };
    } else {
      if (!formData.url?.trim()) {
        setError("Webhook URL is required");
        return;
      }
      config = { url: formData.url.trim() };
      if (formData.headers?.trim()) {
        try {
          config.headers = JSON.parse(formData.headers.trim());
        } catch {
          setError(
            'Custom Headers must be valid JSON — e.g. {"Authorization": "Bearer token"}',
          );
          return;
        }
      }
    }

    if (isEdit) {
      updateMutation.mutate({
        name: name.trim(),
        enabled,
        is_default: isDefault,
        config: config as UpdateSmsProviderRequest["config"],
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        provider_type: providerType,
        enabled,
        is_default: isDefault,
        config: config as CreateSmsProviderRequest["config"],
      });
    }
  };

  const fields = providerType === "twilio" ? TWILIO_FIELDS : WEBHOOK_FIELDS;
  const guide =
    providerType === "twilio" ? TWILIO_GUIDE : WEBHOOK_GUIDES[webhookGuideKey];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
            zIndex: 101,
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius-lg)",
            padding: "28px",
            width: "min(1400px, 94vw)",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              {isEdit
                ? `Edit Provider — ${editingProvider!.name}`
                : "Add SMS Provider"}
            </Dialog.Title>
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
              <span
                style={{ fontSize: "15px", lineHeight: 1, fontWeight: 800 }}
              >
                ?
              </span>
              {showGuide ? "Hide Guide" : "Setup Guide"}
            </button>
          </div>

          {/* ── Two-column layout ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: showGuide ? "1fr 360px" : "1fr",
              gap: "28px",
              alignItems: "start",
            }}
          >
            {/* LEFT: form */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              {/* Name + Provider Type */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: "14px 12px",
                }}
              >
                <div style={{ gridColumn: "span 7" }}>
                  <label style={labelStyle}>Provider Name</label>
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Twilio Production"
                  />
                </div>
                <div style={{ gridColumn: "span 5" }}>
                  <label style={labelStyle}>Provider Type</label>
                  <select
                    value={providerType}
                    onChange={(e) => {
                      const pt = e.target.value as ProviderType;
                      setProviderType(pt);
                      setFormData({});
                      if (pt === "webhook") setShowGuide(true);
                    }}
                    style={inputStyle}
                    disabled={isEdit}
                  >
                    <option value="twilio">Twilio</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>
              </div>

              {/* Webhook guide selector */}
              {providerType === "webhook" && (
                <div>
                  <label style={labelStyle}>
                    Setup Guide — select your bridge provider
                  </label>
                  <select
                    value={webhookGuideKey}
                    onChange={(e) => {
                      setWebhookGuideKey(e.target.value as WebhookGuideKey);
                      setShowGuide(true);
                    }}
                    style={inputStyle}
                  >
                    <option value="vonage">Vonage (Nexmo)</option>
                    <option value="sinch">Sinch</option>
                    <option value="plivo">Plivo</option>
                    <option value="aws_sns">AWS SNS + Lambda</option>
                    <option value="custom">Custom / Other</option>
                  </select>
                </div>
              )}

              {/* Config fields — 12-column grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: "14px 12px",
                  alignItems: "start",
                }}
              >
                {fields.map((f) => (
                  <div
                    key={f.key}
                    style={{ gridColumn: `span ${f.gridSpan ?? 12}` }}
                  >
                    <label style={labelStyle}>
                      {f.label}
                      {f.optional && (
                        <span
                          style={{
                            color: "var(--io-text-muted)",
                            fontWeight: 400,
                            marginLeft: "4px",
                          }}
                        >
                          (optional)
                        </span>
                      )}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        style={{
                          ...inputStyle,
                          minHeight: "72px",
                          resize: "vertical",
                          fontFamily: "monospace",
                          fontSize: "12px",
                        }}
                        value={formData[f.key] ?? ""}
                        onChange={(e) =>
                          setFormData((d) => ({
                            ...d,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <input
                        type={f.type}
                        style={inputStyle}
                        value={formData[f.key] ?? ""}
                        onChange={(e) =>
                          setFormData((d) => ({
                            ...d,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder={f.placeholder}
                        autoComplete={
                          f.type === "password" ? "new-password" : undefined
                        }
                      />
                    )}
                    {f.hint && (
                      <p
                        style={{
                          margin: "3px 0 0",
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        {f.hint}
                      </p>
                    )}
                    {f.key === "auth_token" && isEdit && (
                      <p
                        style={{
                          margin: "3px 0 0",
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        Leave as{" "}
                        <code
                          style={{
                            fontFamily: "monospace",
                            background:
                              "color-mix(in srgb, var(--io-accent) 10%, transparent)",
                            padding: "0 4px",
                            borderRadius: "3px",
                          }}
                        >
                          ***
                        </code>{" "}
                        to keep the existing token, or type a new value to
                        replace it.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", gap: "24px", paddingTop: "4px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "var(--io-text-primary)",
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
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "var(--io-text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  Set as default
                </label>
              </div>

              {error && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "var(--io-danger)",
                  }}
                >
                  {error}
                </p>
              )}
            </div>

            {/* RIGHT: guide panel */}
            {showGuide && (
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
                    marginBottom: "6px",
                  }}
                >
                  Setup Guide
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                    marginBottom: "16px",
                    lineHeight: 1.35,
                  }}
                >
                  {guide.title}
                </div>
                <ol
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {guide.steps.map((step, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
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
                          flexShrink: 0,
                          marginTop: "1px",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          lineHeight: 1.65,
                          color: "var(--io-text-secondary)",
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

          {/* ── Footer ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--io-border)",
            }}
          >
            <Dialog.Close asChild>
              <button style={btnSecondary}>Cancel</button>
            </Dialog.Close>
            <button
              style={btnPrimary}
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                  ? "Save Changes"
                  : "Add Provider"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SmsProvidersPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SmsProvider | null>(
    null,
  );
  const [testingProvider, setTestingProvider] = useState<SmsProvider | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<SmsProvider | null>(null);
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<SmsProvider>();

  const { data, isLoading } = useQuery({
    queryKey: ["sms-providers"],
    queryFn: async () => {
      const result = await smsProvidersApi.list();
      return result.success ? result.data : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => smsProvidersApi.delete(id),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["sms-providers"] });
    },
  });

  const providers: SmsProvider[] = data ?? [];

  function openAdd() {
    setEditingProvider(null);
    setShowDialog(true);
  }
  function openEdit(p: SmsProvider) {
    setEditingProvider(p);
    setShowDialog(true);
  }

  return (
    <SettingsPageLayout
      title="SMS Providers"
      description="Configure SMS delivery providers used for MFA codes and alert notifications."
      variant="list"
      action={
        <button style={btnPrimary} onClick={openAdd}>
          Add Provider
        </button>
      }
    >
      {isLoading ? (
        <p style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          Loading…
        </p>
      ) : providers.length === 0 ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--io-text-muted)",
            fontStyle: "italic",
          }}
        >
          No SMS providers configured. Add one to enable SMS-based MFA and alert
          notifications.
        </p>
      ) : (
        <div
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--io-surface-sunken)",
                  borderBottom: "1px solid var(--io-border)",
                }}
              >
                {[
                  "Name",
                  "Type",
                  "From / URL",
                  "Enabled",
                  "Default",
                  "Last Test",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...cellStyle,
                      color: "var(--io-text-muted)",
                      fontWeight: 600,
                      fontSize: "12px",
                      textAlign: "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p, idx) => (
                <tr
                  key={p.id}
                  onContextMenu={(e) => handleContextMenu(e, p)}
                  style={{
                    borderTop:
                      idx === 0 ? "none" : "1px solid var(--io-border)",
                    cursor: "context-menu",
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      color: "var(--io-text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "var(--io-radius)",
                        fontSize: "11px",
                        fontWeight: 600,
                        background:
                          p.provider_type === "twilio"
                            ? "color-mix(in srgb, #e84444 12%, transparent)"
                            : "color-mix(in srgb, var(--io-accent) 12%, transparent)",
                        color:
                          p.provider_type === "twilio"
                            ? "#e84444"
                            : "var(--io-accent)",
                      }}
                    >
                      {p.provider_type === "twilio" ? "Twilio" : "Webhook"}
                    </span>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: "monospace",
                      fontSize: "12px",
                      maxWidth: "240px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.provider_type === "twilio"
                      ? (p.config.from_number ?? "—")
                      : (p.config.url ?? "—")}
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: p.enabled
                            ? "var(--io-success)"
                            : "var(--io-text-muted)",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {p.enabled ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={cellStyle}>{p.is_default ? "Yes" : "—"}</td>
                  <td style={cellStyle}>
                    {p.last_tested_at == null ? (
                      <span style={{ color: "var(--io-text-muted)" }}>
                        Never
                      </span>
                    ) : (
                      <span
                        style={{
                          color: p.last_test_ok
                            ? "var(--io-success)"
                            : "var(--io-danger)",
                        }}
                      >
                        {p.last_test_ok ? "OK" : "Failed"}{" "}
                        <span
                          style={{
                            color: "var(--io-text-muted)",
                            fontSize: "11px",
                          }}
                        >
                          {new Date(p.last_tested_at).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        style={btnSmall}
                        onClick={() => setTestingProvider(p)}
                      >
                        Test
                      </button>
                      <button style={btnSmall} onClick={() => openEdit(p)}>
                        Edit
                      </button>
                      <button
                        style={{
                          ...btnSmall,
                          color: "var(--io-danger)",
                          borderColor: "var(--io-danger)",
                        }}
                        onClick={() => setConfirmDelete(p)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {menuState?.data && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: menuState.data.name, disabled: true },
            {
              label: "Edit",
              permission: "sms:manage",
              onClick: () => {
                closeMenu();
                openEdit(menuState.data!);
              },
            },
            {
              label: "Test Connection",
              onClick: () => {
                closeMenu();
                setTestingProvider(menuState.data!);
              },
            },
            {
              label: "Delete",
              danger: true,
              divider: true,
              permission: "sms:manage",
              onClick: () => {
                closeMenu();
                setConfirmDelete(menuState.data!);
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}

      <ProviderDialog
        open={showDialog}
        onOpenChange={(v) => {
          setShowDialog(v);
          if (!v) setEditingProvider(null);
        }}
        editingProvider={editingProvider}
        onSaved={() => {
          setShowDialog(false);
          setEditingProvider(null);
        }}
      />

      {testingProvider && (
        <TestSmsDialog
          providerId={testingProvider.id}
          providerName={testingProvider.name}
          onClose={() => {
            setTestingProvider(null);
            queryClient.invalidateQueries({ queryKey: ["sms-providers"] });
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => {
          if (!v) setConfirmDelete(null);
        }}
        title={`Delete "${confirmDelete?.name ?? ""}"?`}
        description="This SMS provider will be permanently removed. Any MFA flows or alert routing that relies on it will stop working."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() =>
          confirmDelete && deleteMutation.mutate(confirmDelete.id)
        }
      />

      <style>{`
        input[type="checkbox"] { accent-color: var(--io-accent); cursor: pointer; }
        select option { background: var(--io-surface-secondary); color: var(--io-text-primary); }
      `}</style>
    </SettingsPageLayout>
  );
}
