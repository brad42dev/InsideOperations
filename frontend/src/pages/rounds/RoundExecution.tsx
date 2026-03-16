import { useParams } from 'react-router-dom'

export default function RoundExecution() {
  const { instance_id } = useParams<{ instance_id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>Execute Round</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>
        Instance ID: {instance_id} — mobile-optimised checklist execution (Phase 13)
      </p>
    </div>
  )
}
