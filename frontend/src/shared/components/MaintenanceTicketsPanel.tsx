import { useQuery } from "@tanstack/react-query";
import { importApi, type ImportTicket } from "../../api/import";

// ---------------------------------------------------------------------------
// Priority and status colors
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#4a9eff",
  new: "#4a9eff",
  in_progress: "#22c55e",
  on_hold: "#eab308",
  resolved: "#6b7280",
  closed: "#6b7280",
  cancelled: "#6b7280",
};

function PriorityDot({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
      title={priority}
    />
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        background: `${color}20`,
        color,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// MaintenanceTicketsPanel
// ---------------------------------------------------------------------------

interface MaintenanceTicketsPanelProps {
  sourceSystem?: string;
  status?: string;
  limit?: number;
  title?: string;
}

export function MaintenanceTicketsPanel({
  sourceSystem = "simblah_maint",
  status = "open",
  limit = 10,
  title = "Maintenance Tickets",
}: MaintenanceTicketsPanelProps) {
  const ticketsQuery = useQuery({
    queryKey: ["import-tickets", sourceSystem, status, limit],
    queryFn: async () => {
      const result = await importApi.listTickets({
        source_system: sourceSystem,
        status,
        limit,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 30000,
  });

  const tickets: ImportTicket[] = ticketsQuery.data ?? [];

  return (
    <div
      style={{
        background: "var(--io-surface)",
        border: "1px solid var(--io-border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--io-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
          {ticketsQuery.isFetching ? "Refreshing…" : `${tickets.length} open`}
        </span>
      </div>

      {ticketsQuery.isError && (
        <div
          style={{
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--io-danger)",
          }}
        >
          Failed to load tickets
        </div>
      )}

      {!ticketsQuery.isLoading && tickets.length === 0 && (
        <div
          style={{
            padding: "16px 14px",
            fontSize: 12,
            color: "var(--io-text-muted)",
            textAlign: "center",
          }}
        >
          No open tickets
        </div>
      )}

      {tickets.map((t: ImportTicket) => (
        <div
          key={t.id}
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--io-border-subtle)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <PriorityDot priority={t.priority} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--io-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={t.title}
            >
              {t.title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 3,
                flexWrap: "wrap",
              }}
            >
              <StatusPill status={t.status} />
              {t.assigned_to && (
                <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
                  {t.assigned_to}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                  marginLeft: "auto",
                }}
              >
                {relativeTime(t.created_at_source ?? t.created_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
