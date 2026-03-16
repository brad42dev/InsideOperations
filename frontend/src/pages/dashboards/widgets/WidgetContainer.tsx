import { memo, useState } from 'react'
import type { WidgetConfig } from '../../../api/dashboards'
import KpiCard from './KpiCard'
import LineChart from './LineChart'
import BarChart from './BarChart'
import PieChart from './PieChart'
import GaugeWidget from './GaugeWidget'
import TableWidget from './TableWidget'
import TextWidget from './TextWidget'
import AlertStatusWidget from './AlertStatusWidget'

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
  editMode?: boolean
  onEdit?: (id: string) => void
  onRemove?: (id: string) => void
}

function WidgetBody({
  config,
  variables,
}: {
  config: WidgetConfig
  variables: Record<string, string[]>
}) {
  switch (config.type) {
    case 'kpi-card':
      return <KpiCard config={config} variables={variables} />
    case 'line-chart':
      return <LineChart config={config} variables={variables} />
    case 'bar-chart':
      return <BarChart config={config} variables={variables} />
    case 'pie-chart':
      return <PieChart config={config} variables={variables} />
    case 'gauge':
      return <GaugeWidget config={config} variables={variables} />
    case 'table':
      return <TableWidget config={config} variables={variables} />
    case 'text':
      return <TextWidget config={config} variables={variables} />
    case 'alert-status':
      return <AlertStatusWidget config={config} variables={variables} />
    default:
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--io-text-muted)',
            fontSize: '12px',
          }}
        >
          Unknown widget type: {config.type}
        </div>
      )
  }
}

function getWidgetTitle(config: WidgetConfig): string {
  const cfg = config.config as Record<string, unknown>
  if (typeof cfg.title === 'string') return cfg.title
  return config.type
}

const WidgetContainer = memo(function WidgetContainer({
  config,
  variables,
  editMode = false,
  onEdit,
  onRemove,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const title = getWidgetTitle(config)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          height: '32px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--io-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>

        {/* 3-dot menu — only in edit mode */}
        {editMode && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '14px',
                lineHeight: 1,
                borderRadius: 4,
              }}
              title="Widget options"
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    minWidth: '140px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    zIndex: 99,
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { label: 'Edit', action: () => { onEdit?.(config.id); setMenuOpen(false) } },
                    { label: 'Export Data', action: () => { setMenuOpen(false) } },
                    { label: 'Remove', action: () => { onRemove?.(config.id); setMenuOpen(false) }, danger: true },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        color: item.danger ? 'var(--io-danger, #ef4444)' : 'var(--io-text-secondary)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'block',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'var(--io-surface-secondary)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Widget body */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <WidgetBody config={config} variables={variables} />
      </div>
    </div>
  )
})

export default WidgetContainer
