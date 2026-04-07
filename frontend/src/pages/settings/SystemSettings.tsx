import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SettingsTabs } from "../../shared/components/SettingsTabs";
import SettingsPageLayout from "./SettingsPageLayout";
import { ArchiveTab } from "./ArchiveSettings";
import { BackupTab } from "./BackupRestore";
import { api } from "../../api/client";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppSettings {
  "system.site_name": string;
  "system.timezone": string;
  "system.default_idle_timeout_minutes": string;
  "system.date_format": string;
  "system.time_format": string;
}

/** One hostname → certificate binding. cert_name is empty string for "none". */
interface HostnameEntry {
  hostname: string;
  cert_name: string;
}

/** Minimal cert info needed for the certificate selector. */
interface InstalledCert {
  name: string;
  not_after: string;
  days_remaining: number;
  is_expired: boolean;
  subject: string;
}

// ---------------------------------------------------------------------------
// Common IANA timezones grouped by region
// ---------------------------------------------------------------------------

const TIMEZONE_GROUPS: {
  label: string;
  zones: { value: string; label: string }[];
}[] = [
  {
    label: "UTC / Universal",
    zones: [
      { value: "UTC", label: "UTC" },
      { value: "Etc/UTC", label: "Etc/UTC" },
    ],
  },
  {
    label: "North America",
    zones: [
      { value: "America/New_York", label: "Eastern Time (New York)" },
      { value: "America/Chicago", label: "Central Time (Chicago)" },
      { value: "America/Denver", label: "Mountain Time (Denver)" },
      { value: "America/Phoenix", label: "Mountain Time — Arizona (no DST)" },
      { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
      { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
      { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
      { value: "America/Toronto", label: "Eastern Time (Toronto)" },
      { value: "America/Vancouver", label: "Pacific Time (Vancouver)" },
      {
        value: "America/Regina",
        label: "Central Time — Saskatchewan (no DST)",
      },
      { value: "America/Mexico_City", label: "Central Time (Mexico City)" },
      { value: "America/Sao_Paulo", label: "Brasília Time (São Paulo)" },
      {
        value: "America/Argentina/Buenos_Aires",
        label: "Argentina Time (Buenos Aires)",
      },
      { value: "America/Bogota", label: "Colombia Time (Bogotá)" },
    ],
  },
  {
    label: "Europe",
    zones: [
      { value: "Europe/London", label: "GMT/BST (London)" },
      { value: "Europe/Dublin", label: "IST/GMT (Dublin)" },
      { value: "Europe/Lisbon", label: "WET/WEST (Lisbon)" },
      { value: "Europe/Paris", label: "CET/CEST (Paris)" },
      { value: "Europe/Berlin", label: "CET/CEST (Berlin)" },
      { value: "Europe/Amsterdam", label: "CET/CEST (Amsterdam)" },
      { value: "Europe/Brussels", label: "CET/CEST (Brussels)" },
      { value: "Europe/Madrid", label: "CET/CEST (Madrid)" },
      { value: "Europe/Rome", label: "CET/CEST (Rome)" },
      { value: "Europe/Warsaw", label: "CET/CEST (Warsaw)" },
      { value: "Europe/Stockholm", label: "CET/CEST (Stockholm)" },
      { value: "Europe/Helsinki", label: "EET/EEST (Helsinki)" },
      { value: "Europe/Athens", label: "EET/EEST (Athens)" },
      { value: "Europe/Istanbul", label: "TRT (Istanbul)" },
      { value: "Europe/Moscow", label: "MSK (Moscow)" },
      { value: "Europe/Kyiv", label: "EET/EEST (Kyiv)" },
    ],
  },
  {
    label: "Middle East & Africa",
    zones: [
      { value: "Asia/Dubai", label: "GST (Dubai)" },
      { value: "Asia/Riyadh", label: "AST (Riyadh)" },
      { value: "Africa/Cairo", label: "EET (Cairo)" },
      { value: "Africa/Lagos", label: "WAT (Lagos)" },
      { value: "Africa/Nairobi", label: "EAT (Nairobi)" },
      { value: "Africa/Johannesburg", label: "SAST (Johannesburg)" },
    ],
  },
  {
    label: "Asia & Pacific",
    zones: [
      { value: "Asia/Kolkata", label: "IST (Kolkata/Mumbai)" },
      { value: "Asia/Dhaka", label: "BST (Dhaka)" },
      { value: "Asia/Bangkok", label: "ICT (Bangkok)" },
      { value: "Asia/Singapore", label: "SGT (Singapore)" },
      { value: "Asia/Kuala_Lumpur", label: "MYT (Kuala Lumpur)" },
      { value: "Asia/Jakarta", label: "WIB (Jakarta)" },
      { value: "Asia/Hong_Kong", label: "HKT (Hong Kong)" },
      { value: "Asia/Shanghai", label: "CST (Shanghai/Beijing)" },
      { value: "Asia/Taipei", label: "CST (Taipei)" },
      { value: "Asia/Seoul", label: "KST (Seoul)" },
      { value: "Asia/Tokyo", label: "JST (Tokyo)" },
      { value: "Australia/Sydney", label: "AEST/AEDT (Sydney)" },
      { value: "Australia/Melbourne", label: "AEST/AEDT (Melbourne)" },
      { value: "Australia/Brisbane", label: "AEST (Brisbane, no DST)" },
      { value: "Australia/Perth", label: "AWST (Perth)" },
      { value: "Pacific/Auckland", label: "NZST/NZDT (Auckland)" },
      { value: "Pacific/Fiji", label: "FJT (Fiji)" },
    ],
  },
];

// ---------------------------------------------------------------------------
// General settings tab
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = {
  "system.site_name": "Inside/Operations",
  "system.timezone": "UTC",
  "system.default_idle_timeout_minutes": "30",
  "system.date_format": "MMM D, YYYY",
  "system.time_format": "HH:mm:ss",
};

const DEFAULT_HOSTNAMES: HostnameEntry[] = [{ hostname: "", cert_name: "" }];

function GeneralTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hostnames, setHostnames] =
    useState<HostnameEntry[]>(DEFAULT_HOSTNAMES);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { isLoading } = useQuery({
    queryKey: ["app-settings-general"],
    queryFn: async () => {
      const res = await api.get<Record<string, string>>(
        "/api/settings?category=system",
      );
      if (res.success && res.data) {
        const raw = res.data as Record<string, string>;
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(raw).filter(([k]) => k in DEFAULT_SETTINGS),
          ),
        }));
        // Hostnames are stored as JSON under "system.hostnames"
        if (raw["system.hostnames"]) {
          try {
            const parsed = JSON.parse(
              raw["system.hostnames"],
            ) as HostnameEntry[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHostnames(parsed);
            }
          } catch {
            // ignore malformed JSON; keep default
          }
        }
      }
      return res;
    },
  });

  // Fetch installed certificates for the cert selector in hostname rows
  // Use a distinct query key from the Certificates page to avoid sharing a
  // cache entry that has a different declared type shape.
  const { data: certsResult } = useQuery({
    queryKey: ["certificates-selector"],
    queryFn: () => api.get<{ data: InstalledCert[] }>("/api/certificates"),
    staleTime: 60_000,
  });
  const installedCerts: InstalledCert[] =
    certsResult?.success && Array.isArray(certsResult.data?.data)
      ? certsResult.data.data
      : [];

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await api.put<Record<string, string>>("/api/settings", {
        settings: {
          ...form,
          "system.hostnames": JSON.stringify(
            hostnames.filter((h) => h.hostname.trim()),
          ),
        },
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      setSaved(true);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["app-settings-general"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (key: keyof AppSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError("");
  };

  const setHostnameEntry = (
    index: number,
    field: keyof HostnameEntry,
    value: string,
  ) => {
    setHostnames((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    );
    setSaved(false);
    setError("");
  };

  const addHostname = () => {
    setHostnames((prev) => [...prev, { hostname: "", cert_name: "" }]);
  };

  const removeHostname = (index: number) => {
    setHostnames((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  // Compute a preview of the current timezone offset
  const [tzPreview, setTzPreview] = useState("");
  useEffect(() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: form["system.timezone"],
        timeZoneName: "longOffset",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = fmt.formatToParts(new Date());
      const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
      setTzPreview(
        `Current time: ${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value} ${offset}`,
      );
    } catch {
      setTzPreview("");
    }
  }, [form["system.timezone"]]);

  if (isLoading) {
    return (
      <div style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "720px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {/* Site Identity */}
      <section>
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Site Identity
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Site Name</label>
            <input
              style={inputStyle}
              value={form["system.site_name"]}
              onChange={(e) => set("system.site_name", e.target.value)}
              placeholder="Inside/Operations"
            />
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
              }}
            >
              Displayed in the browser tab, login page, and email templates.
            </p>
          </div>
          {/* Hostname → Certificate bindings */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Server Hostnames &amp; Certificates
              </label>
              <button
                type="button"
                onClick={addHostname}
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-accent)",
                  borderRadius: "var(--io-radius)",
                  padding: "3px 10px",
                  fontSize: "12px",
                  color: "var(--io-accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                + Add Hostname
              </button>
            </div>

            <div
              style={{
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                overflow: "hidden",
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 32px",
                  gap: "0",
                  background: "var(--io-surface-secondary)",
                  borderBottom: "1px solid var(--io-border)",
                  padding: "8px 12px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Hostname / IP
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    paddingLeft: "10px",
                  }}
                >
                  TLS Certificate
                </span>
                <span />
              </div>

              {hostnames.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 32px",
                    gap: "0",
                    alignItems: "center",
                    borderBottom:
                      i < hostnames.length - 1
                        ? "1px solid var(--io-border-subtle, var(--io-border))"
                        : "none",
                    padding: "8px 12px",
                  }}
                >
                  <input
                    style={{
                      ...inputStyle,
                      margin: 0,
                      borderRadius: "var(--io-radius)",
                      fontSize: "13px",
                    }}
                    value={entry.hostname}
                    onChange={(e) =>
                      setHostnameEntry(i, "hostname", e.target.value)
                    }
                    placeholder="io.example.com or 192.168.1.100"
                  />
                  <div style={{ paddingLeft: "10px" }}>
                    <select
                      style={{
                        ...inputStyle,
                        margin: 0,
                        fontSize: "13px",
                      }}
                      value={entry.cert_name}
                      onChange={(e) =>
                        setHostnameEntry(i, "cert_name", e.target.value)
                      }
                    >
                      <option value="">— No certificate assigned —</option>
                      {installedCerts.map((cert) => {
                        const statusText = cert.is_expired
                          ? " [EXPIRED]"
                          : cert.days_remaining < 30
                            ? ` [expires in ${cert.days_remaining}d]`
                            : "";
                        return (
                          <option key={cert.name} value={cert.name}>
                            {cert.name}
                            {statusText}
                          </option>
                        );
                      })}
                      {installedCerts.length === 0 && (
                        <option disabled value="">
                          No certificates installed — go to Provision tab
                        </option>
                      )}
                    </select>
                    {entry.cert_name &&
                      (() => {
                        const cert = installedCerts.find(
                          (c) => c.name === entry.cert_name,
                        );
                        if (!cert) return null;
                        return (
                          <div
                            style={{
                              marginTop: "3px",
                              fontSize: "11px",
                              color: cert.is_expired
                                ? "var(--io-danger)"
                                : cert.days_remaining < 30
                                  ? "var(--io-warning)"
                                  : "var(--io-text-muted)",
                            }}
                          >
                            {cert.subject} — expires{" "}
                            {new Date(cert.not_after).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </div>
                        );
                      })()}
                  </div>
                  <div style={{ paddingLeft: "8px" }}>
                    {hostnames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHostname(i)}
                        title="Remove hostname"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--io-text-muted)",
                          cursor: "pointer",
                          fontSize: "16px",
                          lineHeight: 1,
                          padding: "2px 4px",
                          borderRadius: "var(--io-radius)",
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
                lineHeight: 1.5,
              }}
            >
              Each hostname can have a dedicated TLS certificate. Used in email
              links, certificate provisioning, and SAML callback URLs. Add
              certificates in{" "}
              <strong>Settings → Certificates → Provision</strong> or upload
              them in the Installed tab.
            </p>
          </div>
        </div>
      </section>

      <div style={{ borderTop: "1px solid var(--io-border)" }} />

      {/* Locale & Time */}
      <section>
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Locale &amp; Time
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Server Timezone</label>
            <select
              style={inputStyle}
              value={form["system.timezone"]}
              onChange={(e) => set("system.timezone", e.target.value)}
            >
              {TIMEZONE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.zones.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {tzPreview && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                }}
              >
                {tzPreview}
              </p>
            )}
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
              }}
            >
              Affects report timestamps, scheduled backup times, shift
              schedules, and alarm activation times. Changing this setting does
              not re-timestamp historical data — it only affects new records and
              display formatting.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label style={labelStyle}>Date Format</label>
              <select
                style={inputStyle}
                value={form["system.date_format"]}
                onChange={(e) => set("system.date_format", e.target.value)}
              >
                <option value="MMM D, YYYY">Jan 15, 2026</option>
                <option value="YYYY-MM-DD">2026-01-15 (ISO 8601)</option>
                <option value="MM/DD/YYYY">01/15/2026 (US)</option>
                <option value="DD/MM/YYYY">15/01/2026 (EU)</option>
                <option value="DD.MM.YYYY">15.01.2026 (EU dot)</option>
                <option value="D MMMM YYYY">15 January 2026</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Time Format</label>
              <select
                style={inputStyle}
                value={form["system.time_format"]}
                onChange={(e) => set("system.time_format", e.target.value)}
              >
                <option value="HH:mm:ss">
                  24-hour with seconds (14:30:00)
                </option>
                <option value="HH:mm">24-hour without seconds (14:30)</option>
                <option value="h:mm:ss A">
                  12-hour with seconds (2:30:00 PM)
                </option>
                <option value="h:mm A">
                  12-hour without seconds (2:30 PM)
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <div style={{ borderTop: "1px solid var(--io-border)" }} />

      {/* Session Policy */}
      <section>
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Session Policy
        </h3>
        <div>
          <label style={labelStyle}>Default Idle Timeout (minutes)</label>
          <input
            style={{ ...inputStyle, maxWidth: "160px" }}
            type="number"
            min={5}
            max={1440}
            value={form["system.default_idle_timeout_minutes"]}
            onChange={(e) =>
              set("system.default_idle_timeout_minutes", e.target.value)
            }
          />
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "11px",
              color: "var(--io-text-muted)",
            }}
          >
            System-wide fallback. Individual roles can override this value under
            Identity &amp; Access → Roles. Set to 0 for no timeout (not
            recommended for production).
          </p>
        </div>
      </section>

      {/* Feedback */}
      {(saved || error || saveMut.isPending) && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--io-radius)",
            background: error
              ? "var(--io-danger-subtle)"
              : "color-mix(in srgb, var(--io-success) 12%, transparent)",
            color: error ? "var(--io-danger)" : "var(--io-success)",
            fontSize: "13px",
          }}
        >
          {saveMut.isPending ? "Saving…" : error ? error : "Settings saved."}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          style={btnPrimary}
        >
          {saveMut.isPending ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={() => {
            setForm(DEFAULT_SETTINGS);
            setHostnames(DEFAULT_HOSTNAMES);
          }}
          style={btnSecondary}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = "general" | "archive" | "backup";

const TABS = [
  { id: "general", label: "General" },
  { id: "archive", label: "Archive" },
  { id: "backup", label: "Backup & Restore" },
];

export default function SystemSettings() {
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    urlTab === "backup"
      ? "backup"
      : urlTab === "archive"
        ? "archive"
        : "general",
  );

  return (
    <SettingsPageLayout
      title="System"
      description="General configuration, archive retention, backup management, and system maintenance."
    >
      <SettingsTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "archive" && <ArchiveTab />}
        {activeTab === "backup" && <BackupTab />}
      </SettingsTabs>
    </SettingsPageLayout>
  );
}
