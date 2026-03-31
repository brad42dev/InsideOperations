// ---------------------------------------------------------------------------
// Chart 31 — Probability Plot (Normal Q-Q)
// Sorts data, computes theoretical normal quantiles via probit, and renders
// as a Plotly scatter with a reference line.
// Uses dynamic import of plotly.js-dist-min to avoid main bundle bloat.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../../../../api/points";
import { type ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

// Rational approximation for the probit function (inverse normal CDF)
// Based on Peter Acklam's algorithm
function probit(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

export default function Chart31ProbabilityPlot({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === "point");
  const pointId = pointSlot?.pointId ?? null;

  const durationMinutes = config.durationMinutes ?? 120;
  const nowISO = new Date().toISOString();
  const startISO = new Date(
    Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000,
  ).toISOString();

  const { data: histResult, isFetching } = useQuery({
    queryKey: ["chart31-qqplot", pointId, startISO],
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

  const plotDivRef = useRef<HTMLDivElement>(null);
  const [plotError, setPlotError] = useState<string | null>(null);

  useEffect(() => {
    if (!plotDivRef.current) return;
    if (!histResult?.success) return;

    const rows = histResult.data?.rows ?? [];
    const vals = rows
      .map((r) => (r.value ?? r.avg ?? null) as number | null)
      .filter((v): v is number => v !== null);

    if (vals.length < 4) return;

    const sorted = [...vals].sort((a, b) => a - b);
    const n = sorted.length;
    const theoreticalQuantiles = sorted.map((_, i) =>
      probit((i + 1 - 0.375) / (n + 0.25)),
    );

    const minTheo = theoreticalQuantiles[0];
    const maxTheo = theoreticalQuantiles[theoreticalQuantiles.length - 1];
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);

    // Reference line: y = mean + std * theoretical_quantile
    const refX = [minTheo, maxTheo];
    const refY = [mean + std * minTheo, mean + std * maxTheo];

    const traces = [
      {
        type: "scatter",
        x: theoreticalQuantiles,
        y: sorted,
        mode: "markers",
        name: "Observed",
        marker: {
          color: pointSlot?.color ?? "#4A9EFF",
          size: 5,
          opacity: 0.8,
        },
      },
      {
        type: "scatter",
        x: refX,
        y: refY,
        mode: "lines",
        name: "Reference",
        line: { color: "#EF4444", width: 1.5, dash: "dash" },
      },
    ];

    const layout = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#aaa", size: 11 },
      margin: { l: 50, r: 20, t: 30, b: 50 },
      xaxis: {
        title: { text: "Theoretical Quantile" },
        gridcolor: "rgba(255,255,255,0.08)",
        zerolinecolor: "rgba(255,255,255,0.15)",
      },
      yaxis: {
        title: { text: "Sample Quantile" },
        gridcolor: "rgba(255,255,255,0.08)",
        zerolinecolor: "rgba(255,255,255,0.15)",
      },
      legend: {
        font: { size: 10 },
        bgcolor: "transparent",
      },
    };

    const div = plotDivRef.current;
    let cancelled = false;

    // plotly.js-dist-min ships its own types via plotly.js; cast through unknown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("plotly.js-dist-min" as any)
      .then((PlotlyRaw: unknown) => {
        if (cancelled || !plotDivRef.current) return;
        const Plotly = PlotlyRaw as typeof import("plotly.js");
        Plotly.newPlot(
          div,
          traces as import("plotly.js").Data[],
          layout as Partial<import("plotly.js").Layout>,
          {
            responsive: true,
            displayModeBar: false,
          },
        ).catch((err: unknown) => {
          if (!cancelled) setPlotError(String(err));
        });
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
  }, [histResult]);

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
        Failed to render chart
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
