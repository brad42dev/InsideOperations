import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

export interface Series {
  label: string
  data: number[]
  color?: string
  strokeWidth?: number
}

export interface TimeSeriesChartProps {
  timestamps: number[]
  series: Series[]
  height?: number
  width?: number
  className?: string
}

const DEFAULT_HEIGHT = 300
const DEFAULT_COLOR = '#4A9EFF'

export default function TimeSeriesChart({
  timestamps,
  series,
  height = DEFAULT_HEIGHT,
  width,
  className,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(width ?? 0)

  // Track controlled vs auto width
  const isAutoWidth = width === undefined

  // Measure container width via ResizeObserver when width not provided
  useEffect(() => {
    if (!isAutoWidth) return
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isAutoWidth])

  // When explicit width changes, sync state
  useEffect(() => {
    if (!isAutoWidth && width !== undefined) {
      setContainerWidth(width)
    }
  }, [isAutoWidth, width])

  const resolvedWidth = isAutoWidth ? containerWidth : (width ?? 0)

  // Build uPlot instance
  useEffect(() => {
    if (!containerRef.current || resolvedWidth === 0) return
    if (timestamps.length === 0) {
      // No data — destroy any existing instance and bail
      uplotRef.current?.destroy()
      uplotRef.current = null
      return
    }

    const uplotSeries: uPlot.Series[] = [
      {}, // x axis (time)
      ...series.map((s) => ({
        label: s.label,
        stroke: s.color ?? DEFAULT_COLOR,
        width: s.strokeWidth ?? 1.5,
      })),
    ]

    const data: uPlot.AlignedData = [
      timestamps,
      ...series.map((s) => s.data),
    ]

    const opts: uPlot.Options = {
      width: resolvedWidth,
      height,
      series: uplotSeries,
      legend: { show: false },
      axes: [
        {
          // x axis — time
          stroke: 'var(--io-text-muted, #888)',
          ticks: { stroke: 'var(--io-border, #333)' },
          grid: { stroke: 'var(--io-border, #333)', width: 1 },
        },
        {
          // y axis — auto-scale
          stroke: 'var(--io-text-muted, #888)',
          ticks: { stroke: 'var(--io-border, #333)' },
          grid: { stroke: 'var(--io-border, #333)', width: 1 },
        },
      ],
      scales: {
        x: { time: true },
      },
      cursor: {
        drag: { x: true, y: false },
      },
    }

    // Destroy previous instance if present
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
  }, [resolvedWidth, height])

  // Update data without rebuilding the chart
  useEffect(() => {
    if (!uplotRef.current || timestamps.length === 0) return
    const data: uPlot.AlignedData = [
      timestamps,
      ...series.map((s) => s.data),
    ]
    uplotRef.current.setData(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestamps, series])

  // Resize when dimensions change but chart already exists
  useEffect(() => {
    if (!uplotRef.current || resolvedWidth === 0) return
    uplotRef.current.setSize({ width: resolvedWidth, height })
  }, [resolvedWidth, height])

  const showNoData = timestamps.length === 0

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: isAutoWidth ? '100%' : resolvedWidth, height, position: 'relative' }}
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
    </div>
  )
}
