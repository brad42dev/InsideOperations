// ---------------------------------------------------------------------------
// ChartRenderer — dispatches to the correct chart component based on chartType.
// All 39 chart types lazy-loaded via React.lazy to keep the bundle size down.
// ---------------------------------------------------------------------------

import { Component, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import type { ChartConfig } from "./chart-config-types";

interface ChartRendererProps {
  config: ChartConfig;
  bufferKey: string;
}

// ---------------------------------------------------------------------------
// ErrorBoundary — catches render errors from any chart renderer and shows an
// in-chart error state instead of propagating up and killing the page.
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  error: Error | null;
}

class ChartErrorBoundary extends Component<
  { children: ReactNode; chartType: number },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; chartType: number }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render() {
    if (this.state.error) {
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
            fontSize: 12,
            padding: "0 16px",
            textAlign: "center",
          }}
        >
          <span style={{ color: "var(--io-danger, #EF4444)", fontWeight: 600 }}>
            Chart {this.props.chartType} error
          </span>
          <span>{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-load all renderers
const RENDERERS = {
  1: lazy(() => import("./renderers/chart01-live-trend")),
  2: lazy(() => import("./renderers/chart01-live-trend")), // merged into chart01
  3: lazy(() => import("./renderers/chart01-live-trend")), // merged into chart01
  4: lazy(() => import("./renderers/chart04-step-chart")),
  5: lazy(() => import("./renderers/chart05-bar-column")),
  6: lazy(() => import("./renderers/chart06-pie-donut")),
  7: lazy(() => import("./renderers/chart07-kpi-card")),
  8: lazy(() => import("./renderers/chart08-gauge")),
  9: lazy(() => import("./renderers/chart09-sparkline")),
  10: lazy(() => import("./renderers/chart10-analog-bar")),
  11: lazy(() => import("./renderers/chart11-fill-gauge")),
  12: lazy(() => import("./renderers/chart12-alarm-indicator")),
  13: lazy(() => import("./renderers/chart13-xy-scatter")),
  14: lazy(() => import("./renderers/chart14-event-timeline")),
  15: lazy(() => import("./renderers/chart15-data-table")),
  16: lazy(() => import("./renderers/chart16-batch-comparison")),
  17: lazy(() => import("./renderers/chart17-heatmap")),
  18: lazy(() => import("./renderers/chart18-pareto")),
  19: lazy(() => import("./renderers/chart19-box-plot")),
  20: lazy(() => import("./renderers/chart20-histogram")),
  21: lazy(() => import("./renderers/chart21-waterfall")),
  22: lazy(() => import("./renderers/chart22-stacked-area")),
  23: lazy(() => import("./renderers/chart23-bullet")),
  24: lazy(() => import("./renderers/chart24-shewhart")),
  25: lazy(() => import("./renderers/chart25-regression")),
  26: lazy(() => import("./renderers/chart26-correlation-matrix")),
  27: lazy(() => import("./renderers/chart27-sankey")),
  28: lazy(() => import("./renderers/chart28-treemap")),
  29: lazy(() => import("./renderers/chart29-cusum")),
  30: lazy(() => import("./renderers/chart30-ewma")),
  31: lazy(() => import("./renderers/chart31-probability-plot")),
  32: lazy(() => import("./renderers/chart32-funnel")),
  33: lazy(() => import("./renderers/chart33-radar")),
  34: lazy(() => import("./renderers/chart34-surface3d")),
  35: lazy(() => import("./renderers/chart35-state-timeline")),
  36: lazy(() => import("./renderers/chart36-scorecard-table")),
  37: lazy(() => import("./renderers/chart37-parallel-coord")),
  38: lazy(() => import("./renderers/chart38-subgroup-spc")),
  39: lazy(() => import("./renderers/chart39-attribute-control")),
} as const;

function ChartFallback() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--io-text-muted)",
        fontSize: 12,
      }}
    >
      Loading chart…
    </div>
  );
}

function UnknownChart({ type }: { type: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--io-text-muted)",
        fontSize: 12,
      }}
    >
      Unknown chart type {type}
    </div>
  );
}

export default function ChartRenderer({
  config,
  bufferKey,
}: ChartRendererProps) {
  const Renderer = RENDERERS[config.chartType as keyof typeof RENDERERS];

  if (!Renderer) {
    return <UnknownChart type={config.chartType} />;
  }

  return (
    <ChartErrorBoundary key={config.chartType} chartType={config.chartType}>
      <Suspense fallback={<ChartFallback />}>
        <Renderer config={config} bufferKey={bufferKey} />
      </Suspense>
    </ChartErrorBoundary>
  );
}
