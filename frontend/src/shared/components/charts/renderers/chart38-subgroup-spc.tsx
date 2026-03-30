// ---------------------------------------------------------------------------
// Chart 38 — X-bar/R & X-bar/S Subgroup SPC
// Dual-panel chart: top = X-bar (subgroup means), bottom = R (range) or S (std dev).
// Subgrouping modes:
//   Time-based (1 instrument): n consecutive readings form each subgroup.
//   Spatial   (2+ instruments): all instruments at each timestamp = one subgroup.
// Control limit constants per ASTM E2587 / Montgomery "Introduction to SPC".
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import EChart from '../EChart'
import { type ChartConfig } from '../chart-config-types'
import { usePlaybackStore } from '../../../../store/playback'
import { pointsApi } from '../../../../api/points'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

// SPC constants keyed by subgroup size n (2–10)
// A2/A3: X-bar factors; D3/D4: R-chart; B3/B4: S-chart
const SPC_CONSTANTS: Record<number, { A2: number; A3: number; D3: number; D4: number; B3: number; B4: number }> = {
  2:  { A2: 1.880, A3: 2.659, D3: 0,     D4: 3.267, B3: 0,     B4: 3.267 },
  3:  { A2: 1.023, A3: 1.954, D3: 0,     D4: 2.574, B3: 0,     B4: 2.568 },
  4:  { A2: 0.729, A3: 1.628, D3: 0,     D4: 2.282, B3: 0,     B4: 2.266 },
  5:  { A2: 0.577, A3: 1.427, D3: 0,     D4: 2.114, B3: 0,     B4: 2.089 },
  6:  { A2: 0.483, A3: 1.287, D3: 0,     D4: 2.004, B3: 0.030, B4: 1.970 },
  7:  { A2: 0.419, A3: 1.182, D3: 0.076, D4: 1.924, B3: 0.118, B4: 1.882 },
  8:  { A2: 0.373, A3: 1.099, D3: 0.136, D4: 1.864, B3: 0.185, B4: 1.815 },
  9:  { A2: 0.337, A3: 1.032, D3: 0.184, D4: 1.816, B3: 0.239, B4: 1.761 },
  10: { A2: 0.308, A3: 0.975, D3: 0.223, D4: 1.777, B3: 0.284, B4: 1.716 },
}

function clampN(n: number): number {
  return Math.max(2, Math.min(10, Math.round(n)))
}

interface Subgroup {
  centerMs: number
  values: number[]
  xbar: number
  r: number
  s: number
}

function buildSubgroupsSpatial(
  historyBatch: { point_id: string; rows: { timestamp: string; value: number | null }[] }[],
  pointIds: string[],
): Subgroup[] {
  // Collect all timestamps and join across instruments
  const tsMap = new Map<string, Map<string, number>>()

  for (const batch of historyBatch) {
    for (const row of batch.rows) {
      if (row.value === null) continue
      if (!tsMap.has(row.timestamp)) tsMap.set(row.timestamp, new Map())
      tsMap.get(row.timestamp)!.set(batch.point_id, row.value)
    }
  }

  const result: Subgroup[] = []
  for (const [ts, pointVals] of tsMap) {
    // Only include time points where all instruments have data
    const vals = pointIds.map((pid) => pointVals.get(pid)).filter((v): v is number => v !== undefined)
    if (vals.length < 2) continue

    const n = vals.length
    const xbar = vals.reduce((a, b) => a + b, 0) / n
    const r = Math.max(...vals) - Math.min(...vals)
    const mean = xbar
    const s = Math.sqrt(vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1))

    result.push({ centerMs: new Date(ts).getTime(), values: vals, xbar, r, s })
  }

  return result.sort((a, b) => a.centerMs - b.centerMs)
}

