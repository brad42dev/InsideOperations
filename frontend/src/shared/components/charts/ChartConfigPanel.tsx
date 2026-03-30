// ---------------------------------------------------------------------------
// ChartConfigPanel — full-screen modal for chart configuration
// Orchestrates: ChartTypePicker + ChartPointSelector + ChartOptionsForm
// Rendered as a viewport-level fixed overlay (panes can be very small).
// ---------------------------------------------------------------------------

import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '../../../api/points'
import type { ChartConfig, ChartTypeId } from './chart-config-types'
import { CHART_SLOTS, SCALING_TAB_CHARTS } from './chart-config-types'
import ChartTypePicker from './ChartTypePicker'
import ChartPointSelector from './ChartPointSelector'
import ChartOptionsForm from './ChartOptionsForm'
import ChartScalingTab from './ChartScalingTab'
import type { ChartContext } from './chart-definitions'

interface ChartConfigPanelProps {
  /** Initial config to populate the panel from */
  initialConfig: ChartConfig
  onSave: (config: ChartConfig) => void
  onClose: () => void
  /** Restricts chart type picker to types available in this context. */
  context?: ChartContext
}

type Tab = 'type' | 'points' | 'scaling' | 'options'

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: 'type',    label: 'Chart Type' },
  { id: 'points',  label: 'Data Points' },
  { id: 'scaling', label: 'Scaling' },
  { id: 'options', label: 'Options' },
]

export default function ChartConfigPanel({ initialConfig, onSave, onClose, context }: ChartConfigPanelProps) {
  const [config, setConfig] = useState<ChartConfig>(() => ({
    durationMinutes: 60,
    ...initialConfig,
  }))
  const [tab, setTab] = useState<Tab>('type')

  // Shared points list — used by both ChartPointSelector and ChartScalingTab
  const { data: listResult } = useQuery({
    queryKey: ['points-list-all'],
    queryFn: () => pointsApi.list({ limit: 2000 }),
    staleTime: 60_000,
  })
  const allPoints = listResult?.success ? listResult.data.data : []
  const pointMeta = new Map(allPoints.map((p) => [p.id, p]))

  // Only show Scaling tab for chart types that have configurable axes
  const TABS = SCALING_TAB_CHARTS.has(config.chartType)
    ? BASE_TABS
    : BASE_TABS.filter((t) => t.id !== 'scaling')

  // Measure sidebar width and topbar height live so the panel sits entirely
  // within the workspace area and never overlaps the top console bar.
  const [sidebarWidth, setSidebarWidth] = useState(0)
  const [topbarHeight, setTopbarHeight] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const sidebar = document.querySelector('.sidebar')
      setSidebarWidth(sidebar ? sidebar.getBoundingClientRect().width : 0)
      const header = document.querySelector('header')
      setTopbarHeight(header ? header.getBoundingClientRect().height : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    const sidebar = document.querySelector('.sidebar')
    const header = document.querySelector('header')
    if (sidebar) ro.observe(sidebar)
    if (header) ro.observe(header)
    return () => ro.disconnect()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // When chart type changes, reset points that don't have valid roles for the new type
  function handleTypeSelect(type: ChartTypeId) {
    const newSlots = CHART_SLOTS[type]
    const validRoles = new Set(newSlots.map((s) => s.id))
    const filteredPoints = config.points.filter((p) => validRoles.has(p.role))
    setConfig((c) => ({ ...c, chartType: type, points: filteredPoints }))
  }

  function patchConfig(patch: Partial<ChartConfig>) {
    setConfig((c) => ({ ...c, ...patch }))
  }

  const slotDefs = CHART_SLOTS[config.chartType]

  const handleSave = useCallback(() => {
    onSave(config)
    onClose()
  }, [config, onSave, onClose])

  // Backdrop covers the workspace area only (right of sidebar, below topbar).
  // Panel is 95% of that area so a sliver of the workspace peeks through.
  const gap = '2.5%'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: topbarHeight,
        left: sidebarWidth,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel — 95% of the workspace area, responsive font size */}
      <div
        style={{
          width: `calc(100% - 2 * ${gap})`,
          height: `calc(100% - 2 * ${gap})`,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          fontSize: 'clamp(12px, 1.3vw, 18px)',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            height: 52,
            borderBottom: '1px solid var(--io-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--io-text-primary)' }}>
            Configure Chart
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: 20,
              lineHeight: 1,
              padding: '4px 6px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--io-text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--io-text-muted)' }}
          >
            ×
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--io-border)',
            background: 'var(--io-surface)',
            flexShrink: 0,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--io-accent)' : '2px solid transparent',
                color: tab === t.id ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 'type' && (
            <div style={{ flex: 1, overflow: 'hidden', padding: 20, display: 'flex', flexDirection: 'column' }}>
              <ChartTypePicker
                selectedType={config.chartType}
                onSelect={handleTypeSelect}
                context={context}
              />
            </div>
          )}

          {tab === 'points' && (
            <div style={{ flex: 1, overflow: 'hidden', padding: 20, display: 'flex', flexDirection: 'column' }}>
              <ChartPointSelector
                slotDefs={slotDefs}
                points={config.points}
                allPoints={allPoints}
                onChange={(pts) => patchConfig({ points: pts })}
              />
            </div>
          )}

          {tab === 'scaling' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <ChartScalingTab
                  chartType={config.chartType}
                  config={config}
                  points={config.points}
                  pointMeta={pointMeta}
                  onChange={patchConfig}
                />
              </div>
            </div>
          )}

          {tab === 'options' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, maxWidth: 640 }}>
                <ChartOptionsForm
                  chartType={config.chartType}
                  config={config}
                  onChange={patchConfig}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid var(--io-border)',
            background: 'var(--io-surface)',
            flexShrink: 0,
            gap: 8,
          }}
        >
          {/* Tab navigation shortcuts */}
          <div style={{ display: 'flex', gap: 6 }}>
            {TABS.map((t, i) => {
              const isCurrent = tab === t.id
              if (isCurrent) return null
              const isPrev = TABS.findIndex((x) => x.id === tab) > i
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: 'var(--io-surface-secondary)',
                    border: '1px solid var(--io-border)',
                    color: 'var(--io-text-muted)',
                    borderRadius: 4,
                    padding: '5px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {isPrev ? `← ${t.label}` : `${t.label} →`}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                color: 'var(--io-text-primary)',
                borderRadius: 6,
                padding: '7px 16px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--io-accent)',
                border: 'none',
                color: '#fff',
                borderRadius: 6,
                padding: '7px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
