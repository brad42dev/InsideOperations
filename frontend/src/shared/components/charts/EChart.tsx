import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as echarts from 'echarts'

export interface EChartProps {
  option: echarts.EChartsOption
  height?: number
  width?: number
  className?: string
  onEvents?: Record<string, (params: unknown) => void>
}

const DEFAULT_HEIGHT = 300

export default function EChart({
  option,
  height = DEFAULT_HEIGHT,
  width,
  className,
  onEvents,
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const prevOptionJson = useRef<string>('')
  const prevEventsRef = useRef<Record<string, (params: unknown) => void>>({})
  const [containerWidth, setContainerWidth] = useState<number>(width ?? 0)

  const isAutoWidth = width === undefined

  // Measure container width via ResizeObserver when width not provided
  useEffect(() => {
    if (!isAutoWidth) return
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isAutoWidth])

  // Sync explicit width
  useEffect(() => {
    if (!isAutoWidth && width !== undefined) setContainerWidth(width)
  }, [isAutoWidth, width])

  // Create / destroy ECharts instance
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el, 'dark')
    chartRef.current = chart

    return () => {
      chart.dispose()
      chartRef.current = null
      prevOptionJson.current = ''
    }
  }, [])

  // Update option when it changes (JSON-equality guard to avoid infinite loops)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const json = JSON.stringify(option)
    if (json === prevOptionJson.current) return
    prevOptionJson.current = json
    chart.setOption(option, { notMerge: false })
  }, [option])

  // Register / update event handlers
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    // Unbind previous handlers
    Object.entries(prevEventsRef.current).forEach(([event, handler]) => {
      chart.off(event, handler)
    })

    const current = onEvents ?? {}
    Object.entries(current).forEach(([event, handler]) => {
      chart.on(event, handler)
    })
    prevEventsRef.current = current
  }, [onEvents])

  // Resize when dimensions change
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.resize()
  }, [containerWidth, height])

  const resolvedWidth = isAutoWidth ? containerWidth : (width ?? 0)

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: isAutoWidth ? '100%' : resolvedWidth,
        height,
      }}
    />
  )
}
