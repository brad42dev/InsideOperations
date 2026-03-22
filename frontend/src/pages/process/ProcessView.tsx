import { useParams } from 'react-router-dom'

interface Props {
  /** When true, rendered in a detached window — no AppShell chrome. */
  detached?: boolean
}

export default function ProcessView({ detached: _detached }: Props) {
  const { view_id } = useParams<{ view_id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>Process View</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>
        View ID: {view_id} — large-scale single-pane process view (Phase 7)
      </p>
    </div>
  )
}
