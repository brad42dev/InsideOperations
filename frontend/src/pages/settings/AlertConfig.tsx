import { useNavigate } from "react-router-dom";

// Alert configuration links to the Alerts module sub-pages for managing
// templates and groups. Escalation policies are configured server-side.
export default function AlertConfig() {
  const navigate = useNavigate();

  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    background: "var(--io-surface)",
    border: "1px solid var(--io-border)",
    borderRadius: "8px",
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <div
      style={{
        padding: "var(--io-space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "640px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          Alert System
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "14px",
            color: "var(--io-text-secondary)",
          }}
        >
          Configure alert templates, recipient groups, and escalation routing.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          {
            label: "Alert Templates",
            desc: "Pre-configured message templates for common emergency events",
            path: "/alerts/templates",
          },
          {
            label: "Recipient Groups",
            desc: "Static and dynamic groups for alert routing",
            path: "/alerts/groups",
          },
          {
            label: "Active Alerts",
            desc: "View and manage currently active notifications",
            path: "/alerts/active",
          },
          {
            label: "Alert History",
            desc: "Audit log of all sent alerts and delivery status",
            path: "/alerts/history",
          },
        ].map(({ label, desc, path }) => (
          <div
            key={path}
            style={linkStyle}
            onClick={() => navigate(path)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--io-accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--io-border)")
            }
          >
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--io-text-primary)",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  marginTop: "2px",
                }}
              >
                {desc}
              </div>
            </div>
            <span style={{ color: "var(--io-text-muted)", fontSize: "18px" }}>
              ›
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "16px",
          background: "var(--io-surface-secondary)",
          borderRadius: "8px",
          border: "1px solid var(--io-border)",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
        }}
      >
        <strong style={{ color: "var(--io-text-primary)" }}>
          Escalation Policies
        </strong>{" "}
        — Advanced escalation routing and shift-aware delivery are configured in
        the backend Alert Service configuration file. Contact your system
        administrator to modify escalation policies.
      </div>
    </div>
  );
}
