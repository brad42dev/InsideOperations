import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as echarts from 'echarts'
import { useThemeName, themeToColorKey } from '../../theme/ThemeContext'
import type { Theme } from '../../theme/tokens'

export interface EChartProps {
  option: echarts.EChartsOption
  height?: number
  width?: number
  className?: string
  onEvents?: Record<string, (params: unknown) => void>
}

const DEFAULT_HEIGHT = 300

/**
 * Map a Theme value ('light' | 'dark' | 'hphmi') to the registered ECharts
 * theme name ('io-light' | 'io-dark' | 'io-high-contrast').
 * These names were registered at app startup in App.tsx.
 */
function toEChartsTheme(theme: Theme): string {
  const key = themeToColorKey(theme) // 'light' | 'dark' | 'high-contrast'
  return `io-${key}`
}

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

  // Subscribe to the active theme from ThemeContext so changes re-render this component
  const theme = useThemeName()
  const echartsThemeName = toEChartsTheme(theme)

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

  // Create / destroy ECharts instance.
  // echartsThemeName is in the dependency array so that a theme change
  // causes dispose + reinit with the new named theme (ECharts does not
  // support hot-swapping the theme via setOption — init time only).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Dispose any existing instance before creating a new one
    if (chartRef.current) {
      chartRef.current.dispose()
      chartRef.current = null
      prevOptionJson.current = ''
    }

    const chart = echarts.init(el, echartsThemeName)
    chartRef.current = chart

    return () => {
      chart.dispose()
      chartRef.current = null
      prevOptionJson.current = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echartsThemeName])

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
