// ---------------------------------------------------------------------------
// Chart 15 — Data Table
// Live-updating table for multiple points. Columns: Tag Name, Description,
// Value, Quality, Timestamp. WebSocket for live values, getMeta for metadata.
// ---------------------------------------------------------------------------

import { useQueries } from "@tanstack/react-query";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { pointsApi } from "../../../../api/points";
import { type ChartConfig } from "../chart-config-types";
import { useContextMenu } from "../../../hooks/useContextMenu";
import ContextMenu from "../../ContextMenu";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

const CELL: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  borderBottom: "1px solid var(--io-border)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 160,
};

const HEADER: React.CSSProperties = {
  ...CELL,
  fontWeight: 600,
  color: "var(--io-text-muted)",
  fontSize: 11,
  position: "sticky",
  top: 0,
  background: "var(--io-surface)",
  zIndex: 1,
  borderBottom: "2px solid var(--io-border)",
};

export default function Chart15DataTable({ config }: RendererProps) {
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((s) => s.pointId);

  const { values } = useWebSocket(pointIds);
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<{ tagName: string; displayValue: string }>();

  // Fetch metadata for all points — useQueries handles dynamic array of queries
  // without violating Rules of Hooks (unlike calling useQuery in a loop).
  const metaQueries = useQueries({
    queries: pointIds.map((id) => ({
      queryKey: ["point-meta", id],
      queryFn: () => pointsApi.getMeta(id),
      staleTime: 60_000,
      enabled: !!id,
    })),
  });

  if (seriesSlots.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        No points configured
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...HEADER, width: "20%" }}>Tag Name</th>
            <th style={{ ...HEADER, width: "25%" }}>Description</th>
            <th style={{ ...HEADER, width: "18%", textAlign: "right" }}>
              Value
            </th>
            <th style={{ ...HEADER, width: "14%" }}>Quality</th>
            <th style={{ ...HEADER, width: "23%" }}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {seriesSlots.map((slot, i) => {
            const entry = values.get(slot.pointId);
            const metaResult = metaQueries[i]?.data;
            const meta = metaResult?.success ? metaResult.data : null;

            const tagName = meta?.name ?? slot.pointId;
            const description = meta?.description ?? "—";
            const unit = meta?.engineering_unit ?? "";
            const displayValue =
              entry !== undefined
                ? `${entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}${unit ? " " + unit : ""}`
                : "—";
            const quality = entry?.quality ?? "—";
            const timestamp = entry?.timestamp
              ? new Date(entry.timestamp).toLocaleTimeString()
              : "—";

            const rowBg =
              i % 2 === 0 ? "var(--io-surface)" : "var(--io-surface-raised)";
            const qualityColor =
              quality === "good" || quality === "Good"
                ? "#10B981"
                : quality === "—"
                  ? "var(--io-text-muted)"
                  : "#F59E0B";

            return (
              <tr
                key={slot.pointId}
                style={{ background: rowBg, cursor: "context-menu" }}
                onContextMenu={(e) => handleContextMenu(e, { tagName, displayValue })}
              >
                <td
                  style={{
                    ...CELL,
                    color: "var(--io-text-primary)",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                  title={slot.pointId}
                >
                  {tagName}
                </td>
                <td
                  style={{ ...CELL, color: "var(--io-text-secondary)" }}
                  title={description}
                >
                  {description}
                </td>
                <td
                  style={{
                    ...CELL,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--io-text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {displayValue}
                </td>
                <td style={{ ...CELL, color: qualityColor }}>{quality}</td>
                <td
                  style={{
                    ...CELL,
                    color: "var(--io-text-muted)",
                    fontSize: 11,
                  }}
                >
                  {timestamp}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "Copy Tag Name",
              onClick: () => {
                closeMenu();
                void navigator.clipboard.writeText(menuState.data?.tagName ?? "");
              },
            },
            {
              label: "Copy Value",
              onClick: () => {
                closeMenu();
                void navigator.clipboard.writeText(menuState.data?.displayValue ?? "");
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
