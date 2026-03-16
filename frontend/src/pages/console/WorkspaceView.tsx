import { useParams } from 'react-router-dom'

export default function WorkspaceView() {
  const { workspace_id } = useParams<{ workspace_id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>Workspace</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>
        Workspace ID: {workspace_id} — live multi-pane view (Phase 7)
      </p>
    </div>
  )
}
