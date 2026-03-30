import type { EChartsOption } from 'echarts'

type SeriesObj = Record<string, unknown>

/**
 * Post-process an ECharts option to apply highlight dimming/boosting.
 *
 * Keyed by series `name` — must match the legend item labels passed to ChartLegendLayout.
 * When `highlighted` is empty, returns `option` unchanged (no overhead).
 *
 * Highlighted series: line/area gets +1.5px width, z=10, full opacity.
 * Non-highlighted series: opacity dimmed to 0.12 (line) / 0.15 (item fill), z=1.
 *
 * NOTE: For chart types where individual *items* (not series) map to legend entries
 * (pie, non-stacked bar, box plot, pareto bars, funnel, waterfall), apply per-item
 * opacity directly inside the renderer's useMemo instead of using this utility.
 */
export function applyEChartsHighlight(
  option: EChartsOption,
  highlighted: Set<string>,
): EChartsOption {
  if (highlighted.size === 0) return option

  const rawSeries = Array.isArray(option.series)
    ? option.series
    : option.series
    ? [option.series]
    : []

  const patchedSeries = (rawSeries as SeriesObj[]).map((s) => {
    const name = typeof s.name === 'string' ? s.name : ''
    const isHighlighted = highlighted.has(name)
    const lineStyle = (s.lineStyle as SeriesObj | undefined) ?? {}
    const itemStyle = (s.itemStyle as SeriesObj | undefined) ?? {}

    if (isHighlighted) {
      return {
        ...s,
        z: 10,
        lineStyle: {
          ...lineStyle,
          width: ((lineStyle.width as number | undefined) ?? 1.5) + 1.5,
          opacity: 1,
        },
        itemStyle: { ...itemStyle, opacity: 1 },
      }
    }

    return {
      ...s,
      z: 1,
      lineStyle: { ...lineStyle, opacity: 0.12 },
      itemStyle: { ...itemStyle, opacity: 0.15 },
    }
  })

  return { ...option, series: patchedSeries as EChartsOption['series'] }
}

/**
 * Extract the highlight key from ECharts click event params.
 * Tries seriesName first (named-series charts), then name (item-keyed charts like pie/bar).
 */
export function getEChartsClickKey(params: unknown): string {
  const p = params as { seriesName?: string; name?: string }
  return p.seriesName ?? p.name ?? ''
}

/**
 * Extract multi-select flag (Ctrl or Meta) from ECharts click event params.
 */
export function getEChartsClickMulti(params: unknown): boolean {
  const p = params as { event?: { event?: { ctrlKey?: boolean; metaKey?: boolean } } }
  return (p.event?.event?.ctrlKey || p.event?.event?.metaKey) ?? false
}
