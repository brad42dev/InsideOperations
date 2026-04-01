// ---------------------------------------------------------------------------
// Chart 29 — CUSUM Chart
// Tabular CUSUM with decision boundary markings.
// Fetches historical data, computes Cp/Cn series, renders via TimeSeriesChart.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as math from "mathjs";
import TimeSeriesChart, { type Series } from "../TimeSeriesChart";
import { type ChartConfig, makeSlotLabeler } from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import { pointsApi } from "../../../../api/points";
import { useHighlight } from "../hooks/useHighlight";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

export default function Chart29Cusum({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const pointSlot = config.points.find((p) => p.role === "point");
  const legendItems: LegendItem[] = pointSlot
    ? [{ label: slotLabel(pointSlot), color: "#4A9EFF" }]
    : [];
  const pointId = pointSlot?.pointId ?? null;

  const k = typeof config.extras?.k === "number" ? config.extras.k : 0.5;
  const h = typeof config.extras?.h === "number" ? config.extras.h : 5;
  const targetOverride =
    typeof config.extras?.target === "number"
      ? (config.extras.target as number)
      : null;

  const durationMinutes = config.durationMinutes ?? 120;
  const nowISO = new Date().toISOString();
  const startISO = new Date(
    Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000,
  ).toISOString();

  const { data: histResult, isFetching } = useQuery({
    queryKey: ["chart29-cusum", pointId, startISO],
    queryFn: () =>
      pointsApi.history(pointId!, {
        start: startISO,
        end: nowISO,
        resolution: "auto",
        limit: 500,
      }),
    enabled: !!pointId,
    staleTime: 30_000,
  });

  const { timestamps, series, xRange, emptyReason } = useMemo(() => {
    const rows =
      histResult?.success && histResult.data?.rows ? histResult.data.rows : [];
    if (rows.length === 0)
      return {
        timestamps: [],
        series: [],
        xRange: undefined,
        emptyReason: "no_data" as const,
      };
    if (rows.length < 4)
      return {
        timestamps: [],
        series: [],
        xRange: undefined,
        emptyReason: "insufficient" as const,
      };

    const tsArr = rows.map((r) => new Date(r.timestamp).getTime() / 1000);
    const vals = rows
      .map((r) => (r.value ?? r.avg ?? null) as number | null)
      .filter((v): v is number => v !== null);

    if (vals.length < 4)
      return {
        timestamps: [],
        series: [],
        xRange: undefined,
        emptyReason: "insufficient" as const,
      };

    const mean = math.mean(vals) as number;
    const sigma = math.std(vals) as unknown as number; // sample std dev (N-1), correct for SPC
    const target = targetOverride ?? mean;

    let Cp = 0,
      Cn = 0;
    const cusumHighArr: (number | null)[] = [];
    const cusumLowArr: (number | null)[] = [];
    const violationHighArr: (number | null)[] = [];
    const violationLowArr: (number | null)[] = [];
    const decisionH: number[] = [];
    const decisionNegH: number[] = [];

    const boundary = h * sigma;

    vals.forEach((v) => {
      Cp = Math.max(0, Cp + (v - target) - k * sigma);
      Cn = Math.max(0, Cn - (v - target) - k * sigma);
      cusumHighArr.push(Cp);
      cusumLowArr.push(-Cn);
      violationHighArr.push(Cp > boundary ? Cp : null);
      violationLowArr.push(Cn > boundary ? -Cn : null);
      decisionH.push(boundary);
      decisionNegH.push(-boundary);
    });

    // Re-align with full rows length (if any were null filtered out, pad)
    // Since we filter nulls above, we need to rebuild aligned to all rows
    let vi = 0;
    const fullCH: (number | null)[] = [];
    const fullCL: (number | null)[] = [];
    const fullVH: (number | null)[] = [];
    const fullVL: (number | null)[] = [];
    const fullDH: (number | null)[] = [];
    const fullDNH: (number | null)[] = [];

    rows.forEach((r) => {
      const v = (r.value ?? r.avg ?? null) as number | null;
      if (v !== null) {
        fullCH.push(cusumHighArr[vi] ?? null);
        fullCL.push(cusumLowArr[vi] ?? null);
        fullVH.push(violationHighArr[vi] ?? null);
        fullVL.push(violationLowArr[vi] ?? null);
        fullDH.push(decisionH[vi] ?? null);
        fullDNH.push(decisionNegH[vi] ?? null);
        vi++;
      } else {
        fullCH.push(null);
        fullCL.push(null);
        fullVH.push(null);
        fullVL.push(null);
        fullDH.push(null);
        fullDNH.push(null);
      }
    });

    const builtSeries: Series[] = [
      {
        label: "CUSUM+",
        data: fullCH,
        color: "#4A9EFF",
        strokeWidth: 1.5,
      },
      {
        label: "CUSUM−",
        data: fullCL,
        color: "#F59E0B",
        strokeWidth: 1.5,
      },
      {
        label: "+H boundary",
        data: fullDH,
        color: "#EF4444",
        strokeWidth: 1,
      },
      {
        label: "−H boundary",
        data: fullDNH,
        color: "#EF4444",
        strokeWidth: 1,
      },
      {
        label: "Violations+",
        data: fullVH,
        color: "#EF4444",
        strokeWidth: 0,
      },
      {
        label: "Violations−",
        data: fullVL,
        color: "#EF4444",
        strokeWidth: 0,
      },
    ];

    return {
      timestamps: tsArr,
      series: builtSeries,
      xRange: { min: tsArr[0], max: tsArr[tsArr.length - 1] },
      emptyReason: null as null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histResult, k, h, targetOverride]);

  if (!pointSlot) {
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
        No point configured
      </div>
    );
  }

  return (
    <ChartLegendLayout
      legend={config.legend}
      items={legendItems}
      highlighted={highlighted}
      onHighlight={toggle}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {isFetching && (
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              fontSize: 11,
              color: "var(--io-text-muted)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            Loading…
          </div>
        )}
        {timestamps.length === 0 && !isFetching ? (
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
            {emptyReason === "no_data"
              ? "No data found in the selected time window"
              : "Need at least 4 readings for CUSUM — extend the time window or wait for more data"}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <TimeSeriesChart
              timestamps={timestamps}
              series={series}
              xRange={xRange}
            />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  );
}
