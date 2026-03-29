import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useThemeColors } from '../../theme/ThemeContext'

export interface Series {
  label: string
  data: (number | null)[]
  color?: string
  strokeWidth?: number
}

export interface TimeSeriesChartProps {
  timestamps: number[]
  series: Series[]
  /** Force the x-axis to this range (Unix seconds). Prevents auto-fit to data extent. */
  xRange?: { min: number; max: number }
  /** Explicit height in px. Omit to fill the parent container (requires parent to have a determined height). */
  height?: number
  /** Explicit width in px. Omit to fill the parent container width. */
  width?: number
  className?: string
}

const DEFAULT_HEIGHT = 300
const DEFAULT_COLOR = '#4A9EFF'

// Format a Unix-second timestamp for the tooltip header
function fmtTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Format a numeric value with appropriate precision
function fmtVal(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return v.toPrecision(4).replace(/\.?0+$/, '')
}

// Build tooltip DOM safely (no innerHTML — avoids XSS from API-sourced labels)
function buildTooltipDOM(
  container: HTMLDivElement,
  ts: number,
  rows: Array<{ label: string; color: string; value: string; stale: boolean }>,
) {
  container.textContent = ''

  // Header: timestamp
  const header = document.createElement('div')
  header.style.cssText =
    'font-size:10px;color:var(--io-text-muted);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--io-border)'
  header.textContent = fmtTime(ts)
  container.appendChild(header)

  // Rows: one per series
  const body = document.createElement('div')
  body.style.fontSize = '11px'

  for (const row of rows) {
    const rowEl = document.createElement('div')
    rowEl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0'

    const dot = document.createElement('span')
    dot.style.cssText = `flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${row.color}`
    rowEl.appendChild(dot)

    const lbl = document.createElement('span')
    lbl.style.cssText =
      'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--io-text-secondary)'
    lbl.textContent = row.label
    rowEl.appendChild(lbl)

    const val = document.createElement('span')
    val.style.cssText = `font-variant-numeric:tabular-nums;font-weight:500;color:${row.stale ? 'var(--io-text-muted)' : 'var(--io-text)'}`

    if (row.stale) {
      const tilde = document.createElement('span')
      tilde.title = 'Last known value before this time'
      tilde.style.cssText = 'opacity:0.6;font-size:9px;margin-right:2px'
      tilde.textContent = '~'
      val.appendChild(tilde)
    }

    val.appendChild(document.createTextNode(row.value))
    rowEl.appendChild(val)

    body.appendChild(rowEl)
  }

  container.appendChild(body)
}

