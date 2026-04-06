import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../../api/settings";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";

type AdminTab = "methods" | "policies";

// ── Stub types for admin-level MFA configuration ──────────────────────────────

interface MfaMethod {
  id: "totp" | "sms" | "email" | "duo";
  label: string;
  description: string;
  enabled: boolean;
  warning?: string;
}

interface RoleMfaPolicy {
  role_id: string;
  role_name: string;
  require_mfa: boolean;
  allowed_methods: ("totp" | "sms" | "email" | "duo")[];
  grace_period_hours: number;
}

// ── Admin: Method Configuration tab ──────────────────────────────────────────

const DEFAULT_METHODS: MfaMethod[] = [
  {
    id: "totp",
    label: "Authenticator App (TOTP)",
    description:
      "Time-based one-time passwords via Google Authenticator, Authy, 1Password, etc.",
    enabled: true,
  },
  {
    id: "sms",
    label: "SMS / Text Message",
    description:
      "One-time codes sent via SMS to the user's registered phone number.",
    enabled: false,
    warning:
      "SMS-based MFA is less secure than TOTP. Ensure your SMS provider is configured in SMS Providers before enabling.",
  },
  {
    id: "email",
    label: "Email OTP",
    description: "One-time codes sent to the user's verified email address.",
    enabled: false,
    warning:
      "Email-based MFA is susceptible to email compromise. Use only as a fallback method.",
  },
  {
    id: "duo",
    label: "Duo Security",
    description:
      "Push notifications and passcodes via Duo Security. Requires Duo API credentials configured under Security > Duo Integration.",
    enabled: false,
    warning:
      "Duo Security requires a Duo hostname, integration key, and secret key configured in Security settings before enabling.",
  },
];

function MfaMethodsTab() {
  const qc = useQueryClient();
  const [methods, setMethods] = useState<MfaMethod[]>(DEFAULT_METHODS);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<{
    id: MfaMethod["id"];
    title: string;
    description: string;
  } | null>(null);

  // Try to hydrate from settings API
  useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.list(),
    select: (result) => {
      if (!result.success) return;
      const settings = result.data;
      setMethods((prev) =>
        prev.map((m) => {
          const s = settings.find((st) => st.key === `mfa.${m.id}.enabled`);
          return s != null ? { ...m, enabled: Boolean(s.value) } : m;
        }),
      );
    },
  });

  const handleToggle = (id: MfaMethod["id"]) => {
    const method = methods.find((m) => m.id === id);
    if (!method) return;

    if (method.warning && !method.enabled) {
      setPendingToggle({
        id,
        title: `Enable ${method.label}?`,
        description: `${method.warning}\n\nEnable anyway?`,
      });
      return;
    }

    if (method.enabled) {
      setPendingToggle({
        id,
        title: `Disable ${method.label}?`,
        description:
          "Users currently using this method will be required to re-enroll with another method.",
      });
      return;
    }

    doToggle(id);
  };

  const doToggle = async (id: MfaMethod["id"]) => {
    const method = methods.find((m) => m.id === id);
    if (!method) return;
    setSaving(id);
    try {
      const result = await settingsApi.update(
        `mfa.${id}.enabled`,
        !method.enabled,
      );
      if (result.success) {
        qc.invalidateQueries({ queryKey: ["settings"] });
      }
      // Update local state regardless (API may not have endpoint yet)
      setMethods((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
      );
    } catch {
      // Endpoint not yet available — update local state for demo
      setMethods((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h4
        style={{
          margin: "0 0 4px",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        Global MFA Methods
      </h4>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
        }}
      >
        Control which authentication methods are available system-wide.
        Disabling a method prevents new enrollments and may require users to
        switch methods.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {methods.map((method) => (
          <div
            key={method.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              padding: "16px",
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {method.label}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: method.enabled
                      ? "var(--io-success-subtle)"
                      : "var(--io-surface-secondary)",
                    color: method.enabled
                      ? "var(--io-success)"
                      : "var(--io-text-muted)",
                  }}
                >
                  {method.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "var(--io-text-secondary)",
                }}
              >
                {method.description}
              </p>
              {method.warning && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "12px",
                    color: "var(--io-warning)",
                  }}
                >
                  {method.warning}
                </p>
              )}
            </div>
            <button
              onClick={() => handleToggle(method.id)}
              disabled={saving === method.id}
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                borderRadius: "var(--io-radius)",
                border: method.enabled
                  ? "1px solid var(--io-danger)"
                  : "1px solid var(--io-accent)",
                background: "transparent",
                color: method.enabled ? "var(--io-danger)" : "var(--io-accent)",
                fontSize: "13px",
                cursor: saving === method.id ? "not-allowed" : "pointer",
                opacity: saving === method.id ? 0.5 : 1,
              }}
            >
              {saving === method.id
                ? "Saving…"
                : method.enabled
                  ? "Disable"
                  : "Enable"}
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingToggle}
        onOpenChange={(v) => { if (!v) setPendingToggle(null); }}
        title={pendingToggle?.title ?? ""}
        description={pendingToggle?.description ?? ""}
        confirmLabel="Confirm"
        onConfirm={() => pendingToggle && doToggle(pendingToggle.id)}
      />
    </div>
  );
}

// ── Admin: Per-Role MFA Policies tab ─────────────────────────────────────────

