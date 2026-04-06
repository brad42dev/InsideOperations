import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { roundsApi, type RoundHistoryEntry } from "../../api/rounds";
import { ExportButton } from "../../shared/components/ExportDialog";
import { useNavigate } from "react-router-dom";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    completed: { bg: "rgba(34,197,94,0.12)", text: "var(--io-alarm-normal)" },
    missed: { bg: "rgba(239,68,68,0.12)", text: "var(--io-alarm-critical)" },
    transferred: {
      bg: "rgba(168,85,247,0.12)",
      text: "var(--io-alarm-suppressed)",
    },
  };
  const c = map[status] ?? {
    bg: "var(--io-surface-secondary)",
    text: "var(--io-text-muted)",
  };
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "100px",
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const HISTORY_COLUMNS = [
  { id: "template_name", label: "Template" },
  { id: "status", label: "Status" },
  { id: "started_at", label: "Started" },
  { id: "completed_at", label: "Completed" },
  { id: "response_count", label: "Responses" },
  { id: "out_of_range_count", label: "Out of Range" },
];

export default function RoundHistory() {
  const navigate = useNavigate();
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(weekAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<RoundHistoryEntry>();

  const { data, isLoading } = useQuery({
    queryKey: ["rounds", "history", from, to],
    queryFn: () =>
      roundsApi.getHistory({
        from: from ? `${from}T00:00:00Z` : undefined,
        to: to ? `${to}T23:59:59Z` : undefined,
      }),
  });

  const entries = data?.success ? data.data : [];

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "6px",
    color: "var(--io-text-primary)",
    fontSize: "13px",
  };

  return (
    <div
      style={{
        padding: "var(--io-space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
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
          Round History
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "14px",
            color: "var(--io-text-secondary)",
          }}
        >
          Completed and missed inspection rounds.
        </p>
      </div>

      {/* Date range filter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "var(--io-text-secondary)",
          }}
        >
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "var(--io-text-secondary)",
          }}
        >
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={inputStyle}
          />
        </label>
        <span style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          {isLoading
            ? "Loading…"
            : `${entries.length} record${entries.length !== 1 ? "s" : ""}`}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <ExportButton
            module="rounds"
            entity="Round History"
            filteredRowCount={entries.length}
            totalRowCount={entries.length}
            activeFilters={{
              from: from ? `${from}T00:00:00Z` : undefined,
              to: to ? `${to}T23:59:59Z` : undefined,
            }}
            availableColumns={HISTORY_COLUMNS}
            visibleColumns={HISTORY_COLUMNS.map((c) => c.id)}
          />
        </div>
      </div>

      {/* Results table */}
      <div
        style={{
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr style={{ background: "var(--io-surface-secondary)" }}>
              {[
                "Template",
                "Status",
                "Started",
                "Completed",
                "Responses",
                "Out of Range",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: "1px solid var(--io-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "var(--io-text-muted)",
                    fontSize: "14px",
                  }}
                >
                  {isLoading ? "Loading…" : "No rounds found for this period."}
                </td>
              </tr>
            ) : (
              entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                  style={{
                    background:
                      i % 2 === 0
                        ? "transparent"
                        : "var(--io-surface-secondary)",
                    cursor: "context-menu",
                  }}
                >
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--io-text-primary)",
                      fontWeight: 500,
                      maxWidth: "240px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.template_name}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {statusBadge(entry.status)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--io-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(entry.started_at)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--io-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(entry.completed_at)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {entry.response_count}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {entry.out_of_range_count > 0 ? (
                      <span
                        style={{
                          color: "var(--io-alarm-critical)",
                          fontWeight: 600,
                        }}
                      >
                        {entry.out_of_range_count}
                      </span>
                    ) : (
                      <span style={{ color: "var(--io-text-muted)" }}>0</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "View",
              onClick: () => {
                closeMenu();
                navigate(`/rounds/${menuState.data!.id}`);
              },
            },
            {
              label: "Print",
              permission: "rounds:read",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Export",
              permission: "rounds:read",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Delete",
              danger: true,
              divider: true,
              permission: "rounds:write",
              onClick: () => {
                closeMenu();
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
