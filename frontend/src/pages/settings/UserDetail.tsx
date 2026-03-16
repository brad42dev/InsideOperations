import { useParams } from 'react-router-dom'

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)' }}>User Detail</h2>
      <p style={{ color: 'var(--io-text-secondary)' }}>User ID: {id}</p>
    </div>
  )
}
