import type { WidgetConfig } from '../../../api/dashboards'

interface Props {
  config: WidgetConfig
}

/**
 * Fallback widget rendered for any widget type that has no dedicated
 * implementation. Displays the widget title and type in a muted
 * placeholder card so dashboards remain navigable without errors.
 */
export default function PlaceholderWidget({ config }: Props) {
  const cfg = config.config as Record<string, unknown>
  const title = typeof cfg.title === 'string' ? cfg.title : config.type

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px',
        color: 'var(--io-text-muted)',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--io-text-secondary)',
          textAlign: 'center',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: '11px',
          fontFamily: 'var(--io-font-mono, monospace)',
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '4px',
          padding: '2px 6px',
          color: 'var(--io-text-muted)',
        }}
      >
        {config.type}
      </span>
    </div>
  )
}
