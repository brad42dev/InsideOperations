import React from "react";

interface UnresolvedBinding {
  elementId: string;
  tag: string;
  reason: string;
}

interface ValidateBindingsDialogProps {
  open: boolean;
  onClose: () => void;
  unresolvedBindings: UnresolvedBinding[];
  totalBound: number;
  resolvedCount: number;
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: "40px",
  right: "16px",
  zIndex: 1060,
  width: "340px",
  maxHeight: "400px",
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: "1px solid var(--io-border)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--io-text-primary)",
};

function StatusIndicator({
  resolved,
  total,
}: {
  resolved: number;
  total: number;
}) {
  const unresolved = total - resolved;
  let color = "var(--io-success)";
  let label = "All resolved";
  if (unresolved > 0 && unresolved < total) {
    color = "var(--io-warning)";
    label = `${unresolved} unresolved`;
  } else if (total === 0) {
    color = "var(--io-text-muted)";
    label = "No bindings";
  } else if (unresolved === total) {
    color = "var(--io-danger)";
    label = "All unresolved";
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <svg width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4" fill={color} />
      </svg>
      <span style={{ fontSize: "12px", color }}>{label}</span>
    </div>
  );
}

export default function ValidateBindingsDialog({
  open,
  onClose,
  unresolvedBindings = [],
  totalBound,
  resolvedCount,
}: ValidateBindingsDialogProps) {
  if (!open) return null;

  const unresolvedCount = totalBound - resolvedCount;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Binding Validation</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--io-text-muted)",
            fontSize: "14px",
            lineHeight: 1,
          }}
        >
          {"\u00D7"}
        </button>
      </div>

      {/* Summary */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--io-border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            marginBottom: "6px",
          }}
        >
          <span style={{ color: "var(--io-text-secondary)" }}>
            Total bindings:
          </span>
          <span style={{ color: "var(--io-text-primary)", fontWeight: 500 }}>
            {totalBound}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            marginBottom: "6px",
          }}
        >
          <span style={{ color: "var(--io-text-secondary)" }}>Resolved:</span>
          <span style={{ color: "var(--io-success)", fontWeight: 500 }}>
            {resolvedCount}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "var(--io-text-secondary)" }}>Unresolved:</span>
          <span
            style={{
              color:
                unresolvedCount > 0
                  ? "var(--io-warning)"
                  : "var(--io-text-primary)",
              fontWeight: 500,
            }}
          >
            {unresolvedCount}
          </span>
        </div>
        <StatusIndicator resolved={resolvedCount} total={totalBound} />
      </div>

      {/* Unresolved list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {unresolvedBindings.length === 0 ? (
          <div
            style={{
              padding: "16px",
              fontSize: "12px",
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            {totalBound === 0
              ? "No point bindings configured."
              : "All bindings resolved successfully."}
          </div>
        ) : (
          unresolvedBindings.map((ub) => (
            <div
              key={ub.elementId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                fontSize: "12px",
                borderBottom: "1px solid var(--io-border-subtle)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M6 1L11 10H1L6 1Z"
                  fill="none"
                  stroke="var(--io-warning)"
                  strokeWidth="1.2"
                />
                <line
                  x1="6"
                  y1="4.5"
                  x2="6"
                  y2="7"
                  stroke="var(--io-warning)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                <circle cx="6" cy="8.2" r="0.5" fill="var(--io-warning)" />
              </svg>
              <span
                style={{
                  color: "var(--io-text-primary)",
                  fontWeight: 500,
                  minWidth: "60px",
                }}
              >
                {ub.elementId}
              </span>
              <span
                style={{
                  color: "var(--io-text-muted)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ub.tag}
              </span>
              <span
                style={{
                  color: "var(--io-warning)",
                  fontSize: "11px",
                  flexShrink: 0,
                }}
              >
                {ub.reason}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
