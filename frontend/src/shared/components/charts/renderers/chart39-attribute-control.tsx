// ---------------------------------------------------------------------------
// Chart 39 — Attribute Control Chart p/np/c/u
// ECharts line series with computed binomial/Poisson control limits.
// p-chart  : fraction defective = defects / sample_size (variable n ok)
// np-chart : count defective, fixed sample size n
// c-chart  : defects per unit, fixed sample size
// u-chart  : defects per unit, variable n → staircase UCL/LCL
// Optionally highlights Western Electric violations on the plotted statistic.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig } from "../chart-config-types";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

// Western Electric rule 1 only for attribute charts (points beyond 3σ)
// Full WE rules are inappropriate for attribute data with skewed distributions.
function weViolationAttr(
  vals: number[],
  ucls: number[],
  lcls: number[],
  i: number,
): boolean {
  return vals[i] > ucls[i] || vals[i] < lcls[i];
}

interface AttributePoint {
  label: string;
  stat: number; // plotted statistic (p, np, c, or u)
  n: number; // sample size at this point
  defects: number; // raw defect count
}

function computeLimits(
  variant: string,
  points: AttributePoint[],
  fixedN: number,
): { ucl: number[]; lcl: number[]; center: number[] } {
  const k = points.length;
  if (k === 0) return { ucl: [], lcl: [], center: [] };

  const ucl: number[] = [];
  const lcl: number[] = [];
  const center: number[] = [];

  if (variant === "p") {
    // p-bar = total defects / total inspected
    const totalDefects = points.reduce((s, p) => s + p.defects, 0);
    const totalN = points.reduce((s, p) => s + p.n, 0);
    const pBar = totalN > 0 ? totalDefects / totalN : 0;

    for (const p of points) {
      const n = p.n > 0 ? p.n : 1;
      const sigma = Math.sqrt((pBar * (1 - pBar)) / n);
      ucl.push(Math.min(1, pBar + 3 * sigma));
      lcl.push(Math.max(0, pBar - 3 * sigma));
      center.push(pBar);
    }
  } else if (variant === "np") {
    // np-bar = mean count defective
    const npBar = points.reduce((s, p) => s + p.stat, 0) / k;
    const pBar = npBar / (fixedN > 0 ? fixedN : 1);
    const sigma = Math.sqrt(fixedN * pBar * (1 - pBar));
    for (let i = 0; i < k; i++) {
      ucl.push(npBar + 3 * sigma);
      lcl.push(Math.max(0, npBar - 3 * sigma));
      center.push(npBar);
    }
  } else if (variant === "c") {
    // c-bar = mean defect count
    const cBar = points.reduce((s, p) => s + p.stat, 0) / k;
    const sigma = Math.sqrt(cBar);
    for (let i = 0; i < k; i++) {
      ucl.push(cBar + 3 * sigma);
      lcl.push(Math.max(0, cBar - 3 * sigma));
      center.push(cBar);
    }
  } else {
    // u-chart: u-bar = total defects / total units inspected
    const totalDefects = points.reduce((s, p) => s + p.defects, 0);
    const totalN = points.reduce((s, p) => s + p.n, 0);
    const uBar = totalN > 0 ? totalDefects / totalN : 0;
    for (const p of points) {
      const n = p.n > 0 ? p.n : 1;
      const sigma = Math.sqrt(uBar / n);
      ucl.push(uBar + 3 * sigma);
      lcl.push(Math.max(0, uBar - 3 * sigma));
      center.push(uBar);
    }
  }

  return { ucl, lcl, center };
}

const VARIANT_LABELS: Record<string, string> = {
  p: "Fraction Defective (p)",
  np: "Count Defective (np)",
  c: "Defects per Unit (c)",
  u: "Defects per Unit, Variable n (u)",
};

const Y_AXIS_NAMES: Record<string, string> = {
  p: "p (fraction)",
  np: "np (count)",
  c: "c (defects)",
  u: "u (defects/unit)",
};

