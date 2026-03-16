import { useParams } from 'react-router-dom'

export default function InvestigationEditor() {
  const { id } = useParams<{ id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>Edit Investigation</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>
        Investigation ID: {id} — Phase 13
      </p>
    </div>
  )
}
