import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { forensicsApi, type ThresholdExceedance } from "../../api/forensics";
import { pointsApi } from "../../api/points";
import DataTable, { type ColumnDef } from "../../shared/components/DataTable";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import EChart from "../../shared/components/charts/EChart";
import type { EChartsOption } from "echarts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Operator = ">" | "<" | ">=" | "<=" | "=";
type LookbackDays = 7 | 30 | 90 | 365;
type ViewMode = "list" | "trend";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

// ---------------------------------------------------------------------------
// ThresholdSearch
// ---------------------------------------------------------------------------

export default function ThresholdSearch() {
  const navigate = useNavigate();

  const [pointId, setPointId] = useState("");
  const [operator, setOperator] = useState<Operator>(">");
  const [threshold, setThreshold] = useState("");
  const [lookback, setLookback] = useState<LookbackDays>(30);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedExceedance, setSelectedExceedance] =
    useState<ThresholdExceedance | null>(null);
  const [creatingFor, setCreatingFor] = useState<ThresholdExceedance | null>(
    null,
  );

  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<ThresholdExceedance>();

  const searchMutation = useMutation({
    mutationFn: async () => {
      const numThreshold = parseFloat(threshold);
      if (!pointId.trim() || isNaN(numThreshold)) {
        throw new Error("Point ID and a valid threshold are required.");
      }
      const result = await forensicsApi.thresholdSearch({
        point_id: pointId.trim(),
        operator,
        threshold: numThreshold,
        lookback_days: lookback,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const createInvestigationMutation = useMutation({
    mutationFn: async (exceedance: ThresholdExceedance) => {
      const name = `Threshold ${operator}${threshold} on ${pointId} — ${new Date(exceedance.start).toLocaleDateString()}`;
      const result = await forensicsApi.createInvestigation({
        name,
        anchor_point_id: pointId.trim(),
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      setCreatingFor(null);
      navigate(`/forensics/${data.id}`);
    },
  });

  const exceedances = searchMutation.data ?? [];

  // ---------------------------------------------------------------------------
  // History data for trend view
  // ---------------------------------------------------------------------------

  // Compute the time window that matches the lookback selector
  const historyRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - lookback * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [lookback]);

  const historyQuery = useQuery({
    queryKey: ["threshold-trend", pointId, lookback],
    queryFn: async () => {
      const result = await pointsApi.getHistory(pointId.trim(), {
        start: historyRange.start,
        end: historyRange.end,
        limit: 1000,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    // Only fetch when in trend view and a successful search has been done
    enabled:
      viewMode === "trend" && searchMutation.isSuccess && !!pointId.trim(),
    staleTime: 60_000,
  });

  // Build ECharts option from history + exceedances
  const trendOption = useMemo(() => {
    const rows = historyQuery.data ?? [];
    const thresholdNum = parseFloat(threshold);

    const seriesData: [number, number][] = rows
      .filter((r) => r.value !== null && r.value !== undefined)
      .map((r) => [new Date(r.time).getTime(), r.value as number]);

    const markAreas: [
      { xAxis: number; itemStyle: { color: string } },
      { xAxis: number },
    ][] = exceedances.map((exc) => [
      {
        xAxis: new Date(exc.start).getTime(),
        itemStyle: { color: "rgba(239,68,68,0.15)" },
      },
      {
        xAxis: new Date(exc.end).getTime(),
      },
    ]);

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "cross" as const },
        formatter: (params: unknown) => {
          const arr = params as Array<{ value: [number, number] }>;
          if (!arr || arr.length === 0) return "";
          const [ts, val] = arr[0].value;
          return `${new Date(ts).toLocaleString()}<br/>Value: ${typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 4 }) : val}`;
        },
      },
      xAxis: {
        type: "time" as const,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { fontSize: 11 },
      },
      grid: { left: 60, right: 20, top: 24, bottom: 40 },
      series: [
        {
          type: "line" as const,
          data: seriesData,
          showSymbol: false,
          lineStyle: { width: 1.5 },
          markLine: isNaN(thresholdNum)
            ? undefined
            : {
                silent: true,
                symbol: "none",
                label: { formatter: `Threshold: ${thresholdNum}` },
                lineStyle: {
                  color: "#f97316",
                  type: "dashed" as const,
                  width: 1.5,
                },
                data: [{ yAxis: thresholdNum }],
              },
          markArea:
            markAreas.length > 0
              ? {
                  silent: false,
                  data: markAreas,
                }
              : undefined,
        },
      ],
    } as EChartsOption;
  }, [historyQuery.data, exceedances, threshold]);

  // Handle click on a markArea region — find the matching exceedance
  const handleTrendEvents = useCallback(
    (params: unknown) => {
      const p = params as {
        componentType?: string;
        name?: string;
        data?: { coord?: [number] };
      };
      if (p?.componentType === "markArea") {
        // ECharts fires markArea click with the area's data index
        const areaParams = params as { dataIndex?: number };
        if (typeof areaParams.dataIndex === "number") {
          const exc = exceedances[areaParams.dataIndex];
          if (exc) setSelectedExceedance(exc);
        }
      }
    },
    [exceedances],
  );

  const trendEventHandlers = useMemo(
    () => ({ click: handleTrendEvents }),
    [handleTrendEvents],
  );

  const columns: ColumnDef<ThresholdExceedance>[] = [
    {
      id: "start",
      header: "Start",
      accessorKey: "start",
      sortable: true,
      cell: (val) => new Date(val as string).toLocaleString(),
    },
    {
      id: "end",
      header: "End",
      accessorKey: "end",
      sortable: true,
      cell: (val) => new Date(val as string).toLocaleString(),
    },
    {
      id: "duration_seconds",
      header: "Duration",
      accessorKey: "duration_seconds",
      sortable: true,
      cell: (val) => formatDuration(val as number),
      width: 90,
    },
    {
      id: "peak_value",
      header: "Peak Value",
      accessorKey: "peak_value",
      sortable: true,
      cell: (val) =>
        (val as number).toLocaleString(undefined, { maximumFractionDigits: 4 }),
      width: 110,
    },
  ];

  const operatorOptions: Operator[] = [">", "<", ">=", "<=", "="];
  const lookbackOptions: { value: LookbackDays; label: string }[] = [
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
    { value: 90, label: "90 days" },
    { value: 365, label: "1 year" },
  ];

  const inputStyle = {
    padding: "7px 10px",
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: "13px",
    outline: "none",
  } as React.CSSProperties;

  const selectStyle = {
    ...inputStyle,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Search controls */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-end",
        }}
      >
        {/* Point selector */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            flex: "1 1 200px",
          }}
        >
          <label
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Point
          </label>
          <input
            type="text"
            placeholder="Point ID or tag"
            value={pointId}
            onChange={(e) => setPointId(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Operator */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Operator
          </label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as Operator)}
            style={{ ...selectStyle, minWidth: "70px" }}
          >
            {operatorOptions.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        {/* Threshold value */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            flex: "0 1 140px",
          }}
        >
          <label
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Threshold
          </label>
          <input
            type="number"
            placeholder="e.g. 85.0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchMutation.mutate();
            }}
            style={inputStyle}
          />
        </div>

        {/* Lookback */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Lookback
          </label>
          <select
            value={lookback}
            onChange={(e) =>
              setLookback(Number(e.target.value) as LookbackDays)
            }
            style={selectStyle}
          >
            {lookbackOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            View
          </label>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              overflow: "hidden",
            }}
          >
            {(["list", "trend"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "6px 12px",
                  background:
                    viewMode === mode
                      ? "var(--io-accent-subtle)"
                      : "var(--io-surface-elevated)",
                  border: "none",
                  color:
                    viewMode === mode
                      ? "var(--io-accent)"
                      : "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: viewMode === mode ? 600 : 400,
                  textTransform: "capitalize",
                }}
              >
                {mode === "list" ? "List" : "Trend"} View
              </button>
            ))}
          </div>
        </div>

        {/* Search button */}
        <button
          onClick={() => searchMutation.mutate()}
          disabled={searchMutation.isPending || !pointId.trim() || !threshold}
          style={{
            padding: "7px 18px",
            background:
              pointId.trim() && threshold
                ? "var(--io-accent)"
                : "var(--io-surface)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color:
              pointId.trim() && threshold ? "#fff" : "var(--io-text-muted)",
            cursor: pointId.trim() && threshold ? "pointer" : "not-allowed",
            fontSize: "13px",
            fontWeight: 600,
            alignSelf: "flex-end",
          }}
        >
          {searchMutation.isPending ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Error */}
      {searchMutation.isError && (
        <div
          style={{
            padding: "10px 20px",
            background: "rgba(239,68,68,0.08)",
            borderBottom: "1px solid var(--io-border)",
            fontSize: "13px",
            color: "var(--io-danger, #ef4444)",
            flexShrink: 0,
          }}
        >
          {(searchMutation.error as Error).message}
        </div>
      )}

      {/* Results area */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {/* Not searched yet */}
        {!searchMutation.isSuccess &&
          !searchMutation.isPending &&
          !searchMutation.isError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                height: "100%",
                color: "var(--io-text-muted)",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "36px", opacity: 0.2 }}>⚡</span>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "var(--io-text-secondary)",
                }}
              >
                Configure a point, operator, and threshold above, then click
                Search.
              </p>
            </div>
          )}

        {/* Loading */}
        {searchMutation.isPending && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Searching...
          </div>
        )}

        {/* List view */}
        {searchMutation.isSuccess && viewMode === "list" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {exceedances.length > 0 && (
              <div style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
                Found {exceedances.length} exceedance
                {exceedances.length !== 1 ? "s" : ""} where{" "}
                <strong style={{ color: "var(--io-text-primary)" }}>
                  {pointId}
                </strong>{" "}
                {operator} {threshold} in the last {lookback} days.
              </div>
            )}

            <DataTable
              data={exceedances}
              columns={columns}
              height={Math.min(
                400,
                Math.max(200, exceedances.length * 36 + 40),
              )}
              loading={searchMutation.isPending}
              emptyMessage="No exceedances found for the given criteria"
              onRowClick={(row) => setSelectedExceedance(row)}
              onRowContextMenu={(e, row) => handleContextMenu(e, row)}
            />

            {/* Selected exceedance action */}
            {selectedExceedance && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--io-surface)",
                  border: "1px solid var(--io-accent)",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "13px" }}>
                  <span style={{ color: "var(--io-text-muted)" }}>
                    Selected:{" "}
                  </span>
                  <span
                    style={{ color: "var(--io-text-primary)", fontWeight: 600 }}
                  >
                    {new Date(selectedExceedance.start).toLocaleString()} — peak{" "}
                    {selectedExceedance.peak_value.toFixed(4)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setSelectedExceedance(null)}
                    style={{
                      padding: "5px 10px",
                      background: "none",
                      border: "1px solid var(--io-border)",
                      borderRadius: "var(--io-radius)",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    Deselect
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFor(selectedExceedance);
                      createInvestigationMutation.mutate(selectedExceedance);
                    }}
                    disabled={createInvestigationMutation.isPending}
                    style={{
                      padding: "5px 12px",
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: "var(--io-radius)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    {creatingFor === selectedExceedance &&
                    createInvestigationMutation.isPending
                      ? "Creating..."
                      : "Start Investigation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trend view */}
        {searchMutation.isSuccess && viewMode === "trend" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {/* Summary line */}
            <div style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
              {exceedances.length > 0 ? (
                <>
                  Found{" "}
                  <strong style={{ color: "var(--io-text-primary)" }}>
                    {exceedances.length}
                  </strong>{" "}
                  exceedance{exceedances.length !== 1 ? "s" : ""} where{" "}
                  <strong style={{ color: "var(--io-text-primary)" }}>
                    {pointId}
                  </strong>{" "}
                  {operator} {threshold} in the last {lookback} days. Shaded
                  regions are exceedances — click to select.
                </>
              ) : (
                <>No exceedances found for the given criteria.</>
              )}
            </div>

            {/* Chart */}
            {historyQuery.isPending && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "300px",
                  color: "var(--io-text-muted)",
                  fontSize: "13px",
                }}
              >
                Loading trend data...
              </div>
            )}
            {historyQuery.isError && (
              <div
                style={{
                  padding: "10px 16px",
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: "var(--io-radius)",
                  fontSize: "13px",
                  color: "var(--io-danger, #ef4444)",
                }}
              >
                Failed to load trend data:{" "}
                {(historyQuery.error as Error).message}
              </div>
            )}
            {historyQuery.isSuccess && (
              <EChart
                option={trendOption}
                height={340}
                onEvents={trendEventHandlers}
              />
            )}

            {/* Selected exceedance action (mirrors list view) */}
            {selectedExceedance && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--io-surface)",
                  border: "1px solid var(--io-accent)",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "13px" }}>
                  <span style={{ color: "var(--io-text-muted)" }}>
                    Selected:{" "}
                  </span>
                  <span
                    style={{ color: "var(--io-text-primary)", fontWeight: 600 }}
                  >
                    {new Date(selectedExceedance.start).toLocaleString()} — peak{" "}
                    {selectedExceedance.peak_value.toFixed(4)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setSelectedExceedance(null)}
                    style={{
                      padding: "5px 10px",
                      background: "none",
                      border: "1px solid var(--io-border)",
                      borderRadius: "var(--io-radius)",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    Deselect
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFor(selectedExceedance);
                      createInvestigationMutation.mutate(selectedExceedance);
                    }}
                    disabled={createInvestigationMutation.isPending}
                    style={{
                      padding: "5px 12px",
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: "var(--io-radius)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#fff",
                    }}
                  >
                    {creatingFor === selectedExceedance &&
                    createInvestigationMutation.isPending
                      ? "Creating..."
                      : "Start Investigation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {menuState?.data && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: `${new Date(menuState.data.start).toLocaleString()}`, disabled: true },
            { label: "Copy Start Time", onClick: () => { closeMenu(); void navigator.clipboard.writeText(new Date(menuState.data!.start).toLocaleString()); } },
            { label: "Copy Peak Value", onClick: () => { closeMenu(); void navigator.clipboard.writeText(String(menuState.data!.peak_value)); } },
            { label: "Create Investigation", divider: true, onClick: () => { closeMenu(); setCreatingFor(menuState.data!); } },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
