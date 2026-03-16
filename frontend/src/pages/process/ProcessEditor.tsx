import { useParams } from 'react-router-dom'

export default function ProcessEditor() {
  const { view_id } = useParams<{ view_id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>Edit Process View</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>
        View ID: {view_id} — process view editor (Phase 7)
      </p>
    </div>
  )
}
