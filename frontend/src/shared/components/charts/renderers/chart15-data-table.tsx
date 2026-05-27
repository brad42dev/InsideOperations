// ---------------------------------------------------------------------------
// Chart 15 — Data Table
// Live-updating table for multiple points. Default mode: one row per point
// with Tag Name, Description, Value, Quality, Timestamp columns.
// Pivot mode: cross-tab with configurable row field, column time bucket, and
// value aggregator. Cells show the most-recent value per tag per bucket
// (full historical aggregation requires the history API).
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { pointsApi } from "../../../../api/points";
import { type ChartConfig, type AggregateType } from "../chart-config-types";
import { applyAggregate } from "../chart-aggregate";
import { useContextMenu } from "../../../hooks/useContextMenu";
import ContextMenu from "../../ContextMenu";
import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "../../../clipboard";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type PivotConfig = {
  rowField: "tagname" | "source" | "category";
  colField: "hour" | "shift" | "day";
  valueAggregator: AggregateType;
};

type PivotRow = Record<string, unknown>;

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

const EMPTY_CENTER: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--io-text-muted)",
  fontSize: 13,
  textAlign: "center",
  padding: "0 16px",
};

const ROW_FIELD_LABELS: Record<string, string> = {
  tagname: "Tag Name",
  source: "Source",
  category: "Category",
};

// ---------------------------------------------------------------------------
// Flat table (default mode)
// ---------------------------------------------------------------------------