export default function TimeSeriesChart({
  timestamps,
  series,
  xRange,
  height,
  width,
  className,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(width ?? 0)
  const [containerHeight, setContainerHeight] = useState<number>(height ?? DEFAULT_HEIGHT)

  // Get theme-aware colors from context — no CSS variable reads
  const colors = useThemeColors()

  // Track controlled vs auto dimensions
  const isAutoWidth = width === undefined
  const isAutoHeight = height === undefined

  // Always-current x range — updated on every render so the scale range function
  // never uses a stale value, even though the chart isn't rebuilt on every tick.
  const xRangeRef = useRef(xRange)
  xRangeRef.current = xRange

  // Always-current snapshot of data and series config — uPlot hooks read these
  // refs so they never use a stale closure.
  const latestDataRef = useRef<uPlot.AlignedData>([timestamps, ...series.map((s) => s.data)])
  latestDataRef.current = [timestamps, ...series.map((s) => s.data)]
  const latestSeriesRef = useRef(series)
  latestSeriesRef.current = series

  // Measure container dimensions via ResizeObserver when not explicitly provided
  useEffect(() => {
    if (!isAutoWidth && !isAutoHeight) return
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        if (isAutoWidth) setContainerWidth(entry.contentRect.width)
        if (isAutoHeight) setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isAutoWidth, isAutoHeight])

  // When explicit dimensions change, sync state
  useEffect(() => {
    if (!isAutoWidth && width !== undefined) setContainerWidth(width)
  }, [isAutoWidth, width])
  useEffect(() => {
    if (!isAutoHeight && height !== undefined) setContainerHeight(height)
  }, [isAutoHeight, height])

  const resolvedWidth = isAutoWidth ? containerWidth : (width ?? 0)
  const resolvedHeight = isAutoHeight ? containerHeight : (height ?? DEFAULT_HEIGHT)

  // Number of Y series — used as a build dep so the chart rebuilds when
  // series are added or removed (uPlot doesn't support adding/removing
  // series after creation).
  const seriesCount = series.length

  // Build (or rebuild) the uPlot instance.
  // Re-runs when dimensions, theme, or series count changes.
  useEffect(() => {
    if (!containerRef.current || resolvedWidth === 0) return

    const data = latestDataRef.current

    const uplotSeries: uPlot.Series[] = [
      {}, // x axis (time)
      ...series.map((s) => ({
        label: s.label,
        stroke: s.color ?? DEFAULT_COLOR,
        width: s.strokeWidth ?? 1.5,
        spanGaps: true,
        points: { show: false },
      })),
    ]

    const opts: uPlot.Options = {
      width: resolvedWidth,
      height: resolvedHeight,
      series: uplotSeries,
      legend: { show: false },
      axes: [
        {
          stroke: colors.chartAxis,
          ticks: { stroke: colors.chartGrid },
          grid: { stroke: colors.chartGrid, width: 1 },
        },
        {
          stroke: colors.chartAxis,
          ticks: { stroke: colors.chartGrid },
          grid: { stroke: colors.chartGrid, width: 1 },
        },
      ],
      scales: {
        x: {
          time: true,
          // Force x-axis to the requested window rather than auto-fitting to data
          // extent — essential when data is sparse (e.g. first load of a 24h window).
          range: (_u, dataMin, dataMax) => {
            const r = xRangeRef.current
            return [r ? r.min : dataMin, r ? r.max : dataMax]
          },
        },
      },
      cursor: {
        drag: { x: true, y: false },
      },
      hooks: {
        setCursor: [
          (u) => {
            const tt = tooltipRef.current
            if (!tt) return

            const idx = u.cursor.idx
            if (idx == null || idx < 0) {
              tt.style.display = 'none'
              return
            }

            const d = latestDataRef.current
            const srcs = latestSeriesRef.current
            const ts = d[0][idx]
            if (ts == null) {
              tt.style.display = 'none'
              return
            }

            // Build row data for each series
            const rows: Array<{ label: string; color: string; value: string; stale: boolean }> = []
            for (let i = 0; i < srcs.length; i++) {
              const yData = d[i + 1] as (number | null | undefined)[]
              if (!yData) continue
              const val = yData[idx]
              const color = srcs[i].color ?? DEFAULT_COLOR

              let value: string
              let stale = false

              if (val != null && !isNaN(val)) {
                value = fmtVal(val)
              } else {
                // Walk back to find the last known good value
                let j = idx - 1
                while (j >= 0 && (yData[j] == null || isNaN(yData[j] as number))) j--
                if (j >= 0 && yData[j] != null) {
                  value = fmtVal(yData[j] as number)
                  stale = true
                } else {
                  value = '—'
                }
              }

              rows.push({ label: srcs[i].label, color, value, stale })
            }

            buildTooltipDOM(tt, ts, rows)

            // Position near cursor; flip side at midpoint to stay in bounds
            const chartW = u.bbox.width / devicePixelRatio
            const chartH = u.bbox.height / devicePixelRatio
            const curLeft = u.cursor.left ?? 0
            const curTop = u.cursor.top ?? 0
            const flipX = curLeft > chartW / 2
            const flipY = curTop > chartH * 0.6

            tt.style.left = flipX ? 'auto' : `${curLeft + 14}px`
            tt.style.right = flipX ? `${chartW - curLeft + 14}px` : 'auto'
            tt.style.top = flipY ? 'auto' : `${curTop + 14}px`
            tt.style.bottom = flipY ? `${chartH - curTop + 14}px` : 'auto'
            tt.style.display = 'block'
          },
        ],
        ready: [
          (u) => {
            u.over.addEventListener('mouseleave', () => {
              if (tooltipRef.current) tooltipRef.current.style.display = 'none'
            })
          },
        ],
      },
    }

    if (uplotRef.current) {
      uplotRef.current.destroy()
      uplotRef.current = null
    }

    const u = new uPlot(opts, data, containerRef.current)
    uplotRef.current = u

    return () => {
      u.destroy()
      uplotRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedWidth, resolvedHeight, colors, seriesCount])

  // Update data without rebuilding the chart (hot path — runs on every tick).
  useEffect(() => {
    if (!uplotRef.current) return
    const data = latestDataRef.current
    if (data[0].length === 0) return
    uplotRef.current.setData(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestamps, series])

  // Resize when dimensions change but chart already exists
  useEffect(() => {
    if (!uplotRef.current || resolvedWidth === 0) return
    uplotRef.current.setSize({ width: resolvedWidth, height: resolvedHeight })
  }, [resolvedWidth, resolvedHeight])

  const showNoData = timestamps.length === 0

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: isAutoWidth ? '100%' : resolvedWidth, height: isAutoHeight ? '100%' : resolvedHeight, position: 'relative' }}
    >
      {showNoData && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--io-text-muted)',
            fontSize: '13px',
            pointerEvents: 'none',
          }}
        >
          No data
        </div>
      )}

      {/* Tooltip — hidden until cursor moves over chart; updated via direct DOM writes for perf */}
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 50,
          pointerEvents: 'none',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 6,
          padding: '7px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          minWidth: 140,
          maxWidth: 220,
        }}
      />
    </div>
  )
}