function buildSubgroupsTimeBased(
  rows: { timestamp: string; value: number | null }[],
  n: number,
): Subgroup[] {
  const valid = rows
    .filter((r) => r.value !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const result: Subgroup[] = []
  for (let i = 0; i + n <= valid.length; i += n) {
    const chunk = valid.slice(i, i + n)
    const vals = chunk.map((r) => r.value as number)
    const xbar = vals.reduce((a, b) => a + b, 0) / n
    const r = Math.max(...vals) - Math.min(...vals)
    const s = Math.sqrt(vals.reduce((acc, v) => acc + (v - xbar) ** 2, 0) / (n - 1))
    // Center time is midpoint of the subgroup
    const centerMs = (new Date(chunk[0].timestamp).getTime() + new Date(chunk[n - 1].timestamp).getTime()) / 2
    result.push({ centerMs, values: vals, xbar, r, s })
  }
  return result
}

// Western Electric Rules (4 standard rules)
function weViolation(values: number[], mean: number, sigma: number, i: number): boolean {
  const v = values[i]
  if (Math.abs(v - mean) > 3 * sigma) return true
  if (i >= 8) {
    const side = v > mean ? 1 : -1
    if (values.slice(i - 8, i + 1).every((x) => (x > mean ? 1 : -1) === side)) return true
  }
  if (i >= 5) {
    const seg = values.slice(i - 5, i + 1)
    let up = true, dn = true
    for (let j = 1; j < seg.length; j++) {
      if (seg[j] <= seg[j - 1]) up = false
      if (seg[j] >= seg[j - 1]) dn = false
    }
    if (up || dn) return true
  }
  if (i >= 2) {
    const seg = [values[i - 2], values[i - 1], values[i]]
    if (seg.filter((x) => x > mean + 2 * sigma).length >= 2) return true
    if (seg.filter((x) => x < mean - 2 * sigma).length >= 2) return true
  }
  return false
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

export default function SubgroupSPCChart({ config }: RendererProps) {
  const instrumentSlots = config.points.filter((p) => p.role === 'instrument')
  const durationMinutes = config.durationMinutes ?? 60 * 24

  const subchartType = (config.extras?.subchartType as string) ?? 'R'
  const subgroupSize = clampN(
    typeof config.extras?.subgroupSize === 'number' ? config.extras.subgroupSize : 5
  )
  const showWERules = config.extras?.showWERules !== false

  const { mode: playbackMode, timeRange } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  const windowEndMs = isHistorical ? new Date(timeRange.end).getTime() : Date.now()
  const windowStartMs = isHistorical
    ? new Date(timeRange.start).getTime()
    : windowEndMs - durationMinutes * 60 * 1000

  const end = new Date(windowEndMs).toISOString()
  const start = new Date(windowStartMs).toISOString()

  const isSpatial = instrumentSlots.length >= 2
  const subgroupMode = isSpatial ? 'spatial' : 'time-based'
  const effectiveN = isSpatial ? instrumentSlots.length : subgroupSize

  const pointIds = instrumentSlots.map((s) => s.pointId)

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ['history-batch', ...pointIds, start, end, 'subgroup-spc'],
    queryFn: () => pointsApi.historyBatch(pointIds, { start, end, limit: 5000 }),
    enabled: pointIds.length > 0,
    refetchInterval: isHistorical ? false : 60_000,
    select: (res) => (res.success ? res.data : []),
  })

  const subgroups = useMemo(() => {
    if (!historyBatch || historyBatch.length === 0) return []
    if (isSpatial) {
      return buildSubgroupsSpatial(historyBatch, pointIds)
    } else {
      const batch = historyBatch.find((b) => b.point_id === pointIds[0])
      if (!batch) return []
      return buildSubgroupsTimeBased(batch.rows, subgroupSize)
    }
  }, [historyBatch, isSpatial, pointIds, subgroupSize])

  const { xbarStats, dispStats, labels } = useMemo(() => {
    if (subgroups.length < 2) return { xbarStats: null, dispStats: null, labels: [] }

    const n = clampN(effectiveN)
    const consts = SPC_CONSTANTS[n] ?? SPC_CONSTANTS[5]

    const xbarVals = subgroups.map((g) => g.xbar)
    const xbarBar = xbarVals.reduce((a, b) => a + b, 0) / xbarVals.length

    const useS = subchartType === 'S'
    const dispVals = subgroups.map((g) => (useS ? g.s : g.r))
    const dispBar = dispVals.reduce((a, b) => a + b, 0) / dispVals.length

    // X-bar control limits
    const xbarFactor = useS ? consts.A3 : consts.A2
    const xbarUCL = xbarBar + xbarFactor * dispBar
    const xbarLCL = xbarBar - xbarFactor * dispBar

    // Dispersion control limits
    const dispUCL = useS ? consts.B4 * dispBar : consts.D4 * dispBar
    const dispLCL = useS ? consts.B3 * dispBar : consts.D3 * dispBar

    // Sigma for WE rules on X-bar chart
    const xbarSigma = (xbarUCL - xbarBar) / 3

    // WE violation flags
    const xbarViolations = xbarVals.map((_, i) =>
      showWERules ? weViolation(xbarVals, xbarBar, xbarSigma, i) : false
    )

    const labels = subgroups.map((g) =>
      new Date(g.centerMs).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    )

    return {
      xbarStats: { vals: xbarVals, mean: xbarBar, ucl: xbarUCL, lcl: xbarLCL, violations: xbarViolations },
      dispStats: { vals: dispVals, mean: dispBar, ucl: dispUCL, lcl: dispLCL },
      labels,
    }
  }, [subgroups, effectiveN, subchartType, showWERules])

  const option: EChartsOption = useMemo(() => {
    if (!xbarStats || !dispStats) return {}

    const textMuted = resolveToken('--io-text-muted')
    const borderColor = resolveToken('--io-border')

    const nPoints = xbarStats.vals.length
    const xlabels = labels

    const constLine = (val: number, color: string) => ({
      type: 'line' as const,
      data: Array(nPoints).fill(val),
      symbol: 'none',
      lineStyle: { color, width: 1, type: 'dashed' as const },
      silent: true,
    })

    // Violation scatter — only non-null at violation indices
    const xbarViolationData = xbarStats.vals.map((v, i) =>
      xbarStats.violations[i] ? v : null
    )

    return {
      backgroundColor: 'transparent',
      grid: [
        { left: 56, right: 24, top: 20, bottom: '55%' },
        { left: 56, right: 24, top: '50%', bottom: 40 },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: unknown) => {
          const ps = params as { axisValueLabel: string; seriesName: string; value: number | null }[]
          if (!ps.length) return ''
          const label = ps[0].axisValueLabel
          const lines = ps
            .filter((p) => p.value !== null && p.seriesName !== 'X-bar Violations')
            .map((p) => `${p.seriesName}: ${typeof p.value === 'number' ? p.value.toFixed(3) : '—'}`)
          return [label, ...lines].join('<br/>')
        },
      },
      xAxis: [
        {
          gridIndex: 0,
          type: 'category',
          data: xlabels,
          axisLabel: { show: false },
          axisLine: { lineStyle: { color: borderColor } },
          axisTick: { show: false },
        },
        {
          gridIndex: 1,
          type: 'category',
          data: xlabels,
          axisLabel: { color: textMuted, fontSize: 9, rotate: 30 },
          axisLine: { lineStyle: { color: borderColor } },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          gridIndex: 0,
          name: 'X̄',
          nameTextStyle: { color: textMuted, fontSize: 10 },
          axisLabel: { color: textMuted, fontSize: 9 },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: borderColor, type: 'dashed' } },
        },
        {
          gridIndex: 1,
          name: subchartType === 'S' ? 'S' : 'R',
          nameTextStyle: { color: textMuted, fontSize: 10 },
          axisLabel: { color: textMuted, fontSize: 9 },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: borderColor, type: 'dashed' } },
          min: 0,
        },
      ],
      series: [
        // ── X-bar panel ──
        {
          name: 'X̄',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: xbarStats.vals,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: '#4A9EFF', width: 1.5 },
          itemStyle: { color: '#4A9EFF' },
        },
        { ...constLine(xbarStats.mean, '#10B981'), name: 'X̄ Mean', xAxisIndex: 0, yAxisIndex: 0 },
        { ...constLine(xbarStats.ucl, '#EF4444'), name: 'UCL', xAxisIndex: 0, yAxisIndex: 0 },
        { ...constLine(xbarStats.lcl, '#EF4444'), name: 'LCL', xAxisIndex: 0, yAxisIndex: 0 },
        {
          name: 'X-bar Violations',
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: xbarViolationData,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#EF4444', borderColor: '#fff', borderWidth: 1 },
          silent: true,
        },
        // ── Dispersion panel ──
        {
          name: subchartType === 'S' ? 'S (Std Dev)' : 'R (Range)',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: dispStats.vals,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: '#8B5CF6', width: 1.5 },
          itemStyle: { color: '#8B5CF6' },
        },
        { ...constLine(dispStats.mean, '#10B981'), name: `${subchartType === 'S' ? 'S' : 'R'} Mean`, xAxisIndex: 1, yAxisIndex: 1 },
        { ...constLine(dispStats.ucl, '#EF4444'), name: `${subchartType === 'S' ? 'S' : 'R'} UCL`, xAxisIndex: 1, yAxisIndex: 1 },
        ...(dispStats.lcl > 0
          ? [{ ...constLine(dispStats.lcl, '#EF4444'), name: `${subchartType === 'S' ? 'S' : 'R'} LCL`, xAxisIndex: 1, yAxisIndex: 1 }]
          : []),
      ],
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xbarStats, dispStats, labels, subchartType])

  if (instrumentSlots.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
        Assign measurement instruments in the Data Points tab
      </div>
    )
  }

  const insufficientData = !isLoading && subgroups.length < 2

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      {isLoading && (
        <div style={{ position: 'absolute', top: 4, right: 8, fontSize: 11, color: 'var(--io-text-muted)', zIndex: 10, pointerEvents: 'none' }}>
          Loading…
        </div>
      )}
      <div style={{ position: 'absolute', top: 4, left: 8, fontSize: 10, color: 'var(--io-text-muted)', zIndex: 10, pointerEvents: 'none' }}>
        {subgroupMode === 'spatial'
          ? `Spatial — n=${effectiveN} instruments`
          : `Time-based — n=${subgroupSize} per subgroup`}
        {' · '}X̄/{subchartType}
      </div>
      {insufficientData && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13, paddingTop: 40 }}>
          Insufficient subgroups — need at least 2 ({subgroups.length} formed)
        </div>
      )}
      {!insufficientData && subgroups.length >= 2 && (
        <EChart option={option} />
      )}
    </div>
  )
}