function FlatDataTable({ config }: { config: ChartConfig }) {
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((s) => s.pointId);

  const visibleCols = (config.extras?.columns as string[] | undefined) ?? [
    "value",
    "quality",
    "timestamp",
    "description",
  ];
  const sortOrder =
    (config.extras?.sortOrder as string | undefined) ?? "newest";
  const liveMode = (config.extras?.refresh as string | undefined) !== "manual";

  const { values } = useWebSocket(liveMode ? pointIds : []);
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<{
    tagName: string;
    displayValue: string;
  }>();

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
      <div data-chart-ready="true" style={EMPTY_CENTER}>
        No points configured
      </div>
    );
  }

  const rows = seriesSlots.map((slot, i) => {
    const entry = values.get(slot.pointId);
    const metaResult = metaQueries[i]?.data;
    const meta = metaResult?.success ? metaResult.data : null;
    return { slot, entry, meta, i };
  });

  if (sortOrder === "newest") {
    rows.sort((a, b) => {
      const ta = a.entry?.timestamp ? new Date(a.entry.timestamp).getTime() : 0;
      const tb = b.entry?.timestamp ? new Date(b.entry.timestamp).getTime() : 0;
      return tb - ta;
    });
  } else {
    rows.sort((a, b) => {
      const ta = a.entry?.timestamp ? new Date(a.entry.timestamp).getTime() : 0;
      const tb = b.entry?.timestamp ? new Date(b.entry.timestamp).getTime() : 0;
      return ta - tb;
    });
  }

  return (
    <div
      data-chart-ready="true"
      style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
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
            {visibleCols.includes("description") && (
              <th style={{ ...HEADER, width: "25%" }}>Description</th>
            )}
            {visibleCols.includes("value") && (
              <th style={{ ...HEADER, width: "18%", textAlign: "right" }}>
                Value
              </th>
            )}
            {visibleCols.includes("quality") && (
              <th style={{ ...HEADER, width: "14%" }}>Quality</th>
            )}
            {visibleCols.includes("timestamp") && (
              <th style={{ ...HEADER, width: "23%" }}>Timestamp</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ slot, entry, meta }, ri) => {
            const tagName =
              meta?.name ?? slot.tagname ?? slot.label ?? "Unknown";
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
              ri % 2 === 0 ? "var(--io-surface)" : "var(--io-surface-raised)";
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
                onContextMenu={(e) =>
                  handleContextMenu(e, { tagName, displayValue })
                }
              >
                <td
                  style={{
                    ...CELL,
                    color: "var(--io-text-primary)",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                  title={tagName}
                >
                  {tagName}
                </td>
                {visibleCols.includes("description") && (
                  <td
                    style={{ ...CELL, color: "var(--io-text-secondary)" }}
                    title={description}
                  >
                    {description}
                  </td>
                )}
                {visibleCols.includes("value") && (
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
                )}
                {visibleCols.includes("quality") && (
                  <td style={{ ...CELL, color: qualityColor }}>{quality}</td>
                )}
                {visibleCols.includes("timestamp") && (
                  <td
                    style={{
                      ...CELL,
                      color: "var(--io-text-muted)",
                      fontSize: 11,
                    }}
                  >
                    {timestamp}
                  </td>
                )}
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
                const tagName = menuState.data?.tagName ?? "";
                void useIOClipboardStore.getState().writeToClipboard(
                  buildIOClipboardPayload({
                    originContext: "chart",
                    contents: {
                      points: tagName ? [{ tagname: tagName }] : [],
                      textRepresentation: tagName,
                    },
                  }),
                );
              },
            },
            {
              label: "Copy Value",
              onClick: () => {
                closeMenu();
                const displayValue = menuState.data?.displayValue ?? "";
                void useIOClipboardStore.getState().writeToClipboard(
                  buildIOClipboardPayload({
                    originContext: "chart",
                    contents: { textRepresentation: displayValue },
                  }),
                );
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pivot table
// ---------------------------------------------------------------------------

function PivotDataTable({
  config,
  pivot,
}: {
  config: ChartConfig;
  pivot: PivotConfig;
}) {
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((s) => s.pointId);

  const { values } = useWebSocket(pointIds);
  const metaQueries = useQueries({
    queries: pointIds.map((id) => ({
      queryKey: ["point-meta", id],
      queryFn: () => pointsApi.getMeta(id),
      staleTime: 60_000,
      enabled: !!id,
    })),
  });

  // Stable cache-key for metaQueries — the array reference changes every render
  // (useQueries returns a new array on each call), so we derive a string key.
  const metaQueriesKey = metaQueries.map((q) => q.dataUpdatedAt).join(",");

  // Build matrix: rowKey → colKey → samples[]
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, number[]>>();
    seriesSlots.forEach((slot, i) => {
      const entry = values.get(slot.pointId);
      if (entry === undefined) return;

      const metaResult = metaQueries[i]?.data;
      const meta = metaResult?.success ? metaResult.data : null;

      let rowKey: string;
      switch (pivot.rowField) {
        case "tagname":
          rowKey = meta?.name ?? slot.tagname ?? slot.label ?? "Unknown";
          break;
        case "source":
          rowKey = meta?.source_name ?? meta?.source_id ?? "unknown";
          break;
        case "category":
          rowKey = meta?.point_category ?? "uncategorized";
          break;
      }

      const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
      let colKey: string;
      switch (pivot.colField) {
        case "hour":
          colKey = ts.getHours().toString().padStart(2, "0") + ":00";
          break;
        case "shift": {
          const h = ts.getHours();
          // TODO: make shift boundaries configurable; currently hardcoded 06:00–18:00 day
          colKey = h >= 6 && h < 18 ? "Day" : "Night";
          break;
        }
        case "day":
          colKey = ts.toISOString().split("T")[0];
          break;
      }

      if (!m.has(rowKey)) m.set(rowKey, new Map());
      const rowMap = m.get(rowKey)!;
      if (!rowMap.has(colKey)) rowMap.set(colKey, []);
      rowMap.get(colKey)!.push(entry.value);
    });
    return m;
    // metaQueriesKey is a stable derived string from metaQueries.map(q=>q.dataUpdatedAt)
    // used instead of metaQueries directly to avoid defeating memoization (useQueries
    // returns a new array reference on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, metaQueriesKey, config.points, pivot.rowField, pivot.colField]);

  const rowKeys = useMemo(() => Array.from(matrix.keys()).sort(), [matrix]);

  const colKeys = useMemo(() => {
    const s = new Set<string>();
    matrix.forEach((colMap) => colMap.forEach((_, k) => s.add(k)));
    return Array.from(s).sort();
  }, [matrix]);

  const tableData = useMemo<PivotRow[]>(() => {
    return rowKeys.map((rk) => {
      const colMap = matrix.get(rk) ?? new Map<string, number[]>();
      const row: PivotRow = { rowKey: rk };
      colKeys.forEach((ck) => {
        const samples = colMap.get(ck);
        row[ck] = samples
          ? applyAggregate(pivot.valueAggregator, samples)
          : undefined;
      });
      return row;
    });
  }, [rowKeys, colKeys, matrix, pivot.valueAggregator]);

  const columns = useMemo<ColumnDef<PivotRow>[]>(
    () => [
      {
        id: "rowKey",
        accessorFn: (row) => row["rowKey"],
        header: ROW_FIELD_LABELS[pivot.rowField] ?? pivot.rowField,
        cell: (info) => String(info.getValue() ?? ""),
      },
      ...colKeys.map(
        (ck): ColumnDef<PivotRow> => ({
          id: ck,
          accessorFn: (row) => row[ck],
          header: ck,
          cell: (info) => {
            const v = info.getValue() as number | undefined;
            if (v === undefined || v === null) return "";
            if (Number.isNaN(v)) return "—";
            return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
          },
        }),
      ),
    ],
    [colKeys, pivot.rowField],
  );

  const table = useReactTable<PivotRow>({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (seriesSlots.length === 0) {
    return (
      <div data-chart-ready="true" style={EMPTY_CENTER}>
        No points configured
      </div>
    );
  }

  if (matrix.size === 0) {
    return (
      <div data-chart-ready="true" style={EMPTY_CENTER}>
        Waiting for data…
      </div>
    );
  }

  return (
    <div
      data-chart-ready="true"
      style={{ flex: 1, overflowX: "auto", overflowY: "auto", minHeight: 0 }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "auto",
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ ...HEADER, maxWidth: "none" }}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, ri) => (
            <tr
              key={row.id}
              style={{
                background:
                  ri % 2 === 0
                    ? "var(--io-surface)"
                    : "var(--io-surface-raised)",
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    ...CELL,
                    maxWidth: "none",
                    fontVariantNumeric:
                      cell.column.id !== "rowKey" ? "tabular-nums" : undefined,
                    textAlign:
                      cell.column.id !== "rowKey" ? "right" : undefined,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function Chart15DataTable({ config }: RendererProps) {
  const pivotMode = (config.extras?.pivotMode as boolean | undefined) ?? false;
  const pivotConfig = config.extras?.pivotConfig as PivotConfig | undefined;

  if (pivotMode) {
    if (!pivotConfig) {
      return (
        <div data-chart-ready="true" style={EMPTY_CENTER}>
          Configure pivot row/column/aggregator in Options.
        </div>
      );
    }
    return <PivotDataTable config={config} pivot={pivotConfig} />;
  }

  return <FlatDataTable config={config} />;
}
