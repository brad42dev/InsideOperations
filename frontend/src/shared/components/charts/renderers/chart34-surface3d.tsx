// ---------------------------------------------------------------------------
// Chart 34 — 3D Surface / Contour
// Three-point chart: x, y, z roles. Fetches historical data, bins into an
// N×N grid, and renders via Plotly.js (dynamic import).
//
// extras.resolution: number (default 20) — grid resolution N×N
// extras.mode: 'surface' | 'contour' | 'both' (default 'surface')
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../../../../api/points";
import { type ChartConfig } from "../chart-config-types";

/** Pick a bucket size that targets ~500 data points for the 3D surface grid. */
function bucketSecondsFor3D(durationMinutes: number): number {
  const rawBucket = (durationMinutes * 60) / 500;
  if (rawBucket <= 60) return 60;
  if (rawBucket <= 300) return 300;
  if (rawBucket <= 900) return 900;
  if (rawBucket <= 3600) return 3600;
  return 86400;
}

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

export default function Chart34Surface3d({ config }: RendererProps) {
  const xSlot = config.points.find((p) => p.role === "x");
  const ySlot = config.points.find((p) => p.role === "y");
  const zSlot = config.points.find((p) => p.role === "z");

  const resolution =
    typeof config.extras?.resolution === "number"
      ? config.extras.resolution
      : 20;
  const mode =
    (config.extras?.mode as "surface" | "contour" | "both") ?? "surface";

  const PALETTE_MAP: Record<string, string> = {
    viridis: "Viridis",
    rainbow: "Rainbow",
    hot: "Hot",
    jet: "Jet",
    blues: "Blues",
  };
  const palette = config.extras?.palette as string | undefined;
  const colorscale = PALETTE_MAP[palette ?? "viridis"] ?? "Viridis";
  const wireframe = config.extras?.wireframe === true;

  const durationMinutes = config.durationMinutes ?? 120;
  const nowISO = new Date().toISOString();
  const startISO = new Date(
    Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000,
  ).toISOString();

  // Use a fixed bucket size so all three series share the same timestamps.
  // "auto" / raw resolution would produce misaligned per-point timestamps
  // that yield zero common entries across the three series.
  const bucketSeconds = bucketSecondsFor3D(durationMinutes);

  const allPresent = !!xSlot && !!ySlot && !!zSlot;

  const { data: histResults, isFetching } = useQuery({
    queryKey: [
      "chart34-surface",
      xSlot?.pointId,
      ySlot?.pointId,
      zSlot?.pointId,
      startISO,
      bucketSeconds,
    ],
    queryFn: async () => {
      const batchRes = await pointsApi.historyBatch(
        [xSlot!.pointId, ySlot!.pointId, zSlot!.pointId],
        {
          start: startISO,
          end: nowISO,
          bucket_seconds: bucketSeconds,
          aggregate_function: "avg",
          limit: 2000,
        },
      );
      if (!batchRes.success || !batchRes.data) return null;
      const [xRes, yRes, zRes] = batchRes.data;
      return { xRes, yRes, zRes };
    },
    enabled: allPresent,
    staleTime: 30_000,
  });

  const plotDivRef = useRef<HTMLDivElement>(null);
  const [plotError, setPlotError] = useState<string | null>(null);

  const [insufficientData, setInsufficientData] = useState(false);

  useEffect(() => {
    setInsufficientData(false);
    if (!plotDivRef.current || !histResults) return;

    // histResults entries are HistoryResult objects (rows directly, no .success wrapper)
    const xRows = histResults.xRes.rows ?? [];
    const yRows = histResults.yRes.rows ?? [];
    const zRows = histResults.zRes.rows ?? [];

    // Align by timestamp — shared bucket boundaries mean exact ms matches
    const xMap = new Map<number, number>();
    const yMap = new Map<number, number>();
    const zMap = new Map<number, number>();

    xRows.forEach((r) => {
      const v = (r.value ?? r.avg ?? null) as number | null;
      if (v !== null) xMap.set(new Date(r.timestamp).getTime(), v);
    });
    yRows.forEach((r) => {
      const v = (r.value ?? r.avg ?? null) as number | null;
      if (v !== null) yMap.set(new Date(r.timestamp).getTime(), v);
    });
    zRows.forEach((r) => {
      const v = (r.value ?? r.avg ?? null) as number | null;
      if (v !== null) zMap.set(new Date(r.timestamp).getTime(), v);
    });

    // Find timestamps present in all three
    const commonTs: number[] = [];
    xMap.forEach((_, ts) => {
      if (yMap.has(ts) && zMap.has(ts)) commonTs.push(ts);
    });

    if (commonTs.length < 4) {
      setInsufficientData(true);
      return;
    }

    const xVals = commonTs.map((ts) => xMap.get(ts)!);
    const yVals = commonTs.map((ts) => yMap.get(ts)!);
    const zVals = commonTs.map((ts) => zMap.get(ts)!);

    // Build N×N grid
    const N = resolution;
    const xMin = Math.min(...xVals);
    const xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);
    const xStep = (xMax - xMin) / (N - 1) || 1;
    const yStep = (yMax - yMin) / (N - 1) || 1;

    const gridX: number[] = Array.from(
      { length: N },
      (_, i) => xMin + i * xStep,
    );
    const gridY: number[] = Array.from(
      { length: N },
      (_, i) => yMin + i * yStep,
    );

    // For each cell, collect z values and average them
    const zSum: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    const zCount: number[][] = Array.from({ length: N }, () =>
      Array(N).fill(0),
    );

    xVals.forEach((xv, i) => {
      const xi = Math.min(N - 1, Math.floor((xv - xMin) / xStep));
      const yi = Math.min(N - 1, Math.floor((yVals[i] - yMin) / yStep));
      zSum[yi][xi] += zVals[i];
      zCount[yi][xi]++;
    });

    const zMatrixRaw: (number | null)[][] = zSum.map((row, ri) =>
      row.map((s, ci) => (zCount[ri][ci] > 0 ? s / zCount[ri][ci] : null)),
    );

    // Plotly surface trace crashes WebGL when z-matrix contains nulls.
    // Fill empty cells with the mean of all non-null cells.
    const allZ: number[] = [];
    zMatrixRaw.forEach((row) =>
      row.forEach((v) => {
        if (v !== null) allZ.push(v);
      }),
    );
    const zFill = allZ.length > 0 ? allZ.reduce((a, b) => a + b, 0) / allZ.length : 0;
    const zMatrix: number[][] = zMatrixRaw.map((row) =>
      row.map((v) => (v !== null ? v : zFill)),
    );

    const xName = xSlot?.pointId ?? "X";
    const yName = ySlot?.pointId ?? "Y";
    const zName = zSlot?.pointId ?? "Z";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type PlotlyData = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type PlotlyLayout = any;

    const traces: PlotlyData[] = [];

    if (mode === "surface" || mode === "both") {
      traces.push({
        type: "surface",
        x: gridX,
        y: gridY,
        z: zMatrix,
        colorscale,
        hidesurface: wireframe,
        contours: wireframe
          ? {
              x: { show: true, width: 1, color: "rgba(255,255,255,0.5)" },
              y: { show: true, width: 1, color: "rgba(255,255,255,0.5)" },
              z: { show: true, width: 1, color: "rgba(255,255,255,0.5)" },
            }
          : undefined,
        name: zName,
      });
    }

    if (mode === "contour" || mode === "both") {
      traces.push({
        type: "contour",
        x: gridX,
        y: gridY,
        z: zMatrix,
        colorscale,
        name: zName,
      });
    }

    const layout: PlotlyLayout = {
      scene: {
        xaxis: { title: xName },
        yaxis: { title: yName },
        zaxis: { title: zName },
      },
      paper_bgcolor: "transparent",
      font: { color: "#aaa", size: 11 },
      margin: { l: 0, r: 0, t: 30, b: 0 },
    };

    const div = plotDivRef.current;
    let cancelled = false;

    // plotly.js-dist-min ships its own types via plotly.js; cast through unknown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("plotly.js-dist-min" as any)
      .then((PlotlyRaw: unknown) => {
        if (cancelled || !plotDivRef.current) return;
        const Plotly = PlotlyRaw as typeof import("plotly.js");
        try {
          Plotly.newPlot(div, traces, layout, {
            responsive: true,
            displayModeBar: false,
          }).catch((err: unknown) => {
            if (!cancelled) setPlotError(String(err));
          });
        } catch (err: unknown) {
          if (!cancelled) setPlotError(String(err));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setPlotError(String(err));
      });

    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import("plotly.js-dist-min" as any)
        .then((PlotlyRaw: unknown) => {
          if (!div) return;
          const Plotly = PlotlyRaw as typeof import("plotly.js");
          Plotly.purge(div);
        })
        .catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histResults, mode, resolution, colorscale, wireframe]);

  if (!allPresent) {
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
        Assign X, Y, and Z points to this chart
      </div>
    );
  }

  if (insufficientData) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: "var(--io-text-muted)",
          fontSize: 13,
          textAlign: "center",
          padding: "0 20px",
        }}
      >
        <span>Not enough overlapping data to build the surface.</span>
        <span style={{ fontSize: 11 }}>
          Try a longer duration — at least 30 minutes recommended.
        </span>
      </div>
    );
  }

  if (plotError) {
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
        Failed to render surface
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
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
      <div ref={plotDivRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
