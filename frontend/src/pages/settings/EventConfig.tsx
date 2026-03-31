// ISA-18.2 alarm and event configuration — informational page (API arrives in Phase 9)

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: "8px",
  padding: "var(--io-space-5)",
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--io-text-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  marginBottom: 8,
};

const ITEM_TITLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--io-text-primary)",
  marginBottom: 4,
};

const ITEM_DESC: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--io-text-secondary)",
  lineHeight: 1.55,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CONFIG_AREAS = [
  {
    title: "Alarm Shelving Policies",
    desc: "Define the maximum shelving duration for process alarms, automatic re-alarm intervals after the shelve period expires, and per-priority shelving permission rules. Shelving follows ISA-18.2 §5.7.",
    icon: "⏱",
  },
  {
    title: "Priority Definitions",
    desc: "Configure the four-tier priority scheme (Critical/High/Medium/Low, mapped to ISA-18.2 HH/H/L/LL). Assign display colors, acknowledgement time-out targets, and escalation thresholds for each tier.",
    icon: "🔢",
  },
  {
    title: "ISA-18.2 State Machine",
    desc: "Tune the lifecycle transitions: Normal → Unacknowledged → Acknowledged → Shelved → Suppressed → Out-of-Service. Set suppression rules, out-of-service overrides, and design-mode bypass behavior.",
    icon: "🔄",
  },
  {
    title: "Dead-band and Hysteresis",
    desc: "Per-priority dead-band values prevent alarm chattering when a process variable oscillates near a trip point. Configure both absolute and percentage-of-span hysteresis per alarm class.",
    icon: "📊",
  },
  {
    title: "Event Logging Retention",
    desc: "Set how long alarm and event records are retained in the time-series store. Separate retention windows apply to active alarms, historical events, and audit trail entries.",
    icon: "🗄",
  },
  {
    title: "Operator Action Audit",
    desc: "Control which operator actions are captured in the event log: acknowledgements, shelves, suppression changes, out-of-service transitions, and forced state overrides.",
    icon: "📋",
  },
];

const PRIORITY_ROWS = [
  {
    tier: "Critical (HH)",
    color: "#ef4444",
    resp: "< 5 min",
    example: "Emergency shutdown, fire/gas trip",
  },
  {
    tier: "High (H)",
    color: "#f97316",
    resp: "< 15 min",
    example: "Process limit exceeded, equipment fault",
  },
  {
    tier: "Medium (L)",
    color: "#eab308",
    resp: "< 60 min",
    example: "Off-spec condition, maintenance required",
  },
  {
    tier: "Low (LL)",
    color: "#3b82f6",
    resp: "Next shift",
    example: "Advisory, informational",
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventConfig() {
  return (
    <div style={{ padding: "var(--io-space-6)", maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--io-space-6)" }}>
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          Event &amp; Alarm Configuration
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "var(--io-text-secondary)",
            lineHeight: 1.55,
          }}
        >
          ISA-18.2 alarm management configuration — shelving policies, priority
          definitions, state machine behavior, and event retention.
        </p>
      </div>

      {/* Coming soon banner */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          padding: "14px 18px",
          borderRadius: "8px",
          background: "var(--io-accent-subtle)",
          border: "1px solid var(--io-accent)",
          marginBottom: "var(--io-space-6)",
        }}
      >
        <span style={{ fontSize: "20px", lineHeight: 1 }}>🔔</span>
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--io-accent)",
            }}
          >
            Available in Phase 9
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            The event and alarm configuration UI is scheduled for Phase 9,
            alongside the alarm definitions API and the ISA-18.2 state machine
            service. In the meantime, alarm thresholds and shelving policies are
            managed server-side. Contact your system administrator to adjust
            these settings.
          </p>
        </div>
      </div>

      {/* Config areas */}
      <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>
        Configuration Areas
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--io-space-3)",
          marginBottom: "var(--io-space-6)",
        }}
      >
        {CONFIG_AREAS.map((area) => (
          <div
            key={area.title}
            style={{
              ...CARD,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>
              {area.icon}
            </span>
            <div>
              <div style={ITEM_TITLE}>{area.title}</div>
              <p style={ITEM_DESC}>{area.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Priority table */}
      <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>
        ISA-18.2 Priority Tiers
      </div>
      <div
        style={{
          ...CARD,
          padding: 0,
          overflow: "hidden",
          marginBottom: "var(--io-space-6)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            fontSize: "13px",
          }}
        >
          <thead>
            <tr>
              {["Priority", "Response Target", "Typical Use"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left" as const,
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-muted)",
                    fontWeight: 600,
                    fontSize: "11px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                    background: "var(--io-surface-secondary)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRIORITY_ROWS.map((row) => (
              <tr key={row.tier}>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--io-border)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: row.color,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    {row.tier}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-secondary)",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                >
                  {row.resp}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-muted)",
                    fontSize: "12px",
                  }}
                >
                  {row.example}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* State machine diagram (text) */}
      <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>
        ISA-18.2 State Machine
      </div>
      <div style={{ ...CARD, marginBottom: "var(--io-space-6)" }}>
        <div
          style={{
            display: "flex",
            gap: 0,
            alignItems: "center",
            flexWrap: "wrap" as const,
            rowGap: 8,
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          {[
            "Normal",
            "Unacknowledged",
            "Acknowledged",
            "Shelved",
            "Suppressed",
            "Out-of-Service",
          ].map((state, i, arr) => (
            <span
              key={state}
              style={{ display: "flex", alignItems: "center", gap: 0 }}
            >
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  color: "var(--io-text-primary)",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {state}
              </span>
              {i < arr.length - 1 && (
                <span
                  style={{ color: "var(--io-text-muted)", padding: "0 4px" }}
                >
                  →
                </span>
              )}
            </span>
          ))}
        </div>
        <p
          style={{
            margin: "var(--io-space-3) 0 0",
            fontSize: "12px",
            color: "var(--io-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Alarm lifecycle per ISA-18.2 §5.3. Each transition is logged to the
          event audit trail with operator ID, timestamp, and reason code. Phase
          9 will expose transition rules, timeout thresholds, and suppression
          group configuration through this UI.
        </p>
      </div>

      {/* Admin note */}
      <div
        style={{
          padding: "14px 16px",
          background: "var(--io-surface-secondary)",
          borderRadius: "8px",
          border: "1px solid var(--io-border)",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "var(--io-text-primary)" }}>
          Server-side configuration
        </strong>{" "}
        — Until Phase 9, alarm limits, priority thresholds, and shelving
        policies are defined in the Event Service configuration file (
        <code style={{ fontFamily: "monospace", fontSize: "12px" }}>
          event-service.toml
        </code>
        ). Contact your system administrator to apply changes. Alarm definitions
        for individual process points are configured in the{" "}
        <strong>OPC Sources</strong> and <strong>Point Management</strong>{" "}
        settings pages.
      </div>
    </div>
  );
}