const STUB_POLICIES: RoleMfaPolicy[] = [
  {
    role_id: "viewer",
    role_name: "Viewer",
    require_mfa: false,
    allowed_methods: ["totp", "sms", "email"],
    grace_period_hours: 24,
  },
  {
    role_id: "operator",
    role_name: "Operator",
    require_mfa: true,
    allowed_methods: ["totp", "sms"],
    grace_period_hours: 0,
  },
  {
    role_id: "analyst",
    role_name: "Analyst",
    require_mfa: false,
    allowed_methods: ["totp", "sms", "email"],
    grace_period_hours: 24,
  },
  {
    role_id: "supervisor",
    role_name: "Supervisor",
    require_mfa: true,
    allowed_methods: ["totp"],
    grace_period_hours: 0,
  },
  {
    role_id: "content_manager",
    role_name: "Content Manager",
    require_mfa: false,
    allowed_methods: ["totp", "sms", "email"],
    grace_period_hours: 24,
  },
  {
    role_id: "maintenance",
    role_name: "Maintenance",
    require_mfa: false,
    allowed_methods: ["totp", "sms", "email"],
    grace_period_hours: 24,
  },
  {
    role_id: "contractor",
    role_name: "Contractor",
    require_mfa: true,
    allowed_methods: ["totp"],
    grace_period_hours: 0,
  },
  {
    role_id: "admin",
    role_name: "Admin",
    require_mfa: true,
    allowed_methods: ["totp"],
    grace_period_hours: 0,
  },
];

const METHOD_LABELS: Record<string, string> = {
  totp: "TOTP",
  sms: "SMS",
  email: "Email",
  duo: "Duo",
};

function MfaPoliciesTab() {
  const [policies, setPolicies] = useState<RoleMfaPolicy[]>(STUB_POLICIES);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    roleId: string;
    current: boolean;
    roleName: string;
  } | null>(null);

  const handleRequireMfaToggle = (
    roleId: string,
    current: boolean,
    roleName: string,
  ) => {
    if (current) {
      setPendingConfirm({ roleId, current, roleName });
      return;
    }
    doToggleMfaRequirement(roleId, current);
  };

  const doToggleMfaRequirement = async (roleId: string, current: boolean) => {
    setSaving(roleId);
    try {
      await settingsApi.update(`mfa.policy.${roleId}.require_mfa`, !current);
    } catch {
      // Endpoint not yet available — update local state for demo
    } finally {
      setPolicies((prev) =>
        prev.map((p) =>
          p.role_id === roleId ? { ...p, require_mfa: !current } : p,
        ),
      );
      setSaving(null);
    }
  };

  return (
    <div>
      <h4
        style={{
          margin: "0 0 4px",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        Per-Role MFA Policies
      </h4>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
        }}
      >
        Configure whether each role requires MFA for login, which methods are
        permitted, and the grace period for new enrollments.
      </p>

      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}
      >
        <thead>
          <tr>
            {["Role", "Require MFA", "Allowed Methods", "Grace Period", ""].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--io-border)",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr
              key={policy.role_id}
              style={{ borderBottom: "1px solid var(--io-border)" }}
            >
              <td
                style={{
                  padding: "10px 12px",
                  fontWeight: 500,
                  color: "var(--io-text-primary)",
                }}
              >
                {policy.role_name}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: policy.require_mfa
                      ? "var(--io-success-subtle)"
                      : "var(--io-surface-secondary)",
                    color: policy.require_mfa
                      ? "var(--io-success)"
                      : "var(--io-text-muted)",
                  }}
                >
                  {policy.require_mfa ? "Required" : "Optional"}
                </span>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--io-text-secondary)",
                }}
              >
                {policy.allowed_methods
                  .map((m) => METHOD_LABELS[m] ?? m)
                  .join(", ")}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--io-text-secondary)",
                }}
              >
                {policy.grace_period_hours === 0
                  ? "None"
                  : `${policy.grace_period_hours}h`}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <button
                  onClick={() =>
                    handleRequireMfaToggle(
                      policy.role_id,
                      policy.require_mfa,
                      policy.role_name,
                    )
                  }
                  disabled={saving === policy.role_id}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "var(--io-radius)",
                    border: policy.require_mfa
                      ? "1px solid var(--io-danger)"
                      : "1px solid var(--io-accent)",
                    background: "transparent",
                    color: policy.require_mfa
                      ? "var(--io-danger)"
                      : "var(--io-accent)",
                    fontSize: "12px",
                    cursor:
                      saving === policy.role_id ? "not-allowed" : "pointer",
                    opacity: saving === policy.role_id ? 0.5 : 1,
                  }}
                >
                  {saving === policy.role_id
                    ? "…"
                    : policy.require_mfa
                      ? "Make Optional"
                      : "Require"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={!!pendingConfirm}
        onOpenChange={(v) => { if (!v) setPendingConfirm(null); }}
        title={`Remove MFA requirement for ${pendingConfirm?.roleName ?? ""}?`}
        description="Users in this role will be able to log in without MFA."
        confirmLabel="Remove Requirement"
        variant="danger"
        onConfirm={() =>
          pendingConfirm &&
          doToggleMfaRequirement(pendingConfirm.roleId, pendingConfirm.current)
        }
      />
    </div>
  );
}

// ── Main export: tabbed MFA Settings page ─────────────────────────────────────

export default function MfaSettings() {
  const [activeTab, setActiveTab] = useState<AdminTab>("methods");

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "methods", label: "Global Methods" },
    { id: "policies", label: "Per-Role Policies" },
  ];

  return (
    <div>
      <h3
        style={{
          margin: "0 0 4px",
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        MFA Configuration
      </h3>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
        }}
      >
        Configure system-wide MFA methods and per-role policies.
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          borderBottom: "1px solid var(--io-border)",
          marginBottom: "24px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--io-accent)"
                  : "2px solid transparent",
              background: "transparent",
              color:
                activeTab === tab.id
                  ? "var(--io-accent)"
                  : "var(--io-text-secondary)",
              fontSize: "13px",
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "methods" && <MfaMethodsTab />}
      {activeTab === "policies" && <MfaPoliciesTab />}
    </div>
  );
}
