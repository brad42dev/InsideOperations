interface StatusBadgeProps {
  status: string;
  label?: string;
}

const STATUS_TOKENS: Record<string, { bg: string; color: string }> = {
  // success
  connected: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  active: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  ok: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  completed: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  healthy: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  sent: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  // accent
  running: { bg: "var(--io-accent-subtle)", color: "var(--io-accent)" },
  // warning
  warning: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  partial: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  pending: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  connecting: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  degraded: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  retry: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  // danger
  error: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
  disconnected: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
  inactive: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
  failed: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
  unhealthy: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
  // muted/neutral — --io-surface-tertiary is undefined; use --io-surface-secondary
  cancelled: {
    bg: "var(--io-surface-secondary)",
    color: "var(--io-text-muted)",
  },
  stopped: { bg: "var(--io-surface-secondary)", color: "var(--io-text-muted)" },
  unknown: { bg: "var(--io-surface-secondary)", color: "var(--io-text-muted)" },
};

const DEFAULT_TOKENS = {
  bg: "var(--io-surface-secondary)",
  color: "var(--io-text-muted)",
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const tokens = STATUS_TOKENS[status] ?? DEFAULT_TOKENS;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        background: tokens.bg,
        color: tokens.color,
        textTransform: "capitalize",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: tokens.color,
          flexShrink: 0,
        }}
      />
      {label ?? status}
    </span>
  );
}