export default function AttributeControlChart({ config }: RendererProps) {
  const defectSlot = config.points.find((p) => p.role === "defects");
  const sampleSlot = config.points.find((p) => p.role === "sampleSize");
  const durationMinutes = config.durationMinutes ?? 60 * 24;

  const variant = (config.extras?.chartVariant as string) ?? "p";
  const fixedN =
    typeof config.extras?.fixedSampleSize === "number"
      ? config.extras.fixedSampleSize
      : 100;
  const showWERules = config.extras?.showWERules !== false;

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const windowEndMs = isHistorical
    ? new Date(timeRange.end).getTime()
    : Date.now();
  const windowStartMs = isHistorical
    ? new Date(timeRange.start).getTime()
    : windowEndMs - durationMinutes * 60 * 1000;

  const end = new Date(windowEndMs).toISOString();
  const start = new Date(windowStartMs).toISOString();

  const pointIds = [
    ...(defectSlot ? [defectSlot.pointId] : []),
    ...(sampleSlot ? [sampleSlot.pointId] : []),
  ];

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ["history-batch", ...pointIds, start, end, "attribute-control"],
    queryFn: () =>
      pointsApi.historyBatch(pointIds, { start, end, limit: 5000 }),
    enabled: !!defectSlot,
    refetchInterval: isHistorical ? false : 60_000,
    select: (res) => (res.success ? res.data : []),
  });

  const { attrPoints, limits, labels } = useMemo(() => {
    if (!historyBatch || !defectSlot)
      return { attrPoints: [], limits: null, labels: [] };

    const defectBatch = historyBatch.find(
      (b) => b.point_id === defectSlot.pointId,
    );
    const sampleBatch = sampleSlot
      ? historyBatch.find((b) => b.point_id === sampleSlot.pointId)
      : undefined;

    if (!defectBatch) return { attrPoints: [], limits: null, labels: [] };

    // Build sample size map by timestamp (for p/u charts with variable n)
    const sampleMap = new Map<string, number>();
    if (sampleBatch) {
      for (const row of sampleBatch.rows) {
        if (row.value !== null) sampleMap.set(row.timestamp, row.value);
      }
    }

    const pts: AttributePoint[] = [];
    for (const row of defectBatch.rows) {
      if (row.value === null) continue;
      const defects = row.value;
      // Resolve n: use sampleSize point if available, else fixedN
      const n = sampleMap.get(row.timestamp) ?? fixedN;

      let stat: number;
      if (variant === "p") {
        stat = n > 0 ? defects / n : 0;
      } else if (variant === "u") {
        stat = n > 0 ? defects / n : 0;
      } else {
        // np or c: plotted directly as count
        stat = defects;
      }

      const label = new Date(row.timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      pts.push({ label, stat, n, defects });
    }

    const lim = computeLimits(variant, pts, fixedN);
    const labels = pts.map((p) => p.label);
    return { attrPoints: pts, limits: lim, labels };
  }, [historyBatch, defectSlot, sampleSlot, variant, fixedN]);

  const option: EChartsOption = useMemo(() => {
    if (!limits || attrPoints.length === 0) return {};

    const textMuted = resolveToken("--io-text-muted");
    const borderColor = resolveToken("--io-border");
    const statVals = attrPoints.map((p) => p.stat);

    const violations = showWERules
      ? statVals.map((_, i) =>
          weViolationAttr(statVals, limits.ucl, limits.lcl, i),
        )
      : statVals.map(() => false);

    const violationData = statVals.map((v, i) => (violations[i] ? v : null));

    // Staircase UCL/LCL for p/u charts (variable n → limits change per point)
    // For np/c (fixed n), limits are constant — same approach works since array per point.
    const uclData = limits.ucl;
    const lclData = limits.lcl.map((v) => Math.max(0, v));
    const centerData = limits.center;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const ps = params as {
            axisValueLabel: string;
            seriesName: string;
            value: number | null;
            dataIndex: number;
          }[];
          if (!ps.length) return "";
          const i = ps[0].dataIndex;
          const p = attrPoints[i];
          const lines = [
            ps[0].axisValueLabel,
            `Defects: ${p.defects}`,
            `n: ${p.n}`,
            `${VARIANT_LABELS[variant] ?? variant}: ${p.stat.toFixed(4)}`,
            `UCL: ${limits.ucl[i].toFixed(4)}`,
            `LCL: ${lclData[i].toFixed(4)}`,
          ];
          return lines.join("<br/>");
        },
      },
      grid: { left: 64, right: 24, top: 40, bottom: 50 },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: textMuted, fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: borderColor } },
        axisTick: { show: false },
      },
      yAxis: {
        name: Y_AXIS_NAMES[variant] ?? variant,
        nameTextStyle: { color: textMuted, fontSize: 10 },
        axisLabel: { color: textMuted, fontSize: 9 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: borderColor, type: "dashed" } },
        min: 0,
      },
      series: [
        {
          name: VARIANT_LABELS[variant] ?? variant,
          type: "line",
          data: statVals,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: "#4A9EFF", width: 1.5 },
          itemStyle: { color: "#4A9EFF" },
        },
        {
          name: "Center Line",
          type: "line",
          data: centerData,
          symbol: "none",
          lineStyle: { color: "#10B981", width: 1, type: "dashed" },
          silent: true,
        },
        {
          name: "UCL",
          type: "line",
          data: uclData,
          symbol: "none",
          // Step mode for staircase limits (p/u with variable n)
          step: variant === "p" || variant === "u" ? "end" : undefined,
          lineStyle: { color: "#EF4444", width: 1, type: "dashed" },
          silent: true,
        },
        {
          name: "LCL",
          type: "line",
          data: lclData,
          symbol: "none",
          step: variant === "p" || variant === "u" ? "end" : undefined,
          lineStyle: { color: "#EF4444", width: 1, type: "dashed" },
          silent: true,
        },
        {
          name: "Violations",
          type: "scatter",
          data: violationData,
          symbol: "circle",
          symbolSize: 8,
          itemStyle: { color: "#EF4444", borderColor: "#fff", borderWidth: 1 },
          silent: true,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrPoints, limits, labels, variant, showWERules]);

  if (!defectSlot) {
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
        Assign a defect count point in the Data Points tab
      </div>
    );
  }

  const noData = !isLoading && attrPoints.length === 0;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
      {isLoading && (
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
      <div
        style={{
          position: "absolute",
          top: 4,
          left: 8,
          fontSize: 10,
          color: "var(--io-text-muted)",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {VARIANT_LABELS[variant] ?? variant}
        {(variant === "np" || variant === "c") && ` · n=${fixedN}`}
      </div>
      {noData && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
            paddingTop: 40,
          }}
        >
          No data in selected range
        </div>
      )}
      {!noData && attrPoints.length > 0 && <EChart option={option} />}
    </div>
  );
}
