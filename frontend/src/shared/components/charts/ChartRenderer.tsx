// ---------------------------------------------------------------------------
// ChartRenderer — dispatches to the correct chart component based on chartType.
// All 39 chart types lazy-loaded via React.lazy to keep the bundle size down.
// ---------------------------------------------------------------------------

import { Suspense, lazy } from 'react'
import type { ChartConfig } from './chart-config-types'

interface ChartRendererProps {
  config: ChartConfig
  bufferKey: string
}

// Lazy-load all renderers
const RENDERERS = {
  1:  lazy(() => import('./renderers/chart01-live-trend')),
  2:  lazy(() => import('./renderers/chart02-historical-trend')),
  3:  lazy(() => import('./renderers/chart03-multi-axis-trend')),
  4:  lazy(() => import('./renderers/chart04-step-chart')),
  5:  lazy(() => import('./renderers/chart05-bar-column')),
  6:  lazy(() => import('./renderers/chart06-pie-donut')),
  7:  lazy(() => import('./renderers/chart07-kpi-card')),
  8:  lazy(() => import('./renderers/chart08-gauge')),
  9:  lazy(() => import('./renderers/chart09-sparkline')),
  10: lazy(() => import('./renderers/chart10-analog-bar')),
  11: lazy(() => import('./renderers/chart11-fill-gauge')),
  12: lazy(() => import('./renderers/chart12-alarm-indicator')),
  13: lazy(() => import('./renderers/chart13-xy-scatter')),
  14: lazy(() => import('./renderers/chart14-event-timeline')),
  15: lazy(() => import('./renderers/chart15-data-table')),
  16: lazy(() => import('./renderers/chart16-batch-comparison')),
  17: lazy(() => import('./renderers/chart17-heatmap')),
  18: lazy(() => import('./renderers/chart18-pareto')),
  19: lazy(() => import('./renderers/chart19-box-plot')),
  20: lazy(() => import('./renderers/chart20-histogram')),
  21: lazy(() => import('./renderers/chart21-waterfall')),
  22: lazy(() => import('./renderers/chart22-stacked-area')),
  23: lazy(() => import('./renderers/chart23-bullet')),
  24: lazy(() => import('./renderers/chart24-shewhart')),
  25: lazy(() => import('./renderers/chart25-regression')),
  26: lazy(() => import('./renderers/chart26-correlation-matrix')),
  27: lazy(() => import('./renderers/chart27-sankey')),
  28: lazy(() => import('./renderers/chart28-treemap')),
  29: lazy(() => import('./renderers/chart29-cusum')),
  30: lazy(() => import('./renderers/chart30-ewma')),
  31: lazy(() => import('./renderers/chart31-probability-plot')),
  32: lazy(() => import('./renderers/chart32-funnel')),
  33: lazy(() => import('./renderers/chart33-radar')),
  34: lazy(() => import('./renderers/chart34-surface3d')),
  35: lazy(() => import('./renderers/chart35-state-timeline')),
  36: lazy(() => import('./renderers/chart36-scorecard-table')),
  37: lazy(() => import('./renderers/chart37-parallel-coord')),
  38: lazy(() => import('./renderers/chart38-subgroup-spc')),
  39: lazy(() => import('./renderers/chart39-attribute-control')),
} as const

function ChartFallback() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--io-text-muted)',
        fontSize: 12,
      }}
    >
      Loading chart…
    </div>
  )
}

function UnknownChart({ type }: { type: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--io-text-muted)',
        fontSize: 12,
      }}
    >
      Unknown chart type {type}
    </div>
  )
}

export default function ChartRenderer({ config, bufferKey }: ChartRendererProps) {
  const Renderer = RENDERERS[config.chartType as keyof typeof RENDERERS]

  if (!Renderer) {
    return <UnknownChart type={config.chartType} />
  }

  return (
    <Suspense fallback={<ChartFallback />}>
      <Renderer config={config} bufferKey={bufferKey} />
    </Suspense>
  )
}
