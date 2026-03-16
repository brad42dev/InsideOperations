import type { WidgetConfig } from '../../../api/dashboards'

interface TextWidgetConfig {
  content: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  color?: string
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function TextWidget({ config }: Props) {
  const cfg = config.config as unknown as TextWidgetConfig

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        fontSize: cfg.fontSize ?? 14,
        textAlign: cfg.align ?? 'left',
        color: cfg.color ?? 'var(--io-text-secondary)',
        lineHeight: 1.5,
        overflow: 'auto',
        justifyContent:
          cfg.align === 'center' ? 'center' : cfg.align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cfg.content}</span>
    </div>
  )
}
